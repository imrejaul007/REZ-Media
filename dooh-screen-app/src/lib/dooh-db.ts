/**
 * DOOH Screen Database Service
 * Supabase integration for screen registry
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface DOOHScreen {
  id: string
  name: string
  type: ScreenType
  location: ScreenLocation
  owner_id: string
  owner_email: string
  owner_phone?: string
  status: 'active' | 'inactive' | 'offline' | 'maintenance'
  registered_at: string
  last_heartbeat?: string
  playlist_version: number
  total_impressions: number
  total_scans: number
  earnings_balance: number
  earnings_paid: number
}

export type ScreenType =
  | 'cab_tablet' | 'bus_shelter' | 'bus_interior' | 'train_display' | 'metro_screen'
  | 'flight_seatback' | 'flight_overhead' | 'flight_entrance' | 'flight_lavatory'
  | 'airport_display' | 'airport_kiosk' | 'airport_gate' | 'airport_lounge' | 'airport_billboard'
  | 'restaurant_tv' | 'hotel_lobby' | 'hotel_room'
  | 'mall_kiosk' | 'mall_directory' | 'gym_screen' | 'salon_display'
  | 'office_lobby' | 'office_elevator'
  | 'generic_display'

export interface ScreenLocation {
  city: string
  area?: string
  lat?: number
  lng?: number
  address?: string
}

/**
 * Register a new screen
 */
export async function registerScreen(data: {
  id: string
  name: string
  type: ScreenType
  location: ScreenLocation
  owner_id: string
  owner_email: string
  owner_phone?: string
}): Promise<{ success: boolean; screen?: DOOHScreen; error?: string }> {
  const { data: screen, error } = await supabase
    .from('dooh_screens')
    .insert({
      id: data.id,
      name: data.name,
      type: data.type,
      location: data.location,
      owner_id: data.owner_id,
      owner_email: data.owner_email,
      owner_phone: data.owner_phone,
      status: 'active',
      registered_at: new Date().toISOString(),
      total_impressions: 0,
      total_scans: 0,
      earnings_balance: 0,
      earnings_paid: 0,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, screen }
}

/**
 * Get screen by ID
 */
export async function getScreen(id: string): Promise<DOOHScreen | null> {
  const { data } = await supabase
    .from('dooh_screens')
    .select('*')
    .eq('id', id)
    .single()

  return data
}

/**
 * Get all screens for an owner
 */
export async function getOwnerScreens(ownerId: string): Promise<DOOHScreen[]> {
  const { data } = await supabase
    .from('dooh_screens')
    .select('*')
    .eq('owner_id', ownerId)
    .order('registered_at', { ascending: false })

  return data || []
}

/**
 * Update screen heartbeat
 */
export async function updateHeartbeat(
  id: string,
  status: 'active' | 'offline'
): Promise<void> {
  await supabase
    .from('dooh_screens')
    .update({
      last_heartbeat: new Date().toISOString(),
      status,
    })
    .eq('id', id)
}

/**
 * Record impression
 */
export async function recordImpression(
  screenId: string,
  campaignId: string
): Promise<void> {
  await supabase.rpc('increment_impression', { screen_id: screenId })
}

/**
 * Record QR scan
 */
export async function recordScan(screenId: string): Promise<void> {
  await supabase.rpc('increment_scan', { screen_id: screenId })
}

/**
 * Get screen stats
 */
export async function getScreenStats(screenId: string) {
  const { data } = await supabase
    .from('dooh_screens')
    .select('total_impressions, total_scans, earnings_balance')
    .eq('id', screenId)
    .single()

  return data
}
