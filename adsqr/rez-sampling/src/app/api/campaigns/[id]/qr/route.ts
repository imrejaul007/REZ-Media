// AdsQr MVP - Phase 1
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { generateSlug, generateQRImage } from '@/lib/qr'

// POST /api/campaigns/[id]/qr - Generate QR code
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label, location_name, location_lat, location_lng } = body

  // Generate unique slug
  const qrSlug = generateSlug()

  // Create QR code record
  const { data: qr } = await supabase
    .from('qr_codes')
    .insert({
      campaign_id: id,
      qr_slug: qrSlug,
      qr_label: label,
      location_name,
      location_lat,
      location_lng,
      qr_image_url: generateQRImage(qrSlug)
    })
    .select()
    .single()

  return NextResponse.json({ qr }, { status: 201 })
}

// GET /api/campaigns/[id]/qr - List all QR codes
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()

  const { data: qr_codes } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ qr_codes })
}
