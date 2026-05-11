import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/brand-coins/create
// Create a new brand coin (admin endpoint)

interface CreateBrandCoinRequest {
  brandId: string
  name: string
  symbol: string
  initialSupply: number
  description?: string
  iconUrl?: string
  metadata?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateBrandCoinRequest = await req.json()
    const { brandId, name, symbol, initialSupply, description, iconUrl, metadata } = body

    if (!brandId || !name || !symbol) {
      return NextResponse.json(
        { error: 'brandId, name, and symbol are required' },
        { status: 400 }
      )
    }

    if (initialSupply < 0) {
      return NextResponse.json(
        { error: 'initialSupply must be non-negative' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Check if brand already has coins
    const { data: existing } = await supabase
      .from('brand_coins')
      .select('id')
      .eq('brand_id', brandId)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Brand already has coins configured' },
        { status: 409 }
      )
    }

    // Create brand coins
    const { data: brandCoin, error } = await supabase
      .from('brand_coins')
      .insert({
        brand_id: brandId,
        name,
        symbol: symbol.toUpperCase(),
        initial_supply: initialSupply,
        current_supply: initialSupply,
        description,
        icon_url: iconUrl,
        metadata,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('[brand-coins/create] error:', error)
      return NextResponse.json(
        { error: 'Failed to create brand coins' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      brandCoin: {
        id: brandCoin.id,
        brandId: brandCoin.brand_id,
        name: brandCoin.name,
        symbol: brandCoin.symbol,
        initialSupply: brandCoin.initial_supply,
        currentSupply: brandCoin.current_supply,
        status: brandCoin.status,
      },
    })
  } catch (e) {
    console.error('[brand-coins/create] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
