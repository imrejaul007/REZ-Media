import { NextRequest, NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'
import { validateEnv } from '@/lib/env'

/**
 * POST /api/auth/2fa/verify
 *
 * Verifies a TOTP code during login when 2FA is enabled.
 * Body: { email: string, code: string }
 *
 * AB-SEC-2FA-02: This endpoint validates 2FA codes for users who have enabled 2FA.
 * It does not create a session - it only validates the code.
 * The login flow should redirect to this endpoint when 2FA is detected.
 */
export async function POST(req: NextRequest) {
  try {
    validateEnv()

    const body = await req.json()
    const { email, code } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim()

    // Find user by email
    const supabase = createServerClient()
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, email, totp_secret, totp_enabled, verified')
      .eq('email', normalizedEmail)
      .single()

    if (fetchError || !userData) {
      // Don't reveal whether email exists
      return NextResponse.json({ error: 'Invalid email or verification code' }, { status: 401 })
    }

    // Check if 2FA is actually enabled for this user
    if (!userData.totp_enabled || !userData.totp_secret) {
      return NextResponse.json({ error: '2FA is not enabled for this account' }, { status: 400 })
    }

    // Check if user is verified
    if (!userData.verified) {
      return NextResponse.json({
        error: 'Please verify your email before logging in. Check your inbox for the confirmation link.'
      }, { status: 403 })
    }

    // Verify the TOTP code
    const verified = speakeasy.totp.verify({
      secret: userData.totp_secret,
      encoding: 'base32',
      token: code,
      window: 1, // Allow 1 step tolerance
    })

    if (!verified) {
      logger.warn('Invalid 2FA verification attempt', { userId: userData.id, email: normalizedEmail })
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
    }

    logger.info('2FA verification successful', { userId: userData.id, email: normalizedEmail })

    // Return success - the client should proceed with the login
    // The actual session creation happens in the login flow with Supabase
    return NextResponse.json({
      success: true,
      verified: true,
      userId: userData.id,
      message: '2FA verification successful',
    })

  } catch (e) {
    logger.error('POST /api/auth/2fa/verify error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
