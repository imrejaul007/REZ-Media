import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { BookingStatus } from '@/types'
import { emailQuoteAccepted } from '@/lib/email'
import { RAZORPAY_KEY_ID } from '@/lib/razorpay'
import { createRazorpayOrder } from '@/lib/paymentService'
import { generateQRCode, generateSlug } from '@/lib/qr'
import { insertNotification } from '@/lib/notifications'

// POST /api/inquiries/[id]/accept
// Buyer accepts the vendor's quote — creates a confirmed booking + Razorpay order.
// Returns booking + razorpayOrder just like POST /api/bookings.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: inquiryId } = await params
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: inquiry } = await supabase
      .from('inquiries')
      .select('*, listings(id, category, title)')
      .eq('id', inquiryId)
      .single()

    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 })
    if (inquiry.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (inquiry.status !== 'quoted') return NextResponse.json({ error: 'Inquiry has no quote yet' }, { status: 400 })

    // AB3-H4 FIX: vendor_id can be null — guard against it
    const vendorId = inquiry.vendor_id
    if (!vendorId) {
      return NextResponse.json({ error: 'Inquiry has no vendor assigned' }, { status: 400 })
    }

    // AB2-H5 FIX: check listing is still active before accepting inquiry
    const listing = inquiry.listings as Record<string, unknown>
    if ((listing?.status as string) !== 'active') {
      return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 })
    }

    // Fetch listing to get purchase_bonus_pct for QR code
    const { data: listingRow } = await supabase
      .from('listings')
      .select('purchase_bonus_pct')
      .eq('id', inquiry.listing_id)
      .single()
    const purchaseBonusPct: number = (listingRow as Record<string, unknown>)?.purchase_bonus_pct as number ?? 5

    // AB2-H8 FIX: Atomic acceptance with quote expiry enforcement.
    // We use an UPDATE with conditional WHERE to atomically:
    // 1. Verify quote is not expired
    // 2. Verify inquiry is still in 'quoted' status
    // 3. Change status to 'accepted' in the same operation
    // This eliminates the race window where two concurrent requests both pass
    // the expiry check before either creates a booking.
    const now = new Date().toISOString()
    const quoteExpired = inquiry.quote_valid_until && new Date(inquiry.quote_valid_until) < new Date()
    const { data: acceptedInquiry, error: acceptError } = await supabase
      .from('inquiries')
      .update({
        status: 'accepted',
        updated_at: now,
      })
      .eq('id', inquiryId)
      .eq('status', 'quoted')  // Must be quoted to accept
      .eq('quote_valid_until', inquiry.quote_valid_until)  // Lock to this specific expiry value
      .gt('quote_valid_until', now)  // AB2-H8 FIX: Enforce expiry atomically in the WHERE clause
      .select('id, status')
      .single()

    if (acceptError || !acceptedInquiry) {
      // Determine why acceptance failed
      if (quoteExpired) {
        return NextResponse.json({ error: 'Quote has expired' }, { status: 400 })
      }
      // Check if already accepted by another request
      const { data: currentInquiry } = await supabase
        .from('inquiries')
        .select('status')
        .eq('id', inquiryId)
        .single()
      if (currentInquiry?.status === 'accepted') {
        return NextResponse.json({ error: 'Quote already accepted' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Quote can no longer be accepted' }, { status: 400 })
    }

    // AB2-C2 FIX: Quote amount is the final price buyer pays — no additional commission.
    // This differs from direct bookings where commission is added on top of listing price.
    // For quote bookings, the vendor sets a final negotiated price that includes their margin.
    const subtotal = Number(inquiry.quote_amount)
    const commissionAmount = 0
    const total = subtotal
    const vendorPayout = subtotal // Vendor gets their quoted amount

    // Create booking (inquiry is already marked as accepted atomically above)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        listing_id: inquiry.listing_id,
        buyer_id: user.id,
        vendor_id: inquiry.vendor_id,
        start_date: inquiry.start_date ?? null,
        end_date: inquiry.end_date ?? null,
        slots: [],
        amount: total,
        commission_rate: 0, // No commission on quote bookings (AB2-C2)
        commission_amount: commissionAmount,
        vendor_payout: vendorPayout,
        status: BookingStatus.Confirmed,
        creative_instructions: inquiry.requirements ?? null,
        proof_of_execution: [],
        proof_approved: false,
        notes: `From inquiry ${inquiryId}`,
      })
      .select()
      .single()

    if (bookingError || !booking) {
      // Roll back: revert inquiry status if booking creation failed
      await supabase
        .from('inquiries')
        .update({ status: 'quoted', updated_at: new Date().toISOString() })
        .eq('id', inquiryId)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // Link booking to inquiry (update the accepted inquiry record)
    await supabase
      .from('inquiries')
      .update({ booking_id: booking.id })
      .eq('id', inquiryId)

    // Create QR code (is_active: false until payment verified)
    const qrSlug = generateSlug()
    const listingTitle = (listing?.title as string) ?? 'Ad Booking'
    await supabase.from('qr_codes').insert({
      booking_id: booking.id,
      listing_id: inquiry.listing_id,
      coins_per_scan: 20,
      visit_bonus_coins: 100,
      purchase_bonus_pct: purchaseBonusPct, // AB-B2 FIX: read from listing config, not hardcoded
      qr_slug: qrSlug,
      qr_label: listingTitle,
      poster_index: 1,
      total_scans: 0,
      unique_scanners: 0,
      is_active: false,
    })

    // Generate QR image (background, non-blocking but logged)
    generateQRCode(qrSlug)
      .then(async (url) => {
        await supabase.from('qr_codes').update({ qr_image_url: url }).eq('qr_slug', qrSlug)
      })
      .catch((e) => logger.error('[inquiry/accept] QR image generation error', e))

    // AB2-H8 NOTE: Inquiry was already marked as 'accepted' atomically at the start
    // (see AB2-H8 FIX above). We only update booking_id here.

    // Create Razorpay order via REZ Payment Service
    let razorpayOrder: { id: string; amount: number; currency: string } | null = null
    try {
      const order = await createRazorpayOrder(
        total,            // rupees
        booking.id,       // receipt
        { bookingId: booking.id, inquiryId },
        booking.id,       // orderId
      )
      razorpayOrder = { id: order.id, amount: order.amount, currency: order.currency }
      await supabase.from('bookings').update({ payment_order_id: order.id }).eq('id', booking.id)
    } catch (e) {
      logger.error('Razorpay order error (inquiry accept)', e)
      // Roll back booking and QR so inquiry can be retried
      await supabase.from('qr_codes').delete().eq('booking_id', booking.id)
      await supabase.from('bookings').delete().eq('id', booking.id)
      await supabase.from('inquiries').update({ status: 'quoted', booking_id: null }).eq('id', inquiryId)
      return NextResponse.json({ error: 'Payment gateway unavailable. Please try again.' }, { status: 502 })
    }

    // Notify vendor of booking confirmed
    await insertNotification({
      user_id: inquiry.vendor_id,
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: `A buyer accepted your quote for "${(listing?.title as string) ?? 'your listing'}"`,
      link: '/vendor/bookings',
    }).catch((e) => logger.error('notification insert failed', e))

    // AB-H3 FIX: Fire email to vendor with proper error handling
    // Fetch users and send email, non-blocking but logged on failure
    ;(async () => {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, name')
          .in('id', [user.id, inquiry.vendor_id])

        const buyer = users?.find((u) => u.id === user.id)
        const vendor = users?.find((u) => u.id === inquiry.vendor_id)
        if (vendor?.email) {
          await emailQuoteAccepted({
            vendorEmail: vendor.email,
            vendorName: vendor.name ?? 'there',
            buyerName: buyer?.name ?? 'A buyer',
            listingTitle: (listing?.title as string) ?? 'your listing',
            amount: total,
            bookingId: booking.id,
          })
        }
      } catch (e) {
        logger.error('[inquiry/accept] emailQuoteAccepted failed', e)
      }
    })()

    return NextResponse.json({
      booking: { ...booking, payment_order_id: razorpayOrder?.id ?? null },
      razorpayOrder,
      razorpayKeyId: RAZORPAY_KEY_ID,
    })
  } catch (e) {
    logger.error('POST /api/inquiries/[id]/accept error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
