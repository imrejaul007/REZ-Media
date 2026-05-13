import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    // Auth via Bearer token
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vendorId = user.id
    const supabase = createServerClient()

    // Fetch vendor's bookings with listings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, listing_id, amount, status, created_at, vendor_payout, listings(title, city, area, category)')
      .eq('vendor_id', vendorId)
      .not('status', 'in', '(cancelled,inquiry)')
      .order('created_at', { ascending: false })

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        totalScans: 0,
        totalVisits: 0,
        totalPayout: 0,
        bookings: [],
      })
    }

    const bookingIds = bookings.map((b) => b.id)

    // Fetch QR codes for these bookings
    const { data: qrCodes, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, booking_id, total_scans, unique_scanners')
      .in('booking_id', bookingIds)

    if (qrError) {
      return NextResponse.json({ error: qrError.message }, { status: 500 })
    }

    const qrIds = (qrCodes ?? []).map((q) => q.id)

    // Fetch scan events
    const { data: scanEvents, error: scanError } = qrIds.length > 0
      ? await supabase
          .from('scan_events')
          .select('id, qr_id, rez_app_opened')
          .in('qr_id', qrIds)
      : { data: [], error: null }

    if (scanError) {
      return NextResponse.json({ error: scanError.message }, { status: 500 })
    }

    // Fetch attributions
    const { data: attributions, error: attrError } = qrIds.length > 0
      ? await supabase
          .from('attribution')
          .select('id, qr_id, booking_id, revenue_amount, purchase_timestamp')
          .in('qr_id', qrIds)
      : { data: [], error: null }

    if (attrError) {
      return NextResponse.json({ error: attrError.message }, { status: 500 })
    }

    // Build maps
    const qrToBooking = new Map<string, string>()
    for (const qr of qrCodes ?? []) {
      if (qr.booking_id) qrToBooking.set(qr.id, qr.booking_id)
    }

    // Aggregate per booking
    const perBooking = new Map<string, { scans: number; uniqueScanners: number; visits: number; purchases: number; revenue: number }>()
    for (const b of bookings) {
      perBooking.set(b.id, { scans: 0, uniqueScanners: 0, visits: 0, purchases: 0, revenue: 0 })
    }

    // From QR code totals
    for (const qr of qrCodes ?? []) {
      if (!qr.booking_id) continue
      const agg = perBooking.get(qr.booking_id)
      if (!agg) continue
      agg.scans += qr.total_scans ?? 0
      agg.uniqueScanners += qr.unique_scanners ?? 0
    }

    // From scan events (live visits)
    for (const scan of scanEvents ?? []) {
      const bookingId = qrToBooking.get(scan.qr_id)
      if (!bookingId) continue
      const agg = perBooking.get(bookingId)
      if (!agg) continue
      if (scan.rez_app_opened) agg.visits += 1
    }

    // From attributions
    for (const attr of attributions ?? []) {
      const bookingId = attr.booking_id ?? qrToBooking.get(attr.qr_id ?? '')
      if (!bookingId) continue
      const agg = perBooking.get(bookingId)
      if (!agg) continue
      if (attr.purchase_timestamp) agg.purchases += 1
      if (attr.revenue_amount) agg.revenue += Number(attr.revenue_amount)
    }

    // Build result rows
    const rows = bookings.map((b) => {
      const agg = perBooking.get(b.id) ?? { scans: 0, uniqueScanners: 0, visits: 0, purchases: 0, revenue: 0 }
      const listingRaw = b.listings as unknown
      const listing = Array.isArray(listingRaw) ? (listingRaw[0] as Record<string, unknown> | undefined ?? null) : (listingRaw as Record<string, unknown> | null)
      return {
        bookingId: b.id,
        listingTitle: (listing?.title as string) ?? 'Unknown listing',
        city: (listing?.city as string) ?? '',
        area: (listing?.area as string) ?? '',
        category: (listing?.category as string) ?? '',
        status: b.status,
        bookingAmount: Number(b.amount),
        vendorPayout: Number(b.vendor_payout ?? 0),
        createdAt: b.created_at,
        totalScans: agg.scans,
        uniqueScanners: agg.uniqueScanners,
        visits: agg.visits,
        purchases: agg.purchases,
        revenueAttributed: Math.round(agg.revenue),
        scanRate: agg.scans > 0 ? Math.round((agg.visits / agg.scans) * 100) : 0,
      }
    })

    const totalScans = rows.reduce((a, b) => a + b.totalScans, 0)
    const totalVisits = rows.reduce((a, b) => a + b.visits, 0)
    const totalPayout = rows.reduce((a, b) => a + b.vendorPayout, 0)

    return NextResponse.json({ totalScans, totalVisits, totalPayout, bookings: rows })
  } catch (e) {
    logger.error('GET /api/vendor/attribution error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
