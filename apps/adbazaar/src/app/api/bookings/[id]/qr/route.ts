/**
 * POST /api/bookings/[id]/qr
 * Add an additional QR code to an existing booking (one per poster/creative).
 * Vendor only.
 *
 * Body: { label: string; creativeImageUrl?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateQRCode, generateSlug } from '@/lib/qr'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params

  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify this vendor owns the booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, vendor_id, listing_id, status')
    .eq('id', bookingId)
    .eq('vendor_id', user.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (['cancelled', 'inquiry'].includes(booking.status)) {
    return NextResponse.json({ error: 'Cannot add QR to a booking in this status' }, { status: 400 })
  }

  const body = await req.json()
  const label = (body.label || '').trim() || 'QR Code'
  const creativeImageUrl = body.creativeImageUrl || null

  // Find next poster index
  const { count } = await supabase
    .from('qr_codes')
    .select('id', { count: 'exact', head: true })
    .eq('booking_id', bookingId)

  const posterIndex = (count ?? 0) + 1

  // Fetch vendor's REZ merchant ID
  const { data: vendorProfile } = await supabase
    .from('users')
    .select('rez_merchant_id')
    .eq('id', user.id)
    .single()

  const qrSlug = generateSlug()

  const { data: qrCode, error: qrError } = await supabase
    .from('qr_codes')
    .insert({
      booking_id: bookingId,
      listing_id: booking.listing_id,
      brand_id: user.id,
      rez_merchant_id: vendorProfile?.rez_merchant_id || null,
      coins_per_scan: 20,
      visit_bonus_coins: 100,
      purchase_bonus_pct: 5, // AB-B2 FIX: could read from listing.qr_purchase_bonus_pct if needed
      qr_slug: qrSlug,
      qr_label: label,
      poster_index: posterIndex,
      creative_image_url: creativeImageUrl,
      total_scans: 0,
      unique_scanners: 0,
      is_active: true,
    })
    .select()
    .single()

  if (qrError || !qrCode) {
    return NextResponse.json({ error: 'Failed to create QR code' }, { status: 500 })
  }

  // Generate QR image
  let qrImageUrl: string | null = null
  try {
    qrImageUrl = await generateQRCode(qrSlug)
    await supabase.from('qr_codes').update({ qr_image_url: qrImageUrl }).eq('id', qrCode.id)
  } catch { /* non-fatal */ }

  return NextResponse.json({
    qrCode: {
      ...qrCode,
      qr_image_url: qrImageUrl,
      scanUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/qr/scan/${qrSlug}`,
    },
  })
}

/**
 * GET /api/bookings/[id]/qr
 * List all QR codes for a booking with their analytics summary.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bookingId } = await params

  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller owns this booking (buyer or vendor) or is admin
  const { data: bk } = await supabase
    .from('bookings').select('buyer_id, vendor_id').eq('id', bookingId).single()
  if (!bk) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  const { data: callerRow } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = callerRow?.role === 'admin'
  if (!isAdmin && bk.buyer_id !== user.id && bk.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: qrCodes } = await supabase
    .from('qr_codes')
    .select('id, qr_slug, qr_label, poster_index, qr_image_url, creative_image_url, total_scans, unique_scanners, is_active, created_at')
    .eq('booking_id', bookingId)
    .order('poster_index', { ascending: true })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  return NextResponse.json({
    qrCodes: (qrCodes ?? []).map(q => ({
      ...q,
      scanUrl: `${appUrl}/api/qr/scan/${q.qr_slug}`,
    })),
  })
}
