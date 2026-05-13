import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // AB3-M9 FIX: use createServerClient for auth to avoid mixing two client instances
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
    )
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const bookingId = req.nextUrl.searchParams.get('bookingId')
    const rawDays = parseInt(req.nextUrl.searchParams.get('days') || '30', 10)
    if (isNaN(rawDays) || rawDays <= 0) {
      return NextResponse.json({ error: 'Invalid days parameter' }, { status: 400 })
    }
    const days = rawDays
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Fetch vendor's bookings (optionally filtered by bookingId)
    const bookingsQuery = supabase
      .from('bookings')
      .select('id, status, amount, start_date, end_date, listings(id, title, city, area, category, images)')
      .eq('vendor_id', user.id)
      .not('status', 'in', ['cancelled', 'inquiry', 'refunded']) // AB3-H1 FIX: array, not string; AB-B5 FIX: exclude refunded bookings from earnings
      .order('created_at', { ascending: false })

    const { data: bookings, error: bookingsError } = bookingId
      ? await bookingsQuery.eq('id', bookingId)
      : await bookingsQuery

    if (bookingsError) return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ bookings: [], totals: emptyTotals() })
    }

    const bookingIds = bookings.map(b => b.id)

    // Fetch all QR codes for these bookings
    const { data: qrCodes } = await supabase
      .from('qr_codes')
      .select('id, booking_id, qr_slug, qr_label, poster_index, creative_image_url, total_scans, unique_scanners, coins_per_scan, is_active, created_at, qr_image_url')
      .in('booking_id', bookingIds)
      .order('poster_index', { ascending: true })

    const qrIds = (qrCodes ?? []).map(q => q.id)

    if (qrIds.length === 0) {
      return NextResponse.json({
        bookings: bookings.map(b => mapBooking(b, [], [], [], since, days)),
        totals: emptyTotals(),
      })
    }

    // Fetch scan events within window
    const { data: scanEvents } = await supabase
      .from('scan_events')
      .select('id, qr_id, timestamp, device_type, city_derived, rez_app_opened, coins_amount')
      .in('qr_id', qrIds)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true })

    // Fetch attributions
    const { data: attributions } = await supabase
      .from('attribution')
      .select('id, qr_id, booking_id, visit_timestamp, purchase_timestamp, revenue_amount')
      .in('qr_id', qrIds)

    const result = bookings.map(b =>
      mapBooking(
        b,
        (qrCodes ?? []).filter(q => q.booking_id === b.id),
        scanEvents ?? [],
        attributions ?? [],
        since,
        days,
      )
    )

    // Platform totals
    const allScans = (scanEvents ?? [])
    const allAttr = (attributions ?? [])
    const totals = {
      totalScans: allScans.length,
      uniqueScanners: new Set(
        allScans.map(s => s.qr_id + '|' + (s.city_derived || 'x'))
      ).size, // approximation; true unique by IP not available
      totalAppOpens: allScans.filter(s => s.rez_app_opened).length,
      totalVisits: allAttr.filter(a => a.visit_timestamp).length,
      totalPurchases: allAttr.filter(a => a.purchase_timestamp).length,
      totalCoins: allScans.reduce((s, e) => s + (e.coins_amount || 0), 0),
      totalRevenue: allAttr.reduce((s, a) => s + Number(a.revenue_amount || 0), 0),
      deviceBreakdown: deviceBreakdown(allScans),
      topCities: topCities(allScans),
    }

    return NextResponse.json({ bookings: result, totals })
  } catch (e) {
    logger.error('GET /api/vendor/analytics error', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function emptyTotals() {
  return {
    totalScans: 0, uniqueScanners: 0, totalAppOpens: 0,
    totalVisits: 0, totalPurchases: 0, totalCoins: 0, totalRevenue: 0,
    deviceBreakdown: [], topCities: [],
  }
}

function deviceBreakdown(scans: { device_type?: string | null }[]) {
  const counts: Record<string, number> = {}
  for (const s of scans) {
    const d = s.device_type || 'unknown'
    counts[d] = (counts[d] || 0) + 1
  }
  return Object.entries(counts)
    .map(([device, count]) => ({ device, count }))
    .sort((a, b) => b.count - a.count)
}

function topCities(scans: { city_derived?: string | null }[]) {
  const counts: Record<string, number> = {}
  for (const s of scans) {
    if (!s.city_derived) continue
    counts[s.city_derived] = (counts[s.city_derived] || 0) + 1
  }
  return Object.entries(counts)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function dailyTimeline(scans: { timestamp: string }[], days: number) {
  // Build a map of date → count for last `days` days
  const counts: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    counts[d] = 0
  }
  for (const s of scans) {
    const d = s.timestamp.slice(0, 10)
    if (d in counts) counts[d]++
  }
  return Object.entries(counts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))
}

interface RawBooking {
  id: string
  status: string
  amount: number
  start_date: string
  end_date: string
  listings: { id: string; title: string; city: string; area: string; category: string; images: string[] | null } | { id: string; title: string; city: string; area: string; category: string; images: string[] | null }[] | null
}

interface RawQr {
  id: string
  qr_slug: string
  qr_label: string
  poster_index: number
  creative_image_url: string | null
  qr_image_url: string | null
  total_scans: number
  unique_scanners: number
  coins_per_scan: number
  is_active: boolean
  created_at: string
}

interface RawScan {
  id: string
  qr_id: string
  timestamp: string
  device_type: string | null
  city_derived: string | null
  rez_app_opened: boolean
  coins_amount: number
}

interface RawAttribution {
  id: string
  qr_id: string
  booking_id: string
  visit_timestamp: string | null
  purchase_timestamp: string | null
  revenue_amount: string | null
}

function mapBooking(booking: RawBooking, qrs: RawQr[], allScans: RawScan[], allAttr: RawAttribution[], since: string, days: number) {
  const listing = Array.isArray(booking.listings) ? booking.listings[0] : booking.listings

  const bookingQrIds = new Set(qrs.map(q => q.id))
  const bookingScans = allScans.filter(s => bookingQrIds.has(s.qr_id))
  const bookingAttr = allAttr.filter(a => bookingQrIds.has(a.qr_id))

  const qrRows = qrs.map(qr => {
    const qrScans = allScans.filter(s => s.qr_id === qr.id)
    const qrAttr = allAttr.filter(a => a.qr_id === qr.id)
    const windowScans = qrScans // already filtered to since
    const appOpens = windowScans.filter(s => s.rez_app_opened).length
    const visits = qrAttr.filter(a => a.visit_timestamp).length
    const purchases = qrAttr.filter(a => a.purchase_timestamp).length
    const coins = windowScans.reduce((sum, s) => sum + (s.coins_amount || 0), 0)
    return {
      id: qr.id,
      slug: qr.qr_slug,
      label: qr.qr_label || `QR Code ${qr.poster_index}`,
      posterIndex: qr.poster_index,
      creativeImageUrl: qr.creative_image_url || null,
      qrImageUrl: qr.qr_image_url || null,
      isActive: qr.is_active,
      totalScansAllTime: qr.total_scans,
      uniqueScannersAllTime: qr.unique_scanners,
      windowScans: windowScans.length,
      appOpens,
      visits,
      purchases,
      coinsDistributed: coins,
      conversionRate: windowScans.length > 0 ? Math.round((visits / windowScans.length) * 100) : 0,
      deviceBreakdown: deviceBreakdown(windowScans),
      topCities: topCities(windowScans),
      timeline: dailyTimeline(windowScans, days),
      lastScanAt: qrScans.length > 0 ? qrScans[qrScans.length - 1]?.timestamp : null,
    }
  })

  const windowScans = bookingScans
  const visits = bookingAttr.filter(a => a.visit_timestamp).length
  const purchases = bookingAttr.filter(a => a.purchase_timestamp).length
  const revenue = bookingAttr.reduce((s, a) => s + Number(a.revenue_amount || 0), 0)
  const coins = windowScans.reduce((s, e) => s + (e.coins_amount || 0), 0)

  return {
    bookingId: booking.id,
    status: booking.status,
    amount: booking.amount,
    startDate: booking.start_date,
    endDate: booking.end_date,
    listing: listing ? {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      area: listing.area,
      category: listing.category,
      thumbnail: listing.images?.[0] || null,
    } : null,
    qrCodes: qrRows,
    summary: {
      totalScans: windowScans.length,
      totalScansAllTime: qrs.reduce((s: number, q: { total_scans: number }) => s + q.total_scans, 0),
      uniqueScanners: qrs.reduce((s: number, q: { unique_scanners: number }) => s + q.unique_scanners, 0),
      appOpens: windowScans.filter((s: { rez_app_opened: boolean }) => s.rez_app_opened).length,
      visits,
      purchases,
      coinsDistributed: coins,
      revenueAttributed: Math.round(revenue),
      conversionRate: windowScans.length > 0 ? Math.round((visits / windowScans.length) * 100) : 0,
      deviceBreakdown: deviceBreakdown(windowScans),
      topCities: topCities(windowScans),
      timeline: dailyTimeline(windowScans, days),
    },
  }
}
