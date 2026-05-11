/**
 * Coin Service
 *
 * Service for coin-related operations
 */

import { config } from '../config';
import { CoinType, COIN_EXPIRY_RULES } from '../types';

/**
 * Coin limits
 */
export const COIN_LIMITS = {
  DAILY_CAP: config.COINS.DAILY_CAP,
  WEEKLY_CAP: config.COINS.WEEKLY_CAP,
  MIN_REDEMPTION: config.COINS.MIN_REDEMPTION,
  MAX_REDEMPTION: config.COINS.MAX_REDEMPTION,
  TO_RUPEE_RATE: config.COINS.TO_RUPEE_RATE
};

/**
 * Get coin expiry date
 */
export function getCoinExpiryDate(
  coinType: CoinType,
  earnedDate: Date = new Date()
): Date {
  const expiryDays = COIN_EXPIRY_RULES[coinType] || 0;

  if (expiryDays === 0) {
    return new Date('2099-12-31'); // Never expires
  }

  const expiryDate = new Date(earnedDate);
  expiryDate.setDate(expiryDate.getDate() + expiryDays);
  return expiryDate;
}

/**
 * Check if coin is expired
 */
export function isCoinExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

/**
 * Calculate days until expiry
 */
export function getDaysUntilExpiry(expiryDate: Date): number {
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Apply daily coin cap
 */
export function applyDailyCap(
  amount: number,
  dailyUsed: number
): { allowed: number; capped: boolean } {
  const remaining = Math.max(0, COIN_LIMITS.DAILY_CAP - dailyUsed);
  const allowed = Math.min(amount, remaining);

  return {
    allowed,
    capped: amount > allowed
  };
}

/**
 * Apply weekly coin cap
 */
export function applyWeeklyCap(
  amount: number,
  weeklyUsed: number
): { allowed: number; capped: boolean } {
  const remaining = Math.max(0, COIN_LIMITS.WEEKLY_CAP - weeklyUsed);
  const allowed = Math.min(amount, remaining);

  return {
    allowed,
    capped: amount > allowed
  };
}

/**
 * Validate redemption amount
 */
export function validateRedemptionAmount(amount: number): {
  valid: boolean;
  error?: string;
} {
  if (amount < COIN_LIMITS.MIN_REDEMPTION) {
    return {
      valid: false,
      error: `Minimum redemption is ${COIN_LIMITS.MIN_REDEMPTION} coins`
    };
  }

  if (amount > COIN_LIMITS.MAX_REDEMPTION) {
    return {
      valid: false,
      error: `Maximum redemption is ${COIN_LIMITS.MAX_REDEMPTION} coins`
    };
  }

  return { valid: true };
}

/**
 * Convert coins to rupees
 */
export function coinsToRupees(coins: number): number {
  return coins * COIN_LIMITS.TO_RUPEE_RATE;
}

/**
 * Convert rupees to coins
 */
export function rupeesToCoins(rupees: number): number {
  return Math.floor(rupees / COIN_LIMITS.TO_RUPEE_RATE);
}

/**
 * Get coin type info
 */
export function getCoinTypeInfo(coinType: CoinType): {
  name: string;
  description: string;
  expiryDays: number;
  expires: boolean;
} {
  const names: Record<CoinType, string> = {
    [CoinType.REZ]: 'REZ Coins',
    [CoinType.BRANDED]: 'Branded Coins',
    [CoinType.CASHBACK]: 'Cashback',
    [CoinType.PROMO]: 'Promo Coins',
    [CoinType.PRIVE]: 'Prive Coins',
    [CoinType.REFERRAL]: 'Referral Bonus'
  };

  const descriptions: Record<CoinType, string> = {
    [CoinType.REZ]: 'Universal coins - earn from all activities',
    [CoinType.BRANDED]: 'Merchant-specific coins',
    [CoinType.CASHBACK]: 'Earned from bill uploads',
    [CoinType.PROMO]: 'Promotional bonus coins',
    [CoinType.PRIVE]: 'Premium tier coins',
    [CoinType.REFERRAL]: 'Earned from referrals'
  };

  const expiryDays = COIN_EXPIRY_RULES[coinType] || 0;

  return {
    name: names[coinType],
    description: descriptions[coinType],
    expiryDays,
    expires: expiryDays > 0
  };
}

export default {
  COIN_LIMITS,
  getCoinExpiryDate,
  isCoinExpired,
  getDaysUntilExpiry,
  applyDailyCap,
  applyWeeklyCap,
  validateRedemptionAmount,
  coinsToRupees,
  rupeesToCoins,
  getCoinTypeInfo
};
