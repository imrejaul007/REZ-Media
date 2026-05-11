import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/visit - Record a verified visit
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scan_event_id, campaign_id, lat, lng, dwell_time } = body

    if (!scan_event_id || !campaign_id) {
      return NextResponse.json(
        { error: 'scan_event_id and campaign_id are required' },
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

    // Credit visit reward using database function
    const { data: visitId, error } = await supabase.rpc('credit_visit_reward', {
      p_scan_event_id: scan_event_id,
      p_user_id: userId,
      p_campaign_id: campaign_id,
      p_lat: lat || null,
      p_lng: lng || null
    })

    if (error) {
      console.error('[visit] credit_visit_reward error:', error)
      return NextResponse.json(
        { error: 'Failed to credit visit reward' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      visit_id: visitId,
      message: userId ? 'Visit recorded, rewards credited' : 'Visit recorded'
    })

  } catch (e) {
    console.error('[visit] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/visit - Get visit history for user
export async function GET(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: visits } = await supabase
    .from('visit_events')
    .select(`
      *,
      campaigns (name),
      qr_codes (qr_label, location_name)
    `)
    .eq('user_id', user.id)
    .order('visited_at', { ascending: false })

  return NextResponse.json({ visits })
}
