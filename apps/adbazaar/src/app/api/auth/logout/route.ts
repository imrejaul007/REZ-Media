import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

export async function POST() {
  try {
    const supabase = createServerClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      logger.error('[Logout] signOut error', error)
      // AB3-L1 FIX: return error to client so they can detect logout failure
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
  } catch (err) {
    logger.error('[Logout] Unexpected error during signOut', err)
  }
  // AB3-M5 FIX: explicitly clear auth cookies server-side so stolen cookies are invalidated immediately
  const response = NextResponse.json({ success: true })
  const cookies = ['sb-access-token', 'sb-refresh-token', 'auth-token']
  cookies.forEach(name => {
    response.cookies.set(name, '', { maxAge: 0, path: '/' })
  })
  return response
}
