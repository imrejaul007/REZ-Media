/**
 * Campaign Scheduler - Handles start/end date management and auto-pause
 * AdsQr MVP - Phase 2
 */

import { createClient } from './supabase'

interface CampaignSchedule {
  id: string
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'active' | 'paused' | 'ended'
}

/**
 * Check if a campaign should be active based on schedule
 */
export function isCampaignActive(schedule: CampaignSchedule): boolean {
  const now = new Date()

  // If no start date or start date has passed
  const startOk = !schedule.start_date || new Date(schedule.start_date) <= now

  // If no end date or end date hasn't passed
  const endOk = !schedule.end_date || new Date(schedule.end_date) > now

  return startOk && endOk
}

/**
 * Check if a campaign should auto-pause (end date passed)
 */
export function shouldAutoPause(schedule: CampaignSchedule): boolean {
  if (!schedule.end_date) return false
  return new Date(schedule.end_date) <= new Date()
}

/**
 * Get campaign status considering schedule
 */
export function getScheduledStatus(schedule: CampaignSchedule): CampaignSchedule['status'] {
  if (schedule.status === 'ended') return 'ended'

  const shouldPause = shouldAutoPause(schedule)
  if (shouldPause) return 'ended'

  if (!schedule.start_date || new Date(schedule.start_date) <= new Date()) {
    if (schedule.status === 'draft') return 'active'
    return schedule.status
  }

  return 'draft'
}

/**
 * Process all campaigns that need status updates
 * Should be called by a cron job or scheduled function
 */
export async function processScheduledCampaigns(): Promise<{
  activated: string[]
  paused: string[]
}> {
  const supabase = createClient()
  const now = new Date()
  const activated: string[] = []
  const paused: string[] = []

  // Get all campaigns with scheduled dates
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date')
    .or(`start_date.lte.${now.toISOString()},end_date.not.is.null`)

  if (!campaigns) return { activated, paused }

  for (const campaign of campaigns) {
    const newStatus = getScheduledStatus({
      id: campaign.id,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      status: campaign.status as CampaignSchedule['status']
    })

    if (newStatus !== campaign.status) {
      await supabase
        .from('campaigns')
        .update({ status: newStatus, updated_at: now.toISOString() })
        .eq('id', campaign.id)

      if (newStatus === 'active') {
        activated.push(campaign.id)
      } else if (newStatus === 'ended') {
        paused.push(campaign.id)
      }
    }
  }

  return { activated, paused }
}

/**
 * Schedule a campaign for future activation
 */
export async function scheduleCampaign(
  campaignId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<boolean> {
  const supabase = createClient()

  const updates: Partial<{
    start_date: string | null
    end_date: string | null
    status: string
    updated_at: string
  }> = {
    updated_at: new Date().toISOString()
  }

  if (startDate !== undefined) {
    updates.start_date = startDate?.toISOString() || null
  }

  if (endDate !== undefined) {
    updates.end_date = endDate?.toISOString() || null
  }

  // If start date is in the future, set to draft
  if (startDate && startDate > new Date()) {
    updates.status = 'draft'
  }

  const { error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId)

  return !error
}

/**
 * Get campaign time remaining
 */
export function getTimeRemaining(endDate: string | null): {
  days: number
  hours: number
  minutes: number
  expired: boolean
} {
  if (!endDate) return { days: 0, hours: 0, minutes: 0, expired: false }

  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes, expired: false }
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(endDate: string | null): string {
  const remaining = getTimeRemaining(endDate)

  if (remaining.expired) return 'Expired'

  const parts: string[] = []
  if (remaining.days > 0) parts.push(`${remaining.days}d`)
  if (remaining.hours > 0) parts.push(`${remaining.hours}h`)
  if (remaining.minutes > 0 || parts.length === 0) parts.push(`${remaining.minutes}m`)

  return parts.join(' ') + ' remaining'
}

/**
 * Extend campaign end date
 */
export async function extendCampaign(campaignId: string, daysToAdd: number): Promise<boolean> {
  const supabase = createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('end_date')
    .eq('id', campaignId)
    .single()

  if (!campaign) return false

  const currentEnd = campaign.end_date ? new Date(campaign.end_date) : new Date()
  const newEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('campaigns')
    .update({
      end_date: newEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId)

  return !error
}

/**
 * Get campaigns starting soon (within next 24 hours)
 */
export async function getUpcomingCampaigns(hoursAhead: number = 24): Promise<CampaignSchedule[]> {
  const supabase = createClient()
  const now = new Date()
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, start_date, end_date, status')
    .eq('status', 'draft')
    .gte('start_date', now.toISOString())
    .lte('start_date', future.toISOString())

  return (campaigns || []) as CampaignSchedule[]
}
