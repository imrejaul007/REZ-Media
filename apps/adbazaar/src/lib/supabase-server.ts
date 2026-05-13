/**
 * Supabase Server Client Factory
 *
 * Creates a server-side Supabase client for use in:
 * - Server Components
 * - Route Handlers (API routes)
 *
 * SECURITY: This client reads authentication from HttpOnly cookies,
 * providing the same security benefits as the browser client.
 *
 * Usage:
 *   import { createClient } from '@/lib/supabase-server'
 *
 *   // In a Server Component:
 *   export default async function Page() {
 *     const supabase = await createClient()
 *     const { data: { user } } = await supabase.auth.getUser()
 *     // ...
 *   }
 *
 *   // In a Route Handler:
 *   export async function GET() {
 *     const supabase = await createClient()
 *     const { data: { user } } = await supabase.auth.getUser()
 *     // ...
 *   }
 */

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'

interface SetCookieParams {
  name: string
  value: string
  options?: CookieOptions
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: SetCookieParams[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - this can be ignored
          }
        },
      },
    }
  )
}

// Re-export types for convenience
export type { User, Session, AuthError, AuthTokenResponse, AuthResponse } from '@supabase/supabase-js'
