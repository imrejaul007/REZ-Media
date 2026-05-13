import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? null : user
}

// GET /api/campaigns — list buyer's campaigns with booking summaries
export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const campaigns = data ?? []

    // Enrich with booking details
    const allBookingIds = campaigns.flatMap((c) => c.booking_ids ?? [])
    const bookingMap: Map<string, Record<string, unknown>> = new Map()

    if (allBookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, amount, status, listings(title, city)')
        .in('id', allBookingIds)
      for (const b of bookings ?? []) {
        bookingMap.set(b.id, b as Record<string, unknown>)
      }
    }

    const enriched = campaigns.map((c) => {
      const bookings = (c.booking_ids ?? []).map((id: string) => bookingMap.get(id)).filter(Boolean)
      const totalSpend = bookings.reduce((s: number, b: Record<string, unknown>) => s + Number(b.amount ?? 0), 0)
      const activeCount = bookings.filter((b: Record<string, unknown>) =>
        ['confirmed', 'paid', 'executing'].includes(b.status as string)
      ).length
      return { ...c, bookings, totalSpend, activeCount }
    })

    return NextResponse.json({ campaigns: enriched })
  } catch (e) {
    logger.error('GET /api/campaigns error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/campaigns — create a new campaign
export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, budget, bookingIds } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const supabase = await createClient()

    // Validate bookingIds belong to this buyer
    const validatedIds: string[] = []
    if (Array.isArray(bookingIds) && bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('buyer_id', user.id)
        .in('id', bookingIds)
      validatedIds.push(...(bookings ?? []).map((b) => b.id))
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .insert({
        buyer_id: user.id,
        name: name.trim(),
        budget: budget ?? null,
        total_spent: 0,
        booking_ids: validatedIds,
        status: 'active',
        attribution_summary: {},
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Link bookings back to this campaign — AB3-C3 FIX: check error and rollback on failure
    if (validatedIds.length > 0) {
      const { error: linkError } = await supabase.from('bookings').update({ campaign_id: campaign.id }).in('id', validatedIds)
      if (linkError) {
        await supabase.from('campaigns').delete().eq('id', campaign.id)
        return NextResponse.json({ error: 'Failed to link bookings to campaign' }, { status: 500 })
      }
    }

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (e) {
    logger.error('POST /api/campaigns error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
