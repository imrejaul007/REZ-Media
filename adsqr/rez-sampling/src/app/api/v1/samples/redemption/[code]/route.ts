import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/samples/redemption/:code
// Get redemption details by code

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { error: 'redemption code is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get redemption request
    const { data: request, error: requestError } = await supabase
      .from('sample_requests')
      .select(`
        *,
        free_samples (
          id,
          name,
          description,
          image_url,
          terms,
          expiry_date
        ),
        campaigns (
          id,
          name,
          brand_id
        ),
        stores (
          id,
          name,
          address,
          location_lat,
          location_lng
        )
      `)
      .eq('redemption_code', code)
      .single()

    if (requestError || !request) {
      return NextResponse.json(
        { error: 'Redemption code not found' },
        { status: 404 }
      )
    }

    // Check if expired
    const isExpired = request.free_samples?.expiry_date
      ? new Date(request.free_samples.expiry_date) < new Date()
      : false

    // Format response
    return NextResponse.json({
      success: true,
      redemption: {
        id: request.id,
        code: request.redemption_code,
        status: request.status,
        isExpired,
        sample: request.free_samples ? {
          id: request.free_samples.id,
          name: request.free_samples.name,
          description: request.free_samples.description,
          imageUrl: request.free_samples.image_url,
          terms: request.free_samples.terms,
          expiryDate: request.free_samples.expiry_date,
        } : null,
        campaign: request.campaigns ? {
          id: request.campaigns.id,
          name: request.campaigns.name,
        } : null,
        store: request.stores ? {
          id: request.stores.id,
          name: request.stores.name,
          address: request.stores.address,
          location: request.stores.location_lat && request.stores.location_lng
            ? { lat: request.stores.location_lat, lng: request.stores.location_lng }
            : null,
        } : null,
        preferredDate: request.preferred_date,
        createdAt: request.created_at,
      },
    })
  } catch (e) {
    console.error('[samples/redemption] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
