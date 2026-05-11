import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/attribution/purchase
// Record a purchase event and credit rewards

interface PurchaseEvent {
  scanEventId?: string
  amount: number
  currency?: string
  transactionId: string
  items?: string[]
  userId?: string
  merchantId?: string
  merchantName?: string
  storeId?: string
  posLocation?: string
}

const ATTRIBUTION_RATE = 0.05 // 5%

export async function POST(req: NextRequest) {
  try {
    const body: PurchaseEvent = await req.json()
    const {
      scanEventId,
      amount,
      currency = 'INR',
      transactionId,
      items = [],
      userId,
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'amount is required and must be positive' },
        { status: 400 }
      )
    }

    if (!transactionId) {
      return NextResponse.json(
        { error: 'transactionId is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Check for duplicate
    const { data: existingPurchase } = await supabase
      .from('purchase_events')
      .select('id')
      .eq('transaction_id', transactionId)
      .single()

    if (existingPurchase) {
      return NextResponse.json(
        { error: 'Purchase already recorded', purchaseId: existingPurchase.id },
        { status: 409 }
      )
    }

    // Calculate attribution
    const attributedRevenue = amount * ATTRIBUTION_RATE
    const rewardAmount = attributedRevenue

    // Create purchase event
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchase_events')
      .insert({
        scan_event_id: scanEventId,
        user_id: userId,
        amount,
        currency,
        transaction_id: transactionId,
        items,
        attributed_revenue: attributedRevenue,
        reward_credited: rewardAmount,
        status: 'completed',
      })
      .select()
      .single()

    if (purchaseError || !purchase) {
      return NextResponse.json(
        { error: 'Failed to record purchase' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      purchaseId: purchase.id,
      attributedRevenue,
      rewardAmount,
    })
  } catch (error) {
    console.error('Purchase attribution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
