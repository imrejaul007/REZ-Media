/**
 * DOOH - Playlist Generation Service
 * Creates optimized playlists for screens
 */

import {
  Playlist,
  PlaylistSlot,
  PlaylistRequest,
  Screen,
  DOOHCampaign,
  Creative,
  TimeSlot,
  AudienceProfile,
  AudienceSegment
} from '../types'

/**
 * Playlist Generator - Creates optimized ad playlists for screens
 */
export class PlaylistGenerator {
  private minSlotDuration: number = 10 // seconds
  private maxRepeatGap: number = 2 // Don't repeat same ad more than twice in this many slots

  /**
   * Generate playlist for a screen
   */
  generatePlaylist(
    request: PlaylistRequest,
    screen: Screen,
    activeCampaigns: DOOHCampaign[]
  ): Playlist {
    // Step 1: Filter eligible campaigns
    const eligible = this.filterCampaigns(activeCampaigns, screen, request)

    // Step 2: Score campaigns for this context
    const scored = this.scoreCampaigns(eligible, request, screen)

    // Step 3: Build playlist slots
    const slots = this.buildSlots(scored, request)

    // Step 4: Optimize playlist
    const optimized = this.optimizePlaylist(slots)

    // Step 5: Calculate metrics
    const totalDuration = optimized.reduce((sum, slot) => sum + slot.duration, 0)

    return {
      id: `pl_${screen.id}_${Date.now()}`,
      screen_id: request.screen_id,
      date: request.date,
      slots: optimized,
      total_duration: totalDuration,
      generated_at: new Date(),
      version: 1
    }
  }

  /**
   * Filter campaigns eligible for this screen
   */
  private filterCampaigns(
    campaigns: DOOHCampaign[],
    screen: Screen,
    request: PlaylistRequest
  ): DOOHCampaign[] {
    return campaigns.filter(campaign => {
      // Active status
      if (campaign.status !== 'active') return false

      // Date range
      const now = new Date()
      if (now < campaign.start_date || now > campaign.end_date) return false

      // Budget remaining
      if (campaign.spent >= campaign.budget) return false

      // Location match
      if (campaign.targeting.cities?.length) {
        if (!campaign.targeting.cities.includes(screen.location.city)) {
          return false
        }
      }

      // Screen type match
      if (campaign.targeting.screen_types?.length) {
        if (!campaign.targeting.screen_types.includes(screen.type)) {
          return false
        }
      }

      // Audience match
      if (campaign.targeting.audience_segments?.length) {
        const screenSegments = screen.audience_profile?.primary.map(s => s.type) || []
        const hasMatch = campaign.targeting.audience_segments.some(
          seg => screenSegments.includes(seg)
        )
        if (!hasMatch && screenSegments.length > 0) return false
      }

      return true
    })
  }

  /**
   * Score campaigns for this context
   */
  private scoreCampaigns(
    campaigns: DOOHCampaign[],
    request: PlaylistRequest,
    screen: Screen
  ): ScoredCampaign[] {
    return campaigns.map(campaign => {
      let score = 100

      // Audience relevance
      if (campaign.targeting.audience_segments?.length && screen.audience_profile) {
        const audienceScore = this.calculateAudienceScore(
          campaign.targeting.audience_segments,
          screen.audience_profile
        )
        score *= audienceScore
      }

      // Time targeting bonus
      const currentHour = new Date().getHours()
      if (campaign.targeting.day_parts) {
        const timeScore = this.calculateTimeScore(campaign.targeting.day_parts, currentHour)
        score *= timeScore
      }

      // Budget urgency
      const budgetRatio = campaign.spent / campaign.budget
      if (budgetRatio > 0.8) score *= 1.5 // Urgent to spend remaining
      if (budgetRatio < 0.3) score *= 0.8 // Lower priority

      // Context signals bonus
      if (request.context_signals?.length) {
        const signalScore = this.calculateSignalScore(campaign, request.context_signals)
        score *= signalScore
      }

      return {
        campaign,
        score,
        creative: campaign.creatives[0]
      }
    }).sort((a, b) => b.score - a.score)
  }

  /**
   * Calculate audience relevance score
   */
  private calculateAudienceScore(
    targetSegments: AudienceSegment['type'][],
    screenProfile: AudienceProfile
  ): number {
    const screenSegments = screenProfile.primary

    let totalWeight = 0
    let matchedWeight = 0

    for (const segment of screenSegments) {
      totalWeight += segment.percentage
      if (targetSegments.includes(segment.type)) {
        matchedWeight += segment.percentage
      }
    }

    return totalWeight > 0 ? matchedWeight / totalWeight : 0.5
  }

  /**
   * Calculate time-based score
   */
  private calculateTimeScore(
    dayParts: { morning?: boolean; afternoon?: boolean; evening?: boolean },
    hour: number
  ): number {
    if (hour >= 6 && hour < 12 && dayParts.morning) return 1.5
    if (hour >= 12 && hour < 17 && dayParts.afternoon) return 1.5
    if (hour >= 17 && hour < 22 && dayParts.evening) return 1.5

    if (hour >= 6 && hour < 12 && dayParts.afternoon) return 0.8
    if (hour >= 12 && hour < 17 && dayParts.evening) return 0.8

    return 1.0
  }

  /**
   * Calculate context signal boost
   */
  private calculateSignalScore(
    campaign: DOOHCampaign,
    signals: { signal_type: string; condition: string; campaign_id?: string }[]
  ): number {
    let boost = 1.0

    for (const signal of signals) {
      // Boost if campaign matches signal
      if (signal.campaign_id === campaign.id) {
        boost *= 1.3
      }

      // Boost based on category
      // (would integrate with ReZ Mind for real context)
    }

    return boost
  }

  /**
   * Build playlist slots
   */
  private buildSlots(
    scored: ScoredCampaign[],
    request: PlaylistRequest
  ): PlaylistSlot[] {
    const slots: PlaylistSlot[] = []
    let position = 0
    let remainingDuration = request.duration
    let lastCampaignIds: string[] = []

    while (remainingDuration > 0 && scored.length > 0) {
      // Pick campaign (weighted by score)
      const campaign = this.pickCampaign(scored, lastCampaignIds)

      if (!campaign) break

      // Pick creative
      const creative = campaign.campaign.creatives[0]
      if (!creative) continue

      // Add slot
      const duration = Math.min(creative.duration, remainingDuration)
      slots.push({
        position: position++,
        campaign_id: campaign.campaign.id,
        creative_id: creative.id,
        start_time: this.calculateStartTime(request.time_slots, position),
        duration,
        scheduled_impressions: this.estimateImpressions(duration, campaign)
      })

      remainingDuration -= duration

      // Track for diversity
      lastCampaignIds.push(campaign.campaign.id)
      if (lastCampaignIds.length > this.maxRepeatGap) {
        lastCampaignIds.shift()
      }
    }

    return slots
  }

  /**
   * Pick campaign weighted by score
   */
  private pickCampaign(
    scored: ScoredCampaign[],
    excludeRecent: string[]
  ): ScoredCampaign | null {
    for (const item of scored) {
      if (!excludeRecent.includes(item.campaign.id)) {
        return item
      }
    }
    return scored[0] || null
  }

  /**
   * Optimize playlist for engagement
   */
  private optimizePlaylist(slots: PlaylistSlot[]): PlaylistSlot[] {
    // Ensure variety: mix video and image
    // Rotate between categories
    // Prioritize brand safety

    return slots
  }

  /**
   * Calculate start time for slot
   */
  private calculateStartTime(timeSlots: TimeSlot[], position: number): string {
    // Simplified: just return time based on position
    const baseHour = 9 + Math.floor(position / 10)
    const minutes = (position % 10) * 6
    return `${baseHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }

  /**
   * Estimate impressions for a slot
   */
  private estimateImpressions(
    duration: number,
    scored: ScoredCampaign
  ): number {
    // Simplified estimation
    const baseRate = 100 // impressions per minute
    const durationMinutes = duration / 60
    const audienceMultiplier = scored.score / 100
    return Math.round(baseRate * durationMinutes * audienceMultiplier)
  }
}

interface ScoredCampaign {
  campaign: DOOHCampaign
  score: number
  creative: Creative
}

/**
 * Factory function
 */
export function createPlaylistGenerator(): PlaylistGenerator {
  return new PlaylistGenerator()
}
