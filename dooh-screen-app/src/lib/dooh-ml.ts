/**
 * DOOH ML Optimization
 * Predicts best ads for each screen
 */

import type { AdSlot, ScreenContext } from './types'

interface Prediction {
  campaign_id: string
  score: number
  reason: string
}

/**
 * Simple ML model for ad selection
 * In production, use TensorFlow.js or server-side ML
 */
export class AdOptimizer {
  private weights = {
    time_match: 0.3,
    audience_match: 0.25,
    budget_remaining: 0.2,
    historical_ctr: 0.15,
    freshness: 0.1,
  }

  /**
   * Predict best ads for a screen
   */
  predict(candidates: any[], context: ScreenContext): Prediction[] {
    const scores = candidates.map(campaign => {
      let score = 0
      const reasons: string[] = []

      // Time match (0-1)
      const timeScore = this.calculateTimeScore(campaign, context)
      score += timeScore * this.weights.time_match
      if (timeScore > 0.8) reasons.push('Perfect time match')

      // Audience match (0-1)
      const audienceScore = this.calculateAudienceScore(campaign, context)
      score += audienceScore * this.weights.audience_match
      if (audienceScore > 0.7) reasons.push('Strong audience fit')

      // Budget remaining (0-1)
      const budgetScore = campaign.spent / campaign.budget
      score += (1 - budgetScore) * this.weights.budget_remaining
      if (budgetScore > 0.9) reasons.push('Budget nearly spent')

      // Historical CTR (0-1)
      const ctrScore = campaign.ctr || 0.05
      score += ctrScore * this.weights.historical_ctr
      if (ctrScore > 0.1) reasons.push('High-performing ad')

      // Freshness (0-1)
      const freshScore = this.calculateFreshness(campaign)
      score += freshScore * this.weights.freshness
      if (freshScore > 0.8) reasons.push('Recently created')

      return {
        campaign_id: campaign.id,
        score,
        reason: reasons.join(', ') || 'Default selection',
      }
    })

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  private calculateTimeScore(campaign: any, context: ScreenContext): number {
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    // Morning (6-12)
    if (hour >= 6 && hour < 12) {
      if (campaign.targeting?.day_parts?.morning) return 1.0
      return 0.6
    }

    // Afternoon (12-17)
    if (hour >= 12 && hour < 17) {
      if (campaign.targeting?.day_parts?.afternoon) return 1.0
      return 0.6
    }

    // Evening (17-22)
    if (hour >= 17 && hour < 22) {
      if (campaign.targeting?.day_parts?.evening) return 1.0
      return 0.7
    }

    return 0.4
  }

  private calculateAudienceScore(campaign: any, context: ScreenContext): number {
    if (!context.audience) return 0.5

    const targetSegments = new Set(campaign.targeting?.audience || [])
    const screenSegments = context.audience

    if (targetSegments.size === 0) return 0.5

    let matches = 0
    for (const seg of screenSegments) {
      if (targetSegments.has(seg)) matches++
    }

    return matches / targetSegments.size
  }

  private calculateFreshness(campaign: any): number {
    const created = new Date(campaign.created_at).getTime()
    const age = Date.now() - created
    const dayAge = age / (1000 * 60 * 60 * 24)

    // Freshness decays over 30 days
    return Math.max(0, 1 - dayAge / 30)
  }

  /**
   * Learn from feedback
   */
  async learn(signal: {
    campaign_id: string
    action: 'impression' | 'scan' | 'visit' | 'purchase'
    context: ScreenContext
  }) {
    // In production:
    // 1. Store signal in database
    // 2. Periodically retrain model
    // 3. Update weights based on conversion data

    console.log('[ML] Learning:', signal)
  }

  /**
   * A/B test winner
   */
  selectWinner(variants: any[]): any {
    if (variants.length === 0) return null
    if (variants.length === 1) return variants[0]

    // Thompson sampling (simple Bayesian)
    const scores = variants.map(v => ({
      variant: v,
      score: v.ctr || 0.05 + Math.random() * 0.1,
    }))

    scores.sort((a, b) => b.score - a.score)
    return scores[0].variant
  }
}

export const adOptimizer = new AdOptimizer()
