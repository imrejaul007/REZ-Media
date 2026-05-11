/**
 * Karma Scoring Configuration
 *
 * Single source of truth for karma scoring system
 */

import { KarmaTier, KARMA_TIERS } from '../types';

export const karmaConfig = {
  // Score range
  MIN_SCORE: 300,
  MAX_SCORE: 900,
  BASE_SCORE: 300,

  // Components
  COMPONENTS: {
    IMPACT: {
      MAX: 250,
      SUB_COMPONENTS: {
        VOLUNTEER_HOURS: { min: 0, max: 80 },
        EVENT_DIFFICULTY: { min: 0, max: 50 },
        CATEGORY_DIVERSITY: { min: 0, max: 40 },
        LIFETIME_KARMA: { min: 0, max: 50 },
        COMPLETION_QUALITY: { min: 0, max: 30 },
      },
    },
    RELATIVE_RANK: {
      MAX: 180,
      PERCENTILE_SCORES: {
        50: 30,    // Top 50%
        25: 70,    // Top 25%
        10: 110,   // Top 10%
        5: 140,    // Top 5%
        1: 170,    // Top 1%
        0.1: 180,  // Top 0.1%
      },
    },
    TRUST: {
      MAX: 100,
      FACTORS: {
        APPROVAL_RATE: 'high',
        VERIFICATION_CONFIDENCE: 'high',
        FRAUD_FREE_HISTORY: 'high',
        CONSISTENCY: 'medium',
        CHECK_INTEGRITY: 'medium',
      },
    },
    MOMENTUM: {
      MAX: 70,
      FACTORS: {
        LAST_30_DAY_ACTIVITY: 'high',
        STREAKS: 'high',
        SCORE_TREND: 'medium',
        RECENCY: 'medium',
      },
    },
  },

  // Tiers
  TIERS: KARMA_TIERS,

  // Decay
  DECAY: {
    THIRTY_DAYS: -5,
    SIXTY_DAYS: -10,
    NINETY_DAYS: -20,
  },

  // Stability
  STABILITY: {
    MAX_DAILY_CHANGE: 5,
    EXTREME_MAX: 10,
  },

  // Conversion to coins
  CONVERSION: {
    WEEKLY_KARMA_CAP: 500,
    WEEKLY_COIN_CAP: 300,
    RATES: {
      L1: 0.25, // 25%
      L2: 0.50,  // 50%
      L3: 0.75,  // 75%
      L4: 1.00,  // 100%
    },
  },

  // Rewards multiplier by tier
  REWARD_MULTIPLIERS: {
    L1: 1.0,
    L2: 1.25,
    L3: 1.5,
    L4: 2.0,
  },
};

/**
 * Get tier by score
 */
export function getTierByScore(score: number): KarmaTier {
  for (let i = KARMA_TIERS.length - 1; i >= 0; i--) {
    if (score >= KARMA_TIERS[i].minScore) {
      return KARMA_TIERS[i];
    }
  }
  return KARMA_TIERS[0]; // Starter
}

/**
 * Get tier by level
 */
export function getTierByLevel(level: 'L1' | 'L2' | 'L3' | 'L4'): KarmaTier {
  // Map L1-L4 to score ranges
  const levelToScore: Record<string, number> = {
    L1: 400,  // Mid of Starter
    L2: 575,   // Mid of Active
    L3: 700,   // Mid of Performer
    L4: 850,   // Mid of Elite
  };
  return getTierByScore(levelToScore[level] || 400);
}

/**
 * Get relative rank score by percentile
 */
export function getRelativeRankScore(percentile: number): number {
  const percentileScores = karmaConfig.COMPONENTS.RELATIVE_RANK.PERCENTILE_SCORES;

  if (percentile <= 0.1) return percentileScores[0.1];
  if (percentile <= 1) return percentileScores[1];
  if (percentile <= 5) return percentileScores[5];
  if (percentile <= 10) return percentileScores[10];
  if (percentile <= 25) return percentileScores[25];
  if (percentile <= 50) return percentileScores[50];
  return 0;
}

/**
 * Get karma conversion rate by level
 */
export function getConversionRate(level: 'L1' | 'L2' | 'L3' | 'L4'): number {
  return karmaConfig.CONVERSION.RATES[level] || 0.25;
}

/**
 * Get reward multiplier by level
 */
export function getRewardMultiplier(level: 'L1' | 'L2' | 'L3' | 'L4'): number {
  return karmaConfig.REWARD_MULTIPLIERS[level] || 1.0;
}

export default karmaConfig;
