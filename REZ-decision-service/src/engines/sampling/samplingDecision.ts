/**
 * SAMPLING DECISION ENGINE
 * Decides WHO gets coins, HOW MUCH, WHICH type, WHEN
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const REDIS_PREFIX = 'sampling:';

// ============================================
// TYPES
// ============================================

export interface SamplingDecision {
  eligible: boolean;
  reason: string;
  coinAmount: number;
  coinType: 'try' | 'brand';
  brandId?: string;
  timing: {
    sendNow: boolean;
    waitMinutes?: number;
    bestTime?: string;
  };
  priority: number; // 1-100
}

export interface SamplingContext {
  userId: string;
  campaignId: string;
  merchantId?: string;
  location?: {
    lat: number;
    lng: number;
  };
  time?: Date;
}

export interface CampaignConfig {
  coinType: 'try' | 'brand';
  brandCoinId?: string;
  minCoins: number;
  maxCoins: number;
  targeting?: {
    segments?: string[];
    maxPerUser?: number;
    cooldownMinutes?: number;
  };
}

// ============================================
// FATIGUE RULES
// ============================================

const FATIGUE_RULES = {
  maxScansPerDay: 3,        // Don't spam
  minGapMinutes: 240,       // 4 hours between scans
  cooldownAfterRedeem: 1440, // 24 hours after redemption
  maxWalletCoins: 500,      // Don't credit if wallet full
};

// ============================================
// SCORING WEIGHTS
// ============================================

const SCORE_WEIGHTS = {
  userAffinity: 0.30,      // How much user likes this category
  userStage: 0.20,        // NEW vs WARM vs HOT
  timeOfDay: 0.15,         // Lunch/dinner/weekend
  inventoryLevel: 0.15,    // Merchant stock
  campaignUrgency: 0.10,   // Deadline
  fatiguePenalty: 0.10,     // Too many messages?
};

// ============================================
// SCORING ENGINE
// ============================================

export class SamplingScoringEngine {

  /**
   * Calculate user's eligibility and score for a campaign
   */
  async score(context: SamplingContext, config: CampaignConfig): Promise<{
    score: number;
    eligible: boolean;
    reason: string;
  }> {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;

    // 1. Fatigue check
    const fatigueCheck = await this.checkFatigue(context.userId);
    if (!fatigueCheck.eligible) {
      return {
        score: 0,
        eligible: false,
        reason: fatigueCheck.reason
      };
    }
    score += (100 - fatigueCheck.level) * SCORE_WEIGHTS.fatiguePenalty;
    reasons.push(`Fatigue OK: ${fatigueCheck.level}/100`);

    // 2. User affinity to category
    const affinity = await this.getUserAffinity(context.userId, context.merchantId);
    score += affinity * SCORE_WEIGHTS.userAffinity * 100;
    reasons.push(`Affinity: ${(affinity * 100).toFixed(0)}%`);

    // 3. User stage (NEW users get boost)
    const stage = await this.getUserStage(context.userId);
    if (stage === 'NEW') {
      score += 20;
      reasons.push('NEW user boost');
    } else if (stage === 'HOT') {
      score += 10;
      reasons.push('HOT user');
    }

    // 4. Time of day
    const timeScore = this.getTimeScore(context.time || new Date());
    score += timeScore * SCORE_WEIGHTS.timeOfDay * 100;
    reasons.push(`Time score: ${timeScore}`);

    // 5. Inventory level (high stock = higher coins)
    if (context.merchantId) {
      const inventory = await this.getInventoryLevel(context.merchantId);
      score += inventory * SCORE_WEIGHTS.inventoryLevel * 100;
      reasons.push(`Inventory: ${(inventory * 100).toFixed(0)}%`);
    }

    // 6. Campaign urgency
    // (would check campaign deadline)

    return {
      score: Math.min(100, score),
      eligible: true,
      reason: reasons.join(' | ')
    };
  }

  /**
   * Check if user is fatigued
   */
  private async checkFatigue(userId: string): Promise<{
    eligible: boolean;
    level: number;
    reason: string;
  }> {
    const key = (suffix: string) => `${REDIS_PREFIX}fatigue:${userId}:${suffix}`;

    // Check today's scan count
    const today = new Date().toISOString().split('T')[0];
    const scansToday = parseInt(await redis.get(key(`scans:${today}`)) || '0');

    if (scansToday >= FATIGUE_RULES.maxScansPerDay) {
      return {
        eligible: false,
        level: 100,
        reason: `Max scans reached today (${scansToday}/${FATIGUE_RULES.maxScansPerDay})`
      };
    }

    // Check gap since last scan
    const lastScan = await redis.get(key('lastScan'));
    if (lastScan) {
      const minutesSince = (Date.now() - parseInt(lastScan)) / 60000;
      if (minutesSince < FATIGUE_RULES.minGapMinutes) {
        return {
          eligible: false,
          level: 80,
          reason: `Wait ${Math.round(FATIGUE_RULES.minGapMinutes - minutesSince)} more minutes`
        };
      }
    }

    // Check cooldown after redemption
    const lastRedeem = await redis.get(key('lastRedeem'));
    if (lastRedeem) {
      const minutesSince = (Date.now() - parseInt(lastRedeem)) / 60000;
      if (minutesSince < FATIGUE_RULES.cooldownAfterRedeem) {
        return {
          eligible: false,
          level: 60,
          reason: 'Cooldown after recent redemption'
        };
      }
    }

    // Calculate fatigue level (0-100)
    const level = Math.min(100, (scansToday / FATIGUE_RULES.maxScansPerDay) * 100);

    return {
      eligible: true,
      level,
      reason: 'Eligible'
    };
  }

  /**
   * Get user affinity to merchant category (0-1)
   */
  private async getUserAffinity(userId: string, merchantId?: string): Promise<number> {
    if (!merchantId) return 0.5; // Neutral

    // Get user's preferred categories from history
    const prefKey = `${REDIS_PREFIX}user:${userId}:preferences`;
    const prefs = await redis.hgetall(prefKey);

    // Get merchant category
    const merchantCategory = await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:category`);

    if (!merchantCategory || Object.keys(prefs).length === 0) {
      return 0.5; // Neutral
    }

    // Check affinity score
    const affinity = parseFloat(prefs[merchantCategory] || '0');
    return Math.min(1, affinity);
  }

  /**
   * Get user stage (NEW, WARM, HOT)
   */
  private async getUserStage(userId: string): Promise<'NEW' | 'WARM' | 'HOT'> {
    const lastActivity = await redis.get(`${REDIS_PREFIX}user:${userId}:lastActivity`);

    if (!lastActivity) return 'NEW';

    const daysSinceActivity = (Date.now() - parseInt(lastActivity)) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity > 30) return 'NEW';
    if (daysSinceActivity > 7) return 'WARM';
    return 'HOT';
  }

  /**
   * Get time score based on time of day
   */
  private getTimeScore(time: Date): number {
    const hour = time.getHours();

    // Lunch time (12-2 PM) - high for food
    if (hour >= 12 && hour <= 14) return 0.9;

    // Dinner time (7-10 PM) - high for food
    if (hour >= 19 && hour <= 22) return 0.8;

    // Weekend - higher for lifestyle
    const day = time.getDay();
    if (day === 0 || day === 6) return 0.7;

    // Evening (6-9 PM)
    if (hour >= 18 && hour <= 21) return 0.6;

    // Normal hours
    if (hour >= 10 && hour <= 20) return 0.4;

    return 0.2; // Low activity times
  }

  /**
   * Get merchant inventory level (0-1)
   */
  private async getInventoryLevel(merchantId: string): Promise<number> {
    const level = await redis.get(`${REDIS_PREFIX}merchant:${merchantId}:inventory`);
    return level ? parseFloat(level) : 0.5;
  }
}

// ============================================
// COIN ALLOCATION ENGINE
// ============================================

export class CoinAllocationEngine {

  /**
   * Calculate optimal coin amount
   */
  calculate(config: CampaignConfig, score: number): number {
    const { minCoins, maxCoins } = config;
    const range = maxCoins - minCoins;

    // Higher score = higher coins
    const percentage = score / 100;
    const coins = Math.round(minCoins + (range * percentage));

    // Clamp to range
    return Math.max(minCoins, Math.min(maxCoins, coins));
  }

  /**
   * Determine coin type
   */
  determineCoinType(config: CampaignConfig, context: SamplingContext): 'try' | 'brand' {
    // If campaign has brand coin, use it
    if (config.coinType === 'brand' && config.brandCoinId) {
      return 'brand';
    }

    // Default to REZ TRY coins
    return 'try';
  }
}

// ============================================
// TIMING ENGINE
// ============================================

export class TimingEngine {

  /**
   * Decide when to send
   */
  decide(context: SamplingContext, score: number): {
    sendNow: boolean;
    waitMinutes?: number;
    bestTime?: string;
  } {
    const hour = new Date().getHours();

    // High score = send now
    if (score >= 70) {
      return { sendNow: true };
    }

    // Medium score = check time
    if (score >= 40) {
      // Don't send late night
      if (hour >= 22 || hour < 8) {
        const waitUntil = hour >= 22 ? '8:00 AM' : `${hour}:00`;
        return {
          sendNow: false,
          waitMinutes: hour >= 22 ? (24 - hour + 8) * 60 : 0,
          bestTime: waitUntil
        };
      }
      return { sendNow: true };
    }

    // Low score = wait for better time
    return {
      sendNow: false,
      waitMinutes: this.getNextBestTime(hour),
      bestTime: this.getBestTimeLabel(hour)
    };
  }

  private getNextBestTime(currentHour: number): number {
    // Next meal time in minutes
    if (currentHour < 12) return (12 - currentHour) * 60;
    if (currentHour < 19) return (19 - currentHour) * 60;
    return (24 - currentHour + 12) * 60;
  }

  private getBestTimeLabel(currentHour: number): string {
    if (currentHour < 12) return '12:00 PM (lunch)';
    if (currentHour < 19) return '7:00 PM (dinner)';
    return 'Tomorrow 12:00 PM';
  }
}

// ============================================
// MAIN DECISION FUNCTION
// ============================================

export async function makeSamplingDecision(
  context: SamplingContext,
  config: CampaignConfig
): Promise<SamplingDecision> {
  const scoring = new SamplingScoringEngine();
  const allocation = new CoinAllocationEngine();
  const timing = new TimingEngine();

  // 1. Score the user
  const { score, eligible, reason } = await scoring.score(context, config);

  if (!eligible) {
    return {
      eligible: false,
      reason,
      coinAmount: 0,
      coinType: 'try',
      timing: { sendNow: false },
      priority: 0
    };
  }

  // 2. Calculate coin amount
  const coinAmount = allocation.calculate(config, score);
  const coinType = allocation.determineCoinType(config, context);

  // 3. Decide timing
  const timingDecision = timing.decide(context, score);

  // 4. Calculate priority (for ranking)
  const priority = Math.round(score);

  return {
    eligible: true,
    reason,
    coinAmount,
    coinType,
    brandId: config.brandCoinId,
    timing: timingDecision,
    priority
  };
}
