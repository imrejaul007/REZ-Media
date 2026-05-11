// Retargeting Engine for Ads QR
// Triggers follow-up campaigns and notifications based on user behavior

import { createClient } from '@/lib/supabase'

// Types
export interface RetargetingTrigger {
  id: string
  campaignId: string
  userId: string
  triggerType: RetargetingTriggerType
  status: 'pending' | 'sent' | 'cancelled' | 'expired'
  scheduledFor?: string
  sentAt?: string
  offer?: RetargetingOffer
  createdAt: string
}

export type RetargetingTriggerType =
  | 'scan_no_visit'
  | 'visit_no_purchase'
  | 'abandoned_cart'
  | 'inactive_user'
  | 'purchase_complete'
  | 'birthday'
  | 'loyalty_tier_upgrade'

export interface RetargetingOffer {
  type: 'coins' | 'discount' | 'bonus' | 'free_sample'
  amount: number
  title: string
  description: string
  expiresIn: number // hours
  code?: string
}

export interface UserEngagement {
  userId: string
  campaignId: string
  scanned: boolean
  scannedAt?: string
  visited: boolean
  visitedAt?: string
  purchased: boolean
  purchasedAt?: string
  totalSpent: number
  visitCount: number
  lastActivity: string
}

export interface RetargetingCampaign {
  id: string
  name: string
  campaignId: string
  triggerType: RetargetingTriggerType
  delayHours: number
  offer: RetargetingOffer
  isActive: boolean
  maxRecipients: number
  sentCount: number
  createdAt: string
}

// Retargeting Engine Class
export class RetargetingEngine {
  private supabase = createClient()

  /**
   * Trigger retargeting for a user who scanned but didn't visit
   */
  async triggerScanNoVisit(userId: string, campaignId: string): Promise<void> {
    const offer: RetargetingOffer = {
      type: 'bonus',
      amount: 5,
      title: 'Come visit us again!',
      description: 'You scanned our QR but haven\'t visited yet. Here\'s a bonus to welcome you!',
      expiresIn: 48
    }

    await this.scheduleTrigger(userId, campaignId, 'scan_no_visit', 24, offer)
  }

  /**
   * Trigger retargeting for a user who visited but didn't purchase
   */
  async triggerVisitNoPurchase(userId: string, campaignId: string): Promise<void> {
    const offer: RetargetingOffer = {
      type: 'discount',
      amount: 10,
      title: 'Special offer just for you!',
      description: 'We noticed you visited but didn\'t make a purchase. Here\'s 10% off!',
      expiresIn: 72,
      code: `VISIT${Date.now().toString(36).toUpperCase()}`
    }

    await this.scheduleTrigger(userId, campaignId, 'visit_no_purchase', 48, offer)
  }

  /**
   * Trigger retargeting for abandoned cart
   */
  async triggerAbandonedCart(userId: string, cartTotal: number): Promise<void> {
    const offer: RetargetingOffer = {
      type: 'bonus',
      amount: Math.min(Math.floor(cartTotal * 0.05), 50),
      title: 'Complete your purchase!',
      description: 'You left items in your cart. Complete your order and get bonus coins!',
      expiresIn: 24
    }

    await this.scheduleTrigger(userId, '', 'abandoned_cart', 1, offer)
  }

  /**
   * Trigger retargeting for inactive users
   */
  async triggerInactiveUser(userId: string, daysInactive: number): Promise<void> {
    const offer: RetargetingOffer = {
      type: 'coins',
      amount: 20 + (daysInactive * 2),
      title: 'We miss you!',
      description: `It's been ${daysInactive} days since your last visit. Here's a welcome back bonus!`,
      expiresIn: 168 // 7 days
    }

    await this.scheduleTrigger(userId, '', 'inactive_user', 0, offer)
  }

  /**
   * Schedule a follow-up after purchase
   */
  async scheduleFollowUp(userId: string, campaignId: string, hours: number = 24): Promise<void> {
    const offer: RetargetingOffer = {
      type: 'coins',
      amount: 10,
      title: 'Thank you for your purchase!',
      description: 'Here are some coins for your recent purchase. Keep collecting!',
      expiresIn: 720 // 30 days
    }

    await this.scheduleTrigger(userId, campaignId, 'purchase_complete', hours, offer)
  }

  /**
   * Schedule a retargeting trigger
   */
  private async scheduleTrigger(
    userId: string,
    campaignId: string,
    triggerType: RetargetingTriggerType,
    delayHours: number,
    offer: RetargetingOffer
  ): Promise<void> {
    const scheduledFor = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString()

    // Check if there's already a pending trigger
    const { data: existing } = await this.supabase
      .from('retargeting_triggers')
      .select('id')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .eq('trigger_type', triggerType)
      .eq('status', 'pending')
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing trigger
      await this.supabase
        .from('retargeting_triggers')
        .update({
          scheduled_for: scheduledFor,
          offer,
          created_at: new Date().toISOString()
        })
        .eq('id', existing[0].id)
    } else {
      // Create new trigger
      await this.supabase.from('retargeting_triggers').insert({
        user_id: userId,
        campaign_id: campaignId,
        trigger_type: triggerType,
        status: 'pending',
        scheduled_for: scheduledFor,
        offer
      })
    }
  }

  /**
   * Get retargeting offers for a user
   */
  async getRetargetingOffers(userId: string): Promise<RetargetingOffer[]> {
    const { data: triggers } = await this.supabase
      .from('retargeting_triggers')
      .select('offer, scheduled_for, trigger_type')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())

    if (!triggers || triggers.length === 0) return []

    // Filter out expired offers
    const now = new Date()
    return triggers
      .filter(t => {
        const scheduledDate = new Date(t.scheduled_for)
        return scheduledDate <= now
      })
      .map(t => t.offer as RetargetingOffer)
  }

  /**
   * Mark a trigger as sent
   */
  async markTriggerSent(triggerId: string): Promise<void> {
    await this.supabase
      .from('retargeting_triggers')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', triggerId)
  }

  /**
   * Get user engagement data
   */
  async getUserEngagement(userId: string, campaignId: string): Promise<UserEngagement | null> {
    // Get scan data
    const { data: scanData } = await this.supabase
      .from('scan_events')
      .select('created_at')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get visit data
    const { data: visitData } = await this.supabase
      .from('visit_events')
      .select('created_at, amount')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    // Get purchase data
    const { data: purchaseData } = await this.supabase
      .from('purchase_events')
      .select('created_at, amount')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    if (!scanData && !visitData && !purchaseData) {
      return null
    }

    const lastActivity = [
      scanData?.created_at,
      visitData?.[0]?.created_at,
      purchaseData?.[0]?.created_at
    ].filter(Boolean).sort()[visitData?.length ? visitData.length - 1 : 0] || new Date().toISOString()

    return {
      userId,
      campaignId,
      scanned: !!scanData,
      scannedAt: scanData?.created_at,
      visited: (visitData?.length || 0) > 0,
      visitedAt: visitData?.[0]?.created_at,
      purchased: (purchaseData?.length || 0) > 0,
      purchasedAt: purchaseData?.[0]?.created_at,
      totalSpent: purchaseData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      visitCount: visitData?.length || 0,
      lastActivity: lastActivity || new Date().toISOString()
    }
  }

  /**
   * Create a retargeting campaign (for brands)
   */
  async createRetargetingCampaign(
    campaignId: string,
    data: Partial<RetargetingCampaign>
  ): Promise<RetargetingCampaign> {
    const { data: result, error } = await this.supabase
      .from('retargeting_campaigns')
      .insert({
        name: data.name || 'Retargeting Campaign',
        campaign_id: campaignId,
        trigger_type: data.triggerType || 'scan_no_visit',
        delay_hours: data.delayHours || 24,
        offer: data.offer,
        is_active: true,
        max_recipients: data.maxRecipients || 1000,
        sent_count: 0
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create retargeting campaign: ${error.message}`)

    return {
      id: result.id,
      name: result.name,
      campaignId: result.campaign_id,
      triggerType: result.trigger_type,
      delayHours: result.delay_hours,
      offer: result.offer,
      isActive: result.is_active,
      maxRecipients: result.max_recipients,
      sentCount: result.sent_count,
      createdAt: result.created_at
    }
  }

  /**
   * Process pending triggers (called by cron job)
   */
  async processPendingTriggers(): Promise<number> {
    const now = new Date().toISOString()

    // Get pending triggers that are due
    const { data: triggers } = await this.supabase
      .from('retargeting_triggers')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)

    if (!triggers || triggers.length === 0) return 0

    let processed = 0

    for (const trigger of triggers) {
      try {
        // Send notification (push notification, email, etc.)
        await this.sendRetargetingNotification(trigger)

        // Mark as sent
        await this.markTriggerSent(trigger.id)

        // Credit offer if applicable
        if (trigger.offer?.type === 'coins' && trigger.user_id) {
          await this.creditOfferCoins(trigger.user_id, trigger.offer.amount)
        }

        processed++
      } catch (error) {
        console.error(`Failed to process trigger ${trigger.id}:`, error)
      }
    }

    return processed
  }

  /**
   * Send retargeting notification
   */
  private async sendRetargetingNotification(trigger: any): Promise<void> {
    // In production, this would integrate with push notification service
    // For now, we'll log and create an in-app notification

    await this.supabase.from('notifications').insert({
      user_id: trigger.user_id,
      type: 'retargeting',
      title: trigger.offer?.title || 'Special Offer',
      body: trigger.offer?.description || 'You have a special offer waiting!',
      data: {
        triggerId: trigger.id,
        campaignId: trigger.campaign_id,
        triggerType: trigger.trigger_type,
        offer: trigger.offer
      },
      is_read: false,
      created_at: new Date().toISOString()
    })
  }

  /**
   * Credit coins from retargeting offer
   */
  private async creditOfferCoins(userId: string, amount: number): Promise<void> {
    await this.supabase.from('coin_transactions').insert({
      user_id: userId,
      coin_type: 'rez',
      amount,
      reason: 'retargeting_offer'
    })
  }

  /**
   * Get retargeting stats
   */
  async getRetargetingStats(campaignId?: string): Promise<{
    totalTriggers: number
    sent: number
    pending: number
    cancelled: number
    conversionRate: number
  }> {
    let query = this.supabase
      .from('retargeting_triggers')
      .select('status')

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: triggers } = await query

    const total = triggers?.length || 0
    const sent = triggers?.filter(t => t.status === 'sent').length || 0
    const pending = triggers?.filter(t => t.status === 'pending').length || 0
    const cancelled = triggers?.filter(t => t.status === 'cancelled').length || 0

    return {
      totalTriggers: total,
      sent,
      pending,
      cancelled,
      conversionRate: total > 0 ? (sent / total) * 100 : 0
    }
  }
}

// Singleton instance
let retargetingEngineInstance: RetargetingEngine | null = null

export function getRetargetingEngine(): RetargetingEngine {
  if (!retargetingEngineInstance) {
    retargetingEngineInstance = new RetargetingEngine()
  }
  return retargetingEngineInstance
}
