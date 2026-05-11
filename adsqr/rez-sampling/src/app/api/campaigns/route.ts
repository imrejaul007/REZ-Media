// AdsQr MVP - Phase 1
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/campaigns - List campaigns for brand
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('brand_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ campaigns })
}

// POST /api/campaigns - Create campaign
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, description, offer, scan_reward, visit_reward, purchase_reward } = body

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data: campaign } = await supabase
    .from('campaigns')
    .insert({
      brand_id: user.id,
      name,
      description,
      offer,
      scan_reward: scan_reward || 10,
      visit_reward: visit_reward || 25,
      purchase_reward: purchase_reward || 50,
      status: 'draft'
    })
    .select()
    .single()

  return NextResponse.json({ campaign }, { status: 201 })
}
