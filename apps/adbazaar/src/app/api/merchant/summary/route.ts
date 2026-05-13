import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { timingSafeEqual } from 'crypto'

export async function GET(req: NextRequest) {
  // Verify internal key
  const key = req.headers.get('x-internal-key') ?? ''
  const expected = Buffer.from(process.env.ADBAZAAR_INTERNAL_KEY ?? '')
  const actual = Buffer.from(key)
  if (!timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rezMerchantId = req.nextUrl.searchParams.get('rezMerchantId')
  if (!rezMerchantId) return NextResponse.json({ error: 'rezMerchantId required' }, { status: 400 })

  const supabase = createServerClient()

  // Fetch bookings where qr_codes.rez_merchant_id = rezMerchantId
  const { data: qrCodes } = await supabase
    .from('qr_codes')
    .select('id, booking_id, total_scans, is_active')
    .eq('rez_merchant_id', rezMerchantId)

  const bookingIds = (qrCodes ?? []).map(q => q.booking_id).filter(Boolean)
  const totalScans = (qrCodes ?? []).reduce((sum, q) => sum + (q.total_scans || 0), 0)
  const activeQr = (qrCodes ?? []).filter(q => q.is_active).length

  // Fetch attribution revenue
  const qrIds = (qrCodes ?? []).map(q => q.id)
  let revenueAttributed = 0
  if (qrIds.length > 0) {
    const { data: attr } = await supabase
      .from('attribution')
      .select('revenue_amount')
      .in('qr_id', qrIds)
    revenueAttributed = (attr ?? []).reduce((sum, a) => sum + (a.revenue_amount || 0), 0)
  }

  // Fetch recent bookings with listing title
  let recentBookings: object[] = []
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, amount, status, start_date, end_date, listing_id')
      .in('id', bookingIds)
      .order('created_at', { ascending: false })
      .limit(5)

    if (bookings && bookings.length > 0) {
      const listingIds = bookings.map(b => b.listing_id).filter(Boolean)
      const { data: listings } = await supabase
        .from('listings')
        .select('id, title, category')
        .in('id', listingIds)

      const listingMap = Object.fromEntries((listings ?? []).map(l => [l.id, l]))
      const qrByBooking = Object.fromEntries((qrCodes ?? []).map(q => [q.booking_id, q]))

      recentBookings = bookings.map(b => ({
        id: b.id,
        listingTitle: listingMap[b.listing_id]?.title ?? 'Ad Booking',
        category: listingMap[b.listing_id]?.category ?? '',
        status: b.status,
        amount: b.amount,
        totalScans: qrByBooking[b.id]?.total_scans ?? 0,
        startDate: b.start_date,
        endDate: b.end_date,
      }))
    }
  }

  return NextResponse.json({ activeBookings: activeQr, totalScans, revenueAttributed, recentBookings })
}
