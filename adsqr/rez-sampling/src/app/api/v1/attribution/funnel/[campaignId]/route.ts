import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/attribution/funnel/:campaignId
// Get attribution funnel for a specific campaign

interface AttributionFunnel {
  totalScans: number
  verifiedVisits: number
  purchases: number
  totalRevenue: number
  attributedRevenue: number
  conversionRates: {
    scanToVisit: number
    visitToPurchase: number
    overall: number
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get scan events count
    const { count: scanCount } = await supabase
      .from('scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    // Get verified visit events count
    const { count: visitCount } = await supabase
      .from('visit_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('location_verified', true)

    // Get total visits (verified and unverified)
    const { count: totalVisitCount } = await supabase
      .from('visit_events')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    // Get purchase events
    const { data: purchases } = await supabase
      .from('purchase_events')
      .select('purchase_amount, attributed_revenue')
      .eq('campaign_id', campaignId)

    // Get unique users
    const { data: uniqueUsers } = await supabase
      .from('scan_events')
      .select('user_id')
      .eq('campaign_id', campaignId)
      .not('user_id', 'is', null)

    const uniqueUserIds = new Set(uniqueUsers?.map(u => u.user_id) || [])

    // Calculate totals
    const totalScans = scanCount || 0
    const verifiedVisits = visitCount || 0
    const totalVisits = totalVisitCount || 0
    const purchasesData = purchases || []
    const purchaseCount = purchasesData.length

    const totalRevenue = purchasesData.reduce(
      (sum, p) => sum + (p.purchase_amount || 0),
      0
    )

    const attributedRevenue = purchasesData.reduce(
      (sum, p) => sum + (p.attributed_revenue || 0),
      0
    )

    // Calculate conversion rates
    const scanToVisitRate = totalScans > 0
      ? Math.round((verifiedVisits / totalScans) * 10000) / 100
      : 0

    const visitToPurchaseRate = totalVisits > 0
      ? Math.round((purchaseCount / totalVisits) * 10000) / 100
      : 0

    const overallRate = totalScans > 0
      ? Math.round((purchaseCount / totalScans) * 10000) / 100
      : 0

    // Get recent conversion timeline (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentScans } = await supabase
      .from('scan_events')
      .select('scanned_at')
      .eq('campaign_id', campaignId)
      .gte('scanned_at', sevenDaysAgo.toISOString())

    const { data: recentVisits } = await supabase
      .from('visit_events')
      .select('visited_at')
      .eq('campaign_id', campaignId)
      .gte('visited_at', sevenDaysAgo.toISOString())

    const { data: recentPurchases } = await supabase
      .from('purchase_events')
      .select('purchased_at')
      .eq('campaign_id', campaignId)
      .gte('purchased_at', sevenDaysAgo.toISOString())

    // Build daily breakdown
    const dailyData: Record<string, { scans: number; visits: number; purchases: number }> = {}

    recentScans?.forEach(s => {
      const date = new Date(s.scanned_at).toISOString().split('T')[0]
      dailyData[date] = dailyData[date] || { scans: 0, visits: 0, purchases: 0 }
      dailyData[date].scans++
    })

    recentVisits?.forEach(v => {
      const date = new Date(v.visited_at).toISOString().split('T')[0]
      dailyData[date] = dailyData[date] || { scans: 0, visits: 0, purchases: 0 }
      dailyData[date].visits++
    })

    recentPurchases?.forEach(p => {
      const date = new Date(p.purchased_at).toISOString().split('T')[0]
      dailyData[date] = dailyData[date] || { scans: 0, visits: 0, purchases: 0 }
      dailyData[date].purchases++
    })

    const funnel: AttributionFunnel = {
      totalScans,
      verifiedVisits,
      purchases: purchaseCount,
      totalRevenue,
      attributedRevenue,
      conversionRates: {
        scanToVisit: scanToVisitRate,
        visitToPurchase: visitToPurchaseRate,
        overall: overallRate,
      },
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        scanReward: campaign.scan_reward,
        visitReward: campaign.visit_reward,
        purchaseReward: campaign.purchase_reward,
        coinBudget: campaign.coin_budget,
        coinsUsed: campaign.coins_used,
      },
      funnel,
      metrics: {
        uniqueUsers: uniqueUserIds.size,
        avgPurchaseValue: purchaseCount > 0
          ? Math.round((totalRevenue / purchaseCount) * 100) / 100
          : 0,
        avgCoinsPerScan: totalScans > 0
          ? Math.round((campaign.coins_used / totalScans) * 100) / 100
          : 0,
      },
      dailyBreakdown: Object.entries(dailyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, ...data })),
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[attribution/funnel] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
