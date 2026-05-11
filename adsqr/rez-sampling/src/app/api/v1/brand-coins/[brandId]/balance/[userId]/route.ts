import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/brand-coins/:brandId/balance/:userId
// Get brand coin balance for a user

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string; userId: string }> }
) {
  try {
    const { brandId, userId } = await params

    if (!brandId || !userId) {
      return NextResponse.json(
        { error: 'brandId and userId are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get brand coin details
    const { data: brandCoin, error: coinError } = await supabase
      .from('brand_coins')
      .select('*')
      .eq('brand_id', brandId)
      .single()

    if (coinError || !brandCoin) {
      return NextResponse.json(
        { error: 'Brand coin not found' },
        { status: 404 }
      )
    }

    // Get user balance
    const { data: balance, error: balanceError } = await supabase
      .from('brand_coin_balances')
      .select('*')
      .eq('brand_coin_id', brandCoin.id)
      .eq('user_id', userId)
      .single()

    if (balanceError || !balance) {
      // Return zero balance if not found
      return NextResponse.json({
        success: true,
        brand: {
          id: brandCoin.id,
          brandId: brandCoin.brand_id,
          name: brandCoin.name,
          symbol: brandCoin.symbol,
        },
        balance: {
          available: 0,
          locked: 0,
          total: 0,
          totalEarned: 0,
          totalSpent: 0,
        },
        history: [],
      })
    }

    // Get recent transactions
    const { data: transactions } = await supabase
      .from('brand_coin_distributions')
      .select('*')
      .eq('brand_coin_id', brandCoin.id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      brand: {
        id: brandCoin.id,
        brandId: brandCoin.brand_id,
        name: brandCoin.name,
        symbol: brandCoin.symbol,
        iconUrl: brandCoin.icon_url,
      },
      balance: {
        available: balance.balance,
        locked: balance.locked || 0,
        total: balance.balance + (balance.locked || 0),
        totalEarned: balance.total_earned || 0,
        totalSpent: balance.total_spent || 0,
      },
      history: transactions?.map(t => ({
        id: t.id,
        amount: t.amount,
        reason: t.reason,
        campaignId: t.campaign_id,
        createdAt: t.created_at,
      })) || [],
    })
  } catch (e) {
    console.error('[brand-coins/balance] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
