import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { BookingStatus } from '@/types'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'
import { forwardWebhook } from '@/lib/paymentService'

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

/**
 * Verify Razorpay webhook signature.
 * https://razorpay.com/docs/payments/webhooks/#step-2-verify-the-signature
 */
function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

interface RazorpayEvent {
  event: string
  payload: {
    payment?: {
      entity: {
        id: string
        order_id?: string
        amount: number
        status: string
        captured?: boolean
        error_code?: string
        error_description?: string
        created_at: number
      }
    }
    refund?: {
      entity: {
        id: string
        payment_id: string
        amount: number
        status: string
        created_at: number
      }
    }
  }
}


async function handlePaymentCaptured(
  supabase: ReturnType<typeof createServerClient>,
  paymentId: string,
  orderId: string | undefined,
) {
  if (!orderId) return { updated: 0 }

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: BookingStatus.Paid,
      payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('payment_order_id', orderId)
    .in('status', [BookingStatus.Inquiry, BookingStatus.Quoted, BookingStatus.Confirmed])
    .select('id, status')
    .single()

  if (error) {
    logger.error('[razorpay webhook] payment.captured update error', error)
    return { updated: 0, error }
  }

  return { updated: data ? 1 : 0 }
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createServerClient>,
  orderId: string | undefined,
  errorCode: string | undefined,
  errorDescription: string | undefined,
) {
  if (!orderId) return { updated: 0 }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, buyer_id, vendor_id, listings(title)')
    .eq('payment_order_id', orderId)
    .in('status', [BookingStatus.Inquiry, BookingStatus.Quoted, BookingStatus.Confirmed])
    .single()

  if (!booking) {
    logger.warn(`payment.failed: booking not found for order ${orderId}`)
    return { updated: 0 }
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: BookingStatus.Cancelled,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)

  if (error) {
    logger.error('[razorpay webhook] payment.failed update error', error)
    return { updated: 0, error }
  }

  if (booking.vendor_id) {
    const title = Array.isArray(booking.listings)
      ? (booking.listings[0] as Record<string, unknown>)?.title
      : (booking.listings as Record<string, unknown> | null)?.title

    try {
      await insertNotification({
        user_id: booking.buyer_id,
        type: 'payment_failed',
        title: 'Payment failed',
        body: `Booking payment for "${title ?? 'your booking'}" failed: ${errorDescription ?? errorCode ?? 'Unknown error'}.`,
        link: '/buyer/bookings',
      })
    } catch (e) {
      logger.error('notification insert failed', e)
    }
  }

  return { updated: 1 }
}

async function handleRefundCreated(
  supabase: ReturnType<typeof createServerClient>,
  paymentId: string,
  refundId: string,
  refundAmount: number,
) {
  const { data: existing } = await supabase
    .from('refunds')
    .select('id')
    .eq('razorpay_refund_id', refundId)
    .maybeSingle()

  if (existing) {
    return { updated: 0, skipped: true }
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, buyer_id, vendor_id, listings(title)')
    .eq('payment_id', paymentId)
    .single()

  if (!booking) {
    return { updated: 0 }
  }

  let refundSaved = false
  try {
    await supabase.from('refunds').insert({
      booking_id: booking.id,
      razorpay_refund_id: refundId,
      amount: refundAmount / 100,
      status: 'created',
    })
    refundSaved = true
  } catch (e) {
    logger.error('refund insert failed', e)
  }

  if (refundSaved) {
    await supabase.from('bookings').update({
      status: BookingStatus.Cancelled,
      updated_at: new Date().toISOString(),
    }).eq('id', booking.id)
  }

  if (booking.vendor_id) {
    const title = Array.isArray(booking.listings)
      ? (booking.listings[0] as Record<string, unknown>)?.title
      : (booking.listings as Record<string, unknown> | null)?.title

    try {
      // AB3-H9 FIX: Refund notification goes to buyer (recipient of refund), not vendor
      await insertNotification({
        user_id: booking.buyer_id,
        type: 'refund_initiated',
        title: 'Refund received',
        body: `A refund of Rs.${(refundAmount / 100).toLocaleString('en-IN')} has been processed for "${title ?? 'your booking'}".`,
        link: '/buyer/bookings',
      })
    } catch (e) {
      logger.error('notification insert failed', e)
    }
  }

  return { updated: refundSaved ? 1 : 0 }
}

export async function POST(req: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      logger.error('[razorpay webhook] RAZORPAY_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
    }

    const signature = req.headers.get('x-razorpay-signature') ?? ''
    const rawBody = await req.text()

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid signature')
      return NextResponse.json({ success: false }, { status: 401 })
    }

    // Forward to REZ Payment Service — it is the canonical handler for payment lifecycle.
    // The service handles deduplication, MongoDB payment state, and wallet credits.
    try {
      const psResult = await forwardWebhook(rawBody, signature)
      logger.info('[razorpay webhook] Forwarded to REZ Payment Service', {
        success: psResult.success,
        duplicate: psResult.duplicate,
      })
    } catch (err: any) {
      // Non-fatal: REZ Payment Service may be unavailable, but we still process
      // AdBazaar-specific Supabase booking updates locally below.
      logger.warn('[razorpay webhook] REZ Payment Service forwarding failed, processing locally', {
        error: err.message,
      })
    }

    let event: RazorpayEvent
    try {
      event = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const supabase = createServerClient()
    let result = { handled: true }

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment?.entity
        if (payment && payment.captured === true) {
          const r = await handlePaymentCaptured(supabase, payment.id, payment.order_id)
          logger.info(`payment.captured: payment=${payment.id}, order=${payment.order_id}, updated=${r.updated}`)
        }
        break
      }

      case 'payment.failed': {
        const payment = event.payload.payment?.entity
        if (payment) {
          const r = await handlePaymentFailed(
            supabase,
            payment.order_id,
            payment.error_code,
            payment.error_description, // AB3-H10 FIX: pass error_description so it's shown to user
          )
          logger.info(`payment.failed: payment=${payment.id}, order=${payment.order_id}, updated=${r.updated}`)
        }
        break
      }

      case 'refund.created': {
        const refund = event.payload.refund?.entity
        if (refund) {
          const r = await handleRefundCreated(
            supabase,
            refund.payment_id,
            refund.id,
            refund.amount,
          )
          logger.info(`refund.created: refund=${refund.id}, payment=${refund.payment_id}, updated=${r.updated}`)
        }
        break
      }

      default:
        logger.info(`Unhandled event: ${event.event}`)
        result = { handled: false }
    }

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    logger.error('[razorpay webhook] Unexpected error', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
