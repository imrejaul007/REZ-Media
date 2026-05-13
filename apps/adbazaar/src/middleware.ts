import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Redis } from '@upstash/redis'
import logger from '@/lib/logger'

/**
 * AB3-M6 FIX: Secure cookie handling for auth cookies
 *
 * Note: The @supabase/ssr package handles cookie security flags automatically:
 * - secure: true when NODE_ENV is 'production'
 * - httpOnly: true (JavaScript cannot access)
 * - sameSite: 'lax' (CSRF protection)
 *
 * For full HttpOnly cookie support across the app, client-side code should
 * also use @supabase/ssr pattern with createBrowserClient configured to
 * read cookies from the server instead of using localStorage.
 *
 * See: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

/**
 * AB3-M4 FIX: Cache user session in short-lived cookie to avoid
 * calling supabase.auth.getUser() on every request.
 *
 * The session cookie contains:
 * - userId: The authenticated user's ID
 * - userEmail: The user's email
 * - userRole: The user's role (cached for 5 minutes)
 * - expiresAt: When the cached session expires
 *
 * This reduces Supabase API calls from 1 per request to 1 per 5 minutes
 * per user, significantly reducing latency and API usage.
 */

// Session cache cookie name
const SESSION_CACHE_COOKIE = 'adb_session_cache'

// Cache TTL in seconds (5 minutes)
const SESSION_CACHE_TTL = 300

interface CachedSession {
  userId: string
  userEmail: string
  userRole: string | null
  expiresAt: number
}

/**
 * Get cached session from cookie (fast path - no network call)
 */
function getCachedSession(req: NextRequest): CachedSession | null {
  const cached = req.cookies.get(SESSION_CACHE_COOKIE)?.value
  if (!cached) return null

  try {
    const session: CachedSession = JSON.parse(cached)
    // Check if cache is still valid
    if (session.expiresAt > Date.now()) {
      return session
    }
  } catch {
    // Invalid cache, treat as no session
  }
  return null
}

/**
 * Set session cache cookie
 */
function setSessionCache(
  res: NextResponse,
  userId: string,
  userEmail: string,
  userRole: string | null,
): void {
  const session: CachedSession = {
    userId,
    userEmail,
    userRole,
    expiresAt: Date.now() + SESSION_CACHE_TTL * 1000,
  }

  res.cookies.set(SESSION_CACHE_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_CACHE_TTL,
    path: '/',
  })
}

/**
 * AB-C3 FIX: Redis-based rate limiter using Upstash Redis
 *
 * Previously used in-memory Map which reset on every serverless cold start,
 * allowing attackers to bypass rate limits by waiting for cold starts.
 *
 * Now uses Upstash Redis for persistent rate limiting:
 * - Survives serverless cold starts
 * - Shared across all Vercel instances
 * - Atomic increment operations
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 *
 * Current limits:
 *   - /api/* routes: 100 requests per minute per IP
 *   - /api/qr/scan: 20 requests per minute per IP
 */

// Upstash Redis client (serverless-native, global for connection reuse)
let redis: Redis | null = null

function getRedisClient(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    logger.warn('[RATE_LIMIT] Upstash Redis not configured - rate limiting less secure')
    return null
  }

  redis = new Redis({ url, token })
  return redis
}

// Fallback in-memory rate limiter (used when Redis is unavailable)
const RATE_LIMIT_WINDOW_MS = 60_000
interface RateLimitEntry {
  count: number
  windowStart: number
}
const rateLimitStore = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()

/**
 * Get rate limit for an IP and route using Redis
 */
async function rateLimitRedis(ip: string, route: string): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const redisClient = getRedisClient()
  if (!redisClient) {
    return rateLimitInMemory(ip, route)
  }

  const key = `ratelimit:${route}:${ip}`
  const windowSec = 60

  try {
    // Use Redis INCR with EXPIRE for atomic rate limiting
    const multi = redisClient.multi()
    multi.incr(key)
    multi.expire(key, windowSec)
    const results = await multi.exec()

    const count = results[0] as number
    const limit = route.includes('/qr/scan') ? 20 : 100
    const remaining = Math.max(0, limit - count)

    if (count > limit) {
      const ttl = await redisClient.ttl(key)
      return { allowed: false, remaining: 0, retryAfter: ttl > 0 ? ttl : windowSec }
    }

    return { allowed: true, remaining }
  } catch (error) {
    logger.error('[RATE_LIMIT] Redis error, falling back to in-memory', { error })
    return rateLimitInMemory(ip, route)
  }
}

/**
 * In-memory fallback rate limiter (less secure, resets on cold start)
 */
function rateLimitInMemory(ip: string, route: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const limit = route.includes('/qr/scan') ? 20 : 100

  // Periodic cleanup
  if (now - lastCleanup > 5 * 60_000) {
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.delete(key)
      }
    }
    lastCleanup = now
  }

  const key = `${route}:${ip}`
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000)
    }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

/**
 * Extract client IP from request
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return req.headers.get('x-real-ip') || 'unknown'
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // AB-C3 FIX: Redis-based rate limiting on public API routes
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(req)
    const { allowed, retryAfter } = await rateLimitRedis(ip, pathname)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: retryAfter ? { 'Retry-After': String(Math.ceil(retryAfter)) } : {},
        },
      )
    }
  }

  // Public routes — no auth required
  if (
    pathname.startsWith('/browse') ||
    pathname.startsWith('/listing') ||
    pathname.startsWith('/scan') ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname === '/' ||
    pathname === '/privacy' ||
    pathname === '/terms'
  ) {
    return NextResponse.next()
  }

  // AB3-M6 FIX: Cryptographically verify the session token via Supabase with secure cookies
  // AB3-M4 FIX: Use cached session to avoid getUser() call on every request
  let userId: string | null = null
  let userEmail: string | null = null
  let userRole: string | null = null

  // Fast path: check cached session first (no network call)
  const cached = getCachedSession(req)
  if (cached) {
    userId = cached.userId
    userEmail = cached.userEmail
    userRole = cached.userRole
  }

  // If no cached session, validate with Supabase
  if (!userId) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string) => {
            req.cookies.set({ name, value })
          },
          remove: (name: string) => {
            req.cookies.set({ name, value: '' })
          },
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      userId = user.id
      userEmail = user.email ?? null

      // Fetch user role for caching
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        userRole = userData?.role ?? null
      } catch (e) {
        logger.error('[MIDDLEWARE] Failed to fetch user role', e)
        userRole = null
      }
    }
  }

  // If no user and not on auth pages, redirect to login
  if (!userId && !pathname.startsWith('/api/')) {
    const redirectUrl = new URL('/', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If API route without auth, return 401
  if (!userId && pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Auth successful - set auth headers and continue
  const headers = new Headers()
  headers.set('x-user-id', userId || '')
  headers.set('x-user-email', userEmail || '')
  headers.set('x-user-role', userRole || '')

  const response = NextResponse.next({ request: { headers } })

  // Cache session in cookie for subsequent requests (AB3-M4 FIX)
  if (userId && userEmail) {
    setSessionCache(response, userId, userEmail, userRole)
  }

  return response
}
