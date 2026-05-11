/**
 * Cashback Service
 *
 * Service for cashback calculations
 */

import { CoinType } from '../types';

export interface CashbackConfig {
  defaultPercent: number;
  maxCashback: number;
  minBillAmount: number;
  merchantOverrides?: Record<string, {
    percent: number;
    maxCashback?: number;
  }>;
  tierOverrides?: Record<string, {
    percent: number;
    maxCashback?: number;
  }>;
}

export interface CashbackCalculation {
  billAmount: number;
  cashbackPercent: number;
  cashbackAmount: number;
  maxCashback: number;
  coinType: CoinType;
  expiresInDays: number;
  tier?: string;
  merchantId?: string;
}

const DEFAULT_CONFIG: CashbackConfig = {
  defaultPercent: 5,      // 5% default
  maxCashback: 500,      // ₹500 max
  minBillAmount: 200,    // ₹200 minimum
};

/**
 * Calculate cashback for a bill
 */
export function calculateCashback(
  billAmount: number,
  merchantId?: string,
  merchantTier?: string,
  config: CashbackConfig = DEFAULT_CONFIG
): CashbackCalculation {
  // Check minimum bill amount
  if (billAmount < config.minBillAmount) {
    return {
      billAmount,
      cashbackPercent: 0,
      cashbackAmount: 0,
      maxCashback: 0,
      coinType: CoinType.CASHBACK,
      expiresInDays: 365,
      tier: merchantTier,
      merchantId
    };
  }

  // Get cashback percentage
  let cashbackPercent = config.defaultPercent;

  // Apply merchant override
  if (merchantId && config.merchantOverrides?.[merchantId]) {
    cashbackPercent = config.merchantOverrides[merchantId].percent;
  }

  // Apply tier override
  if (merchantTier && config.tierOverrides?.[merchantTier]) {
    cashbackPercent = config.tierOverrides[merchantTier].percent;
  }

  // Calculate raw cashback
  const rawCashback = Math.floor(billAmount * (cashbackPercent / 100));

  // Get max cashback
  let maxCashback = config.maxCashback;

  if (merchantId && config.merchantOverrides?.[merchantId]?.maxCashback) {
    maxCashback = config.merchantOverrides[merchantId].maxCashback!;
  }

  if (merchantTier && config.tierOverrides?.[merchantTier]?.maxCashback) {
    maxCashback = config.tierOverrides[merchantTier].maxCashback!;
  }

  // Apply max cap
  const cashbackAmount = Math.min(rawCashback, maxCashback);

  return {
    billAmount,
    cashbackPercent,
    cashbackAmount,
    maxCashback,
    coinType: CoinType.CASHBACK,
    expiresInDays: 365, // Cashback expires in 1 year
    tier: merchantTier,
    merchantId
  };
}

/**
 * Calculate tier-based cashback (for loyalty tiers)
 */
export function calculateTieredCashback(
  billAmount: number,
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
): CashbackCalculation {
  const tierPercents: Record<string, number> = {
    bronze: 3,
    silver: 5,
    gold: 7,
    platinum: 10
  };

  const tierMaxCashback: Record<string, number> = {
    bronze: 200,
    silver: 300,
    gold: 500,
    platinum: 1000
  };

  const config: CashbackConfig = {
    defaultPercent: tierPercents[tier] || 3,
    maxCashback: tierMaxCashback[tier] || 200,
    minBillAmount: 100
  };

  return calculateCashback(billAmount, undefined, tier, config);
}

/**
 * Get cashback preview (for UI)
 */
export function getCashbackPreview(
  billAmount: number,
  merchantId?: string
): CashbackCalculation {
  return calculateCashback(billAmount, merchantId);
}

/**
 * Validate bill for cashback
 */
export function validateBillForCashback(bill: {
  amount: number;
  date?: Date;
  merchantId?: string;
}): { valid: boolean; error?: string } {
  // Check minimum amount
  if (bill.amount < 100) {
    return { valid: false, error: 'Bill amount must be at least ₹100' };
  }

  // Check bill date not in future
  if (bill.date && bill.date > new Date()) {
    return { valid: false, error: 'Bill date cannot be in the future' };
  }

  // Check bill not too old (1 year)
  if (bill.date) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (bill.date < oneYearAgo) {
      return { valid: false, error: 'Bill is too old (more than 1 year)' };
    }
  }

  return { valid: true };
}

/**
 * Calculate streak bonus (for consecutive bill uploads)
 */
export function calculateStreakBonus(
  baseCashback: number,
  streakDays: number
): { bonus: number; total: number } {
  // Streak bonus: +1% per 5 days of streak (max 5%)
  const streakBonusPercent = Math.min(5, Math.floor(streakDays / 5));
  const bonus = Math.floor(baseCashback * (streakBonusPercent / 100));
  return {
    bonus,
    total: baseCashback + bonus
  };
}

export default {
  calculateCashback,
  calculateTieredCashback,
  getCashbackPreview,
  validateBillForCashback,
  calculateStreakBonus
};
