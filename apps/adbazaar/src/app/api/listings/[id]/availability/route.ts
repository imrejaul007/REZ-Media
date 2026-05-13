import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: listingId } = await params
    const { searchParams } = new URL(req.url)

    // Default: 60-day window starting today
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const from = fromParam ?? new Date().toISOString().slice(0, 10)
    const toDate = toParam ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() + 60)
      return d.toISOString().slice(0, 10)
    })()

    const supabase = createServerClient()

    // Verify listing exists and get its availability model
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, availability_model, min_booking_days, price, duration_unit')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.availability_model === 'always_on') {
      return NextResponse.json({
        availabilityModel: 'always_on',
        slots: [],
        blockedDates: [],
        minBookingDays: listing.min_booking_days ?? 1,
      })
    }

    // Fetch availability rows for date range
    let query = supabase
      .from('availability')
      .select('id, date, slot_start, slot_end, status, booking_id')
      .eq('listing_id', listingId)

    if (listing.availability_model === 'calendar') {
      query = query.gte('date', from).lte('date', toDate).order('date')
    } else {
      // slot model — use slot_start
      query = query.gte('slot_start', from).lte('slot_start', toDate + 'T23:59:59').order('slot_start')
    }

    const { data: rows, error } = await query

    if (error) {
      logger.error('[listings availability] Database error', { error: error.message })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Also fetch confirmed bookings to derive blocked dates
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_date, end_date, status')
      .eq('listing_id', listingId)
      .in('status', ['confirmed', 'paid', 'executing'])
      .gte('end_date', from)
      .lte('start_date', toDate)

    // Build blocked date set from bookings
    const bookedDates = new Set<string>()
    for (const b of bookings ?? []) {
      if (!b.start_date || !b.end_date) continue
      const start = new Date(b.start_date)
      const end = new Date(b.end_date)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        bookedDates.add(d.toISOString().slice(0, 10))
      }
    }

    return NextResponse.json({
      availabilityModel: listing.availability_model,
      minBookingDays: listing.min_booking_days ?? 1,
      price: listing.price,
      durationUnit: listing.duration_unit,
      slots: rows ?? [],
      bookedDates: Array.from(bookedDates),
    })
  } catch (e) {
    logger.error('GET /api/listings/[id]/availability error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
