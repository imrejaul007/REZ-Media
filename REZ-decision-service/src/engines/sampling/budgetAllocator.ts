/**
 * BUDGET ALLOCATOR ENGINE
 * Distributes campaign budget across channels/time, optimizes spend for maximum ROI
 *
 * Phase 3: Sampling Platform Budget Management
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const REDIS_PREFIX = 'budget:';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface BudgetConfig {
  campaignId: string;
  totalBudget: number;
  channels: {
    whatsapp: number;
    push: number;
    ads: number;
    qr: number;
  };
  dailyLimit?: number;
  perUserLimit?: number;
}

export interface ChannelMetrics {
  channel: string;
  allocated: number;
  spent: number;
  conversions: number;
  cpc: number;
  impressions: number;
  ctr: number;
  status: 'active' | 'paused' | 'exhausted';
  lastUpdated: Date;
}

export interface BudgetAllocation {
  campaignId: string;
  totalBudget: number;
  spent: number;
  remaining: number;
  allocations: ChannelMetrics[];
  timeSlots: TimeSlotAllocation;
  userSpending: Record<string, number>;
  alerts: BudgetAlert[];
  reallocationSuggestion?: ReallocationSuggestion;
}

export interface TimeSlotAllocation {
  morning: { allocated: number; spent: number };
  afternoon: { allocated: number; spent: number };
  evening: { allocated: number; spent: number };
  night: { allocated: number; spent: number };
}

export interface ReallocationSuggestion {
  from: string;
  to: string;
  amount: number;
  reason: string;
  confidence: number;
  potentialGain: number;
}

export interface BudgetAlert {
  type: 'low_budget' | 'channel_exhausted' | 'overspend' | 'performance_drop';
  channel?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: Date;
}

export interface SpendingRecord {
  campaignId: string;
  channel: string;
  userId: string;
  amount: number;
  timestamp: Date;
  conversion?: boolean;
}

// ============================================
// CONSTANTS & DEFAULTS
// ============================================

const CHANNELS = ['whatsapp', 'push', 'ads', 'qr'] as const;
const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'night'] as const;

type Channel = typeof CHANNELS[number];
type TimeSlot = typeof TIME_SLOTS[number];

const CHANNEL_WEIGHTS = {
  whatsapp: 0.25,
  push: 0.20,
  ads: 0.35,
  qr: 0.20
};

const TIME_SLOT_DISTRIBUTION = {
  morning: { start: 6, end: 12, weight: 0.20 },
  afternoon: { start: 12, end: 17, weight: 0.25 },
  evening: { start: 17, end: 21, weight: 0.35 },
  night: { start: 21, end: 6, weight: 0.20 }
};

const PERFORMANCE_THRESHOLDS = {
  minCPC: 0.01,
  maxCPC: 10.0,
  minCTR: 0.001,
  targetCVR: 0.05,
  reallocationThreshold: 0.15,
  pauseThreshold: 0.95,
  lowBudgetWarning: 0.20
};

const DEFAULT_DAILY_LIMIT_MULTIPLIER = 1.0;
const DEFAULT_PER_USER_LIMIT = 5.0;
const MINIMUM_RESERVE_PERCENT = 0.10;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function getCurrentTimeSlot(): TimeSlot {
  return getTimeSlot(new Date().getHours());
}

function getRedisKey(campaignId: string, ...parts: string[]): string {
  return `${REDIS_PREFIX}${campaignId}:${parts.join(':')}`;
}

function calculateCPC(spent: number, conversions: number): number {
  if (conversions === 0) return 0;
  return spent / conversions;
}

function calculateCTR(impressions: number, clicks: number): number {
  if (impressions === 0) return 0;
  return clicks / impressions;
}

// ============================================
// BUDGET GUARDS
// ============================================

export class BudgetGuard {
  private campaignConfig: BudgetConfig;
  private dailyLimit: number;
  private perUserLimit: number;
  private minimumReserve: number;

  constructor(config: BudgetConfig) {
    this.campaignConfig = config;
    this.dailyLimit = config.dailyLimit || config.totalBudget * DEFAULT_DAILY_LIMIT_MULTIPLIER;
    this.perUserLimit = config.perUserLimit || DEFAULT_PER_USER_LIMIT;
    this.minimumReserve = config.totalBudget * MINIMUM_RESERVE_PERCENT;
  }

  /**
   * Check if spending is allowed for a specific channel and user
   */
  async canSpend(
    campaignId: string,
    channel: string,
    userId: string,
    amount: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check total daily limit
    const dailySpent = await this.getDailySpend(campaignId);
    if (dailySpent + amount > this.dailyLimit) {
      return { allowed: false, reason: 'Daily limit exceeded' };
    }

    // Check total budget with reserve
    const totalSpent = await this.getTotalSpend(campaignId);
    if (totalSpent + amount > this.campaignConfig.totalBudget - this.minimumReserve) {
      return { allowed: false, reason: 'Would exceed minimum reserve' };
    }

    // Check per-user limit
    const userSpent = await this.getUserSpend(campaignId, userId);
    if (userSpent + amount > this.perUserLimit) {
      return { allowed: false, reason: `Per-user limit exceeded (${this.perUserLimit})` };
    }

    // Check channel limit
    const channelSpent = await this.getChannelSpend(campaignId, channel);
    const channelBudget = this.campaignConfig.channels[channel as keyof typeof this.campaignConfig.channels] || 0;
    if (channelSpent + amount > channelBudget) {
      return { allowed: false, reason: 'Channel budget exhausted' };
    }

    return { allowed: true };
  }

  /**
   * Check if channel should be paused
   */
  async shouldPauseChannel(campaignId: string, channel: string): Promise<boolean> {
    const channelBudget = this.campaignConfig.channels[channel as keyof typeof this.campaignConfig.channels] || 0;
    const channelSpent = await this.getChannelSpend(campaignId, channel);
    return channelSpent >= channelBudget * PERFORMANCE_THRESHOLDS.pauseThreshold;
  }

  /**
   * Check if campaign should be paused
   */
  async shouldPauseCampaign(campaignId: string): Promise<boolean> {
    const totalSpent = await this.getTotalSpend(campaignId);
    return totalSpent >= this.campaignConfig.totalBudget * PERFORMANCE_THRESHOLDS.pauseThreshold;
  }

  private async getDailySpend(campaignId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = getRedisKey(campaignId, 'daily', today);
    return parseFloat(await redis.get(key) || '0');
  }

  private async getTotalSpend(campaignId: string): Promise<number> {
    const key = getRedisKey(campaignId, 'total');
    return parseFloat(await redis.get(key) || '0');
  }

  private async getUserSpend(campaignId: string, userId: string): Promise<number> {
    const key = getRedisKey(campaignId, 'user', userId);
    return parseFloat(await redis.get(key) || '0');
  }

  private async getChannelSpend(campaignId: string, channel: string): Promise<number> {
    const key = getRedisKey(campaignId, 'channel', channel);
    return parseFloat(await redis.get(key) || '0');
  }
}

// ============================================
// SPENDING TRACKER
// ============================================

export class SpendingTracker {
  /**
   * Record a spending event
   */
  async record(campaignId: string, record: Omit<SpendingRecord, 'campaignId' | 'timestamp'>): Promise<void> {
    const timestamp = new Date();
    const spendingRecord: SpendingRecord = {
      ...record,
      campaignId,
      timestamp
    };

    const pipeline = redis.pipeline();

    // Total spend
    pipeline.incrbyfloat(getRedisKey(campaignId, 'total'), record.amount);

    // Daily spend (with expiry at end of day)
    const today = timestamp.toISOString().split('T')[0];
    const dailyKey = getRedisKey(campaignId, 'daily', today);
    pipeline.incrbyfloat(dailyKey, record.amount);
    pipeline.expire(dailyKey, 86400 * 2); // Keep for 2 days

    // Channel spend
    pipeline.incrbyfloat(getRedisKey(campaignId, 'channel', record.channel), record.amount);

    // User spend
    pipeline.incrbyfloat(getRedisKey(campaignId, 'user', record.userId), record.amount);

    // Time slot spend
    const timeSlot = getCurrentTimeSlot();
    pipeline.incrbyfloat(getRedisKey(campaignId, 'timeslot', timeSlot), record.amount);

    // Spending history (keep last 1000)
    pipeline.lpush(getRedisKey(campaignId, 'history'), JSON.stringify(spendingRecord));
    pipeline.ltrim(getRedisKey(campaignId, 'history'), 0, 999);

    await pipeline.exec();
  }

  /**
   * Get all spending for a campaign
   */
  async getCampaignSpending(campaignId: string): Promise<{
    total: number;
    byChannel: Record<string, number>;
    byTimeSlot: Record<string, number>;
    byUser: Record<string, number>;
    daily: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const [total, daily, channelData, timeSlotData, userData] = await Promise.all([
      redis.get(getRedisKey(campaignId, 'total')),
      redis.get(getRedisKey(campaignId, 'daily', today)),
      redis.hgetall(getRedisKey(campaignId, 'channel')),
      redis.hgetall(getRedisKey(campaignId, 'timeslot')),
      redis.hgetall(getRedisKey(campaignId, 'user'))
    ]);

    return {
      total: parseFloat(total || '0'),
      daily: parseFloat(daily || '0'),
      byChannel: Object.fromEntries(
        Object.entries(channelData || {}).map(([k, v]) => [k, parseFloat(v)])
      ),
      byTimeSlot: Object.fromEntries(
        Object.entries(timeSlotData || {}).map(([k, v]) => [k, parseFloat(v)])
      ),
      byUser: Object.fromEntries(
        Object.entries(userData || {}).map(([k, v]) => [k, parseFloat(v)])
      )
    };
  }

  /**
   * Get user spending summary
   */
  async getUserSpending(campaignId: string): Promise<Record<string, number>> {
    const data = await redis.hgetall(getRedisKey(campaignId, 'user'));
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, parseFloat(v)])
    );
  }
}

// ============================================
// ROI CALCULATOR
// ============================================

export class ROICalculator {
  /**
   * Calculate performance metrics for a channel
   */
  async calculateChannelMetrics(
    campaignId: string,
    channel: string
  ): Promise<ChannelMetrics> {
    const spent = parseFloat(await redis.get(getRedisKey(campaignId, 'channel', channel)) || '0');

    // Get channel performance from Redis
    const metricsKey = getRedisKey(campaignId, 'metrics', channel);
    const metricsData = await redis.hgetall(metricsKey);

    const conversions = parseInt(metricsData.conversions || '0');
    const impressions = parseInt(metricsData.impressions || '0');
    const clicks = parseInt(metricsData.clicks || '0');

    const cpc = calculateCPC(spent, conversions);
    const ctr = calculateCTR(impressions, clicks);

    // Determine channel status
    const budgetConfig = await this.getChannelBudget(campaignId, channel);
    let status: 'active' | 'paused' | 'exhausted' = 'active';

    if (budgetConfig && spent >= budgetConfig) {
      status = 'exhausted';
    }

    return {
      channel,
      allocated: budgetConfig || 0,
      spent,
      conversions,
      cpc,
      impressions,
      ctr,
      status,
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate cost per conversion for each channel
   */
  async getCostPerConversion(campaignId: string): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    for (const channel of CHANNELS) {
      const channelMetrics = await this.calculateChannelMetrics(campaignId, channel);
      metrics[channel] = channelMetrics.cpc;
    }

    return metrics;
  }

  /**
   * Identify best performing channel
   */
  async getBestPerformingChannel(campaignId: string): Promise<{
    channel: string;
    cpc: number;
    conversions: number;
  } | null> {
    let best: { channel: string; cpc: number; conversions: number } | null = null;
    let bestScore = Infinity;

    for (const channel of CHANNELS) {
      const metrics = await this.calculateChannelMetrics(campaignId, channel);

      // Skip channels with no conversions or exhausted
      if (metrics.conversions === 0 || metrics.status === 'exhausted') continue;

      // Lower CPC is better, but consider volume
      const score = metrics.cpc / Math.log(metrics.conversions + 1);

      if (score < bestScore) {
        bestScore = score;
        best = {
          channel,
          cpc: metrics.cpc,
          conversions: metrics.conversions
        };
      }
    }

    return best;
  }

  /**
   * Identify worst performing channel
   */
  async getWorstPerformingChannel(campaignId: string): Promise<{
    channel: string;
    cpc: number;
    conversions: number;
  } | null> {
    let worst: { channel: string; cpc: number; conversions: number } | null = null;
    let worstScore = -Infinity;

    for (const channel of CHANNELS) {
      const metrics = await this.calculateChannelMetrics(campaignId, channel);

      // Skip exhausted channels (they're not "underperforming", they're done)
      if (metrics.status === 'exhausted') continue;

      // Only consider channels with spend
      if (metrics.spent === 0) continue;

      const score = metrics.cpc;

      if (score > worstScore) {
        worstScore = score;
        worst = {
          channel,
          cpc: metrics.cpc,
          conversions: metrics.conversions
        };
      }
    }

    return worst;
  }

  private async getChannelBudget(campaignId: string, channel: string): Promise<number> {
    const budgetKey = getRedisKey(campaignId, 'config', 'channels', channel);
    return parseFloat(await redis.get(budgetKey) || '0');
  }
}

// ============================================
// REALLOCATION ENGINE
// ============================================

export class ReallocationEngine {
  private roiCalculator: ROICalculator;

  constructor() {
    this.roiCalculator = new ROICalculator();
  }

  /**
   * Generate reallocation suggestions
   */
  async generateSuggestions(campaignId: string): Promise<ReallocationSuggestion[]> {
    const suggestions: ReallocationSuggestion[] = [];

    const [best, worst] = await Promise.all([
      this.roiCalculator.getBestPerformingChannel(campaignId),
      this.roiCalculator.getWorstPerformingChannel(campaignId)
    ]);

    if (!best || !worst) return suggestions;

    // Calculate potential reallocation amount
    const worstMetrics = await this.roiCalculator.calculateChannelMetrics(campaignId, worst.channel);
    const remainingBudget = worstMetrics.allocated - worstMetrics.spent;

    // Only suggest if worst is underperforming by threshold
    const performanceRatio = worst.cpc / best.cpc;
    if (performanceRatio < 1 + PERFORMANCE_THRESHOLDS.reallocationThreshold) {
      return suggestions;
    }

    // Suggest reallocation
    const reallocationAmount = Math.min(
      remainingBudget * 0.5,
      best.cpc * 10 // At least 10 conversions worth
    );

    if (reallocationAmount > 1) {
      suggestions.push({
        from: worst.channel,
        to: best.channel,
        amount: reallocationAmount,
        reason: `${worst.channel} has ${((performanceRatio - 1) * 100).toFixed(0)}% higher CPC than ${best.channel}`,
        confidence: Math.min(0.9, performanceRatio / 2),
        potentialGain: reallocationAmount * (performanceRatio - 1)
      });
    }

    // Pause exhausted channels
    if (worstMetrics.status === 'exhausted') {
      suggestions.push({
        from: worst.channel,
        to: best.channel,
        amount: remainingBudget,
        reason: `${worst.channel} is exhausted`,
        confidence: 1.0,
        potentialGain: 0
      });
    }

    return suggestions;
  }

  /**
   * Apply a reallocation
   */
  async applyReallocation(
    campaignId: string,
    suggestion: ReallocationSuggestion
  ): Promise<boolean> {
    const pipeline = redis.pipeline();

    // Reduce budget from source channel
    pipeline.incrbyfloat(
      getRedisKey(campaignId, 'config', 'channels', suggestion.from),
      -suggestion.amount
    );

    // Increase budget for target channel
    pipeline.incrbyfloat(
      getRedisKey(campaignId, 'config', 'channels', suggestion.to),
      suggestion.amount
    );

    // Record reallocation event
    pipeline.lpush(
      getRedisKey(campaignId, 'reallocations'),
      JSON.stringify({
        ...suggestion,
        appliedAt: new Date()
      })
    );

    await pipeline.exec();
    return true;
  }
}

// ============================================
// ALERT MANAGER
// ============================================

export class AlertManager {
  private alerts: Map<string, BudgetAlert[]> = new Map();

  /**
   * Check and generate alerts for a campaign
   */
  async checkAlerts(
    campaignId: string,
    config: BudgetConfig,
    spending: { total: number; daily: number }
  ): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];

    // Low budget alert
    const remainingBudget = config.totalBudget - spending.total;
    const budgetPercentRemaining = remainingBudget / config.totalBudget;

    if (budgetPercentRemaining <= PERFORMANCE_THRESHOLDS.lowBudgetWarning) {
      alerts.push({
        type: 'low_budget',
        message: `Budget running low: ${(budgetPercentRemaining * 100).toFixed(1)}% remaining`,
        severity: budgetPercentRemaining < 0.1 ? 'critical' : 'warning',
        timestamp: new Date()
      });
    }

    // Check each channel
    for (const channel of CHANNELS) {
      const channelBudget = config.channels[channel as keyof typeof config.channels] || 0;
      const channelSpent = parseFloat(
        await redis.get(getRedisKey(campaignId, 'channel', channel)) || '0'
      );

      if (channelBudget > 0) {
        const channelPercentUsed = channelSpent / channelBudget;

        if (channelPercentUsed >= PERFORMANCE_THRESHOLDS.pauseThreshold) {
          alerts.push({
            type: 'channel_exhausted',
            channel,
            message: `${channel} channel exhausted (${(channelPercentUsed * 100).toFixed(1)}% used)`,
            severity: 'critical',
            timestamp: new Date()
          });
        } else if (channelPercentUsed >= PERFORMANCE_THRESHOLDS.lowBudgetWarning) {
          alerts.push({
            type: 'low_budget',
            channel,
            message: `${channel} running low: ${((1 - channelPercentUsed) * 100).toFixed(1)}% remaining`,
            severity: 'warning',
            timestamp: new Date()
          });
        }
      }
    }

    // Performance drop alerts
    const roiCalculator = new ROICalculator();
    const worst = await roiCalculator.getWorstPerformingChannel(campaignId);
    const best = await roiCalculator.getBestPerformingChannel(campaignId);

    if (worst && best && worst.cpc > 0) {
      const performanceRatio = worst.cpc / best.cpc;
      if (performanceRatio > 2) {
        alerts.push({
          type: 'performance_drop',
          channel: worst.channel,
          message: `${worst.channel} performance dropped: CPC ${worst.cpc.toFixed(2)} vs avg ${best.cpc.toFixed(2)}`,
          severity: performanceRatio > 3 ? 'critical' : 'warning',
          timestamp: new Date()
        });
      }
    }

    // Store alerts
    this.alerts.set(campaignId, alerts);

    // Store in Redis for persistence
    await redis.set(
      getRedisKey(campaignId, 'alerts'),
      JSON.stringify(alerts),
      'EX',
      86400
    );

    return alerts;
  }

  /**
   * Get recent alerts for a campaign
   */
  async getRecentAlerts(campaignId: string): Promise<BudgetAlert[]> {
    const cached = await redis.get(getRedisKey(campaignId, 'alerts'));
    if (cached) {
      return JSON.parse(cached);
    }
    return this.alerts.get(campaignId) || [];
  }
}

// ============================================
// BUDGET DISTRIBUTION ENGINE
// ============================================

export class BudgetDistributionEngine {
  private config: BudgetConfig;

  constructor(config: BudgetConfig) {
    this.config = config;
  }

  /**
   * Initialize budget allocation in Redis
   */
  async initialize(): Promise<void> {
    const pipeline = redis.pipeline();

    // Store channel budgets
    for (const channel of CHANNELS) {
      const amount = this.config.channels[channel as keyof typeof this.config.channels] || 0;
      pipeline.set(getRedisKey(this.config.campaignId, 'config', 'channels', channel), amount);
    }

    // Store total budget
    pipeline.set(getRedisKey(this.config.campaignId, 'config', 'total'), this.config.totalBudget);

    // Initialize time slot allocations
    for (const slot of TIME_SLOTS) {
      const weight = TIME_SLOT_DISTRIBUTION[slot].weight;
      const allocated = this.config.totalBudget * weight;
      pipeline.set(getRedisKey(this.config.campaignId, 'timeslot', slot, 'allocated'), allocated);
    }

    await pipeline.exec();
  }

  /**
   * Get initial allocation structure
   */
  async getInitialAllocation(): Promise<BudgetAllocation> {
    const allocations: ChannelMetrics[] = [];
    const timeSlots: TimeSlotAllocation = {
      morning: { allocated: 0, spent: 0 },
      afternoon: { allocated: 0, spent: 0 },
      evening: { allocated: 0, spent: 0 },
      night: { allocated: 0, spent: 0 }
    };

    for (const channel of CHANNELS) {
      const allocated = this.config.channels[channel as keyof typeof this.config.channels] || 0;
      allocations.push({
        channel,
        allocated,
        spent: 0,
        conversions: 0,
        cpc: 0,
        impressions: 0,
        ctr: 0,
        status: 'active',
        lastUpdated: new Date()
      });
    }

    for (const slot of TIME_SLOTS) {
      const weight = TIME_SLOT_DISTRIBUTION[slot].weight;
      timeSlots[slot] = {
        allocated: this.config.totalBudget * weight,
        spent: 0
      };
    }

    return {
      campaignId: this.config.campaignId,
      totalBudget: this.config.totalBudget,
      spent: 0,
      remaining: this.config.totalBudget,
      allocations,
      timeSlots,
      userSpending: {},
      alerts: []
    };
  }

  /**
   * Calculate optimal bid for a channel based on performance
   */
  calculateOptimalBid(channel: string, targetCPC: number): number {
    const baseBid = CHANNEL_WEIGHTS[channel as keyof typeof CHANNEL_WEIGHTS] || 0.25;

    // Adjust bid based on channel performance weight
    // Higher weight = higher base bid potential
    const multiplier = baseBid * 4; // Scale to reasonable bid range

    // Clamp to reasonable bounds
    return Math.max(
      PERFORMANCE_THRESHOLDS.minCPC,
      Math.min(PERFORMANCE_THRESHOLDS.maxCPC, multiplier * targetCPC)
    );
  }

  /**
   * Get time-based allocation factor
   */
  getTimeAllocationFactor(): number {
    const currentSlot = getCurrentTimeSlot();
    const baseWeight = TIME_SLOT_DISTRIBUTION[currentSlot].weight;

    // Boost allocation during high-performing time slots
    const peakMultiplier = currentSlot === 'evening' ? 1.2 : 1.0;

    return baseWeight * peakMultiplier;
  }
}

// ============================================
// MAIN BUDGET ALLOCATOR CLASS
// ============================================

export class BudgetAllocator {
  private config: BudgetConfig;
  private guard: BudgetGuard;
  private tracker: SpendingTracker;
  private roiCalculator: ROICalculator;
  private reallocationEngine: ReallocationEngine;
  private alertManager: AlertManager;
  private distributionEngine: BudgetDistributionEngine;

  constructor(config: BudgetConfig) {
    this.config = config;
    this.guard = new BudgetGuard(config);
    this.tracker = new SpendingTracker();
    this.roiCalculator = new ROICalculator();
    this.reallocationEngine = new ReallocationEngine();
    this.alertManager = new AlertManager();
    this.distributionEngine = new BudgetDistributionEngine(config);
  }

  /**
   * Initialize the budget allocator for a campaign
   */
  async initialize(): Promise<void> {
    await this.distributionEngine.initialize();
  }

  /**
   * Get current budget allocation status
   */
  async getAllocation(): Promise<BudgetAllocation> {
    const spending = await this.tracker.getCampaignSpending(this.config.campaignId);

    // Get channel metrics
    const allocations: ChannelMetrics[] = [];
    for (const channel of CHANNELS) {
      const metrics = await this.roiCalculator.calculateChannelMetrics(this.config.campaignId, channel);
      allocations.push(metrics);
    }

    // Get time slot allocations
    const timeSlots: TimeSlotAllocation = {
      morning: { allocated: 0, spent: 0 },
      afternoon: { allocated: 0, spent: 0 },
      evening: { allocated: 0, spent: 0 },
      night: { allocated: 0, spent: 0 }
    };

    for (const slot of TIME_SLOTS) {
      const allocated = parseFloat(
        await redis.get(getRedisKey(this.config.campaignId, 'timeslot', slot, 'allocated')) || '0'
      );
      const spent = spending.byTimeSlot[slot] || 0;
      timeSlots[slot] = { allocated, spent };
    }

    // Check for alerts
    const alerts = await this.alertManager.checkAlerts(
      this.config.campaignId,
      this.config,
      spending
    );

    // Get reallocation suggestions
    const suggestions = await this.reallocationEngine.generateSuggestions(this.config.campaignId);
    const primarySuggestion = suggestions[0];

    return {
      campaignId: this.config.campaignId,
      totalBudget: this.config.totalBudget,
      spent: spending.total,
      remaining: this.config.totalBudget - spending.total,
      allocations,
      timeSlots,
      userSpending: spending.byUser,
      alerts,
      reallocationSuggestion: primarySuggestion
    };
  }

  /**
   * Check if spending is allowed
   */
  async canSpend(channel: string, userId: string, amount: number): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    return this.guard.canSpend(this.config.campaignId, channel, userId, amount);
  }

  /**
   * Record spending and track metrics
   */
  async recordSpending(
    channel: string,
    userId: string,
    amount: number,
    conversion: boolean = false
  ): Promise<void> {
    await this.tracker.record(this.config.campaignId, {
      channel,
      userId,
      amount,
      conversion
    });

    // Update conversion metrics if applicable
    if (conversion) {
      await redis.hincrby(
        getRedisKey(this.config.campaignId, 'metrics', channel),
        'conversions',
        1
      );
    }
  }

  /**
   * Record an impression
   */
  async recordImpression(channel: string): Promise<void> {
    await redis.hincrby(
      getRedisKey(this.config.campaignId, 'metrics', channel),
      'impressions',
      1
    );
  }

  /**
   * Record a click
   */
  async recordClick(channel: string): Promise<void> {
    await redis.hincrby(
      getRedisKey(this.config.campaignId, 'metrics', channel),
      'clicks',
      1
    );
  }

  /**
   * Get channel performance metrics
   */
  async getChannelMetrics(channel: string): Promise<ChannelMetrics> {
    return this.roiCalculator.calculateChannelMetrics(this.config.campaignId, channel);
  }

  /**
   * Get cost per conversion per channel
   */
  async getCostPerConversion(): Promise<Record<string, number>> {
    return this.roiCalculator.getCostPerConversion(this.config.campaignId);
  }

  /**
   * Get reallocation suggestions
   */
  async getReallocationSuggestions(): Promise<ReallocationSuggestion[]> {
    return this.reallocationEngine.generateSuggestions(this.config.campaignId);
  }

  /**
   * Apply a reallocation suggestion
   */
  async applyReallocation(suggestion: ReallocationSuggestion): Promise<boolean> {
    return this.reallocationEngine.applyReallocation(this.config.campaignId, suggestion);
  }

  /**
   * Get budget alerts
   */
  async getAlerts(): Promise<BudgetAlert[]> {
    return this.alertManager.getRecentAlerts(this.config.campaignId);
  }

  /**
   * Calculate optimal bid for a channel
   */
  getOptimalBid(channel: string): number {
    return this.distributionEngine.calculateOptimalBid(channel, 1.0);
  }

  /**
   * Get time-based allocation factor
   */
  getTimeAllocationFactor(): number {
    return this.distributionEngine.getTimeAllocationFactor();
  }

  /**
   * Check if channel should be paused
   */
  async shouldPauseChannel(channel: string): Promise<boolean> {
    return this.guard.shouldPauseChannel(this.config.campaignId, channel);
  }

  /**
   * Check if campaign should be paused
   */
  async shouldPauseCampaign(): Promise<boolean> {
    return this.guard.shouldPauseCampaign(this.config.campaignId);
  }

  /**
   * Get user spending for this campaign
   */
  async getUserSpending(userId: string): Promise<number> {
    const key = getRedisKey(this.config.campaignId, 'user', userId);
    return parseFloat(await redis.get(key) || '0');
  }

  /**
   * Reset budget for a new day
   */
  async resetDaily(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const key = getRedisKey(this.config.campaignId, 'daily', today);

    // Set daily spent to 0 (already expired, but ensure clean state)
    await redis.del(key);
  }

  /**
   * Get spending history
   */
  async getSpendingHistory(limit: number = 100): Promise<SpendingRecord[]> {
    const history = await redis.lrange(
      getRedisKey(this.config.campaignId, 'history'),
      0,
      limit - 1
    );
    return history.map(h => JSON.parse(h));
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export async function createBudgetAllocator(
  config: BudgetConfig
): Promise<BudgetAllocator> {
  const allocator = new BudgetAllocator(config);
  await allocator.initialize();
  return allocator;
}

// ============================================
// EXPORTS
// ============================================

export {
  CHANNELS,
  TIME_SLOTS,
  CHANNEL_WEIGHTS,
  TIME_SLOT_DISTRIBUTION,
  PERFORMANCE_THRESHOLDS,
  getRedisKey,
  getCurrentTimeSlot
};
