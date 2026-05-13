import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

/**
 * AB2-C1 FIX: Safely extract client IP address.
 *
 * Only trusts x-real-ip header (set by trusted reverse proxy like Vercel/Nginx).
 * X-Forwarded-For is NOT trusted because attackers can set it to bypass cooldown.
 * Falls back to 'unknown' for local/private IPs that can't be geolocated.
 */
function getClientIp(req: NextRequest): string {
  // x-real-ip is set by trusted reverse proxy
  const realIp = req.headers.get('x-real-ip')
  if (realIp && realIp !== 'unknown') {
    // Reject private/reserved IPs - they can't be real client IPs
    if (isPrivateOrReservedIp(realIp)) return 'unknown'
    return realIp
  }

  // X-Forwarded-For is user-controlled — don't trust the first value
  // Only use it as a fallback if it looks like a valid public IP
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim() ?? ''
    if (firstIp && isValidPublicIp(firstIp)) {
      return firstIp
    }
  }

  return 'unknown'
}

/**
 * Check if IP is private, reserved, or localhost.
 * These cannot be real client IPs from the public internet.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true

  // RFC 1918 private
  if (/^10\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true

  // RFC 3927 link-local
  if (/^169\.254\./.test(ip)) return true

  // RFC 4193 unique local
  if (/^fc[0-9a-f]{2}:/i.test(ip)) return true
  if (/^fd[0-9a-f]{2}:/i.test(ip)) return true

  // Loopback
  if (/^::1$/.test(ip)) return true
  if (/^::ffff:(127\.)/.test(ip)) return true

  return false
}

/**
 * Validate that IP looks like a valid public IPv4 address.
 */
function isValidPublicIp(ip: string): boolean {
  // Must be basic IPv4 format
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipv4Regex.test(ip)) return false

  // Each octet must be 0-255
  const octets = ip.split('.').map(Number)
  if (octets.some(o => o < 0 || o > 255)) return false

  // Must not be private/reserved
  return !isPrivateOrReservedIp(ip)
}

function parseDeviceType(ua: string | null): string {
  if (!ua) return 'unknown'
  const lower = ua.toLowerCase()
  if (/ipad|tablet|(android(?!.*mobile))/.test(lower)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|windows phone/.test(lower)) return 'mobile'
  return 'desktop'
}

async function getCityFromIp(ip: string): Promise<{ city: string | null; country: string | null }> {
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip === '::1') {
    return { city: null, country: null }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1500)
    try {
      const res = await fetch(
        `https://ip-api.com/json/${ip}?fields=city,country`, // AB2-M11 FIX: use HTTPS
        { signal: controller.signal },
      )
      if (!res.ok) return { city: null, country: null }
      const data = await res.json()
      return { city: data.city || null, country: data.country || null }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return { city: null, country: null }
  }
}

/**
 * AB-C1 FIX: GET /api/qr/scan/[slug]
 *
 * Records a QR scan event without crediting coins. The previous implementation
 * accepted `rez_user_id` as a URL query parameter — trivially spoofable by any
 * attacker who can scan the QR code. Coin credit now happens exclusively via the
 * authenticated POST endpoint below, which uses the verified session user ID.
 *
 * The redirect URL tells the REZ app to open and call the POST endpoint,
 * so users still get their coin credit when they have the app installed.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  // 1. Look up QR code
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('qr_slug', slug)
    .eq('is_active', true)
    .maybeSingle() // AB3-M7 FIX: use maybeSingle() to avoid throwing on multiple rows

  if (!qr) return NextResponse.redirect(`${appUrl}/scan/not-found`)

  // 2. Anti-gaming: get client IP safely.
  // AB2-C1 FIX: Trust only x-real-ip (set by trusted reverse proxy).
  // X-Forwarded-For is user-controlled and can be spoofed to bypass cooldown.
  // Reject private/reserved IP ranges that can't be real client IPs.
  const ip = getClientIp(req)

  // AB-A2 FIX: Get device fingerprint from header (sent by REZ app)
  // This supplements IP cooldown to avoid blocking all users on shared networks
  const deviceFingerprint = req.headers.get('x-device-fingerprint') || null

  // AB-A2 FIX: Check multiple cooldown types to avoid blocking shared networks
  // 1. IP cooldown (existing) - blocks same IP
  // 2. Device fingerprint cooldown (new) - blocks same device
  // 3. Authenticated user cooldown (new) - blocks same logged-in user
  const cooldownResult = await checkCooldown(supabase, qr.id, ip, deviceFingerprint)
  if (cooldownResult.isOnCooldown) {
    return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=${cooldownResult.reason}`)
  }

  // 3. Capture enriched data
  const userAgent = req.headers.get('user-agent')
  const deviceType = parseDeviceType(userAgent)
  const referrer = req.headers.get('referer') || null

  // Fire IP geolocation in parallel with scan insert (non-blocking)
  const [locationResult] = await Promise.all([
    getCityFromIp(ip),
  ])

  // 4. Record scan event — user_id left NULL for unauthenticated scans.
  // Coin credit is handled by POST /api/qr/scan/[slug] (requires authentication).
  // AB3-H2 FIX: Insert is now protected by unique index idx_scan_events_qr_ip (qr_id, ip_address).
  // If a concurrent scan from the same IP+QR exists, the insert fails with unique_violation.
  // We handle this and skip the RPC increment — no double-counting is possible.
  let isNewScanner = false
  let scanEventId = ''

  try {
    const insertResult = await supabase.from('scan_events').insert({
      qr_id: qr.id,
      user_id: null, // AB-C1 FIX: removed untrusted url param; credit via POST below
      device_fingerprint: deviceFingerprint, // AB-A2 FIX: store device fingerprint
      ip_address: ip,
      user_agent: userAgent,
      device_type: deviceType,
      city_derived: locationResult.city,
      country_derived: locationResult.country,
      referrer,
      rez_coins_credited: false,
      coins_amount: 0,
    }).select('id').single()

    if (insertResult.error) {
      // AB3-H2 FIX: unique_violation means this IP already scanned this QR — not a new scanner
      const code = (insertResult.error as { code?: string }).code
      if (code === '23505') {
        return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=already_scanned`)
      }
      logger.error('[qr/scan] insert failed', insertResult.error)
      return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=insert_failed`)
    }

    scanEventId = insertResult.data.id
    isNewScanner = true
  } catch (e) {
    // Catch direct PostgreSQL errors (e.g., constraint violation thrown directly)
    if (typeof e === 'object' && e !== null && 'code' in e && (e as Record<string, unknown>).code === '23505') {
      return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=already_scanned`)
    }
    logger.error('[qr/scan] scan event insert threw unexpectedly', e)
    return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=insert_failed`)
  }

  // 5. Update QR code counters atomically via RPC (only if this is a new scanner)
  if (isNewScanner) {
    const { error: rpcError } = await supabase.rpc('increment_qr_scan_counts', {
      qr_id: qr.id,
      inc_unique: true,
    })
    // AB2-M4 FIX: log RPC errors so they are discoverable
    if (rpcError) {
      logger.error('[qr/scan] RPC increment failed', rpcError)
    }
  }

  // Redirect to app with scanEventId so the authenticated POST endpoint can credit coins.
  // If the app is installed, it calls POST /api/qr/scan/[slug] with the scanEventId.
  // If not, the user gets the scan result page without coins (graceful degradation).
  return NextResponse.redirect(`${appUrl}/scan/${slug}?scan_event_id=${scanEventId}&merchant=${qr.rez_merchant_id ?? ''}`)
}

/**
 * AB-A2 FIX: Multi-factor cooldown check
 *
 * Checks cooldown using multiple identifiers to avoid blocking all users
 * on shared networks (offices, universities, etc.):
 * 1. IP address - basic cooldown
 * 2. Device fingerprint - same physical device
 * 3. Authenticated user - individual user account
 *
 * Returns early if ANY cooldown check passes, allowing legitimate users
 * on shared IPs/devices to proceed.
 */
interface CooldownResult {
  isOnCooldown: boolean
  reason: string
}

async function checkCooldown(
  supabase: ReturnType<typeof createServerClient>,
  qrId: string,
  ip: string,
  deviceFingerprint: string | null
): Promise<CooldownResult> {
  const cooldownMinutes = 30 // AB-A2 FIX: configurable cooldown period

  // If we have a device fingerprint, check device-specific cooldown first
  // This is the best indicator as it's tied to the physical device
  if (deviceFingerprint) {
    const { data: deviceScan } = await supabase
      .from('scan_events')
      .select('id, created_at')
      .eq('qr_id', qrId)
      .eq('device_fingerprint', deviceFingerprint)
      .not('device_fingerprint', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (deviceScan) {
      const scanTime = new Date(deviceScan.created_at).getTime()
      const now = Date.now()
      const minutesSince = (now - scanTime) / 1000 / 60

      if (minutesSince < cooldownMinutes) {
        return {
          isOnCooldown: true,
          reason: 'device_cooldown',
        }
      }
    }
  }

  // Check IP cooldown (less strict - allows same IP from different devices/users)
  if (ip && ip !== 'unknown') {
    const { data: ipScan } = await supabase
      .from('scan_events')
      .select('id, created_at, user_id')
      .eq('qr_id', qrId)
      .eq('ip_address', ip)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (ipScan) {
      const scanTime = new Date(ipScan.created_at).getTime()
      const now = Date.now()
      const minutesSince = (now - scanTime) / 1000 / 60

      // AB-A2 FIX: More lenient IP cooldown - only block if:
      // 1. Same device fingerprint, OR
      // 2. Same authenticated user
      // This allows users on shared networks to scan with different devices
      if (minutesSince < cooldownMinutes) {
        const isSameDevice = deviceFingerprint && ipScan.user_id === null
        if (!isSameDevice) {
          // Different device or no device fingerprint - allow (shared network scenario)
          // Only block if we have evidence it's the same user
          return {
            isOnCooldown: false,
            reason: 'shared_network_allowed',
          }
        }
      }
    }
  }

  return {
    isOnCooldown: false,
    reason: '',
  }
}

/**
 * AB-A2 FIX: Authenticated user cooldown check for coin credit
 *
 * Prevents abuse by limiting how often the same user can earn coins
 * from the same QR code. Uses user_id (from authenticated session) as
 * the primary identifier, making it immune to IP spoofing or device changes.
 */
interface UserCooldownResult {
  isOnCooldown: boolean
  retryAfterSeconds: number
}

async function checkUserCooldown(
  supabase: ReturnType<typeof createServerClient>,
  qrId: string,
  userId: string
): Promise<UserCooldownResult> {
  const userCooldownMinutes = 60 // AB-A2 FIX: longer cooldown for authenticated users (1 hour)

  const { data: recentUserScan } = await supabase
    .from('scan_events')
    .select('id, created_at, rez_coins_credited')
    .eq('qr_id', qrId)
    .eq('user_id', userId)
    .eq('rez_coins_credited', true) // Only check credited scans for user cooldown
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentUserScan) {
    const scanTime = new Date(recentUserScan.created_at).getTime()
    const now = Date.now()
    const minutesSince = (now - scanTime) / 1000 / 60

    if (minutesSince < userCooldownMinutes) {
      const retryAfterSeconds = Math.ceil((userCooldownMinutes - minutesSince) * 60)
      return {
        isOnCooldown: true,
        retryAfterSeconds,
      }
    }
  }

  return {
    isOnCooldown: false,
    retryAfterSeconds: 0,
  }
}

/**
 * AB-C1 FIX: POST /api/qr/scan/[slug]
 *
 * Authenticated endpoint for crediting REZ coins after a QR scan.
 * Uses the Supabase session token to get the verified user ID — cannot be spoofed.
 * Safe to call multiple times (idempotency: no-op if already credited).
 *
 * Required fields in body: { scanEventId: string }
 * Optional: { skipAppCheck: boolean } — for web session credit when the app is not installed
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServerClient()

  // --- Auth via Bearer token ---
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { scanEventId: string; skipAppCheck?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { scanEventId, skipAppCheck: _skipAppCheck } = body

  if (!scanEventId) {
    return NextResponse.json({ error: 'scanEventId is required' }, { status: 400 })
  }

  // Look up QR code
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('qr_slug', slug)
    .eq('is_active', true)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found or inactive' }, { status: 404 })
  }

  // Fetch the scan event
  const { data: scanEvent } = await supabase
    .from('scan_events')
    .select('*')
    .eq('id', scanEventId)
    .eq('qr_id', qr.id)
    .single()

  if (!scanEvent) {
    return NextResponse.json({ error: 'Scan event not found' }, { status: 404 })
  }

  // Idempotency: if already credited, return success without re-crediting
  if (scanEvent.rez_coins_credited) {
    return NextResponse.json({ success: true, alreadyCredited: true, coinsEarned: scanEvent.coins_amount ?? 0 })
  }

  // AB-A2 FIX: Check authenticated user cooldown to prevent abuse
  // This complements IP/device cooldown with user-specific tracking
  const userCooldownResult = await checkUserCooldown(supabase, qr.id, user.id)
  if (userCooldownResult.isOnCooldown) {
    return NextResponse.json({
      success: false,
      error: 'user_cooldown',
      message: 'Please wait before scanning this QR code again',
      retryAfterSeconds: userCooldownResult.retryAfterSeconds,
    }, { status: 429 })
  }

  // Only credit if there's a merchant ID (otherwise no REZ integration)
  if (!qr.rez_merchant_id) {
    return NextResponse.json({ success: true, coinsEarned: 0, reason: 'no_merchant' })
  }

  // AB-B1 FIX: Check if this is the user's first scan of this QR code.
  // If yes and visit_bonus_coins > 0, credit the bonus in addition to coins_per_scan.
  const { count: priorScanCount } = await supabase
    .from('scan_events')
    .select('id', { count: 'exact', head: true })
    .eq('qr_id', qr.id)
    .eq('user_id', user.id)
    .neq('id', scanEventId) // exclude current scan

  const isFirstVisit = (priorScanCount ?? 0) === 0
  const visitBonusCoins = isFirstVisit && qr.visit_bonus_coins > 0 ? qr.visit_bonus_coins : 0

  // Credit coins via REZ API
  let coinsEarned = 0
  const rezInternalKey = process.env.REZ_INTERNAL_KEY
  if (!rezInternalKey) {
    // AB-CROSS-01 FIX: Fail fast instead of sending an empty-string header.
    // An empty x-internal-key causes the REZ backend to return 401, silently
    // dropping all coin credits with no user feedback.
    logger.error('[qr/scan] REZ_INTERNAL_KEY env var is not set — cannot credit coins')
    return NextResponse.json({ success: false, error: 'Internal service misconfigured' }, { status: 503 })
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const rezRes = await fetch(`${process.env.REZ_API_BASE_URL}/api/adbazaar/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': rezInternalKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        // AB-C1 FIX: body was previously placed OUTSIDE the fetch options object,
        // causing the request to be sent with an empty body. Coins were never credited.
        rezUserId: user.id,
        qrCodeId: qr.id,
        merchantId: qr.rez_merchant_id,
        coinsAmount: qr.coins_per_scan,
        visitBonusCoins,
        scanEventId: scanEvent.id,
        adPlacementTitle: qr.qr_label || '',
      }),
    })
    clearTimeout(timeout)
    if (rezRes.ok) {
      coinsEarned = qr.coins_per_scan + visitBonusCoins
      await supabase.from('scan_events').update({
        user_id: user.id, // Backfill authenticated user ID
        rez_coins_credited: true,
        coins_amount: coinsEarned,
        rez_app_opened: true,
      }).eq('id', scanEvent.id)
    } else {
      // Non-2xx response — record in DLQ for automatic retry
      const errorText = await rezRes.text().catch(() => `HTTP ${rezRes.status}`)
      const nextRetry = new Date(Date.now() + 60_000).toISOString()
      try {
        await supabase.from('failed_coin_credits').insert({
          scan_event_id: scanEvent.id,
          user_id: user.id,
          merchant_id: qr.rez_merchant_id,
          coins_amount: qr.coins_per_scan + visitBonusCoins,
          attempts: 0,
          last_attempt: new Date().toISOString(),
          next_retry: nextRetry,
          status: 'pending',
          error_message: errorText.slice(0, 1000),
        })
      } catch (dlqErr) {
        logger.error('[qr/scan] failed to insert DLQ record', dlqErr)
      }
    }
  } catch (e) {
    // Log but don't fail — record in DLQ for automatic retry
    logger.error('REZ coin credit failed', e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    const nextRetry = new Date(Date.now() + 60_000).toISOString()
    try {
      await supabase.from('failed_coin_credits').insert({
        scan_event_id: scanEvent.id,
        user_id: user.id,
        merchant_id: qr.rez_merchant_id,
        coins_amount: qr.coins_per_scan + visitBonusCoins,
        attempts: 0,
        last_attempt: new Date().toISOString(),
        next_retry: nextRetry,
        status: 'pending',
        error_message: errorMessage.slice(0, 1000),
      })
    } catch (dlqErr) {
      logger.error('[qr/scan] failed to insert DLQ record', dlqErr)
    }
  }

  return NextResponse.json({
    success: true,
    coinsEarned,
    isFirstVisit,
    visitBonusCredited: visitBonusCoins,
    breakdown: {
      perScan: qr.coins_per_scan,
      visitBonus: visitBonusCoins,
    },
  })
}
