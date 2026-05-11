/**
 * Karma Service
 *
 * Service for karma-related operations
 */

import { config } from '../config';
import {
  KarmaScoringInput,
  KarmaScore,
  CoinType
} from '../types';
import {
  calculateKarmaScore,
  calculateImpactScore,
  calculateTrustScore,
  calculateMomentumScore,
  getTierDisplay
} from '../engines/karmaEngine';
import {
  karmaConfig,
  getConversionRate,
  getRewardMultiplier
} from '../config/karmaConfig';

/**
 * Get karma score for a user
 */
export async function getKarmaScore(userId: string): Promise<KarmaScore | null> {
  // This would typically fetch from database
  // For now, return a placeholder
  return null;
}

/**
 * Calculate karma earned for an action
 */
export function calculateKarmaEarned(
  baseKarma: number,
  userTier: 'L1' | 'L2' | 'L3' | 'L4'
): number {
  const multiplier = getRewardMultiplier(userTier);
  return Math.round(baseKarma * multiplier);
}

/**
 * Get conversion rate for karma to coins
 */
export function getKarmaConversionRate(level: 'L1' | 'L2' | 'L3' | 'L4'): number {
  return getConversionRate(level);
}

/**
 * Convert karma to coins (for batch job)
 */
export function convertKarmaToCoins(
  karmaAmount: number,
  level: 'L1' | 'L2' | 'L3' | 'L4'
): { karmaUsed: number; coinsEarned: number } {
  const rate = getConversionRate(level);
  const coinsEarned = Math.floor(karmaAmount * rate);

  return {
    karmaUsed: karmaAmount,
    coinsEarned
  };
}

/**
 * Apply weekly karma cap
 */
export function applyWeeklyKarmaCap(
  earnedKarma: number,
  weeklyUsed: number
): { allowed: number; capped: boolean } {
  const weeklyCap = karmaConfig.CONVERSION.WEEKLY_KARMA_CAP;
  const remaining = Math.max(0, weeklyCap - weeklyUsed);
  const allowed = Math.min(earnedKarma, remaining);

  return {
    allowed,
    capped: earnedKarma > allowed
  };
}

/**
 * Get reward multiplier for karma tier
 */
export function getRewardBonus(tier: 'L1' | 'L2' | 'L3' | 'L4'): number {
  return getRewardMultiplier(tier);
}

/**
 * Calculate karma score from user data
 */
export function calculateUserKarmaScore(
  userId: string,
  input: KarmaScoringInput,
  previousScore?: number
): KarmaScore {
  const score = calculateKarmaScore(input, previousScore);
  score.userId = userId;
  return score;
}

/**
 * Get tier info for display
 */
export function getTierInfo(score: number) {
  return getTierDisplay(score);
}

/**
 * Determine karma level from score
 */
export function getLevelFromScore(score: number): 'L1' | 'L2' | 'L3' | 'L4' {
  if (score >= 750) return 'L4'; // Top tiers
  if (score >= 650) return 'L3';
  if (score >= 550) return 'L2';
  return 'L1';
}

export default {
  getKarmaScore,
  calculateKarmaEarned,
  getKarmaConversionRate,
  convertKarmaToCoins,
  applyWeeklyKarmaCap,
  getRewardBonus,
  calculateUserKarmaScore,
  getTierInfo,
  getLevelFromScore
};
