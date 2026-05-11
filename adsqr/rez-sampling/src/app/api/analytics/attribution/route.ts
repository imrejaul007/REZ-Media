import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/analytics/attribution - Get attribution funnel for campaigns
export async function GET(req: NextRequest) {
  const supabase = createClient()

  // Require authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = req.nextUrl.searchParams
  const campaignId = searchParams.get('campaign_id')
  const timeRange = searchParams.get('range') || '30d' // 7d, 30d, 90d

  // Calculate date range
  const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  let query = supabase
    .from('attribution_funnel')
    .select('*')

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data: funnel, error } = await query

  if (error) {
    console.error('[analytics/attribution] error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch attribution data' },
      { status: 500 }
    )
  }

  // Calculate totals
  const totals = funnel?.reduce((acc, row) => ({
    scans: acc.scans + (row.total_scans || 0),
    visits: acc.visits + (row.total_visits || 0),
    purchases: acc.purchases + (row.total_purchases || 0),
    revenue: acc.revenue + (row.total_revenue || 0),
    attributed: acc.attributed + (row.attributed_revenue || 0)
  }), { scans: 0, visits: 0, purchases: 0, revenue: 0, attributed: 0 })

  // Calculate rates
  const scanToVisitRate = totals?.scans > 0
    ? Math.round((totals.visits / totals.scans) * 10000) / 100
    : 0
  const visitToPurchaseRate = totals?.visits > 0
    ? Math.round((totals.purchases / totals.visits) * 10000) / 100
    : 0
  const scanToPurchaseRate = totals?.scans > 0
    ? Math.round((totals.purchases / totals.scans) * 10000) / 100
    : 0

  return NextResponse.json({
    campaigns: funnel,
    totals: {
      scans: totals?.scans || 0,
      visits: totals?.visits || 0,
      purchases: totals?.purchases || 0,
      revenue: totals?.revenue || 0,
      attributed_revenue: totals?.attributed || 0
    },
    rates: {
      scan_to_visit: scanToVisitRate,
      visit_to_purchase: visitToPurchaseRate,
      scan_to_purchase: scanToPurchaseRate
    },
    time_range: timeRange,
    period_days: days
  })
}
