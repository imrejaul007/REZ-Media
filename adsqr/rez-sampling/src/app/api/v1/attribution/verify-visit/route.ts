import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// POST /api/v1/attribution/verify-visit
// Verify a visit event with GPS location and dwell time

interface VerifyVisitRequest {
  scanEventId: string
  latitude: number
  longitude: number
  dwellTime: number
  userId?: string
}

const VIST_VERIFICATION_RADIUS_METERS = 100
const MIN_DWELL_TIME_SECONDS = 30

export async function POST(req: NextRequest) {
  try {
    const body: VerifyVisitRequest = await req.json()
    const { scanEventId, latitude, longitude, dwellTime, userId } = body

    if (!scanEventId) {
      return NextResponse.json(
        { error: 'scanEventId is required' },
        { status: 400 }
      )
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'latitude and longitude are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get scan event details
    const { data: scanEvent, error: scanError } = await supabase
      .from('scan_events')
      .select(`
        *,
        campaigns (
          id,
          name,
          visit_reward,
          brand_id
        ),
        qr_codes (
          id,
          qr_label,
          location_lat,
          location_lng,
          location_name
        )
      `)
      .eq('id', scanEventId)
      .single()

    if (scanError || !scanEvent) {
      return NextResponse.json(
        { error: 'Scan event not found' },
        { status: 404 }
      )
    }

    // Calculate distance from QR location
    let distanceMeters: number | null = null
    let locationVerified = false

    if (scanEvent.qr_codes?.location_lat && scanEvent.qr_codes?.location_lng) {
      distanceMeters = calculateDistance(
        latitude,
        longitude,
        parseFloat(scanEvent.qr_codes.location_lat),
        parseFloat(scanEvent.qr_codes.location_lng)
      )
      locationVerified = distanceMeters <= VIST_VERIFICATION_RADIUS_METERS
    }

    // Verify dwell time
    const dwellTimeVerified = dwellTime >= MIN_DWELL_TIME_SECONDS

    // Create visit event record
    const visitRewardAmount = (locationVerified && dwellTimeVerified)
      ? scanEvent.campaigns?.visit_reward || 0
      : 0

    const { data: visitEvent, error: visitError } = await supabase
      .from('visit_events')
      .insert({
        scan_event_id: scanEventId,
        campaign_id: scanEvent.campaign_id,
        user_id: userId || scanEvent.user_id,
        qr_id: scanEvent.qr_id,
        location_lat: latitude,
        location_lng: longitude,
        location_verified: locationVerified,
        dwell_time_seconds: dwellTime,
        visit_reward_amount: visitRewardAmount,
        visit_reward_credited: false, // Will be credited by background job
      })
      .select()
      .single()

    if (visitError) {
      console.error('[attribution/verify-visit] insert error:', visitError)
      return NextResponse.json(
        { error: 'Failed to create visit event' },
        { status: 500 }
      )
    }

    // Update campaign coins used if reward was given
    if (visitRewardAmount > 0 && scanEvent.campaigns) {
      await supabase.rpc('increment_campaign_coins', {
        p_campaign_id: scanEvent.campaign_id,
        p_amount: visitRewardAmount,
      })
    }

    return NextResponse.json({
      success: true,
      visit: {
        id: visitEvent.id,
        locationVerified,
        locationDistance: distanceMeters,
        dwellTimeVerified,
        dwellTime,
        rewardAmount: visitRewardAmount,
        rewardCredited: visitRewardAmount > 0,
      },
      metadata: {
        qrLocation: scanEvent.qr_codes?.location_name,
        qrLabel: scanEvent.qr_codes?.qr_label,
        campaignName: scanEvent.campaigns?.name,
      },
    })
  } catch (e) {
    console.error('[attribution/verify-visit] error:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}
