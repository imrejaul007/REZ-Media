/**
 * Karma Scoring Engine
 *
 * Implements the 300-900 karma scoring system
 */

import { config } from '../config';
import {
  KarmaComponents,
  KarmaTier,
  KARMA_TIERS,
  KarmaScore
} from '../types';
import {
  karmaConfig,
  getTierByScore,
  getRelativeRankScore
} from '../config/karmaConfig';

export interface KarmaScoringInput {
  // Impact components
  volunteerHours: number;
  eventDifficulty: number;
  categoryDiversity: number;
  lifetimeKarma: number;
  completionQuality: number;

  // Trust components
  approvalRate: number;
  verificationConfidence: number;
  fraudFreeDays: number;
  consistencyScore: number;
  checkInIntegrity: number;

  // Momentum components
  last30DayActivity: number;
  currentStreak: number;
  scoreTrend: number; // positive = improving, negative = declining
  lastActivityDays: number;

  // Relative rank
  percentile: number;
}

/**
 * Calculate Impact Score (0-250)
 */
export function calculateImpactScore(input: KarmaScoringInput): number {
  const { IMPACT_MAX, SUB_COMPONENTS } = karmaConfig.COMPONENTS;

  // Volunteer hours (0-80)
  const volunteerScore = Math.min(
    SUB_COMPONENTS.VOLUNTEER_HOURS.max,
    (input.volunteerHours / 100) * SUB_COMPONENTS.VOLUNTEER_HOURS.max // 100 hours = max
  );

  // Event difficulty (0-50)
  const difficultyScore = Math.min(
    SUB_COMPONENTS.EVENT_DIFFICULTY.max,
    input.eventDifficulty * SUB_COMPONENTS.EVENT_DIFFICULTY.max
  );

  // Category diversity (0-40) - based on number of categories
  const diversityScore = Math.min(
    SUB_COMPONENTS.CATEGORY_DIVERSITY.max,
    input.categoryDiversity * SUB_COMPONENTS.CATEGORY_DIVERSITY.max / 10 // 10 categories = max
  );

  // Lifetime karma (0-50)
  const lifetimeScore = Math.min(
    SUB_COMPONENTS.LIFETIME_KARMA.max,
    Math.log10(1 + input.lifetimeKarma / 100) * SUB_COMPONENTS.LIFETIME_KARMA.max / 3
  );

  // Completion quality (0-30)
  const qualityScore = Math.min(
    SUB_COMPONENTS.COMPLETION_QUALITY.max,
    input.completionQuality * SUB_COMPONENTS.COMPLETION_QUALITY.max
  );

  const total = volunteerScore + difficultyScore + diversityScore + lifetimeScore + qualityScore;
  return Math.min(IMPACT_MAX, Math.max(0, Math.round(total)));
}

/**
 * Calculate Trust Score (0-100)
 */
export function calculateTrustScore(input: KarmaScoringInput): number {
  const { TRUST_MAX, FACTORS } = karmaConfig.COMPONENTS.TRUST;

  // Approval rate weight: 35%
  const approvalWeight = 0.35;
  const approvalScore = input.approvalRate * 100 * approvalWeight;

  // Verification confidence weight: 25%
  const verificationWeight = 0.25;
  const verificationScore = input.verificationConfidence * 100 * verificationWeight;

  // Fraud-free days weight: 20%
  const fraudFreeWeight = 0.20;
  const maxFraudFreeDays = 365;
  const fraudFreeScore = Math.min(1, input.fraudFreeDays / maxFraudFreeDays) * 100 * fraudFreeWeight;

  // Consistency weight: 10%
  const consistencyWeight = 0.10;
  const consistencyScore = input.consistencyScore * 100 * consistencyWeight;

  // Check-in integrity weight: 10%
  const integrityWeight = 0.10;
  const integrityScore = input.checkInIntegrity * 100 * integrityWeight;

  const total = approvalScore + verificationScore + fraudFreeScore + consistencyScore + integrityScore;
  return Math.min(TRUST_MAX, Math.max(0, Math.round(total)));
}

/**
 * Calculate Momentum Score (0-70)
 */
export function calculateMomentumScore(input: KarmaScoringInput): number {
  const { MOMENTUM_MAX, FACTORS } = karmaConfig.COMPONENTS.MOMENTUM;

  // Last 30 day activity (40% weight) - max 28 points
  const activityWeight = 0.40;
  const max30DayActivity = 30; // 1 activity per day
  const activityScore = Math.min(1, input.last30DayActivity / max30DayActivity) * MOMENTUM_MAX * activityWeight;

  // Streak (30% weight) - max 21 points
  const streakWeight = 0.30;
  const maxStreak = 30; // 30 day streak = max
  const streakScore = Math.min(1, input.currentStreak / maxStreak) * MOMENTUM_MAX * streakWeight;

  // Score trend (20% weight) - max 14 points
  const trendWeight = 0.20;
  // Normalize trend to 0-1 range (assuming max trend is ±50)
  const normalizedTrend = Math.max(-1, Math.min(1, input.scoreTrend / 50));
  const trendScore = ((normalizedTrend + 1) / 2) * MOMENTUM_MAX * trendWeight;

  // Recency (10% weight) - max 7 points
  const recencyWeight = 0.10;
  // More recent = higher score, 0 days = max, 30+ days = 0
  const recencyScore = Math.max(0, 1 - input.lastActivityDays / 30) * MOMENTUM_MAX * recencyWeight;

  const total = activityScore + streakScore + trendScore + recencyScore;
  return Math.min(MOMENTUM_MAX, Math.max(0, Math.round(total)));
}

/**
 * Calculate Relative Rank Score (0-180)
 */
export function calculateRelativeRankScore(percentile: number): number {
  return getRelativeRankScore(percentile);
}

/**
 * Calculate total karma score with stability rules
 */
export function calculateKarmaScore(
  input: KarmaScoringInput,
  previousScore?: number
): KarmaScore {
  const { BASE_SCORE, STABILITY } = karmaConfig;

  // Calculate components
  const impact = calculateImpactScore(input);
  const trust = calculateTrustScore(input);
  const relativeRank = calculateRelativeRankScore(input.percentile);
  const momentum = calculateMomentumScore(input);

  // Calculate raw total
  const rawTotal = BASE_SCORE + impact + relativeRank + trust + momentum;

  // Apply stability rules
  let total = rawTotal;
  if (previousScore !== undefined) {
    const change = total - previousScore;

    if (Math.abs(change) > STABILITY.EXTREME_MAX) {
      // Extreme case: cap at ±10
      total = previousScore + Math.sign(change) * STABILITY.EXTREME_MAX;
    } else if (Math.abs(change) > STABILITY.MAX_DAILY_CHANGE) {
      // Normal case: cap at ±5
      total = previousScore + Math.sign(change) * STABILITY.MAX_DAILY_CHANGE;
    }
  }

  // Clamp to min/max
  total = Math.min(karmaConfig.MAX_SCORE, Math.max(karmaConfig.MIN_SCORE, Math.round(total)));

  // Get tier
  const tier = getTierByScore(total);

  // Determine trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let dailyChange = 0;
  if (previousScore !== undefined) {
    dailyChange = total - previousScore;
    if (dailyChange > 0) trend = 'up';
    else if (dailyChange < 0) trend = 'down';
  }

  return {
    userId: '', // Will be set by caller
    total,
    components: {
      base: BASE_SCORE,
      impact,
      relativeRank,
      trust,
      momentum
    },
    tier,
    percentile: input.percentile,
    dailyChange,
    trend,
    lastUpdated: new Date()
  };
}

/**
 * Apply score decay for inactivity
 */
export function applyKarmaDecay(
  currentScore: KarmaScore,
  daysInactive: number
): KarmaComponents {
  const { DECAY } = karmaConfig;
  const components = { ...currentScore.components };

  if (daysInactive >= 90) {
    components.momentum = Math.max(0, components.momentum + DECAY[90]);
    // Also slightly reduce trust
    components.trust = Math.max(0, components.trust - 5);
  } else if (daysInactive >= 60) {
    components.momentum = Math.max(0, components.momentum + DECAY[60]);
    components.trust = Math.max(0, components.trust - 2);
  } else if (daysInactive >= 30) {
    components.momentum = Math.max(0, components.momentum + DECAY[30]);
  }

  return components;
}

/**
 * Get tier display info
 */
export function getTierDisplay(score: number): {
  name: string;
  color: string;
  nextTier: KarmaTier | null;
  pointsToNext: number;
} {
  const tier = getTierByScore(score);
  const tierIndex = KARMA_TIERS.findIndex(t => t.name === tier.name);
  const nextTier = tierIndex < KARMA_TIERS.length - 1 ? KARMA_TIERS[tierIndex + 1] : null;
  const pointsToNext = nextTier ? nextTier.minScore - score : 0;

  return {
    name: tier.name,
    color: tier.color,
    nextTier,
    pointsToNext
  };
}

export default {
  calculateImpactScore,
  calculateTrustScore,
  calculateMomentumScore,
  calculateRelativeRankScore,
  calculateKarmaScore,
  applyKarmaDecay,
  getTierDisplay
};
