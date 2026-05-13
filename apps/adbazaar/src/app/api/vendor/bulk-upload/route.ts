import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  parseCSV,
  validateRow,
  generateCSVTemplate,
  BulkUploadRow,
  BulkUploadResult,
} from '@/lib/bulkUpload'
import { ListingCategory, TypeTag, PricingModel, AvailabilityModel, DurationUnit } from '@/types'
import logger from '@/lib/logger'

// ---------------------------------------------------------------------------
// GET — download CSV template
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  let vendorId: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    vendorId = user?.id ?? null
  }

  if (!vendorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return CSV template
  const template = generateCSVTemplate()
  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="listing-template.csv"',
    },
  })
}

// ---------------------------------------------------------------------------
// POST — process bulk upload CSV
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

  if (!vendorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify vendor role
  const { data: userRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', vendorId)
    .single()

  if (userRow?.role !== 'vendor') {
    return NextResponse.json({ error: 'Only vendors can create listings' }, { status: 403 })
  }

  try {
    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Read file content
    const csvText = await file.text()

    // Parse CSV
    let rows: Record<string, string>[]
    try {
      rows = parseCSV(csvText)
    } catch (parseError) {
      return NextResponse.json(
        { error: `CSV parsing error: ${String(parseError)}` },
        { status: 400 }
      )
    }

    // Validate each row
    const validatedRows: BulkUploadRow[] = []
    const failures: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const validated = validateRow(rows[i], i + 2) // +2 because row numbers start at 1, header is row 1
      if (validated.errors.length > 0) {
        failures.push({
          row: validated.rowNumber,
          error: validated.errors.join('; '),
        })
      } else {
        validatedRows.push(validated)
      }
    }

    // Create listings for valid rows
    const created: { id: string; title: string }[] = []
    const creationFailures: { row: number; error: string }[] = []

    for (const row of validatedRows) {
      try {
        const insertPayload = {
          vendor_id: vendorId,
          category: row.category as ListingCategory,
          subcategory: row.subcategory,
          type_tag: TypeTag.Offline,
          title: row.title,
          description: row.description ?? null,
          city: row.city,
          area: row.area ?? null,
          address: row.address ?? null,
          lat: null,
          lng: null,
          images: row.images ?? [],
          pricing_model: row.pricing_model as PricingModel,
          price: row.price ?? null,
          currency: 'INR',
          duration_unit: (row.duration_unit as DurationUnit) ?? null,
          availability_model: row.availability_model as AvailabilityModel,
          min_booking_days: 1,
          bulk_discount_pct: 0,
          seasonal_pricing: false,
          non_competitor_exclusions: [],
          qr_enabled: true,
          specs: {},
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
          .select('id, title')
          .single()

        if (error) {
          creationFailures.push({
            row: row.rowNumber,
            error: error.message,
          })
        } else if (listing) {
          created.push({ id: listing.id, title: listing.title })
        }
      } catch (e) {
        creationFailures.push({
          row: row.rowNumber,
          error: String(e),
        })
      }
    }

    const result: BulkUploadResult = {
      successes: created.length,
      failures: [...failures, ...creationFailures],
      created,
    }

    logger.info(
      `[bulk-upload] vendor=${vendorId} successes=${result.successes} failures=${result.failures.length}`
    )

    return NextResponse.json(result)
  } catch (err) {
    logger.error('[bulk-upload] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
