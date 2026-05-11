// QR Analytics Events API - AdsQr MVP Phase 3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/analytics/qr/[id]/events
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  const supabase = createClient()

  const { data: events } = await supabase
    .from('scan_events')
    .select('*')
    .eq('qr_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  return NextResponse.json({ events: events || [] })
}
