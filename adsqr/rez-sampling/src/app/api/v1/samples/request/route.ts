import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/samples/request
// Request a free sample

interface SampleRequest {
  campaignId: string
  userId: string
  sampleId: string
  storeId?: string
  preferredDate?: string
  contactEmail?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: SampleRequest = await req.json()
    const { campaignId, userId, sampleId, storeId, preferredDate, contactEmail, notes } = body

    if (!campaignId || !userId || !sampleId) {
      return NextResponse.json(
        { error: 'campaignId, userId, and sampleId are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get sample details
    const { data: sample, error: sampleError } = await supabase
      .from('free_samples')
      .select('*')
      .eq('id', sampleId)
      .eq('campaign_id', campaignId)
      .single()

    if (sampleError || !sample) {
      return NextResponse.json(
        { error: 'Sample not found' },
        { status: 404 }
      )
    }

    // Check if sample is available
    if ((sample.quantity_remaining || 0) <= 0) {
      return NextResponse.json(
        { error: 'Sample is out of stock' },
        { status: 400 }
      )
    }

    // Check if user already requested this sample
    const { data: existingRequest } = await supabase
      .from('sample_requests')
      .select('id, status')
      .eq('sample_id', sampleId)
      .eq('user_id', userId)
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You have already requested this sample', requestId: existingRequest.id, status: existingRequest.status },
        { status: 409 }
      )
    }

    // Check user's coin balance if there's a cost
    if (sample.coin_cost && sample.coin_cost > 0) {
      const { data: userBalance } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'credit')

      const totalEarned = userBalance?.reduce((sum, t) => sum + t.amount, 0) || 0
      const { data: spent } = await supabase
        .from('coin_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'debit')

      const totalSpent = spent?.reduce((sum, t) => sum + t.amount, 0) || 0
      const availableCoins = totalEarned - totalSpent

      if (availableCoins < (sample.coin_cost || 0)) {
        return NextResponse.json(
          { error: 'Insufficient coins', required: sample.coin_cost, available: availableCoins },
          { status: 400 }
        )
      }
    }

    // Generate redemption code
    const redemptionCode = generateRedemptionCode()

    // Create sample request
    const { data: request, error: requestError } = await supabase
      .from('sample_requests')
      .insert({
        sample_id: sampleId,
        campaign_id: campaignId,
        user_id: userId,
        store_id: storeId || null,
        preferred_date: preferredDate || null,
        contact_email: contactEmail || null,
        notes,
        status: 'pending',
        redemption_code: redemptionCode,
      })
      .select()
      .single()

    if (requestError) {
      console.error('[samples/request] insert error:', requestError)
      return NextResponse.json(
        { error: 'Failed to create sample request' },
        { status: 500 }
      )
    }

    // Deduct coins if there's a cost
    if (sample.coin_cost && sample.coin_cost > 0) {
      await supabase.from('coin_transactions').insert({
        campaign_id: campaignId,
        user_id: userId,
        amount: sample.coin_cost,
        coin_type: 'rez',
        transaction_type: 'debit',
        reason: 'sample_request',
      })
    }

    // Decrement sample quantity
    await supabase
      .from('free_samples')
      .update({ quantity_remaining: (sample.quantity_remaining || 1) - 1 })
      .eq('id', sampleId)

    return NextResponse.json({
      success: true,
      request: {
        id: request.id,
        status: request.status,
        redemptionCode: request.redemption_code,
        sampleName: sample.name,
        coinCost: sample.coin_cost || 0,
      },
      instructions: {
        message: 'Visit the store and show this code to claim your sample.',
        validUntil: sample.expiry_date,
      },
    })
  } catch (e) {
    console.error('[samples/request] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a unique redemption code
 */
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'SMP-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
