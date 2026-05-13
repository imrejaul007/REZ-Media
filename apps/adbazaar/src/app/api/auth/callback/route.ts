import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

/**
 * GET /api/auth/callback
 *
 * AB-M3 FIX: Handles Supabase email confirmation callbacks.
 *
 * When a user registers, their profile data (name, phone, role, etc.)
 * is stored in Supabase auth's raw_user_meta_data. This callback
 * creates the actual user profile in the `users` table only AFTER
 * email verification is confirmed.
 *
 * This prevents unverified users from existing in our system before
 * they have confirmed their email address.
 */

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const { searchParams } = new URL(req.url)
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/login'

    if (!tokenHash) {
      logger.error('[auth/callback] Missing token_hash')
      return NextResponse.redirect(`${appUrl}/?error=missing_token`)
    }

    if (type !== 'signup') {
      // Handle other callback types (magiclink, etc.) with standard flow
      return NextResponse.redirect(`${appUrl}${next.startsWith('/') ? next : `/${next}`}`)
    }

    // Create Supabase client to verify the token
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Exchange the token hash for a session
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      type: 'signup',
      token_hash: tokenHash,
    })

    if (authError || !authData.user) {
      logger.error('[auth/callback] Token verification failed', authError)
      return NextResponse.redirect(`${appUrl}/?error=confirmation_failed`)
    }

    const user = authData.user
    // AB-M3 FIX: Use user_metadata (Supabase v2+) instead of raw_user_meta_data
    const metadata = user.user_metadata ?? {}

    // AB-M3 FIX: Extract profile data from auth metadata and create user profile.
    // This only happens AFTER email confirmation is verified by Supabase.
    const profileData = {
      id: user.id,
      email: user.email ?? metadata.email ?? '',
      name: metadata.name ?? '',
      phone: metadata.phone ?? null,
      role: metadata.role ?? 'buyer',
      company_name: metadata.company_name ?? null,
      city: metadata.city ?? null,
      verified: true, // AB-M3 FIX: Mark as verified since email is confirmed
    }

    // Create user profile using service role key (to bypass RLS)
    const serviceClient = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error: insertError } = await serviceClient.from('users').insert(profileData)

    if (insertError) {
      // Check if it's a duplicate key error (user already exists)
      if ((insertError as { code?: string }).code === '23505') {
        // User already exists, redirect to login
        logger.info('[auth/callback] User already exists, redirecting to login')
        return NextResponse.redirect(`${appUrl}/login?verified=true`)
      }
      // Other insert error
      logger.error('[auth/callback] Failed to create user profile', insertError)
      return NextResponse.redirect(`${appUrl}/?error=profile_creation_failed`)
    }

    logger.info('[auth/callback] User profile created successfully', { userId: user.id })

    // Redirect to login with success message
    return NextResponse.redirect(`${appUrl}/login?verified=true`)
  } catch (e) {
    logger.error('[auth/callback] Unexpected error', e)
    return NextResponse.redirect(`${appUrl}/?error=callback_error`)
  }
}
