import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/brand-coins/distribute
// Distribute brand coins to a user

interface DistributeCoinsRequest {
  brandId: string
  userId: string
  amount: number
  reason: string
  campaignId?: string
  metadata?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const body: DistributeCoinsRequest = await req.json()
    const { brandId, userId, amount, reason, campaignId, metadata } = body

    if (!brandId || !userId || !amount || !reason) {
      return NextResponse.json(
        { error: 'brandId, userId, amount, and reason are required' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'amount must be positive' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get brand coin details
    const { data: brandCoin, error: coinError } = await supabase
      .from('brand_coins')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'active')
      .single()

    if (coinError || !brandCoin) {
      return NextResponse.json(
        { error: 'Brand coin not found or inactive' },
        { status: 404 }
      )
    }

    // Check if supply allows distribution
    if (brandCoin.current_supply < amount) {
      return NextResponse.json(
        { error: 'Insufficient coin supply', available: brandCoin.current_supply },
        { status: 400 }
      )
    }

    // Create distribution record
    const idempotencyKey = `brand_dist_${brandId}_${userId}_${Date.now()}`

    const { data: distribution, error: distError } = await supabase
      .from('brand_coin_distributions')
      .insert({
        brand_coin_id: brandCoin.id,
        brand_id: brandId,
        user_id: userId,
        amount,
        reason,
        campaign_id: campaignId || null,
        idempotency_key: idempotencyKey,
        metadata,
        status: 'completed',
      })
      .select()
      .single()

    if (distError) {
      // Check for idempotency violation
      if (distError.code === '23505') {
        return NextResponse.json(
          { error: 'Distribution already processed', idempotencyKey },
          { status: 409 }
        )
      }
      console.error('[brand-coins/distribute] insert error:', distError)
      return NextResponse.json(
        { error: 'Failed to distribute coins' },
        { status: 500 }
      )
    }

    // Update brand coin supply
    const { error: updateError } = await supabase
      .from('brand_coins')
      .update({
        current_supply: brandCoin.current_supply - amount,
        total_distributed: (brandCoin.total_distributed || 0) + amount,
      })
      .eq('id', brandCoin.id)

    if (updateError) {
      console.error('[brand-coins/distribute] update error:', updateError)
      // Rollback distribution record
      await supabase.from('brand_coin_distributions').delete().eq('id', distribution.id)
      return NextResponse.json(
        { error: 'Failed to update supply' },
        { status: 500 }
      )
    }

    // Create user balance record if not exists
    const { data: existingBalance } = await supabase
      .from('brand_coin_balances')
      .select('id')
      .eq('brand_coin_id', brandCoin.id)
      .eq('user_id', userId)
      .single()

    if (existingBalance) {
      // Update existing balance
      await supabase.rpc('increment_brand_coin_balance', {
        p_brand_coin_id: brandCoin.id,
        p_user_id: userId,
        p_amount: amount,
      })
    } else {
      // Create new balance
      await supabase.from('brand_coin_balances').insert({
        brand_coin_id: brandCoin.id,
        brand_id: brandId,
        user_id: userId,
        balance: amount,
        total_earned: amount,
      })
    }

    return NextResponse.json({
      success: true,
      distribution: {
        id: distribution.id,
        amount,
        reason,
        brandCoinName: brandCoin.name,
        brandCoinSymbol: brandCoin.symbol,
      },
      newSupply: brandCoin.current_supply - amount,
    })
  } catch (e) {
    console.error('[brand-coins/distribute] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
