import { createClient } from '@supabase/supabase-js'
import logger from '@/lib/logger'

// Server-side client with service role (use only in API routes / server components)
// AB-H1/AB2-C3 FIX: Throw immediately if SERVICE_ROLE_KEY is missing — silently falling
// back to the anon key means admin operations pass RLS checks they should not, creating
// a silent security bypass. It is better to crash and alert ops than to silently operate
// with reduced privileges (or full access for non-admin users in some edge cases).
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      '[SUPABASE] SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
      'Admin operations require the service role key. ' +
      'Set SUPABASE_SERVICE_ROLE_KEY in your environment variables.'
    )
  }
  return createClient(url, key)
}
