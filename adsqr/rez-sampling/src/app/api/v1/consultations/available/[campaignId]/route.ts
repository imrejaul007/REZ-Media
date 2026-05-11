import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET /api/v1/consultations/available/:campaignId
// Get available consultation types for a campaign

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

    // Get available consultation types for this campaign
    const { data: consultationTypes, error: typesError } = await supabase
      .from('consultation_types')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'active')

    if (typesError) {
      console.error('[consultations/available] error:', typesError)
      return NextResponse.json(
        { error: 'Failed to fetch consultation types' },
        { status: 500 }
      )
    }

    // Get user ID from auth if available
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let userId: string | null = null

    if (accessToken) {
      const { data } = await supabase.auth.getUser(accessToken)
      userId = data.user?.id || null
    }

    // Get user's existing bookings for this campaign
    let userBookings: { consultation_type_id: string; status: string }[] = []
    if (userId && consultationTypes && consultationTypes.length > 0) {
      const typeIds = consultationTypes.map(t => t.id)
      const { data: bookings } = await supabase
        .from('consultation_bookings')
        .select('consultation_type_id, status')
        .eq('user_id', userId)
        .in('consultation_type_id', typeIds)

      userBookings = bookings || []
    }

    // Format consultation types with availability
    const availableTypes = consultationTypes?.map(type => {
      const userBooking = userBookings.find(b => b.consultation_type_id === type.id)

      return {
        id: type.id,
        name: type.name,
        description: type.description,
        duration: type.duration_minutes,
        coinCost: type.coin_cost || 0,
        mode: type.mode, // 'in_store', 'video', 'phone'
        requiredDocuments: type.required_documents || [],
        availableSlots: type.max_bookings_per_day - (type.current_day_bookings || 0),
        userStatus: userBooking?.status || null,
        isBooked: !!userBooking,
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
      consultationTypes: availableTypes,
      summary: {
        totalTypes: availableTypes.length,
        bookedCount: availableTypes.filter(t => t.isBooked).length,
      },
    })
  } catch (e) {
    console.error('[consultations/available] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
