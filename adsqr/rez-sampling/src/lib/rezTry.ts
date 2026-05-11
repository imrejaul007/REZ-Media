/**
 * REZ Try Integration for ADSQR
 *
 * Enables:
 * - Free samples via REZ Try
 * - Free trials via REZ Try
 * - Sample redemption tracking
 */

import { createClient } from './supabase'

const REZ_TRY_API_URL = process.env.NEXT_PUBLIC_REZ_TRY_URL || 'https://try.rez.money'

// Types
export interface FreeSample {
  id: string
  campaign_id: string
  merchant_id: string
  merchant_name: string
  name: string
  description: string
  image_url?: string
  stock: number
  coin_cost: number
  expires_at?: string
}

export interface SampleRequest {
  id: string
  user_id: string
  sample_id: string
  campaign_id: string
  status: 'pending' | 'approved' | 'shipped' | 'delivered' | 'cancelled'
  shipping_address?: string
  phone?: string
  created_at: string
}

export interface FreeTrial {
  id: string
  campaign_id: string
  merchant_id: string
  merchant_name: string
  name: string
  description: string
  duration_minutes: number
  locations: string[]
  coin_cost: number
  slots_available: number
}

export interface TrialBooking {
  id: string
  user_id: string
  trial_id: string
  campaign_id: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  slot_time: string
  slot_location: string
  created_at: string
}

// API Functions

/**
 * Get available free samples for a campaign
 */
export async function getFreeSamples(campaignId?: string): Promise<FreeSample[]> {
  const supabase = createClient()

  let query = supabase
    .from('free_samples')
    .select('*')
    .gt('stock', 0)

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch samples:', error)
    return []
  }

  return data || []
}

/**
 * Request a free sample
 */
export async function requestFreeSample(
  sampleId: string,
  campaignId: string,
  userId: string,
  shippingAddress: string,
  phone: string
): Promise<{ success: boolean; request?: SampleRequest; error?: string }> {
  const supabase = createClient()

  // Check stock
  const { data: sample, error: sampleError } = await supabase
    .from('free_samples')
    .select('stock')
    .eq('id', sampleId)
    .single()

  if (sampleError || !sample || sample.stock <= 0) {
    return { success: false, error: 'Sample out of stock' }
  }

  // Create request
  const { data, error } = await supabase
    .from('sample_requests')
    .insert({
      user_id: userId,
      sample_id: sampleId,
      campaign_id: campaignId,
      status: 'pending',
      shipping_address: shippingAddress,
      phone,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Decrement stock
  await supabase
    .from('free_samples')
    .update({ stock: sample.stock - 1 })
    .eq('id', sampleId)

  return { success: true, request: data }
}

/**
 * Get available free trials for a campaign
 */
export async function getFreeTrials(campaignId?: string): Promise<FreeTrial[]> {
  const supabase = createClient()

  let query = supabase
    .from('free_trials')
    .select('*')
    .gt('slots_available', 0)

  if (campaignId) {
    query = query.eq('campaign_id', campaignId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch trials:', error)
    return []
  }

  return data || []
}

/**
 * Book a free trial
 */
export async function bookFreeTrial(
  trialId: string,
  campaignId: string,
  userId: string,
  slotTime: string,
  slotLocation: string
): Promise<{ success: boolean; booking?: TrialBooking; error?: string }> {
  const supabase = createClient()

  // Check availability
  const { data: trial, error: trialError } = await supabase
    .from('free_trials')
    .select('slots_available')
    .eq('id', trialId)
    .single()

  if (trialError || !trial || trial.slots_available <= 0) {
    return { success: false, error: 'No slots available' }
  }

  // Create booking
  const { data, error } = await supabase
    .from('trial_bookings')
    .insert({
      user_id: userId,
      trial_id: trialId,
      campaign_id: campaignId,
      status: 'confirmed',
      slot_time: slotTime,
      slot_location: slotLocation,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Decrement slots
  await supabase
    .from('free_trials')
    .update({ slots_available: trial.slots_available - 1 })
    .eq('id', trialId)

  return { success: true, booking: data }
}

/**
 * Get user's sample requests
 */
export async function getMySampleRequests(userId: string): Promise<SampleRequest[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sample_requests')
    .select('*, free_samples(name, description, image_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch requests:', error)
    return []
  }

  return data || []
}

/**
 * Get user's trial bookings
 */
export async function getMyTrialBookings(userId: string): Promise<TrialBooking[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trial_bookings')
    .select('*, free_trials(name, duration_minutes, locations)')
    .eq('user_id', userId)
    .order('slot_time', { ascending: true })

  if (error) {
    console.error('Failed to fetch bookings:', error)
    return []
  }

  return data || []
}

/**
 * QR Scan → Track scan for attribution
 */
export async function trackScan(
  qrSlug: string,
  userId?: string,
  deviceId?: string,
  location?: { lat: number; lng: number }
): Promise<{ scanId: string; campaignId: string; rewards: any }> {
  const supabase = createClient()

  // Find QR and campaign
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('*, campaigns(*)')
    .eq('qr_slug', qrSlug)
    .single()

  if (!qr) {
    throw new Error('QR not found')
  }

  // Create scan event
  const { data: scan } = await supabase
    .from('scan_events')
    .insert({
      qr_id: qr.id,
      campaign_id: qr.campaign_id,
      user_id: userId,
      device_id: deviceId,
      location: location || null,
    })
    .select()
    .single()

  return {
    scanId: scan.id,
    campaignId: qr.campaign_id,
    rewards: qr.campaigns,
  }
}
