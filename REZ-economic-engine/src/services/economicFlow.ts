/**
 * Economic Flow Service
 *
 * Tracks all coin economics and attribution
 */

import { CoinType } from '../types';

export interface EconomicFlow {
  coinType: CoinType;
  amount: number;
  fundedBy: {
    type: 'merchant' | 'platform' | 'brand' | 'admin';
    id: string;
    name: string;
  };
  liabilityOn: {
    type: 'merchant' | 'platform';
    id: string;
  };
  risk: {
    conversionRisk: number;
    redemptionRisk: number;
    abuseRisk: number;
  };
  flow: {
    source: string;
    sourceId: string;
    userId: string;
    merchantId: string;
  };
  earnedAt: Date;
  expiresAt?: Date;
  status: 'active' | 'expired' | 'redeemed' | 'converted';
}

// ============================================
// REZ COIN ECONOMICS
// ============================================

export interface RezCoinConfig {
  // Commission split (total = 100%)
  commission: {
    totalPercent: number;         // e.g., 15%
    platformPercent: number;     // e.g., 5%
    userPercent: number;         // e.g., 10%
  };

  // User split (userPercent = cashback + social)
  userSplit: {
    cashbackPercent: number;     // e.g., 5%
    socialPercent: number;        // e.g., 5%
  };

  // Usage rules
  usage: {
    noCap: boolean;              // Default: true
    financeEnabled: boolean;     // Default: false
    rechargeEnabled: boolean;     // Default: false
  };
}

export const DEFAULT_REZ_CONFIG: RezCoinConfig = {
  commission: {
    totalPercent: 15,
    platformPercent: 5,
    userPercent: 10,
  },
  userSplit: {
    cashbackPercent: 5,
    socialPercent: 5,
  },
  usage: {
    noCap: true,
    financeEnabled: false,
    rechargeEnabled: false,
  },
};

// ============================================
// BRANDED COIN ECONOMICS
// ============================================

export interface BrandedCoinConfig {
  merchantId: string;
  campaignName: string;

  earnTriggers: {
    transaction?: {
      enabled: boolean;
      percent: number;
      maxPerTransaction: number;
    };
    review?: {
      enabled: boolean;
      amounts: Record<number, number>;  // {1: 5, 2: 10, ..., 5: 50}
      minChars: number;
    };
    referral?: {
      enabled: boolean;
      perReferral: number;
    };
  };

  budget: {
    total: number;
    dailyCap: number;
    perUserCap: number;
  };

  redemption: {
    sameMerchantOnly: true;
    noCap: true;
  };

  expiry: {
    days: number;  // Default: 180
  };

  approval: {
    required: true;
    autoApproveReviews: boolean;
  };
}

// ============================================
// PROMO COIN ECONOMICS
// ============================================

export interface PromoCoinConfig {
  name: string;
  createdBy: 'admin' | 'marketing';
  approvedBy: string;

  discount: {
    type: 'percent' | 'fixed';
    value: number;
    maxDiscount: number;
    minOrderValue: number;
  };

  redemption: {
    maxPerTransaction: number;
    maxTotalRedemption: number;
    maxRedemptionsPerUser: number;
  };

  validity: {
    startDate: Date;
    endDate: Date;
    expiryDays: number;  // Default: 90
  };

  applicability: {
    allOrders: boolean;
    categories?: string[];
    merchants?: string[];
    users?: string[];
  };

  stacking: {
    stackableWithOffers: boolean;
  };

  // Cannot use in finance
  financeEnabled: false;
}

// ============================================
// PRIVE COIN ECONOMICS
// ============================================

export interface PriveCoinConfig {
  merchantId: string;
  name: string;

  earnTriggers: {
    milestonePurchase?: {
      amount: number;
      coins: number;
    };
    vipTier?: {
      enabled: boolean;
      tiers: string[];
    };
  };

  redemption: {
    universal: true;           // Can use everywhere
    minUsePerTransaction: number;
    maxUsePerTransaction: number;
    maxUsePerDay: number;
  };

  // CAN use in finance
  financeEnabled: true;
  rechargeEnabled: true;

  expiry: {
    days: number;  // Default: 365
  };
}

// ============================================
// KARMA COIN ECONOMICS
// ============================================

export interface KarmaCoinConfig {
  campaignId: string;
  organizerId: string;
  budget: number;

  earnTriggers: {
    eventParticipation?: {
      basePoints: number;
      completionBonus: number;
      verifiedBonus: number;
    };
    dailyCheckin?: {
      points: number;
      streakBonus: Record<number, number>;  // {7: 10, 30: 50}
    };
    socialEngagement?: {
      sharePoints: number;
      supportPoints: number;
    };
  };

  conversion: {
    rate: number;               // Default: 20 karma = 1 REZ
    dailyREZCap: number;       // Max REZ per day
    weeklyREZCap: number;      // Max REZ per week
    lifetimeCap: number;       // Max REZ total
    minKarmaToConvert: number;
    minScoreToConvert: number;
  };

  // Dynamic rate (ReZ Mind)
  dynamicRate?: {
    enabled: boolean;
    minRate: number;          // Best: 10 karma = 1 REZ
    maxRate: number;          // Worst: 50 karma = 1 REZ
  };
}

// ============================================
// ABUSE PREVENTION
// ============================================

export interface AbusePrevention {
  // Social sharing
  socialSharing: {
    minViews: number;
    minClicks: number;
    maxRewardsPerDay: number;
    cooldownMinutes: number;
    verifiedShareOnly: boolean;
    platforms: string[];
  };

  // Device/IP limits
  deviceLimits: {
    maxAccountsPerDevice: number;
    maxAccountsPerIP: number;
  };

  // Velocity
  velocity: {
    maxSharesPerHour: number;
    maxSharesPerDay: number;
    maxTransactionsPerHour: number;
  };
}

export const DEFAULT_ABUSE_PREVENTION: AbusePrevention = {
  socialSharing: {
    minViews: 10,
    minClicks: 2,
    maxRewardsPerDay: 3,
    cooldownMinutes: 60,
    verifiedShareOnly: true,
    platforms: ['twitter', 'facebook', 'instagram', 'whatsapp'],
  },
  deviceLimits: {
    maxAccountsPerDevice: 2,
    maxAccountsPerIP: 3,
  },
  velocity: {
    maxSharesPerHour: 5,
    maxSharesPerDay: 20,
    maxTransactionsPerHour: 10,
  },
};

// ============================================
// ECONOMIC CALCULATIONS
// ============================================

/**
 * Calculate REZ coins from transaction
 */
export function calculateRezFromTransaction(
  amount: number,
  config: RezCoinConfig = DEFAULT_REZ_CONFIG
): {
  totalRez: number;
  cashback: number;
  social: number;
  platformKeeps: number;
} {
  const totalRez = (amount * config.userPercent) / 100;
  const cashback = (amount * config.userSplit.cashbackPercent) / 100;
  const social = (amount * config.userSplit.socialPercent) / 100;
  const platformKeeps = (amount * config.commission.platformPercent) / 100;

  return {
    totalRez,
    cashback,
    social,
    platformKeeps,
  };
}

/**
 * Calculate karma to REZ conversion
 */
export function calculateKarmaConversion(
  karmaAmount: number,
  config: KarmaCoinConfig,
  userKarmaScore: number
): {
  rezCoins: number;
  karmaUsed: number;
  rate: number;
  capped: boolean;
} {
  // Get rate (dynamic or fixed)
  let rate = config.conversion.rate;

  if (config.dynamicRate?.enabled) {
    // Dynamic rate based on karma score
    const scoreRatio = Math.min(1, userKarmaScore / 900);
    rate = config.dynamicRate.maxRate -
      (scoreRatio * (config.dynamicRate.maxRate - config.dynamicRate.minRate));
  }

  const maxRezDaily = Math.min(
    karmaAmount / rate,
    config.conversion.dailyREZCap
  );

  const rezCoins = Math.floor(maxRezDaily);
  const capped = rezCoins < karmaAmount / rate;

  return {
    rezCoins,
    karmaUsed: rezCoins * rate,
    rate,
    capped,
  };
}

/**
 * Calculate promo coin discount
 */
export function calculatePromoDiscount(
  promoCoins: number,
  orderTotal: number,
  config: PromoCoinConfig
): {
  discount: number;
  finalTotal: number;
  coinsUsed: number;
} {
  // Calculate max discount
  let maxDiscount: number;
  if (config.discount.type === 'percent') {
    maxDiscount = (orderTotal * config.discount.value) / 100;
  } else {
    maxDiscount = config.discount.value;
  }

  // Cap at max discount
  const discount = Math.min(maxDiscount, config.discount.maxDiscount);

  // Calculate coins used (1 coin = ₹0.50 by default)
  const coinValue = 0.5; // 1 promo coin = ₹0.50
  const coinsUsed = Math.min(promoCoins, Math.ceil(discount / coinValue));

  return {
    discount,
    finalTotal: orderTotal - discount,
    coinsUsed,
  };
}

/**
 * Validate if promo can be used
 */
export function canUsePromo(
  config: PromoCoinConfig,
  orderDetails: {
    amount: number;
    category?: string;
    merchantId?: string;
    userId?: string;
  }
): { canUse: boolean; reason?: string } {
  // Check minimum order
  if (orderDetails.amount < config.discount.minOrderValue) {
    return {
      canUse: false,
      reason: `Minimum order value is ₹${config.discount.minOrderValue}`
    };
  }

  // Check if category applicable
  if (!config.applicability.allOrders) {
    if (config.applicability.categories &&
        !config.applicability.categories.includes(orderDetails.category || '')) {
      return { canUse: false, reason: 'Category not applicable' };
    }
    if (config.applicability.merchants &&
        !config.applicability.merchants.includes(orderDetails.merchantId || '')) {
      return { canUse: false, reason: 'Merchant not applicable' };
    }
  }

  // Check if user applicable
  if (config.applicability.users &&
      !config.applicability.users.includes(orderDetails.userId || '')) {
    return { canUse: false, reason: 'User not eligible for this promo' };
  }

  return { canUse: true };
}

// ============================================
// LIABILTIY TRACKING
// ============================================

export interface LiabilitySummary {
  coinType: CoinType;
  totalIssued: number;
  totalRedeemed: number;
  totalExpired: number;
  pendingLiability: number;
}

/**
 * Calculate pending liability for a coin type
 */
export function calculateLiability(
  flows: EconomicFlow[],
  coinType: CoinType
): LiabilitySummary {
  const relevant = flows.filter(f => f.coinType === coinType);

  const totalIssued = relevant
    .filter(f => f.status === 'active' || f.status === 'redeemed')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalRedeemed = relevant
    .filter(f => f.status === 'redeemed')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpired = relevant
    .filter(f => f.status === 'expired')
    .reduce((sum, f) => sum + f.amount, 0);

  return {
    coinType,
    totalIssued,
    totalRedeemed,
    totalExpired,
    pendingLiability: totalIssued - totalRedeemed - totalExpired,
  };
}
