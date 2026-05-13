import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'
import logger from '@/lib/logger'
import { BookingStatus } from '@/types'
import { insertNotification } from '@/lib/notifications'

// GET /api/cron/stale-bookings
// Vercel Cron (every 6 hours). Finds bookings stuck in "Confirmed" status
// for longer than STALE_HOURS and auto-cancels them.
//
// Rationale: A booking moves to "Confirmed" when a vendor accepts an inquiry,
// but the buyer never completes payment. These stuck bookings should be
// cancelled after a grace period so vendors aren't left waiting indefinitely.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/cron/stale-bookings", "schedule": "0 */6 * * *" }] }
//
// Protected by CRON_SECRET env var (set same value in Vercel dashboard).

const STALE_HOURS = 24 // AB-B4 FIX: Cancel confirmed bookings older than this (payment timeout)

export async function GET(req: NextRequest) {
  // Validate cron secret via Authorization header
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)
  if (!timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const cutoffTime = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()

    // AB-B4 FIX: Find bookings stuck in "confirmed" status beyond the stale threshold.
    // These are bookings where the vendor accepted the inquiry but the buyer
    // never completed payment (no Razorpay webhook fired = no payment_id).
    // We cancel them to free up the vendor's calendar.
    const { data: staleBookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        listing_id,
        buyer_id,
        vendor_id,
        status,
        payment_id,
        updated_at,
        listings(title)
      `)
      .eq('status', BookingStatus.Confirmed)
      .is('payment_id', null) // AB-B4 FIX: Only cancel if no payment received
      .lt('updated_at', cutoffTime)
      .limit(100)

    if (error) {
      logger.error('[cron/stale-bookings] fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let cancelled = 0
    let errors = 0

    for (const booking of staleBookings ?? []) {
      // Extract listing title from the joined result
      const listingTitle = Array.isArray(booking.listings)
        ? (booking.listings[0] as Record<string, unknown>)?.title
        : (booking.listings as Record<string, unknown> | null)?.title

      // Cancel the stale booking
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: BookingStatus.Cancelled,
          notes: `Auto-cancelled by system after ${STALE_HOURS} hours in Confirmed status (no payment received).`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)
        .eq('status', BookingStatus.Confirmed) // Idempotent: only if still confirmed

      if (updateError) {
        logger.error('[cron/stale-bookings] failed to cancel booking', {
          bookingId: booking.id,
          errorMessage: updateError.message,
          errorDetails: updateError.details,
          errorHint: updateError.hint
        })
        errors++
        continue
      }

      cancelled++

      // Notify the buyer that their booking was auto-cancelled
      try {
        await insertNotification({
          user_id: booking.buyer_id,
          type: 'booking_auto_cancelled',
          title: 'Booking auto-cancelled',
          body: `Your booking for "${listingTitle ?? 'the listing'}" was auto-cancelled after ${STALE_HOURS} hours due to no payment. You can book again anytime.`,
          link: '/buyer/bookings',
        })
      } catch (e) {
        logger.error('[cron/stale-bookings] failed to notify buyer', { userId: booking.buyer_id, error: e instanceof Error ? e.message : String(e) })
      }

      // Notify the vendor that the confirmed booking was auto-cancelled
      try {
        await insertNotification({
          user_id: booking.vendor_id,
          type: 'booking_auto_cancelled_vendor',
          title: 'Booking auto-cancelled',
          body: `A confirmed booking for "${listingTitle ?? 'your listing'}" was auto-cancelled after ${STALE_HOURS} hours (buyer never paid). The listing is now available for others.`,
          link: '/vendor/bookings',
        })
      } catch (e) {
        logger.error('[cron/stale-bookings] failed to notify vendor', { userId: booking.vendor_id, error: e instanceof Error ? e.message : String(e) })
      }
    }

    logger.info(
      `[cron/stale-bookings] checked=${staleBookings?.length ?? 0} cancelled=${cancelled} errors=${errors}`,
    )
    return NextResponse.json({
      checked: staleBookings?.length ?? 0,
      cancelled,
      errors,
    })
  } catch (e) {
    logger.error('[cron/stale-bookings] unexpected error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
