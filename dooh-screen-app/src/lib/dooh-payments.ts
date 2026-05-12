/**
 * DOOH Screen Owner Payments
 * Pay screen owners based on impressions
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Payment rates per 1000 impressions
const CPM_RATES: Record<string, number> = {
  cab_tablet: 15, // ₹15 per 1000 impressions
  bus_shelter: 20,
  bus_interior: 12,
  train_display: 18,
  metro_screen: 25,
  flight_seatback: 50, // Premium
  flight_overhead: 45,
  airport_gate: 40,
  airport_lounge: 60, // Premium
  airport_display: 35,
  restaurant_tv: 10,
  hotel_lobby: 15,
  hotel_room: 8,
  mall_kiosk: 22,
  mall_directory: 18,
  gym_screen: 12,
  salon_display: 10,
  office_lobby: 20,
  generic_display: 10,
}

const PLATFORM_FEE = 0.20 // 20% platform fee

export interface PaymentSummary {
  screen_id: string
  impressions: number
  gross_revenue: number
  platform_fee: number
  owner_amount: number
}

/**
 * Calculate earnings for a screen
 */
export async function calculateEarnings(screenId: string): Promise<PaymentSummary> {
  const { data: screen } = await supabase
    .from('dooh_screens')
    .select('type, total_impressions')
    .eq('id', screenId)
    .single()

  if (!screen) {
    throw new Error('Screen not found')
  }

  const cpm = CPM_RATES[screen.type] || 10
  const impressions = screen.total_impressions || 0
  const gross_revenue = (impressions / 1000) * cpm
  const platform_fee = gross_revenue * PLATFORM_FEE
  const owner_amount = gross_revenue - platform_fee

  return {
    screen_id: screenId,
    impressions,
    gross_revenue,
    platform_fee,
    owner_amount,
  }
}

/**
 * Process monthly payout for all screens
 */
export async function processMonthlyPayout(ownerId: string): Promise<{
  total: number
  screens: PaymentSummary[]
}> {
  // Get owner's screens
  const { data: screens } = await supabase
    .from('dooh_screens')
    .select('id, type, total_impressions')
    .eq('owner_id', ownerId)

  if (!screens || screens.length === 0) {
    return { total: 0, screens: [] }
  }

  const payments: PaymentSummary[] = []
  let total = 0

  for (const screen of screens) {
    const payment = await calculateEarnings(screen.id)

    // Update balance
    await supabase
      .from('dooh_screens')
      .update({ earnings_balance: payment.owner_amount })
      .eq('id', screen.id)

    payments.push(payment)
    total += payment.owner_amount
  }

  return { total, screens: payments }
}

/**
 * Request payout
 */
export async function requestPayout(
  screenId: string,
  method: 'bank_transfer' | 'upi' | 'wallet'
): Promise<{ success: boolean; payout_id?: string; error?: string }> {
  // Check balance
  const { data: screen } = await supabase
    .from('dooh_screens')
    .select('earnings_balance')
    .eq('id', screenId)
    .single()

  if (!screen || screen.earnings_balance <= 0) {
    return { success: false, error: 'Insufficient balance' }
  }

  // Create payout record
  const { data: payout, error } = await supabase
    .from('dooh_payouts')
    .insert({
      screen_id: screenId,
      amount: screen.earnings_balance,
      method,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Reset balance
  await supabase
    .from('dooh_screens')
    .update({ earnings_balance: 0 })
    .eq('id', screenId)

  return { success: true, payout_id: payout.id }
}

/**
 * Get payout history
 */
export async function getPayoutHistory(ownerId: string) {
  const { data: screens } = await supabase
    .from('dooh_screens')
    .select('id')
    .eq('owner_id', ownerId)

  if (!screens || screens.length === 0) {
    return []
  }

  const screenIds = screens.map(s => s.id)

  const { data: payouts } = await supabase
    .from('dooh_payouts')
    .select('*')
    .in('screen_id', screenIds)
    .order('created_at', { ascending: false })
    .limit(20)

  return payouts || []
}

/**
 * Get CPM rate for screen type
 */
export function getCPMRate(screenType: string): number {
  return CPM_RATES[screenType] || 10
}

/**
 * Get all screen types with rates
 */
export function getAllCPMRates() {
  return Object.entries(CPM_RATES).map(([type, rate]) => ({
    type,
    rate,
    description: getTypeDescription(type),
  }))
}

function getTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    cab_tablet: 'Taxi/Cab tablet',
    bus_shelter: 'Bus shelter display',
    flight_seatback: 'Flight seat-back entertainment',
    airport_lounge: 'Airport VIP lounge',
    restaurant_tv: 'Restaurant TV',
    hotel_lobby: 'Hotel lobby display',
    mall_kiosk: 'Mall directory/kiosk',
    generic_display: 'Generic display',
  }
  return descriptions[type] || type
}
