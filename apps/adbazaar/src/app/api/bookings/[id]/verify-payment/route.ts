import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { verifySignature, initiatePaymentForOrder, capturePayment } from '@/lib/paymentService'
import { BookingStatus } from '@/types'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'
import { fetchRazorpayPayment } from '@/lib/razorpay'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id: bookingId } = await params
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_amount } = body as {
      razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string; razorpay_amount?: number
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required' },
        { status: 400 },
      )
    }

    // --- Auth via Bearer token ---
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch booking and verify ownership
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, buyer_id, status, payment_order_id, amount')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Allow payment verification for bookings in Inquiry (direct) OR Confirmed (inquiry-accept path)
    const payableStatuses = [BookingStatus.Inquiry, BookingStatus.Confirmed]
    if (!payableStatuses.includes(booking.status as BookingStatus)) {
      return NextResponse.json(
        { error: `Booking is already in status: ${booking.status}` },
        { status: 409 },
      )
    }

    if (booking.payment_order_id !== razorpay_order_id) {
      return NextResponse.json({ error: 'Order ID mismatch' }, { status: 400 })
    }

    // AB-C5 FIX (Complete): Fetch payment from Razorpay API to verify actual amount.
    // This prevents "pay ₹1 for ₹50,000 booking" attacks.
    // DO NOT trust client-provided amounts - always verify server-side.
    const razorpayPayment = await fetchRazorpayPayment(razorpay_payment_id)
    if (!razorpayPayment) {
      return NextResponse.json(
        { error: 'Failed to verify payment with Razorpay' },
        { status: 500 },
      )
    }

    // Verify payment amount matches booking amount (in paise)
    const bookingAmountPaise = Math.round(Number(booking.amount) * 100)
    if (razorpayPayment.amount !== bookingAmountPaise) {
      logger.error('[verify-payment] Payment amount mismatch', {
        bookingId,
        bookingAmount: bookingAmountPaise,
        razorpayAmount: razorpayPayment.amount,
      })
      return NextResponse.json(
        { error: `Payment amount mismatch. Expected ${bookingAmountPaise}, got ${razorpayPayment.amount}` },
        { status: 400 },
      )
    }

    // Verify payment is captured
    if (razorpayPayment.status !== 'captured') {
      return NextResponse.json(
        { error: `Payment not captured. Status: ${razorpayPayment.status}` },
        { status: 400 },
      )
    }

    // Verify signature via REZ Payment Service (which holds the secret)
    const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Ensure the MongoDB payment doc exists in the payment service, then capture.
    // This is needed because AdBazaar creates orders via createRazorpayOrder (not initiatePayment),
    // so the MongoDB doc is created asynchronously via webhook. We call initiatePaymentForOrder
    // to ensure it exists synchronously before capture.
    let paymentId: string | null = null
    try {
      const initiated = await initiatePaymentForOrder(
        razorpay_order_id,
        Number(booking.amount),
        user.id,
        bookingId,
      )
      paymentId = initiated.paymentId
    } catch (err: any) {
      logger.warn('[verify-payment] initiatePaymentForOrder failed, attempting capture anyway', { error: err.message })
    }

    // Capture payment in the payment service (idempotent — replay-protected)
    if (paymentId) {
      try {
        await capturePayment(paymentId, razorpay_payment_id, razorpay_order_id, razorpay_signature)
      } catch (err: any) {
        logger.warn('[verify-payment] capturePayment failed', { error: err.message, paymentId })
        // Non-fatal — the webhook will also attempt capture via handleWebhookCaptured
      }
    }

    // Mark booking as Confirmed and store payment id — atomic guard: only update if still
    // in a payable status to prevent double-confirmation on concurrent requests
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: BookingStatus.Confirmed,
        payment_id: razorpay_payment_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .in('status', payableStatuses)
      .select()
      .single()

    if (updateError || !updated) {
      logger.error('Booking confirm error', updateError)
      return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
    }

    // Activate associated QR code(s)
    await supabase
      .from('qr_codes')
      .update({ is_active: true })
      .eq('booking_id', bookingId)

    // Notify vendor that payment is confirmed
    Promise.resolve(
      supabase
        .from('bookings')
        .select('vendor_id, buyer_id, listings(title)')
        .eq('id', bookingId)
        .single()
    ).then(async ({ data: b }) => {
      if (!b?.vendor_id) return
      const title = Array.isArray(b.listings)
        ? (b.listings[0] as Record<string, unknown>)?.title
        : (b.listings as Record<string, unknown> | null)?.title
      await insertNotification({
        user_id: b.vendor_id,
        type: 'payment_confirmed',
        title: 'Payment received',
        body: `Booking for "${title ?? 'your listing'}" has been paid and confirmed.`,
        link: '/vendor/bookings',
      }).catch((e) => logger.error('notification insert failed', e))
    }).catch((e) => logger.error('[verify-payment] Notification failed', e))

    return NextResponse.json({
      success: true,
      booking: updated,
      message: 'Payment verified. Booking confirmed.',
    })
  } catch (e) {
    logger.error('POST /api/bookings/[id]/verify-payment error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
