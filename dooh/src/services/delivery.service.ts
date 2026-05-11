/**
 * DOOH - Ad Delivery Service
 * Decides which ads to show on which screens
 */

import {
  Screen,
  DOOHCampaign,
  DeliveryRequest,
  DeliveryResponse,
  DeliverySlot,
  Creative,
  DeliveryContext,
  RevenueModel
} from '../types'

/**
 * Ad Delivery Engine
 * Core decision-making for DOOH ad network
 */
export class DeliveryEngine {
  /**
   * Get ads for a screen
   */
  getAdsForScreen(
    request: DeliveryRequest,
    screen: Screen,
    campaigns: DOOHCampaign[]
  ): DeliveryResponse {
    // Step 1: Filter eligible campaigns
    const eligible = this.filterCampaigns(campaigns, screen, request)

    // Step 2: Score and rank
    const ranked = this.rankCampaigns(eligible, screen, request.context)

    // Step 3: Select ads for available slots
    const slots = this.selectSlots(ranked, request.available_slots)

    return {
      screen_id: request.screen_id,
      slots,
      generated_at: new Date()
    }
  }

  /**
   * Filter campaigns for this screen
   */
  private filterCampaigns(
    campaigns: DOOHCampaign[],
    screen: Screen,
    request: DeliveryRequest
  ): DOOHCampaign[] {
    return campaigns.filter(c => {
      // Status check
      if (c.status !== 'active') return false

      // Budget check
      if (c.spent >= c.budget) return false

      // Date check
      const now = new Date()
      if (now < c.start_date || now > c.end_date) return false

      // City match
      if (c.targeting.cities?.length) {
        if (!c.targeting.cities.includes(screen.location.city)) {
          return false
        }
      }

      // Screen type match
      if (c.targeting.screen_types?.length) {
        if (!c.targeting.screen_types.includes(screen.type)) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Rank campaigns by relevance
   */
  private rankCampaigns(
    campaigns: DOOHCampaign[],
    screen: Screen,
    context: DeliveryContext
  ): RankedCampaign[] {
    return campaigns.map(campaign => {
      let score = 100
      const reasons: string[] = []

      // 1. Audience fit (40% weight)
      const audienceScore = this.calculateAudienceScore(campaign, screen.audience_profile)
      score *= (0.4 + audienceScore * 0.6)
      if (audienceScore > 0.8) {
        reasons.push(`High audience match (${Math.round(audienceScore * 100)}%)`)
      }

      // 2. Time targeting (20% weight)
      const timeScore = this.calculateTimeScore(campaign, context)
      score *= (0.8 + timeScore * 0.2)
      if (timeScore > 1) {
        reasons.push('Prime time targeting match')
      }

      // 3. Context signals (20% weight)
      const contextScore = this.calculateContextScore(campaign, context)
      score *= (0.9 + contextScore * 0.1)
      if (contextScore > 1) {
        reasons.push('Context signal match')
      }

      // 4. Budget urgency (20% weight)
      const urgency = (campaign.budget - campaign.spent) / campaign.budget
      if (urgency > 0.8) {
        score *= 1.3
        reasons.push('High budget remaining')
      }

      return {
        campaign,
        score,
        reasons
      }
    }).sort((a, b) => b.score - a.score)
  }

  /**
   * Calculate audience fit score
   */
  private calculateAudienceScore(
    campaign: DOOHCampaign,
    audienceProfile?: { primary: { type: string; percentage: number }[] }
  ): number {
    if (!audienceProfile?.primary?.length || !campaign.targeting.audience_segments?.length) {
      return 1.0
    }

    const targetSegments = new Set(campaign.targeting.audience_segments)
    let totalMatch = 0
    let totalWeight = 0

    for (const segment of audienceProfile.primary) {
      totalWeight += segment.percentage
      if (targetSegments.has(segment.type)) {
        totalMatch += segment.percentage
      }
    }

    return totalWeight > 0 ? totalMatch / totalWeight : 1.0
  }

  /**
   * Calculate time targeting score
   */
  private calculateTimeScore(campaign: DOOHCampaign, context: DeliveryContext): number {
    const hour = new Date().getHours()

    if (!campaign.targeting.day_parts) return 1.0

    // Morning: 6-12
    if (hour >= 6 && hour < 12 && campaign.targeting.day_parts.morning) {
      return 1.5
    }

    // Afternoon: 12-17
    if (hour >= 12 && hour < 17 && campaign.targeting.day_parts.afternoon) {
      return 1.5
    }

    // Evening: 17-22
    if (hour >= 17 && hour < 22 && campaign.targeting.day_parts.evening) {
      return 1.5
    }

    return 0.7 // Lower score if no match
  }

  /**
   * Calculate context signal score
   */
  private calculateContextScore(campaign: DOOHCampaign, context: DeliveryContext): number {
    let score = 1.0

    // Weather-based (from ReZ Mind signals)
    if (context.weather === 'rainy') {
      // Indoor activities boost
      if (campaign.targeting.audience_segments?.includes('foodies')) {
        score *= 1.2
      }
    }

    // Event-based
    if (context.nearby_events?.length) {
      score *= 1.1
    }

    // Density
    if (context.audience.density === 'dense') {
      score *= 1.15 // Higher footfall = more value
    }

    return score
  }

  /**
   * Select slots for available time
   */
  private selectSlots(ranked: RankedCampaign[], availableSlots: number): DeliverySlot[] {
    const slots: DeliverySlot[] = []
    let position = 0

    for (let i = 0; i < Math.min(availableSlots, ranked.length); i++) {
      const ranked = ranked[i]
      const creative = ranked.campaign.creatives[0]

      if (!creative) continue

      slots.push({
        position: position++,
        campaign_id: ranked.campaign.id,
        creative,
        duration: creative.duration,
        priority: Math.round(ranked.score),
        reason: ranked.reasons.join(', ')
      })
    }

    return slots
  }
}

/**
 * Revenue calculator for DOOH
 */
export class RevenueCalculator {
  /**
   * Calculate campaign cost
   */
  calculateCost(
    campaign: DOOHCampaign,
    impressions: number,
    model: RevenueModel
  ): number {
    switch (model.type) {
      case 'cpm':
        return (impressions / 1000) * (model.cpm_rate || 10)

      case 'slot':
        const slot = model.slot_pricing?.find(s => s.slot_type === 'standard')
        return (impressions / 60) * (slot?.price || 1)

      case 'performance':
        return this.calculatePerformanceCost(campaign, model)

      case 'hybrid':
        const base = (impressions / 1000) * (model.base_cpm || 5)
        const bonus = this.calculatePerformanceCost(campaign, model) * (model.performance_bonus || 0)
        return base + bonus

      default:
        return impressions * 0.01
    }
  }

  /**
   * Calculate performance-based cost
   */
  private calculatePerformanceCost(campaign: DOOHCampaign, model: RevenueModel): number {
    const metric = model.performance_metric || 'scan'
    let cost = 0

    if (metric === 'scan') {
      cost = campaign.metrics.scans * (model.performance_rate || 0.5)
    } else if (metric === 'visit') {
      cost = campaign.metrics.visits * (model.performance_rate || 2)
    } else if (metric === 'purchase') {
      cost = campaign.metrics.purchases * (model.performance_rate || 20)
    }

    return cost
  }

  /**
   * Calculate screen owner payout
   */
  calculatePayout(
    impressions: number,
    revenue: number,
    share: { screen_owner: number; platform: number }
  ): { owner: number; platform: number } {
    return {
      owner: Math.round(revenue * (share.screen_owner / 100)),
      platform: Math.round(revenue * (share.platform / 100))
    }
  }
}

interface RankedCampaign {
  campaign: DOOHCampaign
  score: number
  reasons: string[]
}

/**
 * Factory function
 */
export function createDeliveryEngine(): DeliveryEngine {
  return new DeliveryEngine()
}
