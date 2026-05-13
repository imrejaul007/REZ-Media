import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { ListingCategory, TypeTag, PricingModel, AvailabilityModel, DurationUnit } from '@/types'
import { checkListingDuplicate, formatDuplicateWarning } from '@/lib/duplicateDetection'

const VALID_CATEGORIES = Object.values(ListingCategory) as string[]
const VALID_TYPE_TAGS = Object.values(TypeTag) as string[]
const VALID_PRICING_MODELS = Object.values(PricingModel) as string[]
const VALID_AVAILABILITY_MODELS = Object.values(AvailabilityModel) as string[]
const VALID_DURATION_UNITS = Object.values(DurationUnit) as string[]

// ---------------------------------------------------------------------------
// GET — fetch current vendor's listings
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const supabase = createServerClient()

  // Resolve vendor from session cookie header (Supabase auth)
  const authHeader = req.headers.get('authorization')
  let vendorId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    vendorId = user?.id ?? null
  }

  if (!vendorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: listings, error } = await supabase
    .from('listings')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ listings })
}

// ---------------------------------------------------------------------------
// POST — create new listing
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const supabase = createServerClient()

  // Resolve vendor from session
  const authHeader = req.headers.get('authorization')
  let vendorId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: { user } } = await supabase.auth.getUser(token)
    vendorId = user?.id ?? null
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!vendorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // AB3-C2 FIX: Verify user has vendor role before allowing listing creation
  const { data: userRow } = await supabase
    .from('users').select('role').eq('id', vendorId).single()
  if (userRow?.role !== 'vendor') {
    return NextResponse.json({ error: 'Only vendors can create listings' }, { status: 403 })
  }

  // Required field validation
  const requiredErrors: string[] = []
  if (!body.category) requiredErrors.push('category')
  if (!body.subcategory) requiredErrors.push('subcategory')
  if (!body.title) requiredErrors.push('title')
  if (!body.city) requiredErrors.push('city')
  if (!body.pricing_model) requiredErrors.push('pricing_model')
  if (!body.availability_model) requiredErrors.push('availability_model')

  if (requiredErrors.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${requiredErrors.join(', ')}` },
      { status: 422 }
    )
  }

  // Enum validation
  if (!VALID_CATEGORIES.includes(body.category as string)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 422 })
  }
  if (body.type_tag && !VALID_TYPE_TAGS.includes(body.type_tag as string)) {
    return NextResponse.json({ error: 'Invalid type_tag' }, { status: 422 })
  }
  if (!VALID_PRICING_MODELS.includes(body.pricing_model as string)) {
    return NextResponse.json({ error: 'Invalid pricing_model' }, { status: 422 })
  }
  if (!VALID_AVAILABILITY_MODELS.includes(body.availability_model as string)) {
    return NextResponse.json({ error: 'Invalid availability_model' }, { status: 422 })
  }
  if (body.duration_unit && !VALID_DURATION_UNITS.includes(body.duration_unit as string)) {
    return NextResponse.json({ error: 'Invalid duration_unit' }, { status: 422 })
  }

  // Price required for fixed or both
  const pricingModel = body.pricing_model as string
  if ((pricingModel === 'fixed' || pricingModel === 'both') && !body.price) {
    return NextResponse.json({ error: 'price is required for fixed or both pricing model' }, { status: 422 })
  }

  // Check for potential duplicates before creating
  const duplicate = await checkListingDuplicate(
    supabase,
    vendorId,
    (body.title as string).trim(),
    (body.city as string).trim()
  )

  const insertPayload = {
    vendor_id: vendorId,
    category: body.category,
    subcategory: body.subcategory,
    type_tag: body.type_tag ?? 'offline',
    title: (body.title as string).trim(),
    description: (body.description as string | null) ?? null,
    city: (body.city as string).trim(),
    area: (body.area as string | null) ?? null,
    address: (body.address as string | null) ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
    pricing_model: body.pricing_model,
    price: body.price ?? null,
    currency: (body.currency as string) ?? 'INR',
    duration_unit: body.duration_unit ?? null,
    availability_model: body.availability_model,
    min_booking_days: typeof body.min_booking_days === 'number' ? body.min_booking_days : 1,
    bulk_discount_pct: typeof body.bulk_discount_pct === 'number' ? body.bulk_discount_pct : 0,
    seasonal_pricing: false,
    non_competitor_exclusions: Array.isArray(body.non_competitor_exclusions)
      ? body.non_competitor_exclusions
      : [],
    qr_enabled: body.qr_enabled !== false,
    specs: body.specs ?? {},
    status: 'draft',
    freshness_score: 100,
    freshness_last_updated: new Date().toISOString(),
    is_featured: false,
    view_count: 0,
    booking_count: 0,
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return with duplicate warning if found (but don't block the creation)
  const response: { listing: typeof listing; duplicateWarning?: { hasDuplicate: boolean; duplicates: typeof duplicate.duplicates; warning: string } } = {
    listing,
  }

  if (duplicate.hasDuplicate) {
    response.duplicateWarning = {
      hasDuplicate: true,
      duplicates: duplicate.duplicates,
      warning: formatDuplicateWarning(duplicate),
    }
  }

  return NextResponse.json(response, { status: 201 })
}
