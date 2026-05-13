/**
 * POST /api/vendor/payout
 * Vendor requests a payout for a completed + proof-approved booking.
 * Initiates a Razorpay Transfer to the vendor's linked bank account / UPI.
 *
 * Body: { bookingId: string }
 *
 * AB2-H6 FIX: Optimistic locking to prevent double payout.
 * The DB claim (payout_id='pending') happens BEFORE the external
 * Razorpay API call, not after. This eliminates the race window where two
 * concurrent requests both call rz.payouts.create() before either records the result.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getRazorpay } from '@/lib/razorpay'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { bookingId } = await req.json()
    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

    const supabase = createServerClient()

    // Fetch booking — must be completed + proof_approved + not yet paid out
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, vendor_id, vendor_payout, status, proof_approved, payment_id, payout_id, listings(title)')
      .eq('id', bookingId)
      .eq('vendor_id', user.id)
      .single()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status !== 'completed') return NextResponse.json({ error: 'Booking must be completed' }, { status: 400 })
    if (!booking.proof_approved) return NextResponse.json({ error: 'Proof must be approved first' }, { status: 400 })
    if (booking.payout_id) return NextResponse.json({ error: 'Payout already initiated' }, { status: 400 })

    // Fetch vendor payout details
    const { data: vendor } = await supabase
      .from('users')
      .select('id, name, upi_id, bank_account_number, bank_ifsc, bank_account_name')
      .eq('id', user.id)
      .single()

    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const hasUpi = !!vendor.upi_id
    const hasBank = !!(vendor.bank_account_number && vendor.bank_ifsc && vendor.bank_account_name)

    if (!hasUpi && !hasBank) {
      return NextResponse.json({
        error: 'No payout method set. Please add your UPI ID or bank account in Profile → Payout Settings.',
      }, { status: 400 })
    }

    const payoutAmountPaise = Math.round(Number(booking.vendor_payout) * 100)
    if (payoutAmountPaise < 100) {
      return NextResponse.json({ error: 'Payout amount too small (minimum ₹1)' }, { status: 400 })
    }

    const listingRaw = booking.listings as unknown
    const listingObj = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, unknown> | undefined ?? null) : (listingRaw as Record<string, unknown> | null)
    const listingTitle = listingObj?.title as string ?? 'Ad Booking'

    // AB2-H6 FIX: Optimistic locking — claim the row BEFORE calling external API.
    // Only ONE request wins the race to rz.payouts.create(). Loser gets idempotent success.
    const claimTimestamp = new Date().toISOString()
    const { data: claimed } = await supabase
      .from('bookings')
      .update({ payout_id: 'pending', updated_at: claimTimestamp })
      .eq('id', bookingId)
      .eq('payout_id', null)
      .select('id')
      .single()

    if (!claimed) {
      return NextResponse.json({ success: true, message: 'Payout already initiated.', mode: 'idempotent' })
    }

    // We hold the lock. Proceed with Razorpay payout creation.
    let razorpayPayoutId: string | null = null
    let payoutMode: 'upi' | 'bank' | 'simulated' = 'simulated'
    let payoutFailed = false

    const accountNumber = process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER
    if (process.env.NODE_ENV === 'production' && !accountNumber) {
      // AB2-C5 FIX: Throw instead of silently setting payoutFailed and continuing.
      // The previous code set payoutFailed=true then returned 502 on line 179, but execution
      // continued past that return to line 182 which returned success with mode='simulated'.
      // Throwing here ensures the catch block returns 500, making the failure explicit.
      throw new Error(
        '[payout] RAZORPAY_PAYOUT_ACCOUNT_NUMBER not configured in production environment. ' +
        'Payouts cannot be processed. Set RAZORPAY_PAYOUT_ACCOUNT_NUMBER env var.',
      )
    } else if (!accountNumber) {
      payoutMode = 'simulated'
    } else {
      try {
        const rz = getRazorpay()
        if (hasUpi) {
          payoutMode = 'upi'
          const resp = await (rz as unknown as {
            payouts: { create: (o: Record<string, unknown>) => Promise<{ id: string }> }
          }).payouts.create({
            account_number: accountNumber,
            fund_account: {
              account_type: 'vpa',
              vpa: { address: vendor.upi_id },
              contact: { name: vendor.name ?? 'Vendor', type: 'vendor', email: user.email ?? undefined },
            },
            amount: payoutAmountPaise,
            currency: 'INR',
            mode: 'UPI',
            purpose: 'payout',
            narration: `AdBazaar payout: ${listingTitle.slice(0, 30)}`,
            notes: { bookingId, listingTitle },
          })
          razorpayPayoutId = resp.id
        } else if (hasBank) {
          payoutMode = 'bank'
          const resp = await (rz as unknown as {
            payouts: { create: (o: Record<string, unknown>) => Promise<{ id: string }> }
          }).payouts.create({
            account_number: accountNumber,
            fund_account: {
              account_type: 'bank_account',
              bank_account: { name: vendor.bank_account_name, ifsc: vendor.bank_ifsc, account_number: vendor.bank_account_number },
              contact: { name: vendor.name ?? 'Vendor', type: 'vendor', email: user.email ?? undefined },
            },
            amount: payoutAmountPaise,
            currency: 'INR',
            mode: 'IMPS',
            purpose: 'payout',
            narration: `AdBazaar payout: ${listingTitle.slice(0, 30)}`,
            notes: { bookingId, listingTitle },
          })
          razorpayPayoutId = resp.id
        }
      } catch (e) {
        logger.error('Razorpay payout error', e)
        payoutFailed = true
      }
    }

    // Record final payout state — replace 'pending' placeholder with real ID
    const payoutRef = razorpayPayoutId ?? `manual_${bookingId}_${Date.now()}`
    const { error: finalUpdateError } = await supabase
      .from('bookings')
      .update({ payout_id: payoutRef, payout_initiated_at: claimTimestamp, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('payout_id', 'pending')
    if (finalUpdateError) {
      logger.error('[payout] failed to update final payout_id', finalUpdateError)
    }

    // Notify vendor
    const notificationBody = payoutFailed
      ? `Payout attempt for "${listingTitle}" failed. Please contact support.`
      : payoutMode === 'simulated'
        ? `₹${Number(booking.vendor_payout).toLocaleString('en-IN')} payout recorded for "${listingTitle}". Contact admin for transfer.`
        : `₹${Number(booking.vendor_payout).toLocaleString('en-IN')} payout initiated via ${payoutMode.toUpperCase()} for "${listingTitle}".`

    await insertNotification({
      user_id: user.id,
      type: payoutFailed ? 'payout_failed' : 'payout_initiated',
      title: payoutFailed ? 'Payout failed' : 'Payout initiated',
      body: notificationBody,
      link: '/vendor/earnings',
    }).catch((e) => logger.error('notification insert failed', e))

    if (payoutFailed) {
      return NextResponse.json({ error: 'Payout failed. Please try again or contact support.' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      payoutId: payoutRef,
      mode: payoutMode,
      amount: Number(booking.vendor_payout),
      message: payoutMode === 'simulated'
        ? 'Payout recorded. Admin will transfer funds manually.'
        : `Payout of ₹${Number(booking.vendor_payout).toLocaleString('en-IN')} initiated via ${payoutMode.toUpperCase()}.`,
    })
  } catch (e) {
    logger.error('POST /api/vendor/payout error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
