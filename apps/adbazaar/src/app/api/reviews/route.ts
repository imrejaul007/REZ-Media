import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { BookingStatus } from '@/types'
import { ReviewCreateSchema } from '@/lib/schemas'

// POST /api/reviews — buyer submits a review for a completed booking

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await req.json()
    const parsed = ReviewCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const { bookingId, rating, comment, onTimeRating, proofQualityRating, communicationRating } = parsed.data

    // Verify booking is completed and reviewer is the buyer
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, buyer_id, vendor_id, listing_id, status')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (booking.status !== BookingStatus.Completed) {
      return NextResponse.json({ error: 'Can only review completed bookings' }, { status: 400 })
    }

    // Prevent duplicate reviews
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('reviewer_id', user.id)
      .single()

    if (existing) return NextResponse.json({ error: 'You have already reviewed this booking' }, { status: 400 })

    const { data: review, error } = await supabase
      .from('reviews')
      .insert({
        booking_id: bookingId,
        reviewer_id: user.id,
        reviewer_role: 'buyer',
        target_id: booking.listing_id,
        rating,
        on_time_rating: onTimeRating ?? null,
        proof_quality_rating: proofQualityRating ?? null,
        communication_rating: communicationRating ?? null,
        comment: comment ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ review }, { status: 201 })
  } catch (e) {
    logger.error('POST /api/reviews error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
