/**
 * DOOH Screen App - Security Middleware
 *
 * Provides authentication and rate limiting for API routes.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get allowed origins from environment
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://rezapp.com', 'https://www.rezapp.com'];

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Check rate limit for an IP
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now();
  let record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, record);
  }

  record.count++;

  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count);
  const reset = Math.ceil(record.resetTime / 1000);

  return {
    allowed: record.count <= RATE_LIMIT_MAX_REQUESTS,
    remaining,
    reset,
  };
}

/**
 * Validate internal service token
 */
function validateInternalToken(token: string | null): boolean {
  if (!token) return false;

  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expectedToken) {
    console.warn('[AUTH] INTERNAL_SERVICE_TOKEN not configured');
    return false;
  }

  // Timing-safe comparison
  if (token.length !== expectedToken.length) return false;
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate screen API key
 */
function validateScreenApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;

  const validKey = process.env.DOOH_API_KEY;
  if (!validKey) {
    console.warn('[AUTH] DOOH_API_KEY not configured');
    return false;
  }

  if (apiKey.length !== validKey.length) return false;
  let result = 0;
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ validKey.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Main middleware function
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip health check
  if (pathname === '/api/heartbeat' && request.method === 'GET') {
    return NextResponse.next();
  }

  // Get client IP for rate limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // Check rate limit
  const rateLimit = checkRateLimit(ip);

  const response = new NextResponse();

  // Add rate limit headers
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(rateLimit.reset));

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.reset },
      { status: 429, headers: response.headers }
    );
  }

  // Validate authentication for protected routes
  const isScreenRoute = pathname.includes('/playlist') ||
                        pathname.includes('/heartbeat') ||
                        pathname.includes('/register');

  if (isScreenRoute) {
    // Screen routes can use API key authentication
    const apiKey = request.headers.get('x-api-key');
    if (!validateScreenApiKey(apiKey)) {
      console.warn(`[AUTH] Invalid API key from ${ip} for ${pathname}`);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid API key' },
        { status: 401, headers: response.headers }
      );
    }
  } else {
    // Other routes require internal token
    const token = request.headers.get('x-internal-token');
    if (!validateInternalToken(token)) {
      console.warn(`[AUTH] Invalid token from ${ip} for ${pathname}`);
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid authentication token required' },
        { status: 401, headers: response.headers }
      );
    }
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Add request ID for tracing
  const requestId =
    request.headers.get('x-request-id') ||
    `dooh-app-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  response.headers.set('X-Request-Id', requestId);

  return response;
}

/**
 * Configure which routes the middleware applies to
 */
export const config = {
  matcher: ['/api/:path*'],
};
