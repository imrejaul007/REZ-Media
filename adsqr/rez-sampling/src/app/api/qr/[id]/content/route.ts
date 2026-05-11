// QR Content API - AdsQr MVP Phase 3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface QRResponse {
  id: string
  campaign_id: string
  campaigns?: { brand_id: string } | null
}

// GET /api/qr/[id]/content
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('content, campaign_id')
    .eq('id', id)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
  }

  return NextResponse.json({
    content: qr.content || {
      default_content: { type: 'campaign', value: qr.campaign_id },
      time_based: [],
      location_based: []
    }
  })
}

// PUT /api/qr/[id]/content
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership through campaign
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('campaign_id, campaigns(brand_id)')
    .eq('id', id)
    .single() as { data: QRResponse | null }

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
  }

  const campaign = qr.campaigns as unknown as { brand_id: string } | null
  if (campaign?.brand_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { content } = body

  const { error } = await supabase
    .from('qr_codes')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
