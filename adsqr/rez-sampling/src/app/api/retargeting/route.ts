// Retargeting API Routes
import { NextRequest, NextResponse } from 'next/server'
import { getRetargetingEngine } from '@/lib/retargeting/engine'

// GET /api/retargeting - Get offers or stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const campaignId = searchParams.get('campaignId')
    const action = searchParams.get('action')

    const engine = getRetargetingEngine()

    // Get user's retargeting offers
    if (action === 'offers' && userId) {
      const offers = await engine.getRetargetingOffers(userId)
      return NextResponse.json({ offers })
    }

    // Get engagement data
    if (action === 'engagement' && userId && campaignId) {
      const engagement = await engine.getUserEngagement(userId, campaignId)
      return NextResponse.json({ engagement })
    }

    // Get stats
    if (action === 'stats') {
      const stats = await engine.getRetargetingStats(campaignId || undefined)
      return NextResponse.json({ stats })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Retargeting GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/retargeting - Create triggers or campaigns
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId, campaignId, hours } = body

    const engine = getRetargetingEngine()

    // Trigger scan no visit
    if (action === 'scan_no_visit') {
      if (!userId || !campaignId) {
        return NextResponse.json({ error: 'Missing userId or campaignId' }, { status: 400 })
      }
      await engine.triggerScanNoVisit(userId, campaignId)
      return NextResponse.json({ success: true })
    }

    // Trigger visit no purchase
    if (action === 'visit_no_purchase') {
      if (!userId || !campaignId) {
        return NextResponse.json({ error: 'Missing userId or campaignId' }, { status: 400 })
      }
      await engine.triggerVisitNoPurchase(userId, campaignId)
      return NextResponse.json({ success: true })
    }

    // Trigger abandoned cart
    if (action === 'abandoned_cart') {
      if (!userId || !body.cartTotal) {
        return NextResponse.json({ error: 'Missing userId or cartTotal' }, { status: 400 })
      }
      await engine.triggerAbandonedCart(userId, body.cartTotal)
      return NextResponse.json({ success: true })
    }

    // Trigger inactive user
    if (action === 'inactive_user') {
      if (!userId || !body.daysInactive) {
        return NextResponse.json({ error: 'Missing userId or daysInactive' }, { status: 400 })
      }
      await engine.triggerInactiveUser(userId, body.daysInactive)
      return NextResponse.json({ success: true })
    }

    // Schedule follow-up
    if (action === 'followup') {
      if (!userId || !campaignId) {
        return NextResponse.json({ error: 'Missing userId or campaignId' }, { status: 400 })
      }
      await engine.scheduleFollowUp(userId, campaignId, hours || 24)
      return NextResponse.json({ success: true })
    }

    // Create retargeting campaign
    if (action === 'create_campaign') {
      if (!campaignId) {
        return NextResponse.json({ error: 'Missing campaignId' }, { status: 400 })
      }
      const campaign = await engine.createRetargetingCampaign(campaignId, body)
      return NextResponse.json({ campaign }, { status: 201 })
    }

    // Process pending triggers (cron job endpoint)
    if (action === 'process') {
      const processed = await engine.processPendingTriggers()
      return NextResponse.json({ processed })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Retargeting POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
