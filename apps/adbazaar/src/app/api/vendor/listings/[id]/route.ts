import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import logger from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// Helper: resolve vendor from auth header or query param
// ---------------------------------------------------------------------------
async function resolveVendor(req: NextRequest, supabase: ReturnType<typeof createServerClient>): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user?.id) return user.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Helper: verify ownership
// ---------------------------------------------------------------------------
async function verifyOwnership(
  supabase: ReturnType<typeof createServerClient>,
  listingId: string,
  vendorId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('listings')
    .select('vendor_id')
    .eq('id', listingId)
    .single()
  // AB3-L3 FIX: rethrow Supabase errors so they don't look like access-denied
  if (error) {
    logger.error('[verifyOwnership error]', error)
    throw new Error('Failed to verify listing ownership')
  }
  return data?.vendor_id === vendorId
}

// ---------------------------------------------------------------------------
// GET — single listing
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const vendorId = await resolveVendor(req, supabase)
  if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', (await params).id)
    .single()

  if (error || !listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  if (listing.vendor_id !== vendorId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ listing })
}

// ---------------------------------------------------------------------------
// PUT — full update (vendor must own)
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const vendorId = await resolveVendor(req, supabase)
  if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(supabase, (await params).id, vendorId)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // M5 FIX: Apply explicit field allowlist — reject admin/vendor-internal fields
  const vendorEditableFields = [
    'title', 'description', 'category', 'subcategory',
    'price', 'discount_price',
    'city', 'state', 'address',
    'phone', 'whatsapp',
    'images', 'slots', 'active',
    'status',
    'area', 'availability_model', 'min_booking_days', 'duration_unit',
    'specs', 'qr_enabled', 'bulk_discount_pct',
    'non_competitor_exclusions',
  ]

  const putPayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of vendorEditableFields) {
    if (body[field] !== undefined) putPayload[field] = body[field]
  }

  // Prevent setting an invalid status via PUT
  if (putPayload.status && !['draft', 'active', 'paused'].includes(putPayload.status as string)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 422 })
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .update(putPayload)
    .eq('id', (await params).id)
    .select()
    .single()

  if (error) {
    logger.error('[vendor/listings PUT] Database error', error, { path: '/api/vendor/listings/[id]' })
    return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ listing })
}

// ---------------------------------------------------------------------------
// PATCH — partial update, primarily for status toggle
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const vendorId = await resolveVendor(req, supabase)
  if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(supabase, (await params).id, vendorId)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patchPayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Status toggle
  if (body.status !== undefined) {
    const allowedStatuses = ['draft', 'active', 'paused']
    if (!allowedStatuses.includes(body.status as string)) {
      return NextResponse.json({ error: 'Status must be draft, active, or paused' }, { status: 422 })
    }
    patchPayload.status = body.status
  }

  // Allow patching content fields and simple toggles
  const patchableFields = [
    'qr_enabled', 'is_featured', 'bulk_discount_pct', 'price',
    'title', 'description', 'city', 'area', 'address',
    'availability_model', 'min_booking_days', 'duration_unit',
    'specs', 'images', 'non_competitor_exclusions',
  ]
  for (const field of patchableFields) {
    if (body[field] !== undefined) patchPayload[field] = body[field]
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .update(patchPayload)
    .eq('id', (await params).id)
    .select()
    .single()

  if (error) {
    logger.error('[vendor/listings PATCH] Database error', error, { path: '/api/vendor/listings/[id]' })
    return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ listing })
}

// ---------------------------------------------------------------------------
// DELETE — soft delete by setting status to 'rejected' (or hard delete)
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = createServerClient()
  const vendorId = await resolveVendor(req, supabase)
  if (!vendorId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owns = await verifyOwnership(supabase, (await params).id, vendorId)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if listing has confirmed/paid/executing bookings — block delete if so
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('listing_id', (await params).id)
    .in('status', ['confirmed', 'paid', 'executing'])
    .limit(1)

  if (activeBookings && activeBookings.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete listing with active bookings. Pause it instead.' },
      { status: 409 }
    )
  }

  // Soft delete: set status to 'rejected' (invisible to buyers — distinct from admin
  // rejection via the dedicated /api/admin/listings/[id]/review route)
  const { error } = await supabase
    .from('listings')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', (await params).id)

  if (error) {
    logger.error('[vendor/listings DELETE] Database error', error, { path: '/api/vendor/listings/[id]' })
    return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
