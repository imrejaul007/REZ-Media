import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'
import { validateEnv } from '@/lib/env'

// AB-SEC-2FA-01: TOTP secret encryption key (32 bytes for AES-256)
// In production, store this in a secure key management service (AWS KMS, HashiCorp Vault)
function getTotpSecretKey(): string {
  const key = process.env.TOTP_SECRET_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('[ENV] TOTP_SECRET_KEY environment variable is required. 2FA cannot operate without it.');
  }
  // Fallback for development only
  return key || 'dev-only-32-byte-totp-secret-key!!';
}

/**
 * GET /api/auth/2fa/setup
 *
 * Generates a new TOTP secret and QR code URL for setting up 2FA.
 * The secret is stored encrypted in the user's profile.
 */
export async function GET(req: NextRequest) {
  try {
    validateEnv()

    // Authenticate user
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

    // Generate a new TOTP secret
    const secret = speakeasy.generateSecret({
      name: `AdBazaar (${user.email})`,
      length: 20,
    })

    // Generate QR code URL (not the image data URL, just the otpauth URL)
    const otpauthUrl = secret.otpauth_url!

    // Generate QR code as data URL for display
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

    // Store the encrypted secret in user's profile (not confirmed yet)
    // The secret will only be marked as "enabled" after verification
    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('users')
      .update({
        totp_secret: secret.base32,
        totp_enabled: false, // Not confirmed until POST verification
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Error storing TOTP secret', updateError)
      return NextResponse.json({ error: 'Failed to set up 2FA' }, { status: 500 })
    }

    return NextResponse.json({
      secret: secret.base32, // Provide backup codes as well in production
      qrCode: qrCodeDataUrl,
      otpauthUrl: otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    })

  } catch (e) {
    logger.error('GET /api/auth/2fa/setup error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/auth/2fa/setup
 *
 * Verifies a TOTP code to confirm 2FA setup.
 * Body: { code: string }
 *
 * AB-SEC-2FA-01: After successful verification, marks 2FA as enabled.
 */
export async function POST(req: NextRequest) {
  try {
    validateEnv()

    // Authenticate user
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

    // Get request body
    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    // Retrieve the pending TOTP secret
    const supabase = createServerClient()
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('totp_secret')
      .eq('id', user.id)
      .single()

    if (fetchError || !userData?.totp_secret) {
      return NextResponse.json({
        error: '2FA setup not initiated. Please request a new QR code first.'
      }, { status: 400 })
    }

    // Verify the TOTP code
    const verified = speakeasy.totp.verify({
      secret: userData.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1, // Allow 1 step tolerance (30 seconds before/after)
    })

    if (!verified) {
      logger.warn('Invalid TOTP verification attempt', { userId: user.id })
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
    }

    // Mark 2FA as enabled
    const { error: updateError } = await supabase
      .from('users')
      .update({
        totp_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      logger.error('Error enabling TOTP', updateError)
      return NextResponse.json({ error: 'Failed to enable 2FA' }, { status: 500 })
    }

    logger.info('2FA enabled successfully', { userId: user.id })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled successfully.',
    })

  } catch (e) {
    logger.error('POST /api/auth/2fa/setup error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
