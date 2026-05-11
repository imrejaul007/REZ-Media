import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/samples/redemption/:code/claim
// Claim a free sample using redemption code

interface ClaimRequest {
  claimedBy: string // Store staff ID or POS ID
  claimedAt?: string
  notes?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body: ClaimRequest = await req.json()
    const { claimedBy, claimedAt, notes } = body

    if (!code) {
      return NextResponse.json(
        { error: 'redemption code is required' },
        { status: 400 }
      )
    }

    if (!claimedBy) {
      return NextResponse.json(
        { error: 'claimedBy (store staff ID) is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get redemption request
    const { data: request, error: requestError } = await supabase
      .from('sample_requests')
      .select('*')
      .eq('redemption_code', code)
      .single()

    if (requestError || !request) {
      return NextResponse.json(
        { error: 'Redemption code not found' },
        { status: 404 }
      )
    }

    // Check status
    if (request.status === 'claimed') {
      return NextResponse.json(
        { error: 'Sample already claimed', claimedAt: request.claimed_at },
        { status: 400 }
      )
    }

    if (request.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Redemption was cancelled' },
        { status: 400 }
      )
    }

    // Check if expired
    const { data: sample } = await supabase
      .from('free_samples')
      .select('expiry_date')
      .eq('id', request.sample_id)
      .single()

    if (sample?.expiry_date && new Date(sample.expiry_date) < new Date()) {
      // Mark as expired
      await supabase
        .from('sample_requests')
        .update({ status: 'expired' })
        .eq('id', request.id)

      return NextResponse.json(
        { error: 'Redemption code has expired' },
        { status: 400 }
      )
    }

    // Claim the sample
    const { data: updatedRequest, error: updateError } = await supabase
      .from('sample_requests')
      .update({
        status: 'claimed',
        claimed_by: claimedBy,
        claimed_at: claimedAt || new Date().toISOString(),
        notes: notes || request.notes,
      })
      .eq('id', request.id)
      .select(`
        *,
        free_samples (name, image_url),
        campaigns (name)
      `)
      .single()

    if (updateError) {
      console.error('[samples/redemption/claim] update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to claim sample' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sample claimed successfully',
      redemption: {
        id: updatedRequest.id,
        code: updatedRequest.redemption_code,
        status: 'claimed',
        claimedAt: updatedRequest.claimed_at,
        claimedBy: updatedRequest.claimed_by,
        sample: updatedRequest.free_samples ? {
          name: updatedRequest.free_samples.name,
          imageUrl: updatedRequest.free_samples.image_url,
        } : null,
        campaign: updatedRequest.campaigns?.name || null,
      },
    })
  } catch (e) {
    console.error('[samples/redemption/claim] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
