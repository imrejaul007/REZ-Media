// QR Template API - AdsQr MVP Phase 3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/qr/[id]/template
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('template')
    .eq('id', id)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
  }

  return NextResponse.json({
    template: qr.template || {
      foreground: '#000000',
      background: '#ffffff',
      style: 'square'
    }
  })
}

// PUT /api/qr/[id]/template
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('campaign_id, campaigns(brand_id)')
    .eq('id', id)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
  }

  const campaign = qr.campaigns as unknown as { brand_id: string } | null
  if (campaign?.brand_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { template } = body

  // Validate template fields
  const validStyles = ['square', 'round', 'dot', 'star']
  const validatedTemplate = {
    foreground: template.foreground || '#000000',
    background: template.background || '#ffffff',
    style: validStyles.includes(template.style) ? template.style : 'square',
    logo: template.logo,
    logoSize: template.logoSize || 25
  }

  const { error } = await supabase
    .from('qr_codes')
    .update({
      template: validatedTemplate,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }

  return NextResponse.json({ success: true, template: validatedTemplate })
}
