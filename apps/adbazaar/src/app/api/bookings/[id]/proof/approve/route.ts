import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { BookingStatus } from '@/types'
import { emailProofApproved } from '@/lib/email'
import logger from '@/lib/logger'
import { insertNotification } from '@/lib/notifications'

// POST /api/bookings/[id]/proof/approve
// Buyer approves proof of execution → booking moves to Completed,
// which signals the escrow release to the vendor.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: bookingId } = await params

    // Auth
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

    // Verify booking ownership (buyer)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, buyer_id, vendor_id, vendor_payout, status, proof_of_execution, proof_approved, listings(title)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.proof_approved) {
      return NextResponse.json({ error: 'Proof already approved' }, { status: 400 })
    }
    if (booking.status !== BookingStatus.Executing) {
      return NextResponse.json({ error: 'Booking must be in executing status to approve proof' }, { status: 400 })
    }
    if (!Array.isArray(booking.proof_of_execution) || booking.proof_of_execution.length === 0) {
      return NextResponse.json({ error: 'No proof uploaded yet' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        proof_approved: true,
        proof_approved_at: new Date().toISOString(),
        status: BookingStatus.Completed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .select('id, status, proof_approved, proof_approved_at')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Notify vendor of proof approved
    await insertNotification({
      user_id: booking.vendor_id,
      type: 'proof_approved',
      title: 'Proof approved',
      body: `Your execution proof was approved. Payout of ₹${Number(booking.vendor_payout).toLocaleString('en-IN')} queued.`,
      link: '/vendor/earnings',
    }).catch((e) => logger.error('notification insert failed', e))

    // AB-H3 FIX: Send email to vendor with proper error handling
    const listingRaw = booking.listings as unknown
    const listingObj = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, string> | undefined ?? null) : (listingRaw as Record<string, string> | null)
    ;(async () => {
      try {
        const { data: vendor } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('id', booking.vendor_id)
          .single()

        if (vendor?.email) {
          await emailProofApproved({
            vendorEmail: vendor.email,
            vendorName: vendor.name ?? 'there',
            listingTitle: listingObj?.title ?? 'your booking',
            payout: Number(booking.vendor_payout),
          })
        }
      } catch (e) {
        logger.error('[proof/approve] emailProofApproved failed', e)
      }
    })()

    return NextResponse.json({ booking: updated })
  } catch (e) {
    logger.error('POST /api/bookings/[id]/proof/approve error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
