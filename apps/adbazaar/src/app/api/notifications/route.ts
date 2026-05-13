import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

// GET /api/notifications — last 20 notifications for authenticated user
export async function GET(req: NextRequest) {
  const user = await authenticate(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unreadCount = (data ?? []).filter((n) => !n.read_at).length

  return NextResponse.json({ notifications: data ?? [], unreadCount })
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(req: NextRequest) {
  const user = await authenticate(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before') // ISO timestamp — marks notifications older than this as read
  const now = new Date().toISOString()

  // AB3-M6 FIX: accept optional 'before' query param to scope which notifications are marked as read
  let query = supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (before) {
    query = query.lte('created_at', before)
  }

  const { error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
