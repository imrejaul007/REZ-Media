/**
 * Supabase Browser Client Factory
 *
 * Creates a browser-side Supabase client that uses HttpOnly cookies
 * for session storage instead of localStorage.
 *
 * SECURITY: This client stores tokens in HttpOnly cookies, preventing
 * XSS attacks from stealing authentication tokens.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase-browser'
 *   const supabase = createClient()
 *   const { data: { user } } = await supabase.auth.getUser()
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Re-export types for convenience
export type { User, Session, AuthError, AuthTokenResponse, AuthResponse } from '@supabase/supabase-js'
