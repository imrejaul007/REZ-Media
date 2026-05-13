import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import logger from '@/lib/logger'
import { generateQRCode, generateSlug } from '@/lib/qr'
import { COMMISSION_RATES } from '@/lib/constants'
import { BookingStatus } from '@/types'
import { triggerMarketingBroadcast } from '@/lib/marketing'
import { RAZORPAY_KEY_ID } from '@/lib/razorpay'
import { createRazorpayOrder } from '@/lib/paymentService'
import { BookingCreateSchema } from '@/lib/schemas'
import { validateEnv } from '@/lib/env' // AB-SEC-ENV-01: Environment validation

export async function POST(req: NextRequest) {
  // AB-SEC-ENV-01: Validate environment on every request
  validateEnv()
  try {
    // AB-C4 FIX: Accept idempotency key from header to prevent duplicate booking creation
    // when the client retries after a network timeout.
    const idempotencyKey = req.headers.get('Idempotency-Key') ?? undefined

    const rawBody = await req.json()
    const parsed = BookingCreateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      )
    }
    const body = parsed.data
    const {
      listingId,
      startDate,
      endDate,
      slots,
      coinsPerScan,
      visitBonusCoins,
      rezMerchantId,
      creativeInstructions,
      broadcastConfig,
    } = body

    if (!listingId) {
      return NextResponse.json({ error: 'listingId is required' }, { status: 400 })
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

    // AB-C4 FIX: Check if a booking with this idempotency key already exists for this user.
    // Return the existing booking so the client gets a deterministic result.
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('bookings')
        .select('id, status, payment_order_id')
        .eq('buyer_id', user.id)
        .eq('idempotency_key', idempotencyKey)
        .single()
      if (existing) {
        return NextResponse.json({
          booking: { id: existing.id },
          qrCode: null,
          razorpayOrder: existing.payment_order_id ? { id: existing.payment_order_id } : null,
          razorpayKeyId: RAZORPAY_KEY_ID,
          idempotent: true,
        })
      }
    }

    // Fetch listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, vendor_id, price, category, subcategory, type_tag, title, availability_model, min_booking_days, status, qr_enabled, purchase_bonus_pct')
      .eq('id', listingId)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Guard: listing must be active
    if ((listing as Record<string, unknown>).status !== 'active') {
      return NextResponse.json({ error: 'This listing is not currently available for booking' }, { status: 400 })
    }

    // Guard: buyer cannot book their own listing
    if (listing.vendor_id === user.id) {
      return NextResponse.json({ error: 'You cannot book your own listing' }, { status: 400 })
    }

    // Calculate amount
    const pricePerUnit = listing.price ?? 0
    let durationDays = 0
    let subtotal = 0

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      // AB3-H6 FIX: validate date strings before using them
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
      }
      durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (durationDays < 1) {
        return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
      }
      const minDays = listing.min_booking_days ?? 1
      if (durationDays < minDays) {
        return NextResponse.json({ error: `Minimum booking duration is ${minDays} day${minDays !== 1 ? 's' : ''}` }, { status: 400 })
      }
      subtotal = durationDays * pricePerUnit
    } else if (slots !== undefined && !Array.isArray(slots)) {
      // AB3-H7 FIX: slots provided but wrong type — reject explicitly
      return NextResponse.json({ error: 'slots must be an array' }, { status: 400 })
    } else if (Array.isArray(slots) && slots.length > 0) {
      subtotal = slots.length * pricePerUnit
    } else {
      subtotal = pricePerUnit
    }

    const commissionRate = COMMISSION_RATES[listing.category] ?? 15
    const commissionAmount = Math.round(subtotal * commissionRate / 100)
    const total = subtotal + commissionAmount
    // Vendor payout is the subtotal (before commission). Commission is charged on top via `total`.
    const vendorPayout = subtotal

    const buyerId = user.id

    // Create booking with Inquiry status (awaiting payment)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        listing_id: listingId,
        buyer_id: buyerId,
        vendor_id: listing.vendor_id,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        slots: slots ?? [],
        amount: total,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        vendor_payout: vendorPayout,
        status: BookingStatus.Inquiry,
        creative_instructions: creativeInstructions ?? null,
        proof_of_execution: [],
        proof_approved: false,
        idempotency_key: idempotencyKey ?? null, // AB-C4 FIX: idempotency key
      })
      .select()
      .single()

    if (bookingError || !booking) {
      logger.error('Booking insert error', bookingError)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // Create QR code record (default: QR #1 for this booking)
    // AB2-M1 FIX: only create QR if listing has qr_enabled
    let qrCode = null
    const qrSlug = generateSlug() // defined unconditionally for use in broadcast URL
    if (listing.qr_enabled !== false) {
      const { data: qrData, error: qrError } = await supabase
        .from('qr_codes')
        .insert({
          booking_id: booking.id,
          listing_id: listingId,
          rez_merchant_id: rezMerchantId || null,
          coins_per_scan: coinsPerScan ?? 20,
          visit_bonus_coins: visitBonusCoins ?? 100,
          purchase_bonus_pct: (listing as Record<string, unknown>).purchase_bonus_pct ?? 5, // AB-B2 FIX: from listing config, fallback to 5
          qr_slug: qrSlug,
          qr_label: listing.title || 'QR Code 1',
          poster_index: 1,
          total_scans: 0,
          unique_scanners: 0,
          is_active: false,
        })
        .select()
        .single()
      qrCode = qrData
      if (qrError) {
        logger.error('QR insert error', qrError)
        // non-fatal — booking still created
      }

      // Generate QR image
      if (qrCode) {
        let qrImageUrl: string | null = null
        try {
          qrImageUrl = await generateQRCode(qrSlug)
          await supabase.from('qr_codes').update({ qr_image_url: qrImageUrl }).eq('id', qrCode.id)
        } catch (e) {
          logger.error('QR image generation error', e)
          // non-fatal
        }
        qrCode = { ...qrCode, qr_image_url: qrImageUrl }
      }
    }

    // Trigger marketing broadcast if applicable
    const isBroadcastType = listing.subcategory === 'WhatsApp Broadcast' || listing.type_tag === 'influencer'
    if (isBroadcastType && rezMerchantId && broadcastConfig) {
      const { channel = 'push', segment = 'all', broadcastTitle, broadcastBody, scheduledAt } = broadcastConfig
      const resolvedChannel = (channel ?? 'push') as 'push' | 'whatsapp' | 'sms'
      const resolvedSegment = (segment ?? 'all') as 'all' | 'high_value' | 'at_risk' | 'new_users'
      const scanUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/scan/${qrSlug}`

      // AB2-C6 FIX: await the broadcast and record result/warnings — don't silently discard errors
      try {
        const result = await triggerMarketingBroadcast({
          adBazaarBookingId: booking.id,
          rezMerchantId,
          channel: resolvedChannel,
          segment: resolvedSegment,
          title: broadcastTitle || listing.title,
          body: broadcastBody || `Check out this offer from ${listing.title}`,
          qrCodeUrl: scanUrl,
          coinsPerScan: coinsPerScan || 20,
          scheduledAt: scheduledAt ?? undefined,
        })
        if (result) {
          await supabase.from('bookings').update({ notes: `broadcast:${result.broadcastId}` }).eq('id', booking.id)
        }
      } catch (e) {
        logger.error('Marketing broadcast error', e)
        // Broadcast failure is logged — booking creation itself succeeded
      }
    }

    // Create Razorpay order via REZ Payment Service
    let razorpayOrder: { id: string; amount: number; currency: string } | null = null
    try {
      const order = await createRazorpayOrder(
        total,         // rupees (payment service converts to paise internally)
        booking.id,    // receipt
        {              // notes
          bookingId: booking.id,
          listingId,
          buyerId,
        },
        booking.id,    // orderId
      )
      razorpayOrder = { id: order.id, amount: order.amount, currency: order.currency }

      // Store the order id on the booking
      await supabase
        .from('bookings')
        .update({ payment_order_id: order.id })
        .eq('id', booking.id)
    } catch (e) {
      logger.error('Razorpay order creation error', e)
      // Clean up stranded booking and QR code so the user can retry cleanly
      const { error: delQrErr } = await supabase.from('qr_codes').delete().eq('booking_id', booking.id)
      if (delQrErr) logger.error('Failed to clean up stranded QR code', delQrErr, { bookingId: booking.id })
      const { error: delBookingErr } = await supabase.from('bookings').delete().eq('id', booking.id)
      if (delBookingErr) logger.error('Failed to clean up stranded booking', delBookingErr, { bookingId: booking.id })
      return NextResponse.json({ error: 'Payment gateway unavailable. Please try again.' }, { status: 502 })
    }

    // NOTE: Vendor notification fires from verify-payment after payment is confirmed,
    // not here — to avoid ghost notifications for unpaid bookings.

    return NextResponse.json({
      booking: { ...booking, payment_order_id: razorpayOrder?.id ?? null },
      qrCode, // AB2-M1 FIX: null when listing.qr_enabled === false
      razorpayOrder,
      razorpayKeyId: RAZORPAY_KEY_ID,
    })
  } catch (e) {
    logger.error('POST /api/bookings error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Auth — required for scoped queries
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    const { searchParams } = new URL(req.url)
    const role = searchParams.get('role') ?? 'buyer'

    // Resolve authenticated user id when token is present
    let authedUserId: string | null = null
    const supabase = await createClient()
    if (accessToken) {
      const { data: { user } } = await supabase.auth.getUser()
      authedUserId = user?.id ?? null
    }

    // Unauthenticated requests get nothing
    if (!authedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('bookings')
      .select(`
        id, listing_id, buyer_id, vendor_id, start_date, end_date,
        amount, vendor_payout, status, proof_of_execution, proof_approved, created_at,
        campaign_id,
        listings(id, title, city, area),
        vendor:users!vendor_id(name),
        buyer:users!buyer_id(name),
        qr_codes(qr_slug, qr_image_url),
        campaigns(name),
        messages(count),
        reviews(id)
      `)
      .order('created_at', { ascending: false })

    if (role === 'vendor') {
      query = query.eq('vendor_id', authedUserId)
    } else {
      query = query.eq('buyer_id', authedUserId)
    }

    const { data, error } = await query

    if (error) {
      logger.error('GET /api/bookings error', error, { path: '/api/bookings' })
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    const bookings = (data ?? []).map((b: Record<string, unknown>) => {
      const qrArr = b.qr_codes as Record<string, unknown>[] | Record<string, unknown> | null
      const qr = Array.isArray(qrArr) ? (qrArr[0] ?? null) : (qrArr ?? null)
      const listingRaw = b.listings as Record<string, unknown> | null
      return {
        id: b.id,
        listing_id: b.listing_id,
        listing_title: listingRaw?.title ?? 'Unknown listing',
        listing_city: listingRaw?.city ?? null,
        vendor_name: (b.vendor as Record<string, unknown> | null)?.name ?? 'Unknown vendor',
        buyer_name: (b.buyer as Record<string, unknown> | null)?.name ?? 'Unknown buyer',
        start_date: b.start_date,
        end_date: b.end_date,
        amount: b.amount,
        vendor_payout: b.vendor_payout,
        status: b.status,
        proof_of_execution: b.proof_of_execution,
        proof_approved: b.proof_approved,
        created_at: b.created_at,
        qr_slug: (qr as Record<string, unknown> | null)?.qr_slug ?? null,
        qr_image_url: (qr as Record<string, unknown> | null)?.qr_image_url ?? null,
        campaign_id: b.campaign_id ?? null,
        campaign_name: (b.campaigns as Record<string, unknown> | null)?.name ?? null,
        reviewed: Array.isArray(b.reviews) ? b.reviews.length > 0 : false,
        has_messages: (() => {
          const msgs = b.messages as Array<{ count: number }> | null
          return Array.isArray(msgs) && msgs.length > 0 && (msgs[0]?.count ?? 0) > 0
        })(),
      }
    })

    return NextResponse.json({ bookings })
  } catch (e) {
    logger.error('GET /api/bookings error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
