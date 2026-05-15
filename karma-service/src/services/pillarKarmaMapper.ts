/**
 * Pillar-Karma Mapper Service
 *
 * Maps Prive 6-Pillar scores to Karma system signals.
 * This creates a unified scoring system across both loyalty programs.
 *
 * Pillar Weights → Karma Factors:
 * - Engagement (25%) → Activity frequency, consistency
 * - Trust (20%) → Verification level, reliability
 * - Influence (20%) → Social shares, referrals
 * - Economic (15%) → Spending, order value
 * - Brand Affinity (10%) → Brand interactions, loyalty
 * - Network (10%) → Community participation, referrals
 *
 * Connection: Prive 6-Pillar → Karma Service
 */

import { Types } from 'mongoose';

// Pillar IDs
export type PillarId = 'engagement' | 'trust' | 'influence' | 'economic' | 'brand_affinity' | 'network';

// Pillar weights (sum to 1.0)
export const PILLAR_WEIGHTS: Record<PillarId, number> = {
  engagement: 0.25,
  trust: 0.20,
  influence: 0.20,
  economic: 0.15,
  brand_affinity: 0.10,
  network: 0.10,
};

// Pillar to Karma signal mapping
export const PILLAR_TO_KARMA_MAP: Record<PillarId, {
  karmaFactor: string;
  weight: number;
  description: string;
}> = {
  engagement: {
    karmaFactor: 'activity_frequency',
    weight: 0.25,
    description: 'How actively user participates',
  },
  trust: {
    karmaFactor: 'verification_level',
    weight: 0.20,
    description: 'User verification and reliability',
  },
  influence: {
    karmaFactor: 'social_shares',
    weight: 0.20,
    description: 'Social engagement and content sharing',
  },
  economic: {
    karmaFactor: 'spending_power',
    weight: 0.15,
    description: 'Purchase value and frequency',
  },
  brand_affinity: {
    karmaFactor: 'brand_loyalty',
    weight: 0.10,
    description: 'Brand interactions and repeat purchases',
  },
  network: {
    karmaFactor: 'community_participation',
    weight: 0.10,
    description: 'Referrals and community events',
  },
};

// Karma level thresholds
export const KARMA_LEVEL_THRESHOLDS = {
  L1: { min: 0, max: 999, conversionRate: 0.25 },
  L2: { min: 1000, max: 2999, conversionRate: 0.50 },
  L3: { min: 3000, max: 5999, conversionRate: 0.75 },
  L4: { min: 6000, max: Infinity, conversionRate: 1.00 },
};

// Prive tier thresholds
export const PRIVE_TIER_THRESHOLDS = {
  none: { min: 0, max: 49 },
  entry: { min: 50, max: 69 },
  signature: { min: 70, max: 84 },
  elite: { min: 85, max: 100 },
};

export interface PillarScore {
  id: PillarId;
  name: string;
  score: number;      // 0-100
  weight: number;      // 0-1
  weightedScore: number; // score * weight
}

export interface UnifiedScoreResult {
  totalScore: number;
  priveTier: 'none' | 'entry' | 'signature' | 'elite';
  karmaLevel: 'L1' | 'L2' | 'L3' | 'L4';
  karmaMultiplier: number;
  priveMultiplier: number;
  combinedMultiplier: number;
  pillarBreakdown: PillarScore[];
  karmaSignals: Record<string, number>;
}

/**
 * Calculate unified score from 6-Pillar scores
 */
export function calculateUnifiedScore(pillars: Array<{
  id: PillarId;
  name: string;
  score: number;
}>): UnifiedScoreResult {
  // Calculate weighted pillar scores
  const pillarBreakdown: PillarScore[] = pillars.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    weight: PILLAR_WEIGHTS[p.id],
    weightedScore: p.score * PILLAR_WEIGHTS[p.id],
  }));

  // Total score is sum of weighted scores
  const totalScore = pillarBreakdown.reduce((sum, p) => sum + p.weightedScore, 0);

  // Determine Prive tier
  let priveTier: 'none' | 'entry' | 'signature' | 'elite' = 'none';
  if (totalScore >= PRIVE_TIER_THRESHOLDS.elite.min) priveTier = 'elite';
  else if (totalScore >= PRIVE_TIER_THRESHOLDS.signature.min) priveTier = 'signature';
  else if (totalScore >= PRIVE_TIER_THRESHOLDS.entry.min) priveTier = 'entry';

  // Determine Karma level
  let karmaLevel: 'L1' | 'L2' | 'L3' | 'L4' = 'L1';
  let karmaMultiplier = 0.25;
  if (totalScore >= KARMA_LEVEL_THRESHOLDS.L4.min) {
    karmaLevel = 'L4';
    karmaMultiplier = KARMA_LEVEL_THRESHOLDS.L4.conversionRate;
  } else if (totalScore >= KARMA_LEVEL_THRESHOLDS.L3.min) {
    karmaLevel = 'L3';
    karmaMultiplier = KARMA_LEVEL_THRESHOLDS.L3.conversionRate;
  } else if (totalScore >= KARMA_LEVEL_THRESHOLDS.L2.min) {
    karmaLevel = 'L2';
    karmaMultiplier = KARMA_LEVEL_THRESHOLDS.L2.conversionRate;
  }

  // Prive multiplier based on tier
  const priveMultiplierMap: Record<string, number> = {
    none: 1.0,
    entry: 1.1,
    signature: 1.25,
    elite: 1.5,
  };
  const priveMultiplier = priveMultiplierMap[priveTier];

  // Combined multiplier (both systems apply)
  const combinedMultiplier = karmaMultiplier * priveMultiplier;

  // Generate karma signals from pillar scores
  const karmaSignals: Record<string, number> = {};
  for (const [pillarId, mapping] of Object.entries(PILLAR_TO_KARMA_MAP)) {
    const pillar = pillarBreakdown.find((p) => p.id === pillarId);
    if (pillar) {
      karmaSignals[mapping.karmaFactor] = Math.round(pillar.score * mapping.weight);
    }
  }

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    priveTier,
    karmaLevel,
    karmaMultiplier,
    priveMultiplier,
    combinedMultiplier: Math.round(combinedMultiplier * 100) / 100,
    pillarBreakdown,
    karmaSignals,
  };
}

/**
 * Map pillar signal to karma points
 */
export function pillarToKarmaPoints(
  pillarId: PillarId,
  pillarScore: number,
  basePoints: number
): number {
  const mapping = PILLAR_TO_KARMA_MAP[pillarId];
  // Points = base points * (pillar score / 100) * mapping weight
  return Math.round(basePoints * (pillarScore / 100) * mapping.weight);
}

/**
 * Calculate karma score from pillar engagement metrics
 */
export function calculateKarmaFromPillars(engagementMetrics: {
  transactions30d: number;
  activeDays30d: number;
  categoriesUsed: number;
  referrals: number;
  reviews: number;
  shares: number;
  purchases: number;
}): number {
  // Engagement contributes most to karma
  const engagementScore = Math.min(engagementMetrics.transactions30d / 20 * 40, 40) +
    Math.min(engagementMetrics.activeDays30d / 20 * 25, 25) +
    Math.min(engagementMetrics.categoriesUsed * 5, 15);

  // Network contributions
  const networkScore = Math.min(engagementMetrics.referrals * 10, 40) +
    engagementMetrics.reviews * 5;

  // Social contributions
  const socialScore = Math.min(engagementMetrics.shares * 10, 20) +
    Math.min(engagementMetrics.purchases * 5, 20);

  // Total karma contribution from pillars
  return Math.round(engagementScore + networkScore + socialScore);
}

/**
 * Get unified tier benefits
 */
export function getUnifiedBenefits(tier: 'none' | 'entry' | 'signature' | 'elite'): {
  karmaConversion: number;
  priveMultiplier: number;
  benefits: string[];
} {
  const benefitsMap: Record<string, { karmaConversion: number; priveMultiplier: number; benefits: string[] }> = {
    none: {
      karmaConversion: 0.25,
      priveMultiplier: 1.0,
      benefits: ['Basic rewards', 'Standard conversion'],
    },
    entry: {
      karmaConversion: 0.50,
      priveMultiplier: 1.1,
      benefits: ['Enhanced rewards', '10% bonus coins', 'Priority support'],
    },
    signature: {
      karmaConversion: 0.75,
      priveMultiplier: 1.25,
      benefits: ['Premium rewards', '25% bonus coins', 'Priority support', 'Exclusive offers'],
    },
    elite: {
      karmaConversion: 1.00,
      priveMultiplier: 1.5,
      benefits: ['Maximum rewards', '50% bonus coins', 'VIP support', 'Exclusive access', 'Concierge'],
    },
  };

  return benefitsMap[tier];
}

/**
 * Check if user qualifies for tier upgrade
 */
export function checkTierUpgrade(
  currentTier: string,
  pillarScores: Array<{ id: PillarId; score: number }>
): {
  eligible: boolean;
  newTier?: 'entry' | 'signature' | 'elite';
  requirements?: string[];
} {
  const result = calculateUnifiedScore(pillarScores);

  // Already at max tier
  if (currentTier === 'elite' && result.priveTier === 'elite') {
    return { eligible: false };
  }

  // Check for tier upgrade
  const tierOrder = ['none', 'entry', 'signature', 'elite'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const newIndex = tierOrder.indexOf(result.priveTier);

  if (newIndex > currentIndex) {
    const newTier = result.priveTier as 'entry' | 'signature' | 'elite';
    const requirements: string[] = [];

    // Calculate requirements for next tier
    const nextTierIndex = currentIndex + 1;
    if (nextTierIndex < tierOrder.length) {
      const nextTier = tierOrder[nextTierIndex] as 'entry' | 'signature' | 'elite';
      const threshold = PRIVE_TIER_THRESHOLDS[nextTier].min;
      const pointsNeeded = Math.max(0, threshold - result.totalScore);
      requirements.push(`Need ${pointsNeeded.toFixed(1)} more points for ${nextTier} tier`);
    }

    return {
      eligible: true,
      newTier,
      requirements,
    };
  }

  return { eligible: false };
}

export default {
  calculateUnifiedScore,
  pillarToKarmaPoints,
  calculateKarmaFromPillars,
  getUnifiedBenefits,
  checkTierUpgrade,
  PILLAR_WEIGHTS,
  PILLAR_TO_KARMA_MAP,
  KARMA_LEVEL_THRESHOLDS,
  PRIVE_TIER_THRESHOLDS,
};
