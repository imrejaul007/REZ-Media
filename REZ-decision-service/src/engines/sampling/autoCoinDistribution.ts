/**
 * AUTO COIN DISTRIBUTION ENGINE - Phase 4
 * Smart branded coin distribution connected to AdsQr scanning
 *
 * Features:
 * - Trigger-Based Distribution (inventory, new merchant, dormant customers)
 * - Segment-Based Distribution (new users, VIP, referrals)
 * - Time-Based Distribution (lunch, dinner, weekend boosts)
 * - Inventory-Linked Distribution (excess stock, expiry, slow days)
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// CONSTANTS
// ============================================

const REDIS_PREFIX = 'autocoin:';
const RULES_PREFIX = 'rules:';
const EVENTS_PREFIX = 'events:';

// Time windows (24-hour format)
const TIME_WINDOWS = {
  LUNCH_START: 11,
  LUNCH_END: 14,
  DINNER_START: 18,
  DINNER_END: 22,
};

// Boost multipliers
const BOOST_MULTIPLIERS = {
  HIGH_INVENTORY: 1.5,
  NEW_MERCHANT: 1.4,
  DORMANT_CUSTOMER: 1.6,
  NEW_USER: 1.35,
  VIP_USER: 1.45,
  REFERRAL_BONUS: 1.3,
  LUNCH_BOOST: 1.25,
  DINNER_BOOST: 1.35,
  WEEKEND_BOOST: 1.2,
  EXCESS_STOCK: 1.4,
  NEAR_EXPIRY: 1.5,
  SLOW_DAY: 1.25,
};

// ============================================
// INTERFACES
// ============================================

export interface DistributionRule {
  id: string;
  type: 'inventory' | 'segment' | 'time' | 'campaign';
  merchantId?: string;
  condition: DistributionCondition;
  coinBoost: number; // Extra coins
  priority: number;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionCondition {
  // Inventory conditions
  inventoryLevel?: { min?: number; max?: number };
  daysInStock?: { min?: number; max?: number };
  expiryDays?: { min?: number; max?: number };

  // Segment conditions
  userSegment?: ('new' | 'vip' | 'referral' | 'dormant')[];
  lifetimeValue?: { min?: number; max?: number };
  lastActivityDays?: { min?: number; max?: number };

  // Time conditions
  hourOfDay?: { start: number; end: number };
  dayOfWeek?: number[]; // 0-6, Sunday = 0

  // Campaign conditions
  campaignType?: string[];
  conversionRate?: { min?: number; max?: number };
}

export interface DistributionEvent {
  userId: string;
  merchantId: string;
  baseCoins: number;
  boostedCoins: number;
  triggers: string[]; // What triggered boost
  timestamp: Date;
  ruleIds: string[];
  breakdown: CoinBreakdown;
}

export interface CoinBreakdown {
  base: number;
  inventoryBoost: number;
  segmentBoost: number;
  timeBoost: number;
  campaignBoost: number;
  totalMultiplier: number;
}

export interface DistributionContext {
  userId: string;
  merchantId: string;
  campaignId?: string;
  scanId?: string;
  location?: { lat: number; lng: number };
  time?: Date;
}

export interface DistributionResult {
  coins: number;
  breakdown: CoinBreakdown;
  triggers: string[];
  applicableRules: string[];
  expiresAt: Date;
  message: string;
}

export interface MerchantInventory {
  merchantId: string;
  inventoryLevel: number; // 0-1 (0 = empty, 1 = full)
  daysInStock: number;
  category: string;
  totalRedeems: number;
  avgDailyRedeems: number;
  conversionRate: number;
  lastRestockDate?: Date;
}

export interface UserSegment {
  userId: string;
  segments: ('new' | 'vip' | 'referral' | 'dormant' | 'regular')[];
  lifetimeValue: number;
  lastActivityDate?: Date;
  referralCount: number;
  totalScans: number;
}

export interface TimeConditions {
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isLunchTime: boolean;
  isDinnerTime: boolean;
  isHoliday: boolean;
}

// ============================================
// RULE ENGINE
// ============================================

export class DistributionRuleEngine {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Create a new distribution rule
   */
  async createRule(rule: Omit<DistributionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<DistributionRule> {
    const newRule: DistributionRule = {
      ...rule,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const key = `${RULES_PREFIX}${newRule.id}`;
    await this.redis.set(key, JSON.stringify(newRule));

    // Index by type for efficient lookup
    await this.redis.sadd(`${RULES_PREFIX}type:${newRule.type}`, newRule.id);
    if (newRule.merchantId) {
      await this.redis.sadd(`${RULES_PREFIX}merchant:${newRule.merchantId}`, newRule.id);
    }

    return newRule;
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: string): Promise<DistributionRule | null> {
    const data = await this.redis.get(`${RULES_PREFIX}${ruleId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update rule
   */
  async updateRule(ruleId: string, updates: Partial<DistributionRule>): Promise<DistributionRule | null> {
    const existing = await this.getRule(ruleId);
    if (!existing) return null;

    const updated: DistributionRule = {
      ...existing,
      ...updates,
      id: ruleId,
      updatedAt: new Date(),
    };

    await this.redis.set(`${RULES_PREFIX}${ruleId}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * Delete rule
   */
  async deleteRule(ruleId: string): Promise<boolean> {
    const rule = await this.getRule(ruleId);
    if (!rule) return false;

    await this.redis.del(`${RULES_PREFIX}${ruleId}`);
    await this.redis.srem(`${RULES_PREFIX}type:${rule.type}`, ruleId);
    if (rule.merchantId) {
      await this.redis.srem(`${RULES_PREFIX}merchant:${rule.merchantId}`, ruleId);
    }

    return true;
  }

  /**
   * Get all active rules
   */
  async getActiveRules(type?: DistributionRule['type']): Promise<DistributionRule[]> {
    const ruleIds = type
      ? await this.redis.smembers(`${RULES_PREFIX}type:${type}`)
      : await this.redis.keys(`${RULES_PREFIX}*.id`).catch(() => []);

    const rules: DistributionRule[] = [];
    for (const id of ruleIds) {
      const rule = await this.getRule(id);
      if (rule && rule.active) {
        rules.push(rule);
      }
    }

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get rules for a specific merchant
   */
  async getMerchantRules(merchantId: string): Promise<DistributionRule[]> {
    const ruleIds = await this.redis.smembers(`${RULES_PREFIX}merchant:${merchantId}`);
    const rules: DistributionRule[] = [];

    for (const id of ruleIds) {
      const rule = await this.getRule(id);
      if (rule && rule.active) {
        rules.push(rule);
      }
    }

    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate rules against context
   */
  async evaluateRules(
    context: DistributionContext,
    inventory: MerchantInventory,
    userSegment: UserSegment,
    time: TimeConditions
  ): Promise<{ matchingRules: DistributionRule[]; triggerReasons: string[] }> {
    const allRules = await this.getActiveRules();
    const merchantRules = context.merchantId
      ? await this.getMerchantRules(context.merchantId)
      : [];
    const rules = [...merchantRules, ...allRules.filter(r => !r.merchantId)];

    const matchingRules: DistributionRule[] = [];
    const triggerReasons: string[] = [];

    for (const rule of rules) {
      const isMatch = this.evaluateCondition(rule.condition, context, inventory, userSegment, time);
      if (isMatch) {
        matchingRules.push(rule);
        triggerReasons.push(this.getTriggerReason(rule));
      }
    }

    return { matchingRules, triggerReasons };
  }

  /**
   * Evaluate single condition
   */
  private evaluateCondition(
    condition: DistributionCondition,
    context: DistributionContext,
    inventory: MerchantInventory,
    userSegment: UserSegment,
    time: TimeConditions
  ): boolean {
    // Inventory conditions
    if (condition.inventoryLevel) {
      const { min = 0, max = 1 } = condition.inventoryLevel;
      if (inventory.inventoryLevel < min || inventory.inventoryLevel > max) return false;
    }

    if (condition.daysInStock) {
      const { min = 0, max = 999 } = condition.daysInStock;
      if (inventory.daysInStock < min || inventory.daysInStock > max) return false;
    }

    if (condition.expiryDays) {
      const { min = 0, max = 999 } = condition.expiryDays;
      if (inventory.daysInStock < min || inventory.daysInStock > max) return false;
    }

    // Segment conditions
    if (condition.userSegment && condition.userSegment.length > 0) {
      const hasSegment = condition.userSegment.some(s => userSegment.segments.includes(s));
      if (!hasSegment) return false;
    }

    if (condition.lifetimeValue) {
      const { min = 0, max = Infinity } = condition.lifetimeValue;
      if (userSegment.lifetimeValue < min || userSegment.lifetimeValue > max) return false;
    }

    if (condition.lastActivityDays !== undefined) {
      const { min = 0, max = Infinity } = condition.lastActivityDays;
      if (!userSegment.lastActivityDate) return false;
      const daysSinceActivity = (Date.now() - userSegment.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity < min || daysSinceActivity > max) return false;
    }

    // Time conditions
    if (condition.hourOfDay) {
      const { start, end } = condition.hourOfDay;
      if (time.hour < start || time.hour > end) return false;
    }

    if (condition.dayOfWeek && condition.dayOfWeek.length > 0) {
      if (!condition.dayOfWeek.includes(time.dayOfWeek)) return false;
    }

    // Campaign conditions
    if (condition.campaignType && context.campaignId) {
      // Would check campaign type in real implementation
    }

    return true;
  }

  private getTriggerReason(rule: DistributionRule): string {
    switch (rule.type) {
      case 'inventory':
        return `Inventory boost: ${rule.coinBoost} coins`;
      case 'segment':
        return `Segment boost: ${rule.coinBoost} coins`;
      case 'time':
        return `Time boost: ${rule.coinBoost} coins`;
      case 'campaign':
        return `Campaign boost: ${rule.coinBoost} coins`;
      default:
        return `Rule ${rule.id}: ${rule.coinBoost} coins`;
    }
  }
}

// ============================================
// TRIGGER ENGINE
// ============================================

export class TriggerEngine {
  /**
   * Detect all applicable triggers for context
   */
  async detectTriggers(
    context: DistributionContext,
    inventory: MerchantInventory,
    userSegment: UserSegment,
    time: TimeConditions
  ): Promise<{ triggers: string[]; totalBoost: number }> {
    const triggers: string[] = [];
    let totalBoost = 0;

    // 1. INVENTORY TRIGGERS
    const inventoryTriggers = this.detectInventoryTriggers(inventory);
    triggers.push(...inventoryTriggers.triggers);
    totalBoost += inventoryTriggers.boost;

    // 2. SEGMENT TRIGGERS
    const segmentTriggers = this.detectSegmentTriggers(userSegment);
    triggers.push(...segmentTriggers.triggers);
    totalBoost += segmentTriggers.boost;

    // 3. TIME TRIGGERS
    const timeTriggers = this.detectTimeTriggers(time);
    triggers.push(...timeTriggers.triggers);
    totalBoost += timeTriggers.boost;

    return { triggers, totalBoost };
  }

  /**
   * Detect inventory-based triggers
   */
  private detectInventoryTriggers(inventory: MerchantInventory): { triggers: string[]; boost: number } {
    const triggers: string[] = [];
    let boost = 0;

    // High inventory boost
    if (inventory.inventoryLevel >= 0.8) {
      triggers.push('HIGH_INVENTORY');
      boost += BOOST_MULTIPLIERS.HIGH_INVENTORY - 1;
    }

    // New merchant welcome bonus
    if (inventory.totalRedeems < 10) {
      triggers.push('NEW_MERCHANT');
      boost += BOOST_MULTIPLIERS.NEW_MERCHANT - 1;
    }

    // Near expiry / slow moving stock (7+ days in stock)
    if (inventory.daysInStock >= 7) {
      triggers.push('NEAR_EXPIRY');
      boost += BOOST_MULTIPLIERS.NEAR_EXPIRY - 1;
    }

    // Excess stock (inventory > 70%)
    if (inventory.inventoryLevel >= 0.7 && inventory.inventoryLevel < 0.8) {
      triggers.push('EXCESS_STOCK');
      boost += BOOST_MULTIPLIERS.EXCESS_STOCK - 1;
    }

    // Slow day detection (below average daily redeems)
    if (inventory.avgDailyRedeems > 0 && inventory.conversionRate < 0.3) {
      triggers.push('SLOW_DAY');
      boost += BOOST_MULTIPLIERS.SLOW_DAY - 1;
    }

    return { triggers, boost };
  }

  /**
   * Detect segment-based triggers
   */
  private detectSegmentTriggers(user: UserSegment): { triggers: string[]; boost: number } {
    const triggers: string[] = [];
    let boost = 0;

    // New user bonus
    if (user.segments.includes('new')) {
      triggers.push('NEW_USER');
      boost += BOOST_MULTIPLIERS.NEW_USER - 1;
    }

    // VIP user exclusive bonus
    if (user.segments.includes('vip')) {
      triggers.push('VIP_USER');
      boost += BOOST_MULTIPLIERS.VIP_USER - 1;
    }

    // Referral reward
    if (user.referralCount > 0) {
      triggers.push('REFERRAL_ACTIVE');
      boost += (BOOST_MULTIPLIERS.REFERRAL_BONUS - 1) * Math.min(user.referralCount, 3);
    }

    // Dormant customer reactivation
    if (user.segments.includes('dormant')) {
      triggers.push('DORMANT_CUSTOMER');
      boost += BOOST_MULTIPLIERS.DORMANT_CUSTOMER - 1;
    }

    return { triggers, boost };
  }

  /**
   * Detect time-based triggers
   */
  private detectTimeTriggers(time: TimeConditions): { triggers: string[]; boost: number } {
    const triggers: string[] = [];
    let boost = 0;

    // Lunch boost (11 AM - 2 PM)
    if (time.isLunchTime) {
      triggers.push('LUNCH_BOOST');
      boost += BOOST_MULTIPLIERS.LUNCH_BOOST - 1;
    }

    // Dinner boost (6 PM - 10 PM)
    if (time.isDinnerTime) {
      triggers.push('DINNER_BOOST');
      boost += BOOST_MULTIPLIERS.DINNER_BOOST - 1;
    }

    // Weekend bonus
    if (time.isWeekend) {
      triggers.push('WEEKEND_BONUS');
      boost += BOOST_MULTIPLIERS.WEEKEND_BOOST - 1;
    }

    // Holiday boost
    if (time.isHoliday) {
      triggers.push('HOLIDAY_BOOST');
      boost += 0.3; // 30% additional boost
    }

    return { triggers, boost };
  }
}

// ============================================
// DATA PROVIDERS
// ============================================

export class MerchantDataProvider {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Get merchant inventory data
   */
  async getMerchantInventory(merchantId: string): Promise<MerchantInventory> {
    const prefix = `${REDIS_PREFIX}merchant:${merchantId}`;

    const [
      inventoryLevel,
      daysInStock,
      category,
      totalRedeems,
      avgDailyRedeems,
      conversionRate,
      lastRestock
    ] = await Promise.all([
      this.redis.get(`${prefix}:inventoryLevel`),
      this.redis.get(`${prefix}:daysInStock`),
      this.redis.get(`${prefix}:category`),
      this.redis.get(`${prefix}:totalRedeems`),
      this.redis.get(`${prefix}:avgDailyRedeems`),
      this.redis.get(`${prefix}:conversionRate`),
      this.redis.get(`${prefix}:lastRestockDate`),
    ]);

    return {
      merchantId,
      inventoryLevel: parseFloat(inventoryLevel || '0.5'),
      daysInStock: parseInt(daysInStock || '0'),
      category: category || 'general',
      totalRedeems: parseInt(totalRedeems || '0'),
      avgDailyRedeems: parseFloat(avgDailyRedeems || '0'),
      conversionRate: parseFloat(conversionRate || '0.3'),
      lastRestockDate: lastRestock ? new Date(lastRestock) : undefined,
    };
  }

  /**
   * Update merchant inventory
   */
  async updateMerchantInventory(merchantId: string, data: Partial<MerchantInventory>): Promise<void> {
    const prefix = `${REDIS_PREFIX}merchant:${merchantId}`;
    const pipeline = this.redis.pipeline();

    if (data.inventoryLevel !== undefined) {
      pipeline.set(`${prefix}:inventoryLevel`, data.inventoryLevel.toString());
    }
    if (data.daysInStock !== undefined) {
      pipeline.set(`${prefix}:daysInStock`, data.daysInStock.toString());
    }
    if (data.category !== undefined) {
      pipeline.set(`${prefix}:category`, data.category);
    }
    if (data.totalRedeems !== undefined) {
      pipeline.set(`${prefix}:totalRedeems`, data.totalRedeems.toString());
    }
    if (data.avgDailyRedeems !== undefined) {
      pipeline.set(`${prefix}:avgDailyRedeems`, data.avgDailyRedeems.toString());
    }
    if (data.conversionRate !== undefined) {
      pipeline.set(`${prefix}:conversionRate`, data.conversionRate.toString());
    }
    if (data.lastRestockDate !== undefined) {
      pipeline.set(`${prefix}:lastRestockDate`, data.lastRestockDate.toISOString());
    }

    await pipeline.exec();
  }

  /**
   * Record a redemption and update inventory
   */
  async recordRedemption(merchantId: string, coinsUsed: number): Promise<void> {
    const inventory = await this.getMerchantInventory(merchantId);

    // Decrease inventory level (simplified model)
    const newLevel = Math.max(0, inventory.inventoryLevel - (coinsUsed / 1000));
    const newRedeems = inventory.totalRedeems + 1;

    await this.updateMerchantInventory(merchantId, {
      inventoryLevel: newLevel,
      totalRedeems: newRedeems,
    });

    // Update daily redeems
    const today = new Date().toISOString().split('T')[0];
    await this.redis.hincrby(`${REDIS_PREFIX}merchant:${merchantId}:dailyRedeems`, today, 1);
  }
}

export class UserDataProvider {
  private redis: Redis;

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || redis;
  }

  /**
   * Get user segment data
   */
  async getUserSegment(userId: string): Promise<UserSegment> {
    const prefix = `${REDIS_PREFIX}user:${userId}`;

    const [
      lifetimeValue,
      lastActivity,
      referralCount,
      totalScans,
      segments
    ] = await Promise.all([
      this.redis.get(`${prefix}:lifetimeValue`),
      this.redis.get(`${prefix}:lastActivityDate`),
      this.redis.get(`${prefix}:referralCount`),
      this.redis.get(`${prefix}:totalScans`),
      this.redis.smembers(`${prefix}:segments`),
    ]);

    const ltv = parseFloat(lifetimeValue || '0');
    const segmentsList = segments.length > 0
      ? segments as ('new' | 'vip' | 'referral' | 'dormant' | 'regular')[]
      : this.deriveSegments(ltv, lastActivity, parseInt(totalScans || '0'));

    return {
      userId,
      segments: segmentsList,
      lifetimeValue: ltv,
      lastActivityDate: lastActivity ? new Date(lastActivity) : undefined,
      referralCount: parseInt(referralCount || '0'),
      totalScans: parseInt(totalScans || '0'),
    };
  }

  /**
   * Derive segments from user data
   */
  private deriveSegments(ltv: number, lastActivity?: string, totalScans?: number): UserSegment['segments'] {
    const segments: UserSegment['segments'] = [];

    // New user (less than 7 days, few scans)
    if (totalScans !== undefined && totalScans < 5) {
      segments.push('new');
    }

    // VIP (high lifetime value)
    if (ltv >= 1000) {
      segments.push('vip');
    }

    // Dormant (inactive for 30+ days)
    if (lastActivity) {
      const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 30) {
        segments.push('dormant');
      }
    }

    if (segments.length === 0) {
      segments.push('regular');
    }

    return segments;
  }

  /**
   * Update user segment
   */
  async updateUserSegment(userId: string, segments: UserSegment['segments']): Promise<void> {
    const prefix = `${REDIS_PREFIX}user:${userId}`;

    // Clear existing segments
    const existing = await this.redis.smembers(`${prefix}:segments`);
    if (existing.length > 0) {
      await this.redis.srem(`${prefix}:segments`, ...existing);
    }

    // Add new segments
    if (segments.length > 0) {
      await this.redis.sadd(`${prefix}:segments`, ...segments);
    }

    // Update last activity
    await this.redis.set(`${prefix}:lastActivityDate`, new Date().toISOString());
  }

  /**
   * Record scan activity
   */
  async recordScan(userId: string, coinsEarned: number): Promise<void> {
    const prefix = `${REDIS_PREFIX}user:${userId}`;

    await Promise.all([
      this.redis.incrbyfloat(`${prefix}:lifetimeValue`, coinsEarned),
      this.redis.set(`${prefix}:lastActivityDate`, new Date().toISOString()),
      this.redis.incr(`${prefix}:totalScans`),
    ]);
  }
}

export class TimeProvider {
  /**
   * Get current time conditions
   */
  getTimeConditions(time?: Date): TimeConditions {
    const now = time || new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    return {
      hour,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isLunchTime: hour >= TIME_WINDOWS.LUNCH_START && hour < TIME_WINDOWS.LUNCH_END,
      isDinnerTime: hour >= TIME_WINDOWS.DINNER_START && hour < TIME_WINDOWS.DINNER_END,
      isHoliday: this.isHoliday(now),
    };
  }

  /**
   * Check if date is a holiday
   */
  private isHoliday(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    const holidays: Record<string, { month: number; day: number }> = {
      new_year: { month: 0, day: 1 },
      easter: { month: 2, day: -1 }, // Variable, would need calculation
      ramadan_eid: { month: 4, day: -1 },
      eid_adha: { month: 6, day: -1 },
      christmas: { month: 11, day: 25 },
      national_day: { month: 11, day: 16 },
    };

    // Simplified check - in production would have proper holiday calendar
    return Object.values(holidays).some(h => h.month === month && h.day === day);
  }
}

// ============================================
// MAIN DISTRIBUTION ENGINE
// ============================================

export class AutoCoinDistributionEngine {
  private ruleEngine: DistributionRuleEngine;
  private triggerEngine: TriggerEngine;
  private merchantData: MerchantDataProvider;
  private userData: UserDataProvider;
  private timeProvider: TimeProvider;

  // Configuration
  private config: {
    minCoins: number;
    maxCoins: number;
    baseCoins: number;
    boostCap: number;
    expiryMinutes: number;
  };

  constructor(config?: Partial<AutoCoinDistributionEngine['config']>) {
    this.ruleEngine = new DistributionRuleEngine();
    this.triggerEngine = new TriggerEngine();
    this.merchantData = new MerchantDataProvider();
    this.userData = new UserDataProvider();
    this.timeProvider = new TimeProvider();

    this.config = {
      minCoins: 5,
      maxCoins: 500,
      baseCoins: 20,
      boostCap: 3.0, // Max 3x multiplier
      expiryMinutes: 30,
      ...config,
    };
  }

  /**
   * Main entry point: Calculate coin distribution for a scan
   */
  async distribute(context: DistributionContext): Promise<DistributionResult> {
    const time = context.time || new Date();
    const timeConditions = this.timeProvider.getTimeConditions(time);

    // Get merchant inventory data
    const inventory = await this.merchantData.getMerchantInventory(context.merchantId);

    // Get user segment data
    const userSegment = await this.userData.getUserSegment(context.userId);

    // Detect all applicable triggers
    const { triggers, totalBoost } = await this.triggerEngine.detectTriggers(
      context,
      inventory,
      userSegment,
      timeConditions
    );

    // Evaluate custom rules
    const { matchingRules, triggerReasons } = await this.ruleEngine.evaluateRules(
      context,
      inventory,
      userSegment,
      timeConditions
    );

    // Calculate final multiplier (capped)
    const ruleBoost = matchingRules.reduce((sum, rule) => sum + rule.coinBoost / 100, 0);
    const totalMultiplier = Math.min(this.config.boostCap, 1 + totalBoost + ruleBoost);

    // Calculate coin breakdown
    const breakdown: CoinBreakdown = {
      base: this.config.baseCoins,
      inventoryBoost: Math.round(this.config.baseCoins * (totalBoost / (1 + totalBoost)) * 100) / 100,
      segmentBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.4) * 100) / 100,
      timeBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.3) * 100) / 100,
      campaignBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.3) * 100) / 100,
      totalMultiplier,
    };

    // Calculate final coins
    let coins = Math.round(this.config.baseCoins * totalMultiplier);
    coins += matchingRules.reduce((sum, rule) => sum + rule.coinBoost, 0);
    coins = Math.max(this.config.minCoins, Math.min(this.config.maxCoins, coins));

    // Calculate expiry
    const expiresAt = new Date(time.getTime() + this.config.expiryMinutes * 60 * 1000);

    // Generate message
    const message = this.generateMessage(triggers, matchingRules);

    // Record the distribution event
    await this.recordDistribution({
      userId: context.userId,
      merchantId: context.merchantId,
      baseCoins: this.config.baseCoins,
      boostedCoins: coins,
      triggers: [...triggers, ...triggerReasons],
      timestamp: time,
      ruleIds: matchingRules.map(r => r.id),
      breakdown,
    });

    return {
      coins,
      breakdown,
      triggers: [...triggers, ...triggerReasons],
      applicableRules: matchingRules.map(r => r.id),
      expiresAt,
      message,
    };
  }

  /**
   * Preview distribution without recording
   */
  async preview(context: DistributionContext): Promise<DistributionResult> {
    const time = context.time || new Date();
    const timeConditions = this.timeProvider.getTimeConditions(time);

    const inventory = await this.merchantData.getMerchantInventory(context.merchantId);
    const userSegment = await this.userData.getUserSegment(context.userId);

    const { triggers, totalBoost } = await this.triggerEngine.detectTriggers(
      context,
      inventory,
      userSegment,
      timeConditions
    );

    const { matchingRules, triggerReasons } = await this.ruleEngine.evaluateRules(
      context,
      inventory,
      userSegment,
      timeConditions
    );

    const ruleBoost = matchingRules.reduce((sum, rule) => sum + rule.coinBoost / 100, 0);
    const totalMultiplier = Math.min(this.config.boostCap, 1 + totalBoost + ruleBoost);

    const breakdown: CoinBreakdown = {
      base: this.config.baseCoins,
      inventoryBoost: Math.round(this.config.baseCoins * (totalBoost / (1 + totalBoost)) * 100) / 100,
      segmentBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.4) * 100) / 100,
      timeBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.3) * 100) / 100,
      campaignBoost: Math.round(this.config.baseCoins * (ruleBoost * 0.3) * 100) / 100,
      totalMultiplier,
    };

    let coins = Math.round(this.config.baseCoins * totalMultiplier);
    coins += matchingRules.reduce((sum, rule) => sum + rule.coinBoost, 0);
    coins = Math.max(this.config.minCoins, Math.min(this.config.maxCoins, coins));

    const expiresAt = new Date(time.getTime() + this.config.expiryMinutes * 60 * 1000);
    const message = this.generateMessage(triggers, matchingRules);

    return {
      coins,
      breakdown,
      triggers: [...triggers, ...triggerReasons],
      applicableRules: matchingRules.map(r => r.id),
      expiresAt,
      message,
    };
  }

  /**
   * Record distribution event for analytics
   */
  private async recordDistribution(event: DistributionEvent): Promise<void> {
    const eventId = uuidv4();
    const key = `${EVENTS_PREFIX}${eventId}`;

    await redis.set(key, JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString(),
    }));

    // Index by user for quick lookup
    await redis.zadd(
      `${EVENTS_PREFIX}user:${event.userId}`,
      event.timestamp.getTime(),
      eventId
    );

    // Index by merchant
    await redis.zadd(
      `${EVENTS_PREFIX}merchant:${event.merchantId}`,
      event.timestamp.getTime(),
      eventId
    );

    // Track active triggers for analytics
    for (const trigger of event.triggers) {
      const triggerKey = `${EVENTS_PREFIX}trigger:${trigger}:${new Date().toISOString().split('T')[0]}`;
      await redis.hincrby(triggerKey, 'count', 1);
      await redis.hincrby(triggerKey, 'coins', event.boostedCoins);
      await redis.expire(triggerKey, 86400 * 7); // 7 days TTL
    }

    // Update user data
    await this.userData.recordScan(event.userId, event.boostedCoins);

    // Update merchant inventory
    await this.merchantData.recordRedemption(event.merchantId, event.boostedCoins);
  }

  /**
   * Get distribution history for a user
   */
  async getUserDistributionHistory(
    userId: string,
    limit = 20
  ): Promise<DistributionEvent[]> {
    const eventIds = await redis.zrevrange(`${EVENTS_PREFIX}user:${userId}`, 0, limit - 1);
    const events: DistributionEvent[] = [];

    for (const eventId of eventIds) {
      const data = await redis.get(`${EVENTS_PREFIX}${eventId}`);
      if (data) {
        const parsed = JSON.parse(data);
        events.push({
          ...parsed,
          timestamp: new Date(parsed.timestamp),
        });
      }
    }

    return events;
  }

  /**
   * Get trigger analytics for a day
   */
  async getTriggerAnalytics(date?: string): Promise<Record<string, { count: number; coins: number }>> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const triggerKey = `${EVENTS_PREFIX}trigger:*:${targetDate}`;
    const keys = await redis.keys(triggerKey);

    const analytics: Record<string, { count: number; coins: number }> = {};

    for (const key of keys) {
      const data = await redis.hgetall(key);
      const triggerName = key.split(':')[2];
      analytics[triggerName] = {
        count: parseInt(data.count || '0'),
        coins: parseInt(data.coins || '0'),
      };
    }

    return analytics;
  }

  /**
   * Generate human-readable message
   */
  private generateMessage(triggers: string[], rules: DistributionRule[]): string {
    const parts: string[] = [];

    if (triggers.includes('LUNCH_BOOST') || triggers.includes('DINNER_BOOST')) {
      parts.push('Meal time bonus active!');
    }
    if (triggers.includes('WEEKEND_BONUS')) {
      parts.push('Weekend special rewards!');
    }
    if (triggers.includes('NEW_USER')) {
      parts.push('Welcome bonus applied!');
    }
    if (triggers.includes('VIP_USER')) {
      parts.push('VIP exclusive rewards!');
    }
    if (triggers.includes('DORMANT_CUSTOMER')) {
      parts.push('We missed you! Reactivation bonus!');
    }
    if (triggers.includes('HIGH_INVENTORY') || triggers.includes('EXCESS_STOCK')) {
      parts.push('Extra coins for excess inventory clearance!');
    }
    if (triggers.includes('NEAR_EXPIRY')) {
      parts.push('Flash sale bonus!');
    }
    if (triggers.includes('NEW_MERCHANT')) {
      parts.push('New merchant welcome bonus!');
    }

    if (parts.length === 0) {
      return 'Standard coin reward';
    }

    return parts.join(' ');
  }

  /**
   * Create default distribution rules
   */
  async createDefaultRules(): Promise<void> {
    const defaultRules: Omit<DistributionRule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      // Inventory rules
      {
        id: '',
        type: 'inventory',
        condition: { inventoryLevel: { min: 0.8 } },
        coinBoost: 15,
        priority: 10,
        active: true,
        metadata: { name: 'High Inventory Boost' },
      },
      {
        id: '',
        type: 'inventory',
        condition: { daysInStock: { min: 7 } },
        coinBoost: 20,
        priority: 15,
        active: true,
        metadata: { name: 'Slow Moving Stock' },
      },
      // Segment rules
      {
        id: '',
        type: 'segment',
        condition: { userSegment: ['new'] },
        coinBoost: 10,
        priority: 20,
        active: true,
        metadata: { name: 'New User Welcome' },
      },
      {
        id: '',
        type: 'segment',
        condition: { userSegment: ['vip'] },
        coinBoost: 15,
        priority: 25,
        active: true,
        metadata: { name: 'VIP Reward' },
      },
      {
        id: '',
        type: 'segment',
        condition: { userSegment: ['dormant'] },
        coinBoost: 25,
        priority: 30,
        active: true,
        metadata: { name: 'Reactivation Bonus' },
      },
      // Time rules
      {
        id: '',
        type: 'time',
        condition: { hourOfDay: { start: 11, end: 14 } },
        coinBoost: 8,
        priority: 5,
        active: true,
        metadata: { name: 'Lunch Boost' },
      },
      {
        id: '',
        type: 'time',
        condition: { hourOfDay: { start: 18, end: 22 } },
        coinBoost: 12,
        priority: 5,
        active: true,
        metadata: { name: 'Dinner Boost' },
      },
      {
        id: '',
        type: 'time',
        condition: { dayOfWeek: [0, 6] },
        coinBoost: 10,
        priority: 5,
        active: true,
        metadata: { name: 'Weekend Bonus' },
      },
    ];

    for (const rule of defaultRules) {
      await this.ruleEngine.createRule(rule);
    }
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export const autoCoinDistributionEngine = new AutoCoinDistributionEngine();

/**
 * Quick distribution function
 */
export async function distributeCoins(
  userId: string,
  merchantId: string,
  campaignId?: string
): Promise<DistributionResult> {
  return autoCoinDistributionEngine.distribute({
    userId,
    merchantId,
    campaignId,
  });
}

/**
 * Preview distribution
 */
export async function previewDistribution(
  userId: string,
  merchantId: string,
  campaignId?: string
): Promise<DistributionResult> {
  return autoCoinDistributionEngine.preview({
    userId,
    merchantId,
    campaignId,
  });
}

/**
 * Get trigger breakdown without full distribution
 */
export async function getTriggerBreakdown(
  userId: string,
  merchantId: string
): Promise<{ triggers: string[]; totalBoost: number }> {
  const engine = new AutoCoinDistributionEngine();
  const inventory = await new MerchantDataProvider().getMerchantInventory(merchantId);
  const userSegment = await new UserDataProvider().getUserSegment(userId);
  const timeConditions = new TimeProvider().getTimeConditions();

  return new TriggerEngine().detectTriggers(
    { userId, merchantId },
    inventory,
    userSegment,
    timeConditions
  );
}

// ============================================
// TYPE EXPORTS
// ============================================

export type {
  DistributionRule,
  DistributionCondition,
  DistributionEvent,
  DistributionContext,
  DistributionResult,
  CoinBreakdown,
  MerchantInventory,
  UserSegment,
  TimeConditions,
};
