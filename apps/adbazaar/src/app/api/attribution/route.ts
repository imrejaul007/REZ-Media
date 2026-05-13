import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

interface BookingAttribution {
  bookingId: string
  listingTitle: string
  bookingAmount: number
  totalScans: number
  visits: number
  purchases: number
  revenueAttributed: number
  roi: number
  costPerScan: number
  costPerVisit: number
  costPerAcquisition: number
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId')

    // Auth via Bearer token — buyerId derived from authenticated user
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null // AB2-M18 FIX: safe extraction
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const buyerId = user.id

    // Fetch buyer's bookings
    let bookingQuery = supabase
      .from('bookings')
      .select('id, listing_id, amount, listings(title)')
      .eq('buyer_id', buyerId)
      .not('status', 'in', '(cancelled,inquiry)')

    if (campaignId) {
      bookingQuery = bookingQuery.eq('campaign_id', campaignId)
    }

    const { data: bookings, error: bookingsError } = await bookingQuery

    if (bookingsError) {
      logger.error('GET /api/attribution error', bookingsError, { path: '/api/attribution' })
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        totalScans: 0,
        totalVisits: 0,
        totalRevenue: 0,
        bookings: [],
      })
    }

    const bookingIds = bookings.map(b => b.id)

    // Fetch all QR codes for these bookings
    const { data: qrCodes, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, booking_id, coins_per_scan')
      .in('booking_id', bookingIds)

    if (qrError) {
      logger.error('GET /api/attribution QR error', qrError, { path: '/api/attribution' })
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    const qrIds = (qrCodes ?? []).map(q => q.id)

    // Fetch all scan events
    const { data: scanEvents, error: scanError } = qrIds.length > 0
      ? await supabase
          .from('scan_events')
          .select('id, qr_id, rez_app_opened')
          .in('qr_id', qrIds)
      : { data: [], error: null }

    if (scanError) {
      logger.error('GET /api/attribution scan error', scanError, { path: '/api/attribution' })
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    // Fetch attribution records
    const { data: attributions, error: attrError } = qrIds.length > 0
      ? await supabase
          .from('attribution')
          .select('id, qr_id, booking_id, revenue_amount, visit_timestamp, purchase_timestamp')
          .in('qr_id', qrIds)
      : { data: [], error: null }

    if (attrError) {
      logger.error('GET /api/attribution attribution error', attrError, { path: '/api/attribution' })
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
    }

    // Build lookup maps
    const qrToBooking = new Map<string, string>()
    for (const qr of (qrCodes ?? [])) {
      if (qr.booking_id) qrToBooking.set(qr.id, qr.booking_id)
    }

    // Aggregate per booking
    const perBooking = new Map<string, {
      scans: number
      visits: number
      purchases: number
      revenue: number
    }>()

    for (const bookingId of bookingIds) {
      perBooking.set(bookingId, { scans: 0, visits: 0, purchases: 0, revenue: 0 })
    }

    for (const scan of (scanEvents ?? [])) {
      const bookingId = qrToBooking.get(scan.qr_id)
      if (!bookingId) continue
      const agg = perBooking.get(bookingId)
      if (!agg) continue
      agg.scans += 1
      if (scan.rez_app_opened) agg.visits += 1
    }

    for (const attr of (attributions ?? [])) {
      const bookingId = attr.booking_id ?? qrToBooking.get(attr.qr_id ?? '')
      if (!bookingId) continue
      const agg = perBooking.get(bookingId)
      if (!agg) continue
      if (attr.visit_timestamp) agg.visits = Math.max(agg.visits, 0) // already counted via scan_events
      if (attr.purchase_timestamp) agg.purchases += 1
      if (attr.revenue_amount) agg.revenue += Number(attr.revenue_amount)
    }

    // Build result rows
    const bookingRows: BookingAttribution[] = bookings.map(b => {
      const agg = perBooking.get(b.id) ?? { scans: 0, visits: 0, purchases: 0, revenue: 0 }
      const amount = Number(b.amount)
      const roi = amount > 0 ? (agg.revenue / amount) * 100 : 0
      const costPerScan = agg.scans > 0 ? amount / agg.scans : 0
      const costPerVisit = agg.visits > 0 ? amount / agg.visits : 0
      const costPerAcquisition = agg.purchases > 0 ? amount / agg.purchases : 0
      const listingRaw = b.listings as unknown
      const listing = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, unknown> | undefined ?? null) : (listingRaw as Record<string, unknown> | null)

      return {
        bookingId: b.id,
        listingTitle: (listing?.title as string) ?? 'Unknown listing',
        bookingAmount: amount,
        totalScans: agg.scans,
        visits: agg.visits,
        purchases: agg.purchases,
        revenueAttributed: Math.round(agg.revenue),
        roi: Math.round(roi * 10) / 10,
        costPerScan: Math.round(costPerScan * 100) / 100,
        costPerVisit: Math.round(costPerVisit * 100) / 100,
        costPerAcquisition: Math.round(costPerAcquisition * 100) / 100,
      }
    })

    // Summary totals
    const totalScans = bookingRows.reduce((a, b) => a + b.totalScans, 0)
    const totalVisits = bookingRows.reduce((a, b) => a + b.visits, 0)
    const totalRevenue = bookingRows.reduce((a, b) => a + b.revenueAttributed, 0)

    return NextResponse.json({
      totalScans,
      totalVisits,
      totalRevenue,
      bookings: bookingRows,
    })
  } catch (e) {
    logger.error('GET /api/attribution error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
