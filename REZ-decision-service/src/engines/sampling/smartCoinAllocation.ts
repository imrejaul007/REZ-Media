/**
 * SMART COIN ALLOCATION ENGINE - Phase 3
 * Decides HOW MUCH coins to give based on multiple factors
 *
 * Features:
 * - Dynamic coin calculation based on multiple factors
 * - Merchant factors (inventory, conversion rate, rating)
 * - User factors (affinity, stage, past conversion)
 * - Market factors (time of day, day of week, competition)
 * - Budget management (daily/weekly/user limits, auto-pause)
 */

import Redis from 'ioredis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_PREFIX = 'smartcoins:';
const BUDGET_PREFIX = 'budget:';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// INTERFACES
// ============================================

export interface CoinAllocationRequest {
  userId: string;
  campaignId: string;
  merchantId: string;
  baseCoins: number;
  location?: { lat: number; lng: number };
}

export interface CoinAllocationResponse {
  coins: number;
  breakdown: {
    base: number;
    userBoost: number;
    merchantBoost: number;
    marketBoost: number;
  };
  reason: string;
  budgetStatus: 'ok' | 'low' | 'exhausted';
}

export interface MerchantData {
  inventoryLevel: number;      // 0-1, high stock = more coins
  conversionRate: number;      // 0-1, new merchant = boost
  rating: number;             // 1-5, higher = less coins needed
  totalRedeems: number;       // Total redemptions
  avgDailyRedeems: number;    // Average daily redemptions
  campaignBudget: number;      // Campaign budget remaining
  dailyBudget: number;         // Daily budget remaining
}

export interface UserData {
  affinity: number;            // 0-1, affinity to category
  stage: 'NEW' | 'WARM' | 'HOT';
  pastConversionRate: number;  // 0-1
  lifetimeCoins: number;       // Total coins ever received
  recentScans: number;         // Scans in last 7 days
  categoryHistory: Record<string, string>; // Category -> score (from Redis hgetall)
}

export interface MarketConditions {
  hourOfDay: number;           // 0-23
  dayOfWeek: number;           // 0-6 (Sunday = 0)
  nearbyCompetitors: number;   // Count of similar merchants
  isWeekend: boolean;
  isPeakHour: boolean;
}

// ============================================
// DEFAULT CONFIG
// ============================================

const DEFAULT_CONFIG = {
  minCoins: 5,
  maxCoins: 500,
  defaultBaseCoins: 20,

  // Budget limits
  dailyBudgetLimit: 10000,
  perUserDailyLimit: 100,
  perUserWeeklyLimit: 500,

  // Boost thresholds
  highInventoryThreshold: 0.7,
  lowInventoryThreshold: 0.3,
  newMerchantThreshold: 10, // Redeems < 10 = new

  // Boost percentages
  maxUserBoost: 50,         // Max % boost from user factors
  maxMerchantBoost: 40,    // Max % boost from merchant factors
  maxMarketBoost: 30,      // Max % boost from market factors

  // Adjustment factors
  newUserBoost: 1.3,        // 30% boost for new users
  highInventoryBoost: 1.2,  // 20% boost for high inventory
  newMerchantBoost: 1.25,   // 25% boost for new merchants
  lowRatingPenalty: 0.8,    // 20% penalty for low rating
  highAffinityDiscount: 0.9, // 10% discount for high affinity
  offPeakBoost: 1.15,       // 15% boost for off-peak hours
  weekendBoost: 1.1,        // 10% boost on weekends
  competitionBoost: 1.2,    // 20% boost when competition nearby

  // Rating thresholds
  highRatingThreshold: 4.5,
  lowRatingThreshold: 3.0,

  // Affinity thresholds
  highAffinityThreshold: 0.7,
  lowAffinityThreshold: 0.3,

  // Time windows (hours)
  lunchStart: 11,
  lunchEnd: 14,
  dinnerStart: 18,
  dinnerEnd: 22,

  // Budget status thresholds
  budgetLowThreshold: 0.2,  // 20% remaining = low
};

// ============================================
// BUDGET MANAGER
// ============================================

export class BudgetManager {
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if budget allows allocation
   */
  async checkBudget(
    campaignId: string,
    userId: string,
    requestedAmount: number
  ): Promise<{
    allowed: boolean;
    status: 'ok' | 'low' | 'exhausted';
    reason: string;
    availableBudget: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Check campaign daily budget
    const campaignDailyKey = `${BUDGET_PREFIX}campaign:${campaignId}:daily:${today}`;
    const campaignSpent = parseInt(await redis.get(campaignDailyKey) || '0');
    const campaignBudget = this.config.dailyBudgetLimit;

    if (campaignSpent >= campaignBudget) {
      return {
        allowed: false,
        status: 'exhausted',
        reason: 'Campaign daily budget exhausted',
        availableBudget: 0
      };
    }

    const campaignRemaining = campaignBudget - campaignSpent;

    // Check user daily limit
    const userDailyKey = `${BUDGET_PREFIX}user:${userId}:daily:${today}`;
    const userDailySpent = parseInt(await redis.get(userDailyKey) || '0');

    if (userDailySpent + requestedAmount > this.config.perUserDailyLimit) {
      return {
        allowed: false,
        status: 'exhausted',
        reason: 'User daily limit reached',
        availableBudget: Math.max(0, this.config.perUserDailyLimit - userDailySpent)
      };
    }

    // Check user weekly limit
    const weekStart = this.getWeekStart();
    const userWeeklyKey = `${BUDGET_PREFIX}user:${userId}:weekly:${weekStart}`;
    const userWeeklySpent = parseInt(await redis.get(userWeeklyKey) || '0');

    if (userWeeklySpent + requestedAmount > this.config.perUserWeeklyLimit) {
      return {
        allowed: false,
        status: 'exhausted',
        reason: 'User weekly limit reached',
        availableBudget: Math.max(0, this.config.perUserWeeklyLimit - userWeeklySpent)
      };
    }

    // Determine status
    let status: 'ok' | 'low' | 'exhausted' = 'ok';
    const remainingPercentage = campaignRemaining / campaignBudget;

    if (remainingPercentage < 0.1) {
      status = 'exhausted';
    } else if (remainingPercentage < this.config.budgetLowThreshold) {
      status = 'low';
    }

    return {
      allowed: true,
      status,
      reason: status === 'ok' ? 'Budget available' : `Budget ${status}`,
      availableBudget: Math.min(campaignRemaining, this.config.perUserDailyLimit - userDailySpent)
    };
  }

  /**
   * Reserve budget for allocation
   */
  async reserveBudget(
    campaignId: string,
    userId: string,
    amount: number
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getWeekStart();

    const campaignDailyKey = `${BUDGET_PREFIX}campaign:${campaignId}:daily:${today}`;
    const userDailyKey = `${BUDGET_PREFIX}user:${userId}:daily:${today}`;
    const userWeeklyKey = `${BUDGET_PREFIX}user:${userId}:weekly:${weekStart}`;

    const pipeline = redis.pipeline();

    // Increment campaign daily spend
    pipeline.incrby(campaignDailyKey, amount);
    pipeline.expire(campaignDailyKey, 86400 * 2); // 2 days TTL

    // Increment user daily spend
    pipeline.incrby(userDailyKey, amount);
    pipeline.expire(userDailyKey, 86400 * 2);

    // Increment user weekly spend
    pipeline.incrby(userWeeklyKey, amount);
    pipeline.expire(userWeeklyKey, 86400 * 8); // 8 days TTL

    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[BudgetManager] Failed to reserve budget:', error);
      return false;
    }
  }

  /**
   * Release reserved budget (e.g., if transaction fails)
   */
  async releaseBudget(
    campaignId: string,
    userId: string,
    amount: number
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = this.getWeekStart();

    const pipeline = redis.pipeline();

    pipeline.decrby(`${BUDGET_PREFIX}campaign:${campaignId}:daily:${today}`, amount);
    pipeline.decrby(`${BUDGET_PREFIX}user:${userId}:daily:${today}`, amount);
    pipeline.decrby(`${BUDGET_PREFIX}user:${userId}:weekly:${weekStart}`, amount);

    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[BudgetManager] Failed to release budget:', error);
      return false;
    }
  }

  /**
   * Get budget status for a campaign
   */
  async getCampaignBudgetStatus(campaignId: string): Promise<{
    dailySpent: number;
    dailyLimit: number;
    percentageRemaining: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const dailySpent = parseInt(
      await redis.get(`${BUDGET_PREFIX}campaign:${campaignId}:daily:${today}`) || '0'
    );

    return {
      dailySpent,
      dailyLimit: this.config.dailyBudgetLimit,
      percentageRemaining: Math.max(0, (this.config.dailyBudgetLimit - dailySpent) / this.config.dailyBudgetLimit)
    };
  }

  /**
   * Pause campaign when budget exhausted
   */
  async pauseCampaign(campaignId: string, reason: string): Promise<void> {
    const key = `${BUDGET_PREFIX}paused:${campaignId}`;
    await redis.setex(key, 86400, JSON.stringify({
      reason,
      pausedAt: new Date().toISOString()
    }));
    console.log(`[BudgetManager] Campaign ${campaignId} paused: ${reason}`);
  }

  /**
   * Check if campaign is paused
   */
  async isCampaignPaused(campaignId: string): Promise<{
    paused: boolean;
    reason?: string;
    pausedAt?: string;
  }> {
    const data = await redis.get(`${BUDGET_PREFIX}paused:${campaignId}`);
    if (!data) return { paused: false };

    return { paused: true, ...JSON.parse(data) };
  }

  private getWeekStart(): string {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  }
}

// ============================================
// MERCHANT ANALYZER
// ============================================

export class MerchantAnalyzer {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Get merchant data from Redis cache
   */
  async getMerchantData(merchantId: string): Promise<MerchantData> {
    const prefix = `${REDIS_PREFIX}merchant:${merchantId}`;

    const [
      inventoryLevel,
      conversionRate,
      rating,
      totalRedeems
    ] = await Promise.all([
      this.redis.get(`${prefix}:inventory`),
      this.redis.get(`${prefix}:conversionRate`),
      this.redis.get(`${prefix}:rating`),
      this.redis.get(`${prefix}:totalRedeems`)
    ]);

    const total = parseInt(totalRedeems || '0');

    return {
      inventoryLevel: parseFloat(inventoryLevel || '0.5'),
      conversionRate: parseFloat(conversionRate || '0.3'),
      rating: parseFloat(rating || '4.0'),
      totalRedeems: total,
      avgDailyRedeems: await this.getAvgDailyRedeems(merchantId),
      campaignBudget: parseInt(await this.redis.get(`${prefix}:campaignBudget`) || '10000'),
      dailyBudget: parseInt(await this.redis.get(`${prefix}:dailyBudget`) || '1000')
    };
  }

  /**
   * Calculate merchant boost factor
   */
  calculateBoost(merchant: MerchantData): {
    boost: number;
    breakdown: Record<string, number>;
  } {
    let totalBoost = 1.0;
    const breakdown: Record<string, number> = {};

    // Inventory level boost (high stock = more coins to clear inventory)
    if (merchant.inventoryLevel >= DEFAULT_CONFIG.highInventoryThreshold) {
      const boost = DEFAULT_CONFIG.highInventoryBoost;
      totalBoost *= boost;
      breakdown.inventoryBoost = boost;
    } else if (merchant.inventoryLevel <= DEFAULT_CONFIG.lowInventoryThreshold) {
      const penalty = 0.8;
      totalBoost *= penalty;
      breakdown.inventoryBoost = penalty;
    } else {
      breakdown.inventoryBoost = 1.0;
    }

    // New merchant boost (need to establish track record)
    if (merchant.totalRedeems < DEFAULT_CONFIG.newMerchantThreshold) {
      const boost = DEFAULT_CONFIG.newMerchantBoost;
      totalBoost *= boost;
      breakdown.newMerchantBoost = boost;
    } else {
      breakdown.newMerchantBoost = 1.0;
    }

    // Rating adjustment (low rating = more coins to attract users)
    if (merchant.rating < DEFAULT_CONFIG.lowRatingThreshold) {
      const penalty = DEFAULT_CONFIG.lowRatingPenalty;
      totalBoost *= penalty;
      breakdown.ratingPenalty = penalty;
    } else if (merchant.rating >= DEFAULT_CONFIG.highRatingThreshold) {
      const discount = 0.95;
      totalBoost *= discount;
      breakdown.ratingDiscount = discount;
    } else {
      breakdown.ratingAdjustment = 1.0;
    }

    // Conversion rate adjustment (low conversion = need more incentive)
    if (merchant.conversionRate < 0.2) {
      const boost = 1.15;
      totalBoost *= boost;
      breakdown.conversionBoost = boost;
    } else {
      breakdown.conversionAdjustment = 1.0;
    }

    return {
      boost: totalBoost,
      breakdown
    };
  }

  /**
   * Get average daily redemptions
   */
  private async getAvgDailyRedeems(merchantId: string): Promise<number> {
    const key = `${REDIS_PREFIX}merchant:${merchantId}:dailyRedeems`;
    const data = await this.redis.lrange(key, 0, 6); // Last 7 days

    if (data.length === 0) return 0;

    const sum = data.reduce((acc, val) => acc + parseInt(val || '0'), 0);
    return sum / data.length;
  }

  /**
   * Cache merchant data
   */
  async cacheMerchantData(merchantId: string, data: Partial<MerchantData>): Promise<void> {
    const prefix = `${REDIS_PREFIX}merchant:${merchantId}`;
    const pipeline = this.redis.pipeline();

    if (data.inventoryLevel !== undefined) {
      pipeline.set(`${prefix}:inventory`, data.inventoryLevel.toString());
    }
    if (data.conversionRate !== undefined) {
      pipeline.set(`${prefix}:conversionRate`, data.conversionRate.toString());
    }
    if (data.rating !== undefined) {
      pipeline.set(`${prefix}:rating`, data.rating.toString());
    }
    if (data.totalRedeems !== undefined) {
      pipeline.set(`${prefix}:totalRedeems`, data.totalRedeems.toString());
    }
    if (data.campaignBudget !== undefined) {
      pipeline.set(`${prefix}:campaignBudget`, data.campaignBudget.toString());
    }
    if (data.dailyBudget !== undefined) {
      pipeline.set(`${prefix}:dailyBudget`, data.dailyBudget.toString());
    }

    await pipeline.exec();
  }
}

// ============================================
// USER ANALYZER
// ============================================

export class UserAnalyzer {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Get user data from Redis cache
   */
  async getUserData(userId: string, merchantId?: string): Promise<UserData> {
    const prefix = `${REDIS_PREFIX}user:${userId}`;

    const [
      lastActivity,
      lifetimeCoins,
      categoryHistory
    ] = await Promise.all([
      this.redis.get(`${prefix}:lastActivity`),
      this.redis.get(`${prefix}:lifetimeCoins`),
      this.redis.hgetall(`${prefix}:categoryHistory`)
    ]);

    // Calculate affinity to merchant category
    let affinity = 0.5;
    if (merchantId) {
      const merchantCategory = await this.redis.get(`${REDIS_PREFIX}merchant:${merchantId}:category`);
      if (merchantCategory && categoryHistory[merchantCategory]) {
        affinity = Math.min(1, parseFloat(categoryHistory[merchantCategory]) / 100);
      }
    }

    // Determine user stage
    let stage: 'NEW' | 'WARM' | 'HOT' = 'NEW';
    if (lastActivity) {
      const daysSinceActivity = (Date.now() - parseInt(lastActivity)) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= 7) stage = 'HOT';
      else if (daysSinceActivity <= 30) stage = 'WARM';
    }

    // Get recent scans
    const recentScans = await this.getRecentScans(userId);

    // Calculate past conversion rate
    const pastConversionRate = await this.calculatePastConversionRate(userId);

    return {
      affinity,
      stage,
      pastConversionRate,
      lifetimeCoins: parseInt(lifetimeCoins || '0'),
      recentScans,
      categoryHistory
    };
  }

  /**
   * Calculate user boost factor
   */
  calculateBoost(user: UserData): {
    boost: number;
    breakdown: Record<string, number>;
  } {
    let totalBoost = 1.0;
    const breakdown: Record<string, number> = {};

    // User stage boost (NEW users need more incentive)
    if (user.stage === 'NEW') {
      const boost = DEFAULT_CONFIG.newUserBoost;
      totalBoost *= boost;
      breakdown.stageBoost = boost;
    } else if (user.stage === 'HOT') {
      breakdown.stageBoost = 1.0;
    } else {
      breakdown.stageBoost = 1.0;
    }

    // Affinity adjustment (high affinity = less coins needed)
    if (user.affinity >= DEFAULT_CONFIG.highAffinityThreshold) {
      const discount = DEFAULT_CONFIG.highAffinityDiscount;
      totalBoost *= discount;
      breakdown.affinityDiscount = discount;
    } else if (user.affinity <= DEFAULT_CONFIG.lowAffinityThreshold) {
      const boost = 1.15;
      totalBoost *= boost;
      breakdown.affinityBoost = boost;
    } else {
      breakdown.affinityAdjustment = 1.0;
    }

    // Past conversion rate (high converter = less coins needed)
    if (user.pastConversionRate > 0.5) {
      const discount = 0.9;
      totalBoost *= discount;
      breakdown.conversionDiscount = discount;
    } else if (user.pastConversionRate < 0.2) {
      const boost = 1.2;
      totalBoost *= boost;
      breakdown.conversionBoost = boost;
    } else {
      breakdown.conversionAdjustment = 1.0;
    }

    // Fatigue check (too many recent scans = less coins)
    if (user.recentScans > 10) {
      const penalty = 0.85;
      totalBoost *= penalty;
      breakdown.fatiguePenalty = penalty;
    } else if (user.recentScans > 5) {
      const penalty = 0.95;
      totalBoost *= penalty;
      breakdown.fatiguePenalty = penalty;
    } else {
      breakdown.fatigueAdjustment = 1.0;
    }

    return {
      boost: totalBoost,
      breakdown
    };
  }

  /**
   * Get recent scan count
   */
  private async getRecentScans(userId: string): Promise<number> {
    const key = `${REDIS_PREFIX}user:${userId}:recentScans`;
    const scans = await this.redis.lrange(key, 0, -1);

    // Filter to last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return scans.filter(s => parseInt(s) > sevenDaysAgo).length;
  }

  /**
   * Calculate user's past conversion rate
   */
  private async calculatePastConversionRate(userId: string): Promise<number> {
    const offered = parseInt(
      await this.redis.get(`${REDIS_PREFIX}user:${userId}:coinsOffered`) || '0'
    );
    const redeemed = parseInt(
      await this.redis.get(`${REDIS_PREFIX}user:${userId}:coinsRedeemed`) || '0'
    );

    if (offered === 0) return 0.3; // Default for new users
    return redeemed / offered;
  }

  /**
   * Record coin allocation for analytics
   */
  async recordAllocation(
    userId: string,
    merchantId: string,
    amount: number,
    outcome: 'pending' | 'redeemed' | 'expired'
  ): Promise<void> {
    const key = `${REDIS_PREFIX}user:${userId}`;
    const today = new Date().toISOString().split('T')[0];

    // Update lifetime coins
    await this.redis.incrby(`${key}:lifetimeCoins`, amount);

    // Update category history
    const merchantCategory = await this.redis.get(
      `${REDIS_PREFIX}merchant:${merchantId}:category`
    );
    if (merchantCategory) {
      await this.redis.hincrbyfloat(
        `${key}:categoryHistory`,
        merchantCategory,
        amount / 10
      );
    }

    // Record recent scan
    await this.redis.lpush(`${key}:recentScans`, Date.now().toString());
    await this.redis.ltrim(`${key}:recentScans`, 0, 99);

    // Record daily stats
    await this.redis.hincrby(`${key}:daily:${today}`, 'offered', amount);

    // Track outcome
    const outcomeKey = `${key}:outcome:${outcome}`;
    await this.redis.hincrby(outcomeKey, today, 1);
  }
}

// ============================================
// MARKET ANALYZER
// ============================================

export class MarketAnalyzer {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Get current market conditions
   */
  getMarketConditions(location?: { lat: number; lng: number }): MarketConditions {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;
    const isPeakHour = this.isPeakHour(hour);

    return {
      hourOfDay: hour,
      dayOfWeek: day,
      nearbyCompetitors: 0, // Will be populated async if location provided
      isWeekend,
      isPeakHour
    };
  }

  /**
   * Calculate market boost factor
   */
  calculateBoost(conditions: MarketConditions): {
    boost: number;
    breakdown: Record<string, number>;
  } {
    let totalBoost = 1.0;
    const breakdown: Record<string, number> = {};

    // Time of day adjustment
    if (!conditions.isPeakHour) {
      const boost = DEFAULT_CONFIG.offPeakBoost;
      totalBoost *= boost;
      breakdown.offPeakBoost = boost;
    } else {
      breakdown.peakHourAdjustment = 1.0;
    }

    // Weekend boost
    if (conditions.isWeekend) {
      const boost = DEFAULT_CONFIG.weekendBoost;
      totalBoost *= boost;
      breakdown.weekendBoost = boost;
    } else {
      breakdown.weekendAdjustment = 1.0;
    }

    // Competition boost (more competition = need more coins to stand out)
    if (conditions.nearbyCompetitors >= 3) {
      const boost = DEFAULT_CONFIG.competitionBoost;
      totalBoost *= boost;
      breakdown.competitionBoost = boost;
    } else if (conditions.nearbyCompetitors > 0) {
      const boost = 1.1;
      totalBoost *= boost;
      breakdown.competitionBoost = boost;
    } else {
      breakdown.competitionAdjustment = 1.0;
    }

    // Lunch/dinner boost (meal times)
    const isMealTime = this.isMealTime(conditions.hourOfDay);
    if (isMealTime) {
      breakdown.mealTimeBoost = 1.1;
    }

    return {
      boost: totalBoost,
      breakdown
    };
  }

  /**
   * Find nearby competitors
   */
  async findNearbyCompetitors(
    merchantId: string,
    location?: { lat: number; lng: number }
  ): Promise<number> {
    if (!location) return 0;

    const merchantCategory = await this.redis.get(
      `${REDIS_PREFIX}merchant:${merchantId}:category`
    );

    if (!merchantCategory) return 0;

    // In production, this would query a spatial index
    // For now, we'll check a Redis set of nearby merchants
    const nearbyKey = `${REDIS_PREFIX}location:${location.lat.toFixed(2)}:${location.lng.toFixed(2)}:merchants`;
    const nearby = await this.redis.smembers(nearbyKey);

    // Filter to same category
    let count = 0;
    for (const nearbyId of nearby.slice(0, 10)) {
      const cat = await this.redis.get(`${REDIS_PREFIX}merchant:${nearbyId}:category`);
      if (cat === merchantCategory && nearbyId !== merchantId) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get time of day label
   */
  getTimeOfDayLabel(hour: number): string {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 14) return 'lunch';
    if (hour >= 14 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'dinner';
    return 'late-night';
  }

  private isPeakHour(hour: number): boolean {
    return (
      (hour >= DEFAULT_CONFIG.lunchStart && hour <= DEFAULT_CONFIG.lunchEnd) ||
      (hour >= DEFAULT_CONFIG.dinnerStart && hour <= DEFAULT_CONFIG.dinnerEnd)
    );
  }

  private isMealTime(hour: number): boolean {
    return (
      (hour >= 12 && hour <= 13) || // Lunch peak
      (hour >= 19 && hour <= 20)    // Dinner peak
    );
  }
}

// ============================================
// SMART COIN ALLOCATOR (MAIN ENGINE)
// ============================================

export class SmartCoinAllocator {
  private budgetManager: BudgetManager;
  private merchantAnalyzer: MerchantAnalyzer;
  private userAnalyzer: UserAnalyzer;
  private marketAnalyzer: MarketAnalyzer;
  private config: typeof DEFAULT_CONFIG;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.budgetManager = new BudgetManager(config);
    this.merchantAnalyzer = new MerchantAnalyzer();
    this.userAnalyzer = new UserAnalyzer();
    this.marketAnalyzer = new MarketAnalyzer();
  }

  /**
   * Main allocation function
   */
  async allocate(request: CoinAllocationRequest): Promise<CoinAllocationResponse> {
    const { userId, campaignId, merchantId, baseCoins, location } = request;

    // 1. Check if campaign is paused
    const pauseCheck = await this.budgetManager.isCampaignPaused(campaignId);
    if (pauseCheck.paused) {
      return this.createExhaustedResponse(
        `Campaign paused: ${pauseCheck.reason}`
      );
    }

    // 2. Get all data in parallel
    const [
      merchantData,
      userData,
      marketConditions
    ] = await Promise.all([
      this.merchantAnalyzer.getMerchantData(merchantId),
      this.userAnalyzer.getUserData(userId, merchantId),
      Promise.resolve(this.marketAnalyzer.getMarketConditions(location))
    ]);

    // Get nearby competitors async
    if (location) {
      marketConditions.nearbyCompetitors = await this.marketAnalyzer.findNearbyCompetitors(
        merchantId,
        location
      );
    }

    // 3. Calculate all boost factors
    const merchantBoost = this.merchantAnalyzer.calculateBoost(merchantData);
    const userBoost = this.userAnalyzer.calculateBoost(userData);
    const marketBoost = this.marketAnalyzer.calculateBoost(marketConditions);

    // 4. Calculate base coin amount
    const effectiveBase = baseCoins || this.config.defaultBaseCoins;

    // 5. Apply all boosts
    let coins = effectiveBase;
    coins *= merchantBoost.boost;
    coins *= userBoost.boost;
    coins *= marketBoost.boost;

    // 6. Check budget availability
    const budgetCheck = await this.budgetManager.checkBudget(campaignId, userId, Math.round(coins));

    if (!budgetCheck.allowed) {
      // If budget exhausted, return minimum coins
      if (budgetCheck.status === 'exhausted') {
        return this.createExhaustedResponse(budgetCheck.reason);
      }
      // If just low, cap at available
      coins = Math.min(coins, budgetCheck.availableBudget);
    }

    // 7. Apply min/max bounds
    coins = Math.round(coins);
    coins = Math.max(this.config.minCoins, Math.min(this.config.maxCoins, coins));

    // 8. Reserve budget
    await this.budgetManager.reserveBudget(campaignId, userId, coins);

    // 9. Record allocation for analytics
    await this.userAnalyzer.recordAllocation(userId, merchantId, coins, 'pending');

    // 10. Build breakdown
    const breakdown = {
      base: effectiveBase,
      userBoost: Math.round(effectiveBase * (userBoost.boost - 1) * 100) / 100,
      merchantBoost: Math.round(effectiveBase * (merchantBoost.boost - 1) * 100) / 100,
      marketBoost: Math.round(effectiveBase * (marketBoost.boost - 1) * 100) / 100
    };

    // 11. Generate reason
    const reason = this.generateReason(
      userData,
      merchantData,
      marketConditions,
      budgetCheck.status
    );

    return {
      coins,
      breakdown,
      reason,
      budgetStatus: budgetCheck.status
    };
  }

  /**
   * Recalculate allocation (e.g., when user context changes)
   */
  async recalculate(
    request: CoinAllocationRequest,
    originalCoins: number
  ): Promise<CoinAllocationResponse> {
    const newAllocation = await this.allocate(request);

    // If new allocation is different, release old budget and reserve new
    if (newAllocation.coins !== originalCoins) {
      await this.budgetManager.releaseBudget(
        request.campaignId,
        request.userId,
        originalCoins
      );
      await this.budgetManager.reserveBudget(
        request.campaignId,
        request.userId,
        newAllocation.coins
      );
    }

    return newAllocation;
  }

  /**
   * Validate allocation before finalizing
   */
  async validate(request: CoinAllocationRequest): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!request.userId) errors.push('userId is required');
    if (!request.campaignId) errors.push('campaignId is required');
    if (!request.merchantId) errors.push('merchantId is required');

    // Check budget
    const budgetCheck = await this.budgetManager.checkBudget(
      request.campaignId,
      request.userId,
      request.baseCoins
    );

    if (!budgetCheck.allowed) {
      errors.push(budgetCheck.reason);
    } else if (budgetCheck.status === 'low') {
      warnings.push('Budget running low');
    }

    // Check campaign pause status
    const pauseCheck = await this.budgetManager.isCampaignPaused(request.campaignId);
    if (pauseCheck.paused) {
      errors.push(`Campaign is paused: ${pauseCheck.reason}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(campaignId: string): Promise<{
    status: 'ok' | 'low' | 'exhausted';
    dailySpent: number;
    dailyLimit: number;
    percentageRemaining: number;
  }> {
    const status = await this.budgetManager.getCampaignBudgetStatus(campaignId);

    let overallStatus: 'ok' | 'low' | 'exhausted' = 'ok';
    if (status.percentageRemaining < 0.1) {
      overallStatus = 'exhausted';
    } else if (status.percentageRemaining < this.config.budgetLowThreshold) {
      overallStatus = 'low';
    }

    return {
      status: overallStatus,
      ...status
    };
  }

  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId: string, reason: string): Promise<void> {
    await this.budgetManager.pauseCampaign(campaignId, reason);
  }

  private createExhaustedResponse(reason: string): CoinAllocationResponse {
    return {
      coins: 0,
      breakdown: {
        base: 0,
        userBoost: 0,
        merchantBoost: 0,
        marketBoost: 0
      },
      reason,
      budgetStatus: 'exhausted'
    };
  }

  private generateReason(
    user: UserData,
    merchant: MerchantData,
    market: MarketConditions,
    budgetStatus: 'ok' | 'low' | 'exhausted'
  ): string {
    const parts: string[] = [];

    // User factors
    if (user.stage === 'NEW') {
      parts.push('NEW user boost');
    }
    if (user.affinity >= 0.7) {
      parts.push('High affinity');
    } else if (user.affinity <= 0.3) {
      parts.push('Low affinity - incentive');
    }

    // Merchant factors
    if (merchant.totalRedeems < DEFAULT_CONFIG.newMerchantThreshold) {
      parts.push('New merchant');
    }
    if (merchant.inventoryLevel >= 0.7) {
      parts.push('High inventory');
    }
    if (merchant.rating < 3.0) {
      parts.push('Low rating - boost');
    }

    // Market factors
    if (!market.isPeakHour) {
      parts.push('Off-peak');
    }
    if (market.isWeekend) {
      parts.push('Weekend');
    }
    if (market.nearbyCompetitors >= 3) {
      parts.push('High competition');
    }

    // Budget
    if (budgetStatus === 'low') {
      parts.push('Budget low');
    } else if (budgetStatus === 'exhausted') {
      parts.push('Budget exhausted');
    }

    return parts.length > 0 ? parts.join(', ') : 'Standard allocation';
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function allocateCoins(
  request: CoinAllocationRequest
): Promise<CoinAllocationResponse> {
  const allocator = new SmartCoinAllocator();
  return allocator.allocate(request);
}

export async function getCoinAllocationBreakdown(
  request: CoinAllocationRequest
): Promise<{
  merchantBoost: ReturnType<MerchantAnalyzer['calculateBoost']>;
  userBoost: ReturnType<UserAnalyzer['calculateBoost']>;
  marketBoost: ReturnType<MarketAnalyzer['calculateBoost']>;
  estimatedCoins: number;
}> {
  const merchantAnalyzer = new MerchantAnalyzer();
  const userAnalyzer = new UserAnalyzer();
  const marketAnalyzer = new MarketAnalyzer();

  const [merchantData, userData, marketConditions] = await Promise.all([
    merchantAnalyzer.getMerchantData(request.merchantId),
    userAnalyzer.getUserData(request.userId, request.merchantId),
    Promise.resolve(marketAnalyzer.getMarketConditions(request.location))
  ]);

  if (request.location) {
    marketConditions.nearbyCompetitors = await marketAnalyzer.findNearbyCompetitors(
      request.merchantId,
      request.location
    );
  }

  const merchantBoost = merchantAnalyzer.calculateBoost(merchantData);
  const userBoost = userAnalyzer.calculateBoost(userData);
  const marketBoost = marketAnalyzer.calculateBoost(marketConditions);

  const base = request.baseCoins || 20;
  const estimatedCoins = Math.round(base * merchantBoost.boost * userBoost.boost * marketBoost.boost);

  return {
    merchantBoost,
    userBoost,
    marketBoost,
    estimatedCoins: Math.max(5, Math.min(500, estimatedCoins))
  };
}

export async function getUserCoinStats(userId: string): Promise<{
  lifetimeCoins: number;
  recentScans: number;
  stage: 'NEW' | 'WARM' | 'HOT';
  avgAllocation: number;
}> {
  const userAnalyzer = new UserAnalyzer();
  const data = await userAnalyzer.getUserData(userId);

  // Get historical allocations
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const today = new Date().toISOString().split('T')[0];
  const dailyData = await redis.hgetall(`${REDIS_PREFIX}user:${userId}:daily:${today}`);

  let totalOffered = 0;
  let daysWithData = 0;

  // Calculate average (simplified)
  const offered = parseInt(dailyData?.offered || '0');
  if (offered > 0) {
    totalOffered = offered;
    daysWithData = 1;
  }

  return {
    lifetimeCoins: data.lifetimeCoins,
    recentScans: data.recentScans,
    stage: data.stage,
    avgAllocation: daysWithData > 0 ? totalOffered / daysWithData : 20
  };
}
