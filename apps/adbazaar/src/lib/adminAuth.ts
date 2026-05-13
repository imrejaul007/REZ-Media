import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'

/**
 * AB-H2 FIX: Use @supabase/ssr for secure cookie handling.
 *
 * Previous implementation used manual cookie parsing which is fragile —
 * if Supabase changes their cookie format, authentication breaks.
 * @supabase/ssr handles cookie serialization/deserialization automatically
 * and is maintained by the Supabase team.
 */
export async function requireAdmin(): Promise<{ userId: string; role: string }> {
  const cookieStore = await cookies()

  // Create Supabase client with cookie adapter from @supabase/ssr
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>
        ) {
          try {
            cookiesToSet.forEach((cookie) => {
              cookieStore.set(cookie.name, cookie.value, cookie.options as Parameters<typeof cookieStore.set>[2])
            })
          } catch {
            // This can fail in Server Components where cookies() is read-only
          }
        },
      },
    }
  )

  // getUser() automatically reads from the session cookies
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login?next=/admin/dashboard')

  // Verify admin role in database
  const { data: row } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (row?.role !== 'admin') redirect('/login')

  return { userId: user.id, role: row.role }
}
