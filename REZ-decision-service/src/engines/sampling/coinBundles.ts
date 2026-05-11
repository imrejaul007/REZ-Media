/**
 * COIN BUNDLES ENGINE
 * Phase 4 - Coin Package Purchasing System
 *
 * Features:
 * - Bundle Types (Starter, Value, Premium, Custom)
 * - Volume & First-Purchase Discounts
 * - Bonus Coins (buy X get Y free, time-limited, loyalty)
 * - Subscription Bundles (monthly, priority access)
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const REDIS_PREFIX = 'coin_bundles:';
const BUNDLE_PREFIX = 'bundle:';
const PURCHASE_PREFIX = 'purchase:';
const SUBSCRIPTION_PREFIX = 'subscription:';

// ============================================
// TYPES & INTERFACES
// ============================================

export type CoinType = 'try' | 'rez' | 'brand';

export type BundleType = 'starter' | 'value' | 'premium' | 'custom';

export type BonusType = 'volume' | 'first_purchase' | 'time_limited' | 'loyalty' | 'referral';

export interface CoinBundle {
  id: string;
  name: string;
  bundleType: BundleType;
  coinAmount: number;
  bonusCoins: number;
  totalCoins: number;
  price: number;
  pricePerCoin: number;
  coinType: CoinType;
  brandId?: string;
  validDays: number;
  features: string[];
  isSubscription: boolean;
  subscriptionInterval?: 'monthly' | 'yearly';
  discount?: number;
  originalPrice?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BundlePurchase {
  id: string;
  bundleId: string;
  userId: string;
  coins: number;
  bonus: number;
  totalCoins: number;
  price: number;
  pricePerCoin: number;
  coinType: CoinType;
  brandId?: string;
  paymentId: string;
  discountApplied: number;
  bonusType?: BonusType;
  timestamp: Date;
}

export interface BundleConfig {
  starterCoins: number;
  starterPrice: number;
  valueCoins: number;
  valuePrice: number;
  premiumCoins: number;
  premiumPrice: number;
}

export interface BonusConfig {
  minCoins: number;
  bonusPercentage: number;
  bonusCoins: number;
  cap?: number;
}

export interface SubscriptionConfig {
  monthlyCoins: number;
  monthlyPrice: number;
  yearlyCoins: number;
  yearlyPrice: number;
  priorityAccessBonus: number;
  extraBonusPercentage: number;
}

export interface BundlePricingTier {
  minCoins: number;
  maxCoins: number;
  discountPercentage: number;
  pricePerCoin: number;
}

export interface UserPurchaseHistory {
  userId: string;
  totalPurchases: number;
  totalCoins: number;
  totalSpent: number;
  firstPurchaseDate?: Date;
  lastPurchaseDate?: Date;
  isFirstPurchase: boolean;
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

// ============================================
// CONFIGURATION CONSTANTS
// ============================================

const DEFAULT_BUNDLE_CONFIG: BundleConfig = {
  starterCoins: 100,
  starterPrice: 0.99,
  valueCoins: 500,
  valuePrice: 4.49,
  premiumCoins: 1000,
  premiumPrice: 7.99
};

const VOLUME_BONUS_TIERS: BonusConfig[] = [
  { minCoins: 100, bonusPercentage: 5, bonusCoins: 5 },
  { minCoins: 250, bonusPercentage: 8, bonusCoins: 20 },
  { minCoins: 500, bonusPercentage: 10, bonusCoins: 50 },
  { minCoins: 1000, bonusPercentage: 15, bonusCoins: 150 },
  { minCoins: 2500, bonusPercentage: 20, bonusCoins: 500 },
  { minCoins: 5000, bonusPercentage: 25, bonusCoins: 1250 }
];

const FIRST_PURCHASE_DISCOUNT = 0.20; // 20% off first purchase

const LOYALTY_BONUSES: Record<UserPurchaseHistory['loyaltyTier'], number> = {
  bronze: 0,
  silver: 2,
  gold: 5,
  platinum: 10
};

const LOYALTY_TIER_THRESHOLDS: Record<UserPurchaseHistory['loyaltyTier'], number> = {
  bronze: 0,
  silver: 100,
  gold: 500,
  platinum: 2000
};

const DEFAULT_SUBSCRIPTION_CONFIG: SubscriptionConfig = {
  monthlyCoins: 1500,
  monthlyPrice: 9.99,
  yearlyCoins: 20000,
  yearlyPrice: 99.99,
  priorityAccessBonus: 100,
  extraBonusPercentage: 15
};

const BUNDLE_VALIDITY_DAYS = {
  starter: 30,
  value: 60,
  premium: 90,
  custom: 30
};

const TIME_LIMITED_BONUSES = {
  weekend: { days: [0, 6], bonusPercentage: 10 },
  flash_sale: { bonusPercentage: 25, maxDurationHours: 24 },
  holiday: {
    'new_year': { month: 0, day: 1, bonusPercentage: 30 },
    'eid': { month: 4, bonusPercentage: 20 },
    'christmas': { month: 11, bonusPercentage: 25 }
  }
};

// ============================================
// BUNDLE PRICING ENGINE
// ============================================

export class BundlePricingEngine {

  /**
   * Calculate price for a coin amount
   */
  calculatePrice(coinAmount: number, coinType: CoinType = 'rez'): number {
    // Base price per coin varies by type
    const basePricePerCoin: Record<CoinType, number> = {
      try: 0.008,   // $0.008 per try coin
      rez: 0.012,   // $0.012 per rez coin
      brand: 0.015  // $0.015 per brand coin
    };

    const basePrice = coinAmount * basePricePerCoin[coinType];

    // Apply volume discount
    const volumeDiscount = this.getVolumeDiscount(coinAmount);
    const discountedPrice = basePrice * (1 - volumeDiscount);

    // Round to 2 decimal places
    return Math.round(discountedPrice * 100) / 100;
  }

  /**
   * Get volume discount percentage based on coin amount
   */
  getVolumeDiscount(coinAmount: number): number {
    // Find applicable tier
    let applicableTier: BonusConfig | null = null;

    for (const tier of VOLUME_BONUS_TIERS) {
      if (coinAmount >= tier.minCoins) {
        applicableTier = tier;
      } else {
        break;
      }
    }

    return applicableTier ? applicableTier.bonusPercentage / 100 : 0;
  }

  /**
   * Calculate price per coin
   */
  calculatePricePerCoin(coinAmount: number, totalPrice: number): number {
    return totalPrice > 0 ? Math.round((totalPrice / coinAmount) * 10000) / 10000 : 0;
  }

  /**
   * Apply first purchase discount
   */
  applyFirstPurchaseDiscount(price: number): { discountedPrice: number; discount: number } {
    const discount = Math.round(price * FIRST_PURCHASE_DISCOUNT * 100) / 100;
    return {
      discountedPrice: Math.round((price - discount) * 100) / 100,
      discount
    };
  }

  /**
   * Calculate loyalty bonus
   */
  calculateLoyaltyBonus(coinAmount: number, loyaltyTier: UserPurchaseHistory['loyaltyTier']): number {
    const bonusPercentage = LOYALTY_BONUSES[loyaltyTier];
    return Math.floor(coinAmount * (bonusPercentage / 100));
  }

  /**
   * Get loyalty tier for a user
   */
  getLoyaltyTier(totalSpent: number): UserPurchaseHistory['loyaltyTier'] {
    if (totalSpent >= LOYALTY_TIER_THRESHOLDS.platinum) return 'platinum';
    if (totalSpent >= LOYALTY_TIER_THRESHOLDS.gold) return 'gold';
    if (totalSpent >= LOYALTY_TIER_THRESHOLDS.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Calculate time-limited bonus
   */
  calculateTimeLimitedBonus(coinAmount: number, date: Date = new Date()): number | null {
    const day = date.getDay();
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    const hour = date.getHours();

    // Weekend bonus
    if (TIME_LIMITED_BONUSES.weekend.days.includes(day)) {
      return Math.floor(coinAmount * (TIME_LIMITED_BONUSES.weekend.bonusPercentage / 100));
    }

    // Flash sale (check Redis for active flash sale)
    // This would check a Redis flag set by admin

    // Holiday bonuses
    const holidays = TIME_LIMITED_BONUSES.holiday;
    for (const [key, config] of Object.entries(holidays)) {
      if (month === config.month) {
        if ('day' in config && config.day === dayOfMonth) {
          return Math.floor(coinAmount * (config.bonusPercentage / 100));
        } else if (!('day' in config)) {
          return Math.floor(coinAmount * (config.bonusPercentage / 100));
        }
      }
    }

    return null;
  }
}

// ============================================
// BONUS CALCULATION ENGINE
// ============================================

export class BonusCalculationEngine {

  /**
   * Calculate all applicable bonuses for a purchase
   */
  calculateTotalBonus(params: {
    coinAmount: number;
    userId: string;
    isFirstPurchase: boolean;
    loyaltyTier: UserPurchaseHistory['loyaltyTier'];
    hasActiveSubscription: boolean;
    date?: Date;
  }): {
    volumeBonus: number;
    firstPurchaseBonus: number;
    loyaltyBonus: number;
    subscriptionBonus: number;
    timeLimitedBonus: number;
    totalBonus: number;
    bonusBreakdown: Record<BonusType, number>;
  } {
    const pricing = new BundlePricingEngine();
    const { coinAmount, loyaltyTier, hasActiveSubscription, date = new Date() } = params;

    // Volume bonus
    const volumeBonusPercentage = VOLUME_BONUS_TIERS
      .filter(tier => coinAmount >= tier.minCoins)
      .pop()?.bonusPercentage || 0;
    const volumeBonus = Math.floor(coinAmount * (volumeBonusPercentage / 100));

    // First purchase bonus
    const firstPurchaseBonus = params.isFirstPurchase
      ? Math.floor(coinAmount * FIRST_PURCHASE_DISCOUNT)
      : 0;

    // Loyalty bonus
    const loyaltyBonus = pricing.calculateLoyaltyBonus(coinAmount, loyaltyTier);

    // Subscription bonus
    const subscriptionBonus = hasActiveSubscription
      ? Math.floor(coinAmount * (DEFAULT_SUBSCRIPTION_CONFIG.extraBonusPercentage / 100))
      : 0;

    // Time-limited bonus
    const timeLimitedBonus = pricing.calculateTimeLimitedBonus(coinAmount, date) || 0;

    // Total bonus (with caps)
    const totalBonus = this.applyBonusCaps({
      volume: volumeBonus,
      firstPurchase: firstPurchaseBonus,
      loyalty: loyaltyBonus,
      subscription: subscriptionBonus,
      timeLimited: timeLimitedBonus,
      totalCoins: coinAmount
    });

    // Breakdown for transparency
    const bonusBreakdown: Record<BonusType, number> = {
      volume: volumeBonus,
      first_purchase: firstPurchaseBonus,
      loyalty: loyaltyBonus,
      referral: 0,
      time_limited: timeLimitedBonus
    };

    return {
      volumeBonus,
      firstPurchaseBonus,
      loyaltyBonus,
      subscriptionBonus,
      timeLimitedBonus,
      totalBonus,
      bonusBreakdown
    };
  }

  /**
   * Apply caps to prevent abuse
   */
  private applyBonusCaps(bonuses: {
    volume: number;
    firstPurchase: number;
    loyalty: number;
    subscription: number;
    timeLimited: number;
    totalCoins: number;
  }): number {
    // Cap each bonus type
    const maxBonusPercentage = 0.50; // Max 50% of purchase as bonus
    const maxTotalBonus = Math.floor(bonuses.totalCoins * maxBonusPercentage);

    // Sum bonuses
    let totalBonus =
      bonuses.volume +
      bonuses.firstPurchase +
      bonuses.loyalty +
      bonuses.subscription +
      bonuses.timeLimited;

    // Apply cap if exceeded
    if (totalBonus > maxTotalBonus) {
      totalBonus = maxTotalBonus;
    }

    return totalBonus;
  }

  /**
   * Get bonus description for display
   */
  getBonusDescription(bonusType: BonusType, amount: number): string {
    switch (bonusType) {
      case 'volume':
        return `Buy more, save more! +${amount} bonus coins`;
      case 'first_purchase':
        return `Welcome offer! +${amount} bonus coins on your first purchase`;
      case 'loyalty':
        return `Thank you for your loyalty! +${amount} bonus coins`;
      case 'time_limited':
        return `Limited time offer! +${amount} bonus coins`;
      case 'referral':
        return `Friend referral bonus! +${amount} bonus coins`;
      default:
        return `+${amount} bonus coins`;
    }
  }
}

// ============================================
// BUNDLE GENERATION ENGINE
// ============================================

export class BundleGenerationEngine {

  /**
   * Generate all default bundles
   */
  generateDefaultBundles(coinType: CoinType = 'rez', brandId?: string): CoinBundle[] {
    const bundles: CoinBundle[] = [];

    // Starter Pack
    bundles.push(this.generateStarterPack(coinType, brandId));

    // Value Pack
    bundles.push(this.generateValuePack(coinType, brandId));

    // Premium Pack
    bundles.push(this.generatePremiumPack(coinType, brandId));

    return bundles;
  }

  /**
   * Generate Starter Pack (cheap trial)
   */
  generateStarterPack(coinType: CoinType = 'rez', brandId?: string): CoinBundle {
    const coins = DEFAULT_BUNDLE_CONFIG.starterCoins;
    const price = DEFAULT_BUNDLE_CONFIG.starterPrice;

    // Calculate bonus
    const volumeBonus = Math.floor(coins * 0.05);
    const bonusCoins = volumeBonus;

    return {
      id: uuidv4(),
      name: 'Starter Pack',
      bundleType: 'starter',
      coinAmount: coins,
      bonusCoins,
      totalCoins: coins + bonusCoins,
      price,
      pricePerCoin: Math.round((price / (coins + bonusCoins)) * 10000) / 10000,
      coinType,
      brandId,
      validDays: BUNDLE_VALIDITY_DAYS.starter,
      features: [
        'Perfect for trying out ReZ',
        `${bonusCoins} bonus coins included`,
        'Valid for 30 days',
        'Can be used across all merchants'
      ],
      isSubscription: false,
      tags: ['starter', 'trial', 'popular'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate Value Pack (best value)
   */
  generateValuePack(coinType: CoinType = 'rez', brandId?: string): CoinBundle {
    const coins = DEFAULT_BUNDLE_CONFIG.valueCoins;
    const price = DEFAULT_BUNDLE_CONFIG.valuePrice;

    // Calculate bonus (10% volume)
    const volumeBonus = Math.floor(coins * 0.10);
    const bonusCoins = volumeBonus;

    return {
      id: uuidv4(),
      name: 'Value Pack',
      bundleType: 'value',
      coinAmount: coins,
      bonusCoins,
      totalCoins: coins + bonusCoins,
      price,
      pricePerCoin: Math.round((price / (coins + bonusCoins)) * 10000) / 10000,
      coinType,
      brandId,
      validDays: BUNDLE_VALIDITY_DAYS.value,
      features: [
        'Most popular choice',
        `${bonusCoins} bonus coins included`,
        'Best price per coin',
        'Valid for 60 days',
        'Priority support included'
      ],
      isSubscription: false,
      tags: ['value', 'best-seller', 'popular'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate Premium Pack (VIP)
   */
  generatePremiumPack(coinType: CoinType = 'rez', brandId?: string): CoinBundle {
    const coins = DEFAULT_BUNDLE_CONFIG.premiumCoins;
    const price = DEFAULT_BUNDLE_CONFIG.premiumPrice;

    // Calculate bonus (15% volume + premium perks)
    const volumeBonus = Math.floor(coins * 0.15);
    const bonusCoins = volumeBonus;

    return {
      id: uuidv4(),
      name: 'Premium Pack',
      bundleType: 'premium',
      coinAmount: coins,
      bonusCoins,
      totalCoins: coins + bonusCoins,
      price,
      pricePerCoin: Math.round((price / (coins + bonusCoins)) * 10000) / 10000,
      coinType,
      brandId,
      validDays: BUNDLE_VALIDITY_DAYS.premium,
      features: [
        'Ultimate coin package',
        `${bonusCoins} bonus coins included`,
        'Lowest price per coin',
        'Valid for 90 days',
        'VIP support & early access',
        'Exclusive merchant offers'
      ],
      isSubscription: false,
      tags: ['premium', 'vip', 'best-value'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate custom bundle
   */
  generateCustomBundle(
    coinAmount: number,
    coinType: CoinType = 'rez',
    brandId?: string
  ): CoinBundle {
    const pricing = new BundlePricingEngine();
    const price = pricing.calculatePrice(coinAmount, coinType);

    // Calculate bonus based on volume tiers
    const bonusPercentage = VOLUME_BONUS_TIERS
      .filter(tier => coinAmount >= tier.minCoins)
      .pop()?.bonusPercentage || 5;
    const bonusCoins = Math.floor(coinAmount * (bonusPercentage / 100));

    // Determine features based on size
    const features = ['Custom coin package'];
    if (coinAmount >= 500) {
      features.push(`${bonusCoins} bonus coins`);
    }
    if (coinAmount >= 1000) {
      features.push('Priority support');
      features.push('Early access to new merchants');
    }

    return {
      id: uuidv4(),
      name: `Custom Pack (${coinAmount} coins)`,
      bundleType: 'custom',
      coinAmount,
      bonusCoins,
      totalCoins: coinAmount + bonusCoins,
      price,
      pricePerCoin: Math.round((price / (coinAmount + bonusCoins)) * 10000) / 10000,
      coinType,
      brandId,
      validDays: BUNDLE_VALIDITY_DAYS.custom,
      features,
      isSubscription: false,
      tags: ['custom', 'flexible'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Generate subscription bundle
   */
  generateSubscriptionBundle(
    interval: 'monthly' | 'yearly',
    coinType: CoinType = 'rez',
    brandId?: string
  ): CoinBundle {
    const config = DEFAULT_SUBSCRIPTION_CONFIG;

    const isMonthly = interval === 'monthly';
    const coins = isMonthly ? config.monthlyCoins : config.yearlyCoins;
    const price = isMonthly ? config.monthlyPrice : config.yearlyPrice;

    // Yearly gets extra discount
    const yearlyDiscount = isMonthly ? 0 : 0.17; // ~17% off yearly
    const adjustedPrice = price * (1 - yearlyDiscount);

    // Subscription bonus
    const bonusPercentage = config.extraBonusPercentage + (isMonthly ? 0 : 5);
    const bonusCoins = Math.floor(coins * (bonusPercentage / 100));
    const priorityBonus = config.priorityAccessBonus;

    const packName = isMonthly ? 'Monthly Subscription' : 'Yearly Subscription';

    return {
      id: uuidv4(),
      name: packName,
      bundleType: 'premium',
      coinAmount: coins,
      bonusCoins: bonusCoins + priorityBonus,
      totalCoins: coins + bonusCoins + priorityBonus,
      price: Math.round(adjustedPrice * 100) / 100,
      pricePerCoin: Math.round((adjustedPrice / (coins + bonusCoins + priorityBonus)) * 10000) / 10000,
      coinType,
      brandId,
      validDays: isMonthly ? 30 : 365,
      features: [
        `${coins.toLocaleString()} coins monthly`,
        `+${bonusCoins} bonus coins each month`,
        `+${priorityBonus} priority access coins`,
        `${isMonthly ? 'Billed monthly' : 'Billed annually (save 17%)'}`,
        'Priority access to new merchants',
        'Exclusive subscription-only offers',
        'Cancel anytime'
      ],
      isSubscription: true,
      subscriptionInterval: interval,
      discount: yearlyDiscount > 0 ? yearlyDiscount * 100 : undefined,
      tags: ['subscription', interval, 'recurring', 'best-value'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Get recommended bundle for user
   */
  getRecommendedBundle(userId: string): Promise<CoinBundle> {
    return this.getRecommendationForUser(userId);
  }

  private async getRecommendationForUser(userId: string): Promise<CoinBundle> {
    // Get user history
    const history = await this.getUserPurchaseHistory(userId);

    if (!history || history.totalPurchases === 0) {
      // New user - recommend starter
      return this.generateStarterPack();
    }

    if (history.loyaltyTier === 'platinum') {
      // High-value user - recommend premium or subscription
      return this.generateSubscriptionBundle('yearly');
    }

    if (history.loyaltyTier === 'gold') {
      // Returning user - recommend value or premium
      return this.generateValuePack();
    }

    // Default - recommend value pack
    return this.generateValuePack();
  }
}

// ============================================
// SUBSCRIPTION ENGINE
// ============================================

export class SubscriptionEngine {

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const key = `${SUBSCRIPTION_PREFIX}active:${userId}`;
    const expiry = await redis.ttl(key);
    return expiry > 0;
  }

  /**
   * Get user's subscription details
   */
  async getSubscription(userId: string): Promise<{
    active: boolean;
    interval?: 'monthly' | 'yearly';
    expiresAt?: Date;
    daysRemaining?: number;
  } | null> {
    const key = `${SUBSCRIPTION_PREFIX}active:${userId}`;
    const data = await redis.get(key);

    if (!data) {
      return { active: false };
    }

    const parsed = JSON.parse(data);
    const expiresAt = new Date(parsed.expiresAt);
    const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      active: daysRemaining > 0,
      interval: parsed.interval,
      expiresAt,
      daysRemaining
    };
  }

  /**
   * Create or renew subscription
   */
  async createSubscription(
    userId: string,
    interval: 'monthly' | 'yearly',
    paymentId: string
  ): Promise<{
    success: boolean;
    subscriptionId: string;
    expiresAt: Date;
    error?: string;
  }> {
    try {
      const subscriptionId = uuidv4();
      const expiresAt = new Date();

      if (interval === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // Store subscription
      const key = `${SUBSCRIPTION_PREFIX}active:${userId}`;
      await redis.set(key, JSON.stringify({
        subscriptionId,
        interval,
        paymentId,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }));

      // Set expiry (for backup TTL)
      const ttlSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      await redis.expire(key, ttlSeconds);

      return {
        success: true,
        subscriptionId,
        expiresAt
      };
    } catch (error) {
      return {
        success: false,
        subscriptionId: '',
        expiresAt: new Date(),
        error: error instanceof Error ? error.message : 'Subscription creation failed'
      };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    const key = `${SUBSCRIPTION_PREFIX}active:${userId}`;

    // Get current subscription
    const data = await redis.get(key);
    if (!data) return false;

    const subscription = JSON.parse(data);

    // Mark as cancelled but keep active until expiry
    subscription.cancelledAt = new Date().toISOString();
    subscription.status = 'cancelled';

    await redis.set(key, JSON.stringify(subscription));

    return true;
  }

  /**
   * Process monthly subscription renewal
   */
  async processRenewal(userId: string): Promise<{
    renewed: boolean;
    nextBillingDate: Date;
    error?: string;
  }> {
    const subscription = await this.getSubscription(userId);

    if (!subscription || !subscription.active || !subscription.interval) {
      return {
        renewed: false,
        nextBillingDate: new Date(),
        error: 'No active subscription'
      };
    }

    // In production, this would trigger payment processing
    // For now, just extend the subscription

    const newExpiry = new Date();
    if (subscription.interval === 'monthly') {
      newExpiry.setMonth(newExpiry.getMonth() + 1);
    } else {
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
    }

    const key = `${SUBSCRIPTION_PREFIX}active:${userId}`;
    const data = await redis.get(key);

    if (data) {
      const parsed = JSON.parse(data);
      parsed.expiresAt = newExpiry.toISOString();
      parsed.renewedAt = new Date().toISOString();
      parsed.status = 'active';

      const ttlSeconds = Math.floor((newExpiry.getTime() - Date.now()) / 1000);
      await redis.setex(key, ttlSeconds, JSON.stringify(parsed));
    }

    return {
      renewed: true,
      nextBillingDate: newExpiry
    };
  }

  /**
   * Get subscription benefits
   */
  getSubscriptionBenefits(interval: 'monthly' | 'yearly'): string[] {
    const benefits = [
      'Priority access to new merchants',
      'Extra bonus coins on every purchase',
      'Exclusive subscription-only offers',
      'Dedicated support'
    ];

    if (interval === 'yearly') {
      benefits.push('17% savings vs monthly');
      benefits.push('Bonus priority access coins');
    }

    return benefits;
  }
}

// ============================================
// PURCHASE ENGINE
// ============================================

export class PurchaseEngine {
  private pricing: BundlePricingEngine;
  private bonusCalculation: BonusCalculationEngine;

  constructor() {
    this.pricing = new BundlePricingEngine();
    this.bonusCalculation = new BonusCalculationEngine();
  }

  /**
   * Process a bundle purchase
   */
  async processPurchase(params: {
    bundle: CoinBundle;
    userId: string;
    paymentId: string;
    applyFirstPurchaseDiscount?: boolean;
  }): Promise<{
    success: boolean;
    purchase?: BundlePurchase;
    error?: string;
  }> {
    const { bundle, userId, paymentId, applyFirstPurchaseDiscount = false } = params;

    try {
      // Get user purchase history
      const history = await this.getUserPurchaseHistory(userId);
      const isFirstPurchase = !history || history.totalPurchases === 0;

      // Get loyalty tier
      const loyaltyTier = this.pricing.getLoyaltyTier(history?.totalSpent || 0);

      // Check subscription status
      const subscriptionEngine = new SubscriptionEngine();
      const hasSubscription = await subscriptionEngine.hasActiveSubscription(userId);

      // Calculate all bonuses
      const bonusResult = this.bonusCalculation.calculateTotalBonus({
        coinAmount: bundle.coinAmount,
        userId,
        isFirstPurchase: applyFirstPurchaseDiscount ? true : isFirstPurchase,
        loyaltyTier,
        hasActiveSubscription: hasSubscription,
        date: new Date()
      });

      // Calculate final price
      let finalPrice = bundle.price;
      let discountApplied = 0;

      if (isFirstPurchase && applyFirstPurchaseDiscount) {
        const firstPurchaseResult = this.pricing.applyFirstPurchaseDiscount(finalPrice);
        finalPrice = firstPurchaseResult.discountedPrice;
        discountApplied = firstPurchaseResult.discount;
      }

      const totalCoins = bundle.coinAmount + bonusResult.totalBonus;

      // Create purchase record
      const purchase: BundlePurchase = {
        id: uuidv4(),
        bundleId: bundle.id,
        userId,
        coins: bundle.coinAmount,
        bonus: bonusResult.totalBonus,
        totalCoins,
        price: finalPrice,
        pricePerCoin: this.pricing.calculatePricePerCoin(totalCoins, finalPrice),
        coinType: bundle.coinType,
        brandId: bundle.brandId,
        paymentId,
        discountApplied,
        bonusType: bonusResult.totalBonus > 0 ? this.getPrimaryBonusType(bonusResult) : undefined,
        timestamp: new Date()
      };

      // Store purchase
      await this.storePurchase(purchase);

      // Update user history
      await this.updateUserPurchaseHistory(userId, purchase);

      // Credit coins to user wallet
      await this.creditUserWallet(userId, purchase);

      // Mark first purchase if applicable
      if (isFirstPurchase) {
        await this.markFirstPurchaseComplete(userId);
      }

      return {
        success: true,
        purchase
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase processing failed'
      };
    }
  }

  /**
   * Get user's purchase history
   */
  async getUserPurchaseHistory(userId: string): Promise<UserPurchaseHistory | null> {
    const key = `${PURCHASE_PREFIX}history:${userId}`;
    const data = await redis.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      firstPurchaseDate: parsed.firstPurchaseDate ? new Date(parsed.firstPurchaseDate) : undefined,
      lastPurchaseDate: parsed.lastPurchaseDate ? new Date(parsed.lastPurchaseDate) : undefined
    };
  }

  /**
   * Get user's purchase history with bonus type breakdown
   */
  async getDetailedPurchaseHistory(
    userId: string,
    limit = 50
  ): Promise<BundlePurchase[]> {
    const key = `${PURCHASE_PREFIX}history:${userId}:purchases`;
    const purchaseIds = await redis.lrange(key, 0, limit - 1);

    const purchases: BundlePurchase[] = [];

    for (const id of purchaseIds) {
      const data = await redis.get(`${PURCHASE_PREFIX}${id}`);
      if (data) {
        const parsed = JSON.parse(data);
        purchases.push({
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        });
      }
    }

    return purchases;
  }

  /**
   * Store purchase record
   */
  private async storePurchase(purchase: BundlePurchase): Promise<void> {
    const key = `${PURCHASE_PREFIX}${purchase.id}`;
    await redis.set(key, JSON.stringify(purchase));

    // Add to user's purchase list
    const userKey = `${PURCHASE_PREFIX}history:${purchase.userId}:purchases`;
    await redis.lpush(userKey, purchase.id);
    await redis.ltrim(userKey, 0, 99); // Keep last 100 purchases
  }

  /**
   * Update user purchase history
   */
  private async updateUserPurchaseHistory(
    userId: string,
    purchase: BundlePurchase
  ): Promise<void> {
    const key = `${PURCHASE_PREFIX}history:${userId}`;
    const existing = await this.getUserPurchaseHistory(userId);

    const history: UserPurchaseHistory = {
      userId,
      totalPurchases: (existing?.totalPurchases || 0) + 1,
      totalCoins: (existing?.totalCoins || 0) + purchase.totalCoins,
      totalSpent: (existing?.totalSpent || 0) + purchase.price,
      firstPurchaseDate: existing?.firstPurchaseDate || purchase.timestamp,
      lastPurchaseDate: purchase.timestamp,
      isFirstPurchase: false,
      loyaltyTier: this.pricing.getLoyaltyTier((existing?.totalSpent || 0) + purchase.price)
    };

    await redis.set(key, JSON.stringify(history));
  }

  /**
   * Credit coins to user wallet
   */
  private async creditUserWallet(
    userId: string,
    purchase: BundlePurchase
  ): Promise<void> {
    const walletKey = `wallet:${userId}:${purchase.coinType}`;

    // Get current balance
    const currentBalance = parseInt(await redis.get(walletKey) || '0');

    // Add coins
    const newBalance = currentBalance + purchase.totalCoins;
    await redis.set(walletKey, newBalance.toString());

    // Record transaction
    const txKey = `wallet:${userId}:transactions`;
    await redis.lpush(txKey, JSON.stringify({
      type: 'credit',
      amount: purchase.totalCoins,
      purchaseId: purchase.id,
      timestamp: Date.now()
    }));
    await redis.ltrim(txKey, 0, 99);

    // Set expiry on coins if bundle has validity
    if (purchase.bonusType) {
      // Bonus coins might expire at different time
    }
  }

  /**
   * Mark first purchase as complete
   */
  private async markFirstPurchaseComplete(userId: string): Promise<void> {
    const key = `${PURCHASE_PREFIX}first_purchase:${userId}`;
    await redis.set(key, 'completed');
    await redis.expire(key, 86400 * 365 * 10); // 10 years
  }

  /**
   * Check if user has completed first purchase
   */
  async hasCompletedFirstPurchase(userId: string): Promise<boolean> {
    const key = `${PURCHASE_PREFIX}first_purchase:${userId}`;
    const result = await redis.get(key);
    return result === 'completed';
  }

  /**
   * Get primary bonus type for display
   */
  private getPrimaryBonusType(bonusResult: ReturnType<typeof this.bonusCalculation.calculateTotalBonus>): BonusType {
    const { volumeBonus, firstPurchaseBonus, loyaltyBonus, subscriptionBonus, timeLimitedBonus } = bonusResult;

    // Priority order
    if (firstPurchaseBonus > 0) return 'first_purchase';
    if (timeLimitedBonus > 0) return 'time_limited';
    if (subscriptionBonus > 0) return 'volume';
    if (loyaltyBonus > 0) return 'loyalty';
    if (volumeBonus > 0) return 'volume';

    return 'volume';
  }

  /**
   * Validate purchase (payment verification stub)
   */
  async validatePayment(paymentId: string): Promise<{
    valid: boolean;
    amount?: number;
    error?: string;
  }> {
    // In production, this would verify with payment provider
    // For now, assume valid
    return { valid: true };
  }

  /**
   * Process refund
   */
  async processRefund(purchaseId: string, reason: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const key = `${PURCHASE_PREFIX}${purchaseId}`;
    const data = await redis.get(key);

    if (!data) {
      return { success: false, error: 'Purchase not found' };
    }

    const purchase = JSON.parse(data) as BundlePurchase;

    // Debit user wallet
    const walletKey = `wallet:${purchase.userId}:${purchase.coinType}`;
    const currentBalance = parseInt(await redis.get(walletKey) || '0');
    const newBalance = Math.max(0, currentBalance - purchase.totalCoins);
    await redis.set(walletKey, newBalance.toString());

    // Mark purchase as refunded
    purchase.refunded = true;
    purchase.refundReason = reason;
    purchase.refundedAt = new Date();
    await redis.set(key, JSON.stringify(purchase));

    // Record refund transaction
    const txKey = `wallet:${purchase.userId}:transactions`;
    await redis.lpush(txKey, JSON.stringify({
      type: 'refund',
      amount: purchase.totalCoins,
      purchaseId,
      reason,
      timestamp: Date.now()
    }));

    return { success: true };
  }
}

// ============================================
// BUNDLE MANAGEMENT ENGINE
// ============================================

export class BundleManagementEngine {

  /**
   * Create a new custom bundle (merchant function)
   */
  async createBundle(params: {
    name: string;
    coinAmount: number;
    price: number;
    coinType: CoinType;
    brandId?: string;
    validDays?: number;
    bonusCoins?: number;
    features?: string[];
    tags?: string[];
  }): Promise<{
    success: boolean;
    bundle?: CoinBundle;
    error?: string;
  }> {
    try {
      const bundleId = uuidv4();
      const validDays = params.validDays || 30;
      const bonusCoins = params.bonusCoins || Math.floor(params.coinAmount * 0.10);
      const features = params.features || ['Custom coin package'];

      const bundle: CoinBundle = {
        id: bundleId,
        name: params.name,
        bundleType: 'custom',
        coinAmount: params.coinAmount,
        bonusCoins,
        totalCoins: params.coinAmount + bonusCoins,
        price: params.price,
        pricePerCoin: Math.round((params.price / (params.coinAmount + bonusCoins)) * 10000) / 10000,
        coinType: params.coinType,
        brandId: params.brandId,
        validDays,
        features,
        isSubscription: false,
        tags: params.tags || ['custom', 'merchant-created'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store bundle
      const key = `${BUNDLE_PREFIX}${bundleId}`;
      await redis.set(key, JSON.stringify(bundle));

      // Add to brand's bundles if applicable
      if (params.brandId) {
        await redis.sadd(`${BUNDLE_PREFIX}brand:${params.brandId}:bundles`, bundleId);
      }

      return { success: true, bundle };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bundle creation failed'
      };
    }
  }

  /**
   * Get bundle by ID
   */
  async getBundle(bundleId: string): Promise<CoinBundle | null> {
    const key = `${BUNDLE_PREFIX}${bundleId}`;
    const data = await redis.get(key);

    if (!data) return null;

    const bundle = JSON.parse(data);
    return {
      ...bundle,
      createdAt: new Date(bundle.createdAt),
      updatedAt: new Date(bundle.updatedAt)
    };
  }

  /**
   * Get all bundles for a brand
   */
  async getBrandBundles(brandId: string): Promise<CoinBundle[]> {
    const bundleIds = await redis.smembers(`${BUNDLE_PREFIX}brand:${brandId}:bundles`);
    const bundles: CoinBundle[] = [];

    for (const id of bundleIds) {
      const bundle = await this.getBundle(id);
      if (bundle) {
        bundles.push(bundle);
      }
    }

    return bundles;
  }

  /**
   * Update bundle
   */
  async updateBundle(
    bundleId: string,
    updates: Partial<Pick<CoinBundle, 'name' | 'price' | 'validDays' | 'features' | 'tags'>>
  ): Promise<{
    success: boolean;
    bundle?: CoinBundle;
    error?: string;
  }> {
    const existing = await this.getBundle(bundleId);

    if (!existing) {
      return { success: false, error: 'Bundle not found' };
    }

    const updated: CoinBundle = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    const key = `${BUNDLE_PREFIX}${bundleId}`;
    await redis.set(key, JSON.stringify(updated));

    return { success: true, bundle: updated };
  }

  /**
   * Deactivate bundle
   */
  async deactivateBundle(bundleId: string): Promise<boolean> {
    const key = `${BUNDLE_PREFIX}${bundleId}`;
    const data = await redis.get(key);

    if (!data) return false;

    const bundle = JSON.parse(data);
    bundle.active = false;
    bundle.deactivatedAt = new Date();
    await redis.set(key, JSON.stringify(bundle));

    return true;
  }

  /**
   * Get all active bundles (public)
   */
  async getActiveBundles(coinType?: CoinType, brandId?: string): Promise<CoinBundle[]> {
    // This would typically scan Redis for active bundles
    // For now, return generated bundles
    const generator = new BundleGenerationEngine();
    const bundles = generator.generateDefaultBundles(coinType, brandId);

    if (brandId) {
      const brandBundles = await this.getBrandBundles(brandId);
      return [...bundles, ...brandBundles].filter(b => b.active !== false);
    }

    return bundles;
  }

  /**
   * Get pricing comparison for all bundles
   */
  getPricingComparison(coinType: CoinType = 'rez'): Array<{
    bundleType: BundleType;
    coins: number;
    price: number;
    pricePerCoin: number;
    bonusPercentage: number;
  }> {
    const generator = new BundleGenerationEngine();
    const bundles = generator.generateDefaultBundles(coinType);

    return bundles.map(b => ({
      bundleType: b.bundleType,
      coins: b.coinAmount,
      price: b.price,
      pricePerCoin: b.pricePerCoin,
      bonusPercentage: Math.round((b.bonusCoins / b.coinAmount) * 100)
    }));
  }
}

// ============================================
// ANALYTICS & REPORTING
// ============================================

export class BundleAnalyticsEngine {

  /**
   * Get bundle purchase statistics
   */
  async getBundleStats(bundleId?: string): Promise<{
    totalPurchases: number;
    totalRevenue: number;
    averageOrderValue: number;
    topBundles: Array<{ bundleId: string; count: number }>;
    revenueByDay: Array<{ date: string; revenue: number; purchases: number }>;
  }> {
    // This would aggregate from Redis
    // Placeholder implementation
    return {
      totalPurchases: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      topBundles: [],
      revenueByDay: []
    };
  }

  /**
   * Get conversion metrics
   */
  async getConversionMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    viewToPurchaseRate: number;
    revenuePerUser: number;
    averageCoinsPurchased: number;
    mostPopularBundle: string;
  }> {
    return {
      viewToPurchaseRate: 0,
      revenuePerUser: 0,
      averageCoinsPurchased: 0,
      mostPopularBundle: ''
    };
  }
}

// ============================================
// FACTORY INSTANCES
// ============================================

export const bundlePricingEngine = new BundlePricingEngine();
export const bonusCalculationEngine = new BonusCalculationEngine();
export const bundleGenerationEngine = new BundleGenerationEngine();
export const subscriptionEngine = new SubscriptionEngine();
export const purchaseEngine = new PurchaseEngine();
export const bundleManagementEngine = new BundleManagementEngine();
export const bundleAnalyticsEngine = new BundleAnalyticsEngine();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get all available bundles
 */
export async function getAvailableBundles(
  coinType?: CoinType,
  brandId?: string
): Promise<CoinBundle[]> {
  return bundleManagementEngine.getActiveBundles(coinType, brandId);
}

/**
 * Get bundle by ID
 */
export async function getBundleById(bundleId: string): Promise<CoinBundle | null> {
  return bundleManagementEngine.getBundle(bundleId);
}

/**
 * Purchase a bundle
 */
export async function purchaseBundle(params: {
  bundleId: string;
  userId: string;
  paymentId: string;
  applyFirstPurchaseDiscount?: boolean;
}): Promise<{
  success: boolean;
  purchase?: BundlePurchase;
  error?: string;
}> {
  const bundle = await bundleManagementEngine.getBundle(params.bundleId);

  if (!bundle) {
    return { success: false, error: 'Bundle not found' };
  }

  return purchaseEngine.processPurchase({
    bundle,
    userId: params.userId,
    paymentId: params.paymentId,
    applyFirstPurchaseDiscount: params.applyFirstPurchaseDiscount
  });
}

/**
 * Calculate bonus for purchase preview
 */
export async function previewBonus(params: {
  coinAmount: number;
  userId: string;
  coinType?: CoinType;
}): Promise<{
  basePrice: number;
  finalPrice: number;
  bonusCoins: number;
  totalCoins: number;
  pricePerCoin: number;
  bonuses: Record<BonusType, number>;
  loyaltyTier: UserPurchaseHistory['loyaltyTier'];
  hasSubscription: boolean;
}> {
  const history = await purchaseEngine.getUserPurchaseHistory(params.userId);
  const loyaltyTier = bundlePricingEngine.getLoyaltyTier(history?.totalSpent || 0);
  const hasSubscription = await subscriptionEngine.hasActiveSubscription(params.userId);
  const isFirstPurchase = !history || history.totalPurchases === 0;

  const bonusResult = bonusCalculationEngine.calculateTotalBonus({
    coinAmount: params.coinAmount,
    userId: params.userId,
    isFirstPurchase,
    loyaltyTier,
    hasActiveSubscription: hasSubscription
  });

  const coinType = params.coinType || 'rez';
  const basePrice = bundlePricingEngine.calculatePrice(params.coinAmount, coinType);

  let finalPrice = basePrice;
  if (isFirstPurchase) {
    const firstPurchaseResult = bundlePricingEngine.applyFirstPurchaseDiscount(finalPrice);
    finalPrice = firstPurchaseResult.discountedPrice;
  }

  return {
    basePrice,
    finalPrice,
    bonusCoins: bonusResult.totalBonus,
    totalCoins: params.coinAmount + bonusResult.totalBonus,
    pricePerCoin: bundlePricingEngine.calculatePricePerCoin(
      params.coinAmount + bonusResult.totalBonus,
      finalPrice
    ),
    bonuses: bonusResult.bonusBreakdown,
    loyaltyTier,
    hasSubscription
  };
}

/**
 * Create subscription
 */
export async function createSubscription(
  userId: string,
  interval: 'monthly' | 'yearly',
  paymentId: string
): Promise<{
  success: boolean;
  subscriptionId?: string;
  expiresAt?: Date;
  error?: string;
}> {
  return subscriptionEngine.createSubscription(userId, interval, paymentId);
}

/**
 * Get subscription status
 */
export async function getSubscriptionStatus(
  userId: string
): Promise<{
  active: boolean;
  interval?: 'monthly' | 'yearly';
  expiresAt?: Date;
  daysRemaining?: number;
}> {
  return subscriptionEngine.getSubscription(userId);
}

// Default export
export default {
  bundlePricingEngine,
  bonusCalculationEngine,
  bundleGenerationEngine,
  subscriptionEngine,
  purchaseEngine,
  bundleManagementEngine,
  bundleAnalyticsEngine
};
