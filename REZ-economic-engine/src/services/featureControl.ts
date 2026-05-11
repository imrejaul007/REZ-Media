/**
 * Feature Control Service
 *
 * REE controls all feature flags and entitlements
 */

// ============================================
// USER FEATURE FLAGS
// ============================================

export interface UserFeatureFlags {
  // Coin features
  canEarnRez: boolean;
  canEarnBranded: boolean;
  canEarnPromo: boolean;
  canEarnPrive: boolean;
  canConvertKarma: boolean;

  // Access features
  hasPrioritySupport: boolean;
  hasEarlyAccess: boolean;
  hasExclusiveEvents: boolean;
  hasVipKarmaEvents: boolean;

  // Limits
  maxSocialSharesPerDay: number;
  maxCashbackPercent: number;
  maxReferralsPerMonth: number;

  // Tier info
  currentTier: string;
  requiredTier?: string;
}

export interface UserTierConfig {
  name: string;
  minSpend: number;           // Lifetime spend threshold
  benefits: UserFeatureFlags;
}

// User subscription tiers
export const USER_TIERS: UserTierConfig[] = [
  {
    name: 'starter',
    minSpend: 0,
    benefits: {
      canEarnRez: true,
      canEarnBranded: true,
      canEarnPromo: true,
      canEarnPrive: false,
      canConvertKarma: true,
      hasPrioritySupport: false,
      hasEarlyAccess: false,
      hasExclusiveEvents: false,
      hasVipKarmaEvents: false,
      maxSocialSharesPerDay: 3,
      maxCashbackPercent: 5,
      maxReferralsPerMonth: 5,
      currentTier: 'starter',
    },
  },
  {
    name: 'active',
    minSpend: 5000,
    benefits: {
      canEarnRez: true,
      canEarnBranded: true,
      canEarnPromo: true,
      canEarnPrive: false,
      canConvertKarma: true,
      hasPrioritySupport: true,
      hasEarlyAccess: false,
      hasExclusiveEvents: false,
      hasVipKarmaEvents: false,
      maxSocialSharesPerDay: 5,
      maxCashbackPercent: 5,
      maxReferralsPerMonth: 10,
      currentTier: 'active',
    },
  },
  {
    name: 'gold',
    minSpend: 25000,
    benefits: {
      canEarnRez: true,
      canEarnBranded: true,
      canEarnPromo: true,
      canEarnPrive: false,
      canConvertKarma: true,
      hasPrioritySupport: true,
      hasEarlyAccess: true,
      hasExclusiveEvents: false,
      hasVipKarmaEvents: false,
      maxSocialSharesPerDay: 10,
      maxCashbackPercent: 6,
      maxReferralsPerMonth: 20,
      currentTier: 'gold',
    },
  },
  {
    name: 'platinum',
    minSpend: 100000,
    benefits: {
      canEarnRez: true,
      canEarnBranded: true,
      canEarnPromo: true,
      canEarnPrive: true,
      canConvertKarma: true,
      hasPrioritySupport: true,
      hasEarlyAccess: true,
      hasExclusiveEvents: true,
      hasVipKarmaEvents: true,
      maxSocialSharesPerDay: -1, // unlimited
      maxCashbackPercent: 7,
      maxReferralsPerMonth: 50,
      currentTier: 'platinum',
    },
  },
];

// ============================================
// MERCHANT FEATURE FLAGS
// ============================================

export interface MerchantFeatureFlags {
  // Basic
  maxQRCodes: number;
  maxTransactionsPerMonth: number;
  hasAnalytics: boolean;

  // Advanced
  hasCustomBranding: boolean;
  hasAPI: boolean;
  hasMultiLocation: boolean;
  hasWhiteLabel: boolean;

  // Coins
  canCreateBrandedCoins: boolean;
  canRunPromoCampaigns: boolean;
  canRunKarmaCampaigns: boolean;

  // Commission
  commissionRate: number;
  platformFee: number;

  // Tier info
  currentTier: string;
}

export interface MerchantTierConfig {
  name: string;
  monthlyFee: number;
  benefits: MerchantFeatureFlags;
}

// Merchant subscription tiers
export const MERCHANT_TIERS: MerchantTierConfig[] = [
  {
    name: 'free',
    monthlyFee: 0,
    benefits: {
      maxQRCodes: 100,
      maxTransactionsPerMonth: 100,
      hasAnalytics: false,
      hasCustomBranding: false,
      hasAPI: false,
      hasMultiLocation: false,
      hasWhiteLabel: false,
      canCreateBrandedCoins: false,
      canRunPromoCampaigns: false,
      canRunKarmaCampaigns: false,
      commissionRate: 15,
      platformFee: 15,
      currentTier: 'free',
    },
  },
  {
    name: 'growth',
    monthlyFee: 299,
    benefits: {
      maxQRCodes: 1000,
      maxTransactionsPerMonth: 1000,
      hasAnalytics: true,
      hasCustomBranding: false,
      hasAPI: false,
      hasMultiLocation: false,
      hasWhiteLabel: false,
      canCreateBrandedCoins: true,
      canRunPromoCampaigns: true,
      canRunKarmaCampaigns: false,
      commissionRate: 12,
      platformFee: 12,
      currentTier: 'growth',
    },
  },
  {
    name: 'pro',
    monthlyFee: 799,
    benefits: {
      maxQRCodes: -1, // unlimited
      maxTransactionsPerMonth: -1,
      hasAnalytics: true,
      hasCustomBranding: true,
      hasAPI: true,
      hasMultiLocation: false,
      hasWhiteLabel: false,
      canCreateBrandedCoins: true,
      canRunPromoCampaigns: true,
      canRunKarmaCampaigns: true,
      commissionRate: 10,
      platformFee: 10,
      currentTier: 'pro',
    },
  },
  {
    name: 'enterprise',
    monthlyFee: 1999,
    benefits: {
      maxQRCodes: -1,
      maxTransactionsPerMonth: -1,
      hasAnalytics: true,
      hasCustomBranding: true,
      hasAPI: true,
      hasMultiLocation: true,
      hasWhiteLabel: true,
      canCreateBrandedCoins: true,
      canRunPromoCampaigns: true,
      canRunKarmaCampaigns: true,
      commissionRate: 8,
      platformFee: 8,
      currentTier: 'enterprise',
    },
  },
];

// ============================================
// FEATURE EVALUATION
// ============================================

/**
 * Get user feature flags by tier
 */
export function getUserFeatures(tier: string): UserFeatureFlags {
  const tierConfig = USER_TIERS.find(t => t.name === tier);
  if (!tierConfig) {
    return USER_TIERS[0].benefits; // default to starter
  }
  return tierConfig.benefits;
}

/**
 * Get merchant feature flags by tier
 */
export function getMerchantFeatures(tier: string): MerchantFeatureFlags {
  const tierConfig = MERCHANT_TIERS.find(t => t.name === tier);
  if (!tierConfig) {
    return MERCHANT_TIERS[0].benefits; // default to free
  }
  return tierConfig.benefits;
}

/**
 * Get user tier by lifetime spend
 */
export function getUserTier(lifetimeSpend: number): UserTierConfig {
  // Find highest tier user qualifies for
  for (let i = USER_TIERS.length - 1; i >= 0; i--) {
    if (lifetimeSpend >= USER_TIERS[i].minSpend) {
      return USER_TIERS[i];
    }
  }
  return USER_TIERS[0]; // default to starter
}

/**
 * Check if user has specific feature
 */
export function userHasFeature(
  lifetimeSpend: number,
  feature: keyof UserFeatureFlags
): { has: boolean; currentTier: string; requiredTier?: string } {
  const tier = getUserTier(lifetimeSpend);
  const features = tier.benefits;
  const has = features[feature];

  if (typeof features[feature] === 'boolean') {
    if (!has) {
      // Find tier that has this feature
      const requiredTier = USER_TIERS.find(t => t.benefits[feature])?.name;
      return { has: false, currentTier: tier.name, requiredTier };
    }
  } else if (typeof features[feature] === 'number') {
    // For limits, check if unlimited or has value
    const value = features[feature] as number;
    return {
      has: value !== 0,
      currentTier: tier.name,
      requiredTier: value === 0 ? USER_TIERS.find(t => t.benefits[feature] !== 0)?.name : undefined,
    };
  }

  return { has: true, currentTier: tier.name };
}

/**
 * Check if merchant has specific feature
 */
export function merchantHasFeature(
  tier: string,
  feature: keyof MerchantFeatureFlags
): { has: boolean; currentTier: string } {
  const features = getMerchantFeatures(tier);
  const has = features[feature];

  if (typeof features[feature] === 'boolean') {
    return { has, currentTier: tier };
  } else if (typeof features[feature] === 'number') {
    return {
      has: features[feature] !== 0,
      currentTier: tier,
    };
  }

  return { has: true, currentTier: tier };
}

/**
 * Get all tiers (for admin)
 */
export function getAllUserTiers(): UserTierConfig[] {
  return USER_TIERS;
}

export function getAllMerchantTiers(): MerchantTierConfig[] {
  return MERCHANT_TIERS;
}

/**
 * Get commission breakdown for merchant
 */
export function getMerchantCommission(
  tier: string,
  transactionAmount: number
): {
  platformFee: number;
  merchantReceives: number;
  userCashback: number;
  userSocial: number;
} {
  const features = getMerchantFeatures(tier);
  const commissionRate = features.commissionRate;
  const platformFee = (transactionAmount * commissionRate) / 100;
  const merchantReceives = transactionAmount - platformFee;

  // User gets split of platform fee
  const userCashback = platformFee * 0.5;  // 5% of transaction
  const userSocial = platformFee * 0.5;   // 5% of transaction

  return {
    platformFee,
    merchantReceives,
    userCashback,
    userSocial,
  };
}

/**
 * Get cashback for user
 */
export function getUserCashback(
  lifetimeSpend: number,
  transactionAmount: number
): {
  cashbackPercent: number;
  cashbackAmount: number;
  socialAmount: number;
  coinType: 'rez';
} {
  const tier = getUserTier(lifetimeSpend);
  const cashbackPercent = tier.benefits.maxCashbackPercent;
  const cashbackAmount = (transactionAmount * cashbackPercent) / 100;

  // Social sharing is same as cashback by default
  const socialAmount = cashbackAmount;

  return {
    cashbackPercent,
    cashbackAmount,
    socialAmount,
    coinType: 'rez',
  };
}

export default {
  getUserFeatures,
  getMerchantFeatures,
  getUserTier,
  userHasFeature,
  merchantHasFeature,
  getAllUserTiers,
  getAllMerchantTiers,
  getMerchantCommission,
  getUserCashback,
};
