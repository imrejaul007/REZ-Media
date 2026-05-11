import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { generateSlug, generateQRImage } from '@/lib/qr'

// POST /api/campaigns/[id]/qr/bulk - Generate multiple QR codes at once
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('brand_id', user.id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const body = await req.json()
  const { locations = [] } = body

  if (!Array.isArray(locations) || locations.length === 0) {
    return NextResponse.json(
      { error: 'locations array is required' },
      { status: 400 }
    )
  }

  if (locations.length > 50) {
    return NextResponse.json(
      { error: 'Maximum 50 QR codes per batch' },
      { status: 400 }
    )
  }

  // Generate QR codes
  const qrCodes: unknown[] = []
  for (const loc of locations) {
    const slug = generateSlug()
    const imgUrl = generateQRImage(slug)

    const result = await supabase
      .from('qr_codes')
      .insert({
        campaign_id: campaignId,
        qr_slug: slug,
        qr_label: (loc as Record<string, unknown>).label || (loc as Record<string, unknown>).name || `QR ${qrCodes.length + 1}`,
        location_name: (loc as Record<string, unknown>).address || (loc as Record<string, unknown>).name || null,
        location_lat: (loc as Record<string, unknown>).lat || null,
        location_lng: (loc as Record<string, unknown>).lng || null,
        qr_image_url: imgUrl,
        is_active: true
      })
      .select()
      .single()

    if (result.data) {
      qrCodes.push(result.data)
    }
  }

  return NextResponse.json({
    created: qrCodes.length,
    qr_codes: qrCodes
  }, { status: 201 })
}

// Generate template for bulk upload
export async function GET(_req: NextRequest, _params: { params: Promise<{ id: string }> }) {
  const template = `label,address,lat,lng
Table 1,Main Hall,,
Table 2,Main Hall,,
Counter,Front Counter,,
Entrance,Main Entrance,,
Parking,Parking Area,,
`

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="qr-locations-template.csv"'
    }
  })
}
