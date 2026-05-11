import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/purchase - Record a purchase and credit rewards
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scan_event_id, campaign_id, amount } = body

    if (!campaign_id || !amount) {
      return NextResponse.json(
        { error: 'campaign_id and amount are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get user from auth header
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let userId: string | null = null

    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken)
      userId = data.user?.id || null
    }

    // Credit purchase reward using database function
    const { data: purchaseId, error } = await supabase.rpc('credit_purchase_reward', {
      p_scan_event_id: scan_event_id || null,
      p_user_id: userId,
      p_campaign_id: campaign_id,
      p_amount: amount
    })

    if (error) {
      console.error('[purchase] credit_purchase_reward error:', error)
      return NextResponse.json(
        { error: 'Failed to credit purchase reward' },
        { status: 500 }
      )
    }

    // Get campaign for attribution data
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name')
      .eq('id', campaign_id)
      .single()

    return NextResponse.json({
      purchase_id: purchaseId,
      message: userId ? 'Purchase recorded, rewards credited' : 'Purchase recorded',
      attribution: {
        campaign: campaign?.name,
        amount,
        attributed: amount * 0.05
      }
    })

  } catch (e) {
    console.error('[purchase] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/purchase - Get purchase history for user
export async function GET(_req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: purchases } = await supabase
    .from('purchase_events')
    .select(`
      *,
      campaigns (name)
    `)
    .eq('user_id', user.id)
    .order('purchased_at', { ascending: false })

  return NextResponse.json({ purchases })
}
