import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

/**
 * POST /api/auth/resend-confirmation
 *
 * Resends the email confirmation link to the user.
 * This endpoint is used when a user registers but doesn't receive
 * the confirmation email or the link expires.
 *
 * Security: Rate limit this endpoint in production (e.g., 3 requests per 5 minutes).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error('Supabase environment variables not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Check if user exists
    const { data: userData, error: getUserError } = await supabase
      .from('users')
      .select('id, email, verified')
      .eq('email', email.toLowerCase())
      .single()

    if (getUserError || !userData) {
      // Don't reveal whether email exists for security
      return NextResponse.json({
        message: 'If an account with this email exists and requires confirmation, a verification email has been sent.'
      })
    }

    // Check if user is already verified
    if (userData.verified) {
      return NextResponse.json({
        message: 'This account is already verified. Please log in.'
      })
    }

    // Get the auth user to check confirmation status
    const { data: authUser, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      logger.error('Error listing auth users', authError)
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      )
    }

    // Find user by email in auth.users
    const user = authUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      return NextResponse.json({
        message: 'If an account with this email exists and requires confirmation, a verification email has been sent.'
      })
    }

    // Check if email is already confirmed in auth
    if (user.email_confirmed_at) {
      // Update the users table verified flag if auth is confirmed but users table says not
      await supabase
        .from('users')
        .update({ verified: true })
        .eq('id', userData.id)

      return NextResponse.json({
        message: 'Your account is already verified. Please log in.'
      })
    }

    // AB-M3 FIX: Generate new confirmation link with redirect to our callback.
    // The callback will create the user profile after email verification.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const { error: updateError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback`,
      },
    })

    if (updateError) {
      logger.error('Error generating confirmation link', updateError)
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Verification email sent. Please check your inbox and spam folder.'
    })

  } catch (e) {
    logger.error('POST /api/auth/resend-confirmation error', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
