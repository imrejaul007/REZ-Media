import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { MessageCreateSchema } from '@/lib/schemas'

// GET  /api/bookings/[id]/messages — list messages for a booking
// POST /api/bookings/[id]/messages — send a message

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return null

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: bookingId } = await params
    const supabase = await createClient()

    // Verify user is buyer or vendor of this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('buyer_id, vendor_id')
      .eq('id', bookingId)
      .single()

    if (!booking || (booking.buyer_id !== user.id && booking.vendor_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, sender_role, body, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('[bookings messages] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({
      messages: (messages ?? []).map((m) => ({ ...m, content: m.body })),
    })
  } catch (e) {
    logger.error('GET /api/bookings/[id]/messages error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: bookingId } = await params
    const rawBody = await req.json()
    const parsed = MessageCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { content } = parsed.data

    const supabase = await createClient()

    // Verify user is buyer or vendor of this booking
    const { data: booking } = await supabase
      .from('bookings')
      .select('buyer_id, vendor_id')
      .eq('id', bookingId)
      .single()

    if (!booking || (booking.buyer_id !== user.id && booking.vendor_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const senderRole = booking.buyer_id === user.id ? 'buyer' : 'vendor'

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        sender_role: senderRole,
        body: content.trim(),
      })
      .select('id, sender_id, sender_role, body, created_at')
      .single()

    if (error) {
      logger.error('[bookings messages] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ message: { ...message, content: message?.body } }, { status: 201 })
  } catch (e) {
    logger.error('POST /api/bookings/[id]/messages error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
