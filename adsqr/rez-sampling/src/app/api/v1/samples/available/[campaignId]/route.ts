import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/samples/available/:campaignId
// Get available free samples for a campaign

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

    // Get user ID from auth header if available
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let userId: string | null = null

    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken)
      userId = data.user?.id || null
    }

    // Get campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get available samples for this campaign
    const { data: samples, error: samplesError } = await supabase
      .from('free_samples')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'active')

    if (samplesError) {
      console.error('[samples/available] error:', samplesError)
      return NextResponse.json(
        { error: 'Failed to fetch samples' },
        { status: 500 }
      )
    }

    // Get user's request history for these samples
    let userRequests: { sample_id: string; status: string }[] = []
    if (userId && samples && samples.length > 0) {
      const sampleIds = samples.map(s => s.id)
      const { data: requests } = await supabase
        .from('sample_requests')
        .select('sample_id, status')
        .eq('user_id', userId)
        .in('sample_id', sampleIds)

      userRequests = requests || []
    }

    // Format samples with availability and user eligibility
    const availableSamples = samples?.map(sample => {
      const userRequest = userRequests.find(r => r.sample_id === sample.id)
      const isClaimed = userRequest?.status === 'claimed'
      const isPending = userRequest?.status === 'pending'

      return {
        id: sample.id,
        name: sample.name,
        description: sample.description,
        imageUrl: sample.image_url,
        quantity: sample.quantity,
        quantityRemaining: sample.quantity_remaining || 0,
        coinCost: sample.coin_cost || 0,
        isAvailable: (sample.quantity_remaining || 0) > 0,
        userStatus: userRequest?.status || null,
        isClaimed,
        isPending,
        expiryDate: sample.expiry_date,
        terms: sample.terms,
      }
    }) || []

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        brandColor: campaign.brand_color,
        logoUrl: campaign.logo_url,
      },
      samples: availableSamples,
      summary: {
        totalSamples: availableSamples.length,
        availableCount: availableSamples.filter(s => s.isAvailable).length,
        claimedCount: availableSamples.filter(s => s.isClaimed).length,
      },
    })
  } catch (e) {
    console.error('[samples/available] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
