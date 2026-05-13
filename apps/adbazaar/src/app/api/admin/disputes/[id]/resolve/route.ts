import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BookingStatus } from '@/types'
import { getPaymentByRazorpayPaymentId, processRefund } from '@/lib/paymentService'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'

// POST /api/admin/disputes/[id]/resolve
// Body: { resolution: 'vendor_wins' | 'buyer_wins', notes?: string }
//
// vendor_wins → booking stays Completed, vendor payout released
// buyer_wins  → booking moves to Cancelled, vendor payout blocked

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth via Bearer token — verify user is an admin
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null // AB2-M18 FIX: safe extraction
  if (!token) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check admin role
  const supabaseAdmin = supabase
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (userRow?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id: bookingId } = await params
    const body = await req.json()
    const supabase = supabaseAdmin
    const { resolution, notes } = body

    if (!['vendor_wins', 'buyer_wins'].includes(resolution)) {
      return NextResponse.json({ error: 'resolution must be vendor_wins or buyer_wins' }, { status: 400 })
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, payment_id, amount, buyer_id, vendor_id')
      .eq('id', bookingId)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status !== BookingStatus.Disputed) {
      return NextResponse.json({ error: 'Booking is not in disputed status' }, { status: 400 })
    }

    const newStatus = resolution === 'vendor_wins'
      ? BookingStatus.Completed
      : BookingStatus.Cancelled

    const { data: updated, error } = await supabase
      .from('bookings')
      .update({
        status: newStatus,
        notes: notes ? `[DISPUTE RESOLVED: ${resolution}] ${notes}` : `[DISPUTE RESOLVED: ${resolution}]`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select('id, status, notes')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If buyer wins, initiate refund via REZ Payment Service
    let refundNote = ''
    if (resolution === 'buyer_wins' && booking.payment_id) {
      try {
        // Look up the MongoDB paymentId from the razorpay_payment_id
        const paymentId = await getPaymentByRazorpayPaymentId(booking.payment_id)
        if (!paymentId) {
          throw new Error('Payment not found in payment service')
        }
        await processRefund(
          paymentId,
          Number(booking.amount),
          `Dispute resolution: ${resolution}, resolvedBy: ${user.id}`,
        )
        refundNote = ' | Refund initiated.'
        await supabase.from('bookings').update({ notes: (updated?.notes ?? '') + refundNote }).eq('id', bookingId)
      } catch (e) {
        logger.error('Refund error (dispute buyer_wins)', e)
        refundNote = ' | Refund FAILED — process manually.'
        await supabase.from('bookings').update({ notes: (updated?.notes ?? '') + refundNote }).eq('id', bookingId)
        return NextResponse.json({
          error: 'Dispute resolved but refund initiation failed. Please process the refund manually.',
          booking: updated,
          resolution,
        }, { status: 500 })
      }
    }

    // Notify both parties (fire-and-forget)
    const { data: fullBooking } = await supabase
      .from('bookings')
      .select('buyer_id, vendor_id, listings(title)')
      .eq('id', bookingId)
      .single()

    if (fullBooking) {
      const listingTitle = Array.isArray(fullBooking.listings)
        ? (fullBooking.listings[0] as Record<string, unknown>)?.title
        : (fullBooking.listings as Record<string, unknown> | null)?.title

      const buyerWins = resolution === 'buyer_wins'
      const notifs = [
        {
          user_id: fullBooking.buyer_id,
          type: 'dispute_resolved',
          title: buyerWins ? 'Dispute resolved in your favour' : 'Dispute resolved',
          body: buyerWins
            ? `Your dispute for "${listingTitle ?? 'your booking'}" was resolved in your favour.`
            : `Your dispute for "${listingTitle ?? 'your booking'}" was resolved in the vendor's favour.`,
          link: '/buyer/bookings',
        },
        {
          user_id: fullBooking.vendor_id,
          type: 'dispute_resolved',
          title: buyerWins ? 'Dispute resolved' : 'Dispute resolved in your favour',
          body: buyerWins
            ? `The dispute for "${listingTitle ?? 'your booking'}" was resolved in the buyer's favour.`
            : `The dispute for "${listingTitle ?? 'your booking'}" was resolved in your favour.`,
          link: '/vendor/bookings',
        },
      ]
      await Promise.all(notifs.map((n) => insertNotification(n).catch((e) => logger.error('notification insert failed', e))))
    }

    return NextResponse.json({ booking: updated, resolution })
  } catch (e) {
    logger.error('POST /api/admin/disputes/[id]/resolve error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
