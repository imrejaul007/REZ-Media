/**
 * Boarding Pass QR Integration for ADSQR
 *
 * Allows:
 * - Airlines to offer rewards on seat-back screens
 * - Passengers scan QR → get offers
 * - Track attribution to flight/cabin/seat
 */

import { createClient } from './supabase'

export interface BoardingPassQR {
  id: string
  campaign_id: string
  flight_number: string
  airline: string
  origin: string
  destination: string
  departure_date: string
  cabin_class: 'economy' | 'business' | 'first'
  seat_range?: string
  pnr?: string // Passenger Name Record
  passenger_name?: string
  is_active: boolean
  created_at: string
}

export interface BoardingPassReward {
  id: string
  boarding_pass_id: string
  passenger_name: string
  offer_type: 'discount' | 'lounge_access' | 'priority_boarding' | 'miles' | 'cashback'
  offer_value: string
  offer_description: string
  qr_code: string
  expires_at: string
  redeemed: boolean
  redeemed_at?: string
}

/**
 * Create boarding pass QR campaign
 */
export async function createBoardingPassCampaign(
  campaignId: string,
  flightNumbers: string[],
  airline: string,
  rewards: BoardingPassReward[]
): Promise<{ success: boolean; boardingPasses?: BoardingPassQR[]; error?: string }> {
  const supabase = createClient()

  const boardingPasses: any[] = []

  for (const flight of flightNumbers) {
    const [origin, destination] = flight.split('-')

    const { data, error } = await supabase
      .from('boarding_pass_qrs')
      .insert({
        campaign_id: campaignId,
        flight_number: flight,
        airline,
        origin,
        destination,
        departure_date: new Date().toISOString(),
        cabin_class: 'economy',
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    boardingPasses.push(data)
  }

  return { success: true, boardingPasses }
}

/**
 * Scan boarding pass QR
 */
export async function scanBoardingPassQR(
  qrData: string,
  passengerName?: string
): Promise<{
  success: boolean
  reward?: BoardingPassReward
  boardingPass?: BoardingPassQR
  error?: string
}> {
  const supabase = createClient()

  // Decode QR data
  let qrPayload: {
    id: string
    campaign_id: string
    flight: string
    pnr?: string
  }

  try {
    qrPayload = JSON.parse(atob(qrData))
  } catch {
    return { success: false, error: 'Invalid QR code' }
  }

  // Find boarding pass
  const { data: boardingPass, error: bpError } = await supabase
    .from('boarding_pass_qrs')
    .select('*')
    .eq('id', qrPayload.id)
    .eq('is_active', true)
    .single()

  if (bpError || !boardingPass) {
    return { success: false, error: 'Boarding pass not found or expired' }
  }

  // Get reward for this campaign
  const { data: reward, error: rewardError } = await supabase
    .from('boarding_pass_rewards')
    .select('*')
    .eq('boarding_pass_id', boardingPass.id)
    .eq('redeemed', false)
    .single()

  if (rewardError || !reward) {
    return {
      success: true,
      boardingPass,
      reward: null as any,
      error: 'No rewards available for this flight',
    }
  }

  // Mark as redeemed
  await supabase
    .from('boarding_pass_rewards')
    .update({ redeemed: true, redeemed_at: new Date().toISOString() })
    .eq('id', reward.id)

  return {
    success: true,
    boardingPass,
    reward: {
      ...reward,
      passenger_name: passengerName || 'Valued Passenger',
    },
  }
}

/**
 * Get boarding pass rewards for a campaign
 */
export async function getBoardingPassRewards(
  campaignId: string
): Promise<BoardingPassReward[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('boarding_pass_rewards')
    .select('*')
    .eq('boarding_pass_id', campaignId)

  if (error) {
    console.error('Failed to fetch rewards:', error)
    return []
  }

  return data || []
}
