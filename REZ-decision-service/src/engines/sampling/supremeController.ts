/**
 * REZ DECISION ENGINE - SUPREME CONTROLLER
 *
 * This is the CENTRAL BRAIN that controls EVERYTHING
 *
 * RULE: NOTHING happens without this controller's approval
 *
 * INTEGRATION: Connects to ReZ Mind for user intent data
 *              Integrates with Sponsored Ranking Engine for ad auctions
 */

import Redis from 'ioredis';
import { getUserIntent, getTopIntent, getVibeScore, sendIntentSignal } from './rezMindIntegration';
import {
  SponsoredRankingEngine,
  rankListings as rankSponsoredListings,
  RankingRequest,
  RankingResult,
  SponsoredListing
} from './sponsoredRanking';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIX = 'rde:supreme:';

// Initialize Sponsored Ranking Engine
const sponsoredRanking = new SponsoredRankingEngine();

// ============================================
// TYPES
// ============================================

export type Channel = 'whatsapp' | 'push' | 'email' | 'qr' | 'dooh' | 'sms';

export type ActionType =
  | 'send_message'
  | 'show_qr_reward'
  | 'allocate_coins'
  | 'show_ad'
  | 'send_notification'
  | 'update_price'
  | 'show_merchant';

export interface DecisionRequest {
  userId: string;
  action: ActionType;
  channel: Channel;
  context: {
    campaignId?: string;
    merchantId?: string;
    location?: { lat: number; lng: number };
    intent?: string;
    amount?: number;
    [key: string]: any;
  };
}

export interface DecisionResponse {
  approved: boolean;
  decisionId: string;
  reason: string;

  // If approved
  approvedAction?: {
    channel: Channel;
    content?: string;
    timing: 'now' | 'later';
    waitMinutes?: number;
    coins?: number;
    merchantId?: string;
    priority?: number;
  };

  // If rejected
  rejectedReason?: string;
  cooldownMinutes?: number;
}

export interface RealTimeEvent {
  userId: string;
  event: 'search' | 'scan' | 'location' | 'cart_abandon' | 'browse' | 'purchase';
  data: Record<string, any>;
  timestamp: Date;
}

// ============================================
// SUPREME CONTROLLER
// ============================================

export class SupremeController {

  /**
   * Main decision endpoint - ALL channels MUST call this
   */
  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    const decisionId = `d_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Check fatigue
    const fatigueCheck = await this.checkFatigue(request.userId, request.channel);
    if (!fatigueCheck.allowed) {
      return {
        approved: false,
        decisionId,
        reason: 'fatigue',
        rejectedReason: fatigueCheck.reason,
        cooldownMinutes: fatigueCheck.cooldownMinutes
      };
    }

    // 2. Get user context from ReZ Mind
    const userContext = await this.getUserContext(request.userId);

    // 3. Get competing merchants (if applicable)
    let merchantRanking: any[] = [];
    if (request.context.merchantId || request.context.intent) {
      merchantRanking = await this.rankCompetingMerchants(
        request.userId,
        request.context.merchantId,
        request.context.intent,
        userContext
      );
    }

    // 4. Make decision
    const decision = await this.makeDecision(
      request,
      userContext,
      merchantRanking
    );

    // 5. If approved, record the decision
    if (decision.approved && decision.decisionId) {
      await this.recordDecision(decision);
    }

    return decision;
  }

  /**
   * Process REAL-TIME event - triggers instant decisions
   * Also sends signals to ReZ Mind for learning
   */
  async processRealTimeEvent(event: RealTimeEvent): Promise<DecisionResponse | null> {
    const decisionId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // SEND TO REZ MIND for learning
    await sendIntentSignal(
      event.userId,
      event.event,
      event.data.category || event.data.intent || 'general',
      event.data
    );

    // Map event to action
    const actionMap: Record<string, { action: ActionType; channel: Channel }> = {
      'search': { action: 'send_message', channel: 'whatsapp' },
      'scan': { action: 'show_qr_reward', channel: 'qr' },
      'location': { action: 'show_merchant', channel: 'push' },
      'cart_abandon': { action: 'send_notification', channel: 'push' },
      'browse': { action: 'send_message', channel: 'whatsapp' },
      'purchase': { action: 'allocate_coins', channel: 'qr' }
    };

    const mapping = actionMap[event.event];
    if (!mapping) return null;

    const request: DecisionRequest = {
      userId: event.userId,
      action: mapping.action,
      channel: mapping.channel,
      context: {
        intent: event.data.intent,
        merchantId: event.data.merchantId,
        location: event.data.location,
        ...event.data
      }
    };

    const decision = await this.decide(request);

    // Record real-time event
    await this.recordRealTimeEvent(event, decision);

    return decision;
  }

  /**
   * Rank competing merchants for same user
   */
  private async rankCompetingMerchants(
    userId: string,
    primaryMerchantId?: string,
    intent?: string,
    userContext?: any
  ): Promise<any[]> {
    // Get all merchants targeting this user
    const merchantIds = await redis.smembers(`${PREFIX}user:${userId}:targeting`);

    if (merchantIds.length === 0) return [];

    // Score each merchant
    const scores = await Promise.all(
      merchantIds.map(async (merchantId) => {
        const score = await this.scoreMerchant(userId, merchantId, intent, userContext);
        return { merchantId, score };
      })
    );

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  /**
   * Score a single merchant for this user
   */
  private async scoreMerchant(
    userId: string,
    merchantId: string,
    intent?: string,
    userContext?: any
  ): Promise<number> {
    let score = 50; // Base score

    // 1. Intent match (30%)
    if (intent) {
      const merchantCategories = await redis.smembers(`${PREFIX}merchant:${merchantId}:categories`);
      if (merchantCategories.includes(intent.toLowerCase())) {
        score += 30;
      }
    }

    // 2. Budget remaining (15%)
    const budget = await redis.get(`${PREFIX}campaign:${merchantId}:budget`);
    if (budget && parseFloat(budget) > 0) {
      score += 15;
    }

    // 3. Historical CTR (20%)
    const ctr = await redis.get(`${PREFIX}merchant:${merchantId}:ctr`);
    if (ctr) {
      score += parseFloat(ctr) * 20;
    }

    // 4. Offer quality (20%)
    const offerScore = await redis.get(`${PREFIX}merchant:${merchantId}:offer_score`);
    if (offerScore) {
      score += parseFloat(offerScore) * 0.20;
    }

    // 5. User affinity (10%)
    if (userContext?.preferences?.[merchantId]) {
      score += userContext.preferences[merchantId] * 0.10;
    }

    // 6. Conversion rate (5%)
    const conversionRate = await redis.get(`${PREFIX}merchant:${merchantId}:conversion`);
    if (conversionRate) {
      score += parseFloat(conversionRate) * 0.05;
    }

    return Math.min(100, score);
  }

  /**
   * Make the actual decision
   */
  private async makeDecision(
    request: DecisionRequest,
    userContext: any,
    merchantRanking: any[]
  ): Promise<DecisionResponse> {
    const decisionId = `d_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // If multiple merchants competing, only approve the best one
    if (merchantRanking.length > 1) {
      const best = merchantRanking[0];

      // Check if this merchant is the winner
      if (best.merchantId !== request.context.merchantId) {
        return {
          approved: false,
          decisionId,
          reason: 'competition',
          rejectedReason: `Merchant ${best.merchantId} ranked higher (${best.score} vs your score)`
        };
      }
    }

    // Check user preferences
    if (userContext?.preferences?.muted?.[request.channel]) {
      return {
        approved: false,
        decisionId,
        reason: 'user_preference',
        rejectedReason: 'User has muted this channel'
      };
    }

    // Decision approved
    const timing = this.decideTiming(request);

    return {
      approved: true,
      decisionId,
      reason: 'approved',
      approvedAction: {
        channel: request.channel,
        timing: timing.sendNow ? 'now' : 'later',
        waitMinutes: timing.waitMinutes,
        coins: await this.calculateCoins(request, userContext),
        merchantId: request.context.merchantId
      }
    };
  }

  /**
   * Check user fatigue
   */
  private async checkFatigue(userId: string, channel: Channel): Promise<{
    allowed: boolean;
    reason?: string;
    cooldownMinutes?: number;
  }> {
    const today = new Date().toISOString().split('T')[0];

    // Channel-specific limits
    const limits: Record<Channel, number> = {
      whatsapp: 5,  // Max 5 WhatsApp/day
      push: 10,    // Max 10 push/day
      email: 3,    // Max 3 email/day
      qr: 3,      // Max 3 QR rewards/day
      dooh: 10,   // Max 10 DOOH/day
      sms: 2       // Max 2 SMS/day
    };

    const limit = limits[channel] || 5;
    const countKey = `${PREFIX}fatigue:${userId}:${channel}:${today}`;

    const count = parseInt(await redis.get(countKey) || '0');

    if (count >= limit) {
      return {
        allowed: false,
        reason: 'limit_reached',
        cooldownMinutes: 1440 // 24 hours
      };
    }

    // Check last message gap
    const lastKey = `${PREFIX}fatigue:${userId}:${channel}:last`;
    const lastTime = await redis.get(lastKey);

    if (lastTime) {
      const minutesSince = (Date.now() - parseInt(lastTime)) / 60000;
      const minGap = channel === 'whatsapp' ? 60 : 30; // 1hr for WhatsApp, 30min for others

      if (minutesSince < minGap) {
        return {
          allowed: false,
          reason: 'too_frequent',
          cooldownMinutes: Math.ceil(minGap - minutesSince)
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Get user context for decision
   * Now integrates with ReZ Mind for user intent data
   */
  private async getUserContext(userId: string): Promise<any> {
    // First try to get from ReZ Mind (user intent data)
    const rezMindIntent = await getUserIntent(userId);

    if (rezMindIntent) {
      // Enrich with local cache
      const key = `${PREFIX}user:${userId}:context`;
      const localData = await redis.hgetall(key);

      return {
        // From ReZ Mind
        topIntents: rezMindIntent.topIntents,
        vibeScore: rezMindIntent.vibeScore,
        dormantScore: rezMindIntent.dormantScore,
        lastActive: rezMindIntent.lastActive,
        affinity: rezMindIntent.affinity,

        // From local cache
        preferences: localData.preferences ? JSON.parse(localData.preferences) : {},
        segments: localData.segments ? JSON.parse(localData.segments) : [],

        // Enrich from local if missing
        topIntent: rezMindIntent.topIntents?.[0]?.category || null,
        topIntentConfidence: rezMindIntent.topIntents?.[0]?.confidence || 0
      };
    }

    // Fallback to local cache
    const key = `${PREFIX}user:${userId}:context`;
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return {
        preferences: {},
        segments: [],
        lastActive: null,
        topIntents: [],
        vibeScore: 50,
        dormantScore: 0,
        affinity: {}
      };
    }

    return {
      preferences: data.preferences ? JSON.parse(data.preferences) : {},
      segments: data.segments ? JSON.parse(data.segments) : [],
      lastActive: data.lastActive,
      affinity: data.affinity ? JSON.parse(data.affinity) : {}
    };
  }

  /**
   * Decide timing for action
   */
  private decideTiming(request: DecisionRequest): { sendNow: boolean; waitMinutes?: number } {
    const hour = new Date().getHours();

    // Don't send late night (10 PM - 8 AM)
    if (hour >= 22 || hour < 8) {
      // Queue for 8 AM
      const minutesUntil8 = (24 - hour + 8) * 60;
      return { sendNow: false, waitMinutes: minutesUntil8 };
    }

    // High intent events = send now
    if (request.context.intent === 'high') {
      return { sendNow: true };
    }

    return { sendNow: true };
  }

  /**
   * Calculate coin reward
   */
  private async calculateCoins(request: DecisionRequest, userContext: any): Promise<number> {
    let coins = 50; // Base

    // Adjust based on action type
    switch (request.action) {
      case 'scan':
        coins = 50;
        break;
      case 'purchase':
        coins = 100;
        break;
      case 'show_qr_reward':
        coins = 25;
        break;
      default:
        coins = 10;
    }

    // Boost for new users
    if (!userContext?.lastActive) {
      coins = Math.round(coins * 1.5);
    }

    return coins;
  }

  /**
   * Record decision for learning
   */
  private async recordDecision(decision: DecisionResponse): Promise<void> {
    const key = `${PREFIX}decisions:${decision.decisionId}`;

    await redis.hmset(key, {
      approved: decision.approved ? '1' : '0',
      reason: decision.reason,
      timestamp: Date.now().toString()
    });

    await redis.expire(key, 86400 * 30); // 30 days
  }

  /**
   * Record real-time event
   */
  private async recordRealTimeEvent(event: RealTimeEvent, decision: DecisionResponse): Promise<void> {
    const key = `${PREFIX}events:${event.userId}:${Date.now()}`;

    await redis.hmset(key, {
      event: event.event,
      data: JSON.stringify(event.data),
      timestamp: event.timestamp.toISOString(),
      decision: decision.approved ? 'approved' : 'rejected',
      decisionId: decision.decisionId
    });

    await redis.expire(key, 86400 * 7); // 7 days
  }

  /**
   * Record action execution
   */
  async recordExecution(
    decisionId: string,
    result: 'sent' | 'clicked' | 'converted' | 'failed'
  ): Promise<void> {
    const key = `${PREFIX}decisions:${decisionId}`;
    const exists = await redis.exists(key);

    if (exists) {
      await redis.hmset(key, {
        result,
        executedAt: Date.now().toString()
      });
    }

    // Learn from result
    if (result === 'converted') {
      await this.learnFromConversion(decisionId);
    }
  }

  /**
   * Learn from conversion
   */
  private async learnFromConversion(decisionId: string): Promise<void> {
    const key = `${PREFIX}decisions:${decisionId}`;
    const data = await redis.hgetall(key);

    if (!data.timestamp) return;

    // Could update ML models here
    // For now, just track the pattern
    const hour = new Date().parseInt(data.timestamp).getHours();
    await redis.zincrby(`${PREFIX}patterns:hour:${hour}`, 1);
  }

  /**
   * Get merchant ranking for user (public endpoint)
   */
  async getMerchantRanking(userId: string): Promise<any[]> {
    return this.rankCompetingMerchants(userId, undefined, undefined, await this.getUserContext(userId));
  }

  /**
   * Check if user should receive message (quick check)
   */
  async quickCheck(userId: string, channel: Channel): Promise<boolean> {
    const fatigue = await this.checkFatigue(userId, channel);
    return fatigue.allowed;
  }

  // ============================================
  // SPONSORED RANKING INTEGRATION
  // ============================================

  /**
   * Rank sponsored listings for a user
   * Called when serving search results, recommendations, or ad slots
   */
  async rankSponsoredContent(
    userId: string,
    intent: string,
    slotCount: number = 3,
    options?: {
      category?: string;
      location?: { lat: number; lng: number };
      organicIds?: string[];
      filters?: RankingRequest['filters'];
    }
  ): Promise<RankingResult> {
    // Get organic IDs from context if not provided
    const organicIds = options?.organicIds ||
      (await redis.zrange(`${PREFIX}user:${userId}:organic_history`, 0, 9)).map(k => k.split(':')[1]);

    const request: RankingRequest = {
      userId,
      intent,
      context: {
        category: options?.category,
        location: options?.location
      },
      slotCount,
      organicIds,
      filters: options?.filters
    };

    // Run the sponsored ranking engine
    const result = await sponsoredRanking.rankListings(request);

    // Record impressions for winning listings
    for (const slot of result.slots) {
      if (slot.type === 'sponsored' && slot.listing) {
        await sponsoredRanking.recordImpression(slot.listing.id, slot.position);
      }
    }

    return result;
  }

  /**
   * Handle sponsored click event
   */
  async handleSponsoredClick(
    userId: string,
    listingId: string,
    merchantId: string
  ): Promise<void> {
    // Record the click
    await sponsoredRanking.recordClick(listingId);

    // Update user affinity
    await sponsoredRanking.updateUserAffinity(userId, merchantId, {
      type: 'click'
    });

    // Notify the auction engine
    const auctionEngine = (await import('./auctionEngine')).auctionEngine;
    await auctionEngine.submitBid({
      merchantId,
      campaignId: listingId,
      userId,
      baseBid: 0,
      cpm: 0,
      cpc: 0,
      cpa: 0,
      qualityScore: 50,
      intentMatch: 80,
      historicalCTR: 5,
      conversionRate: 10,
      discount: 0,
      coinReward: 0,
      startTime: new Date(),
      endTime: new Date(Date.now() + 86400000),
      status: 'active'
    });
  }

  /**
   * Handle sponsored conversion
   */
  async handleSponsoredConversion(
    userId: string,
    listingId: string,
    merchantId: string,
    value: number
  ): Promise<void> {
    // Record the conversion
    await sponsoredRanking.recordConversion(listingId, value);

    // Update user affinity with purchase
    await sponsoredRanking.updateUserAffinity(userId, merchantId, {
      type: 'purchase',
      value
    });

    // Update merchant quality score based on conversion
    const stats = await sponsoredRanking.getMerchantStats(merchantId);
    const newQualityScore = Math.min(100, stats.conversionRate * 100);

    await sponsoredRanking.updateListing(listingId, {
      qualityScore: newQualityScore
    });
  }

  /**
   * Get sponsored rankings for ad decision
   * Used by the decision logic to include sponsored content
   */
  async getSponsoredRankingsForDecision(
    userId: string,
    intent: string,
    maxSlots: number = 3
  ): Promise<{
    listings: SponsoredListing[];
    slots: RankingResult['slots'];
    fillRate: number;
  }> {
    const result = await this.rankSponsoredContent(userId, intent, maxSlots);

    return {
      listings: result.sponsored,
      slots: result.slots,
      fillRate: result.metrics.fillRate
    };
  }

  /**
   * Check if request should show sponsored content
   */
  async shouldShowSponsored(
    userId: string,
    context: DecisionRequest['context']
  ): Promise<{
    shouldShow: boolean;
    reason: string;
    maxSlots: number;
  }> {
    // Check user preference
    const userPrefs = await redis.hget(`${PREFIX}user:${userId}:prefs`, 'noSponsoredAds');
    if (userPrefs === 'true') {
      return {
        shouldShow: false,
        reason: 'user_opted_out',
        maxSlots: 0
      };
    }

    // Check fatigue (don't show sponsored too frequently)
    const today = new Date().toISOString().split('T')[0];
    const sponsoredCount = parseInt(
      await redis.get(`${PREFIX}fatigue:${userId}:sponsored:${today}`) || '0'
    );

    if (sponsoredCount >= 10) {
      return {
        shouldShow: false,
        reason: 'fatigue_limit',
        maxSlots: 0
      };
    }

    // Check if intent supports sponsored content
    const highIntentKeywords = ['buy', 'shop', 'search', 'find', 'order', 'get'];
    const hasCommercialIntent = highIntentKeywords.some(
      keyword => context.intent?.toLowerCase().includes(keyword)
    );

    return {
      shouldShow: true,
      reason: hasCommercialIntent ? 'high_intent' : 'default',
      maxSlots: hasCommercialIntent ? 5 : 3
    };
  }
}

// Export singleton
export const supremeController = new SupremeController();

// Convenience function
export async function requestDecision(request: DecisionRequest): Promise<DecisionResponse> {
  return supremeController.decide(request);
}

export async function processEvent(event: RealTimeEvent): Promise<DecisionResponse | null> {
  return supremeController.processRealTimeEvent(event);
}

// ============================================
// SPONSORED RANKING CONVENIENCE EXPORTS
// ============================================

export async function rankSponsoredContent(
  userId: string,
  intent: string,
  slotCount?: number,
  options?: {
    category?: string;
    location?: { lat: number; lng: number };
    organicIds?: string[];
    filters?: RankingRequest['filters'];
  }
): Promise<RankingResult> {
  return supremeController.rankSponsoredContent(userId, intent, slotCount, options);
}

export async function handleSponsoredClick(
  userId: string,
  listingId: string,
  merchantId: string
): Promise<void> {
  return supremeController.handleSponsoredClick(userId, listingId, merchantId);
}

export async function handleSponsoredConversion(
  userId: string,
  listingId: string,
  merchantId: string,
  value: number
): Promise<void> {
  return supremeController.handleSponsoredConversion(userId, listingId, merchantId, value);
}

export async function getSponsoredRankingsForDecision(
  userId: string,
  intent: string,
  maxSlots?: number
): Promise<{
  listings: SponsoredListing[];
  slots: RankingResult['slots'];
  fillRate: number;
}> {
  return supremeController.getSponsoredRankingsForDecision(userId, intent, maxSlots);
}

export async function shouldShowSponsored(
  userId: string,
  context: DecisionRequest['context']
): Promise<{
  shouldShow: boolean;
  reason: string;
  maxSlots: number;
}> {
  return supremeController.shouldShowSponsored(userId, context);
}

// Re-export types for convenience
export type { RankingRequest, RankingResult, SponsoredListing } from './sponsoredRanking';
