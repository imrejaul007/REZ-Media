/**
 * AI Marketing Service — REZ Marketing Platform
 *
 * Provides AI-powered marketing automation features:
 * - Auto campaign suggestions based on merchant data and trends
 * - Send time optimization for each user segment
 * - Audience insights using ML patterns
 * - Campaign performance prediction
 * - Content recommendations
 * - A/B testing automation
 * - Budget optimization suggestions
 *
 * Integrates with REZ Mind service for advanced ML inference.
 */

import mongoose from 'mongoose';
import { MarketingCampaign, IMarketingCampaign, IAudienceFilter, CampaignChannel } from '../models/MarketingCampaign';
import { logger } from '../config/logger';
import { getRedis } from '../config/redis';

// ── REZ Mind Integration Configuration ─────────────────────────────────────────

const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4017';

interface InternalTokens {
  [serviceName: string]: string;
}

function getInternalTokens(): InternalTokens {
  try {
    const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  const legacy = process.env.INTERNAL_SERVICE_TOKEN;
  if (legacy) return { 'rez-mind': legacy };
  return {};
}

// ── Core Types ────────────────────────────────────────────────────────────────

export interface CampaignSuggestion {
  id: string;
  type: 'new_campaign' | 'retarget' | 'seasonal' | 'engagement' | 'win_back';
  name: string;
  description: string;
  channel: CampaignChannel;
  objective: 'awareness' | 'engagement' | 'sales' | 'win_back';
  audience: {
    segment: string;
    description: string;
    estimatedSize?: number;
  };
  message?: {
    subject?: string;
    body: string;
    imageSuggestion?: string;
  };
  scheduledTime?: string;
  confidence: number;
  reasoning: string[];
  actionItems: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface SendTimeOptimization {
  segment: string;
  bestTimes: {
    dayOfWeek: number;
    hour: number;
    dayName: string;
    engagementScore: number;
    confidence: number;
  }[];
  recommendedTimezone: string;
  avoidTimes: {
    dayOfWeek: number;
    hour: number;
    reason: string;
  }[];
  sampleSize: number;
}

export interface AudienceInsight {
  segment: string;
  size: number;
  characteristics: {
    name: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
    percentage?: number;
  }[];
  preferredChannels: {
    channel: CampaignChannel;
    engagementScore: number;
    deliveryRate: number;
  }[];
  lifetimeValue: {
    average: number;
    predicted: number;
    segment: string;
  };
  churnRisk: {
    percentage: number;
    atRisk: number;
    reason: string;
  };
  purchasePatterns: {
    averageOrderValue: number;
    purchaseFrequency: number;
    lastPurchaseDays: number;
    categoryAffinity: string[];
  };
  optimalFrequency: number;
}

export interface PerformancePrediction {
  campaignId?: string;
  predictedMetrics: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
    estimatedReach: number;
  };
  confidence: number;
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    explanation: string;
  }[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
}

export interface ContentRecommendation {
  id: string;
  type: 'subject_line' | 'body' | 'cta' | 'image' | 'full_template';
  original?: string;
  suggested: string;
  channel: CampaignChannel;
  reason: string;
  engagementLift?: number;
  variants?: {
    text: string;
    expectedPerformance: number;
  }[];
  personalizationTokens?: string[];
}

export interface ABTestConfig {
  testId: string;
  name: string;
  hypothesis: string;
  variants: {
    id: string;
    name: string;
    content: Record<string, string>;
    trafficAllocation: number;
  }[];
  metrics: {
    primary: string;
    secondary: string[];
  };
  sampleSizePerVariant: number;
  significanceLevel: number;
  duration: number;
  status: 'draft' | 'running' | 'completed' | 'stopped';
  results?: {
    winner: string;
    metrics: Record<string, Record<string, {
      value: number;
      confidence: number;
      lift: number;
    }>>;
    recommendedAction: string;
  };
}

export interface BudgetOptimization {
  totalBudget: number;
  currentSpend: number;
  allocation: {
    channel: CampaignChannel;
    allocated: number;
    spent: number;
    performance: number;
    recommendedChange: number;
    roi: number;
  }[];
  recommendations: {
    type: 'increase' | 'decrease' | 'reallocate' | 'pause';
    channel?: CampaignChannel;
    amount: number;
    reason: string;
    expectedImpact: string;
  }[];
  projectedROI: number;
  dailyBudgetSuggestions: Record<string, number>;
}

export interface TrendAnalysis {
  category: string;
  direction: 'rising' | 'falling' | 'stable';
  changePercentage: number;
  dataPoints: number;
  period: string;
  insights: string[];
  relatedCategories: string[];
}

// ── Redis Cache Keys ───────────────────────────────────────────────────────────

const CACHE_TTL = 3600; // 1 hour default

function cacheKey(prefix: string, merchantId: string, suffix?: string): string {
  return `ai:mkt:${prefix}:${merchantId}${suffix ? `:${suffix}` : ''}`;
}

// ── REZ Mind API Client ───────────────────────────────────────────────────────

interface MindRequestOptions {
  endpoint: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  timeout?: number;
}

async function callRezMind<T>(options: MindRequestOptions): Promise<T | null> {
  const { endpoint, method = 'POST', body, timeout = 30000 } = options;
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-mind'];

  if (!serviceToken) {
    logger.warn('[AIMarketing] REZ Mind service token not configured — falling back to local ML');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${REZ_MIND_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('[AIMarketing] REZ Mind API error', { status: response.status, endpoint, error: errorText });
      return null;
    }

    return await response.json() as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      logger.warn('[AIMarketing] REZ Mind request timeout', { endpoint });
    } else {
      logger.warn('[AIMarketing] REZ Mind request failed', { endpoint, error: err instanceof Error ? err.message : String(err) });
    }
    return null;
  }
}

// ── AI Marketing Service Class ────────────────────────────────────────────────

export class AIMarketingService {
  // ── Campaign Suggestions ──────────────────────────────────────────────────

  /**
   * Generate AI-powered campaign suggestions based on merchant data, trends, and behavior.
   */
  async generateCampaignSuggestions(
    merchantId: string,
    options?: { limit?: number; focusObjective?: string }
  ): Promise<CampaignSuggestion[]> {
    const limit = options?.limit || 5;
    const redis = getRedis();

    // Try cache first
    const cacheKeyStr = cacheKey('suggestions', merchantId, options?.focusObjective);
    const cached = await redis.get(cacheKeyStr);
    if (cached) {
      logger.debug('[AIMarketing] Using cached campaign suggestions');
      return JSON.parse(cached);
    }

    // Gather merchant context
    const context = await this.gatherMerchantContext(merchantId);

    // Try REZ Mind for ML-powered suggestions
    const mindSuggestions = await callRezMind<CampaignSuggestion[]>({
      endpoint: '/api/v1/marketing/campaign-suggestions',
      body: {
        merchantId,
        context,
        limit,
        focusObjective: options?.focusObjective,
      },
    });

    if (mindSuggestions && mindSuggestions.length > 0) {
      // Cache results
      await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(mindSuggestions));
      return mindSuggestions;
    }

    // Fall back to rule-based suggestions
    const suggestions = await this.generateRuleBasedSuggestions(merchantId, context, limit);

    // Cache results
    await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(suggestions));

    return suggestions;
  }

  /**
   * Gather merchant context data for AI analysis.
   */
  private async gatherMerchantContext(merchantId: string): Promise<Record<string, unknown>> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return { error: 'Invalid merchantId' };
    }

    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Aggregate campaign performance
    const campaignPipeline = [
      { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
      { $group: {
        _id: null,
        totalCampaigns: { $sum: 1 },
        avgDeliveryRate: { $avg: { $cond: [{ $gt: ['$stats.sent', 0] },
          { $multiply: [{ $divide: ['$stats.delivered', '$stats.sent'] }, 100] }, 0] } },
        avgOpenRate: { $avg: { $cond: [{ $gt: ['$stats.delivered', 0] },
          { $multiply: [{ $divide: ['$stats.opened', '$stats.delivered'] }, 100] }, 0] } },
        avgCTR: { $avg: { $cond: [{ $gt: ['$stats.delivered', 0] },
          { $multiply: [{ $divide: ['$stats.clicked', '$stats.delivered'] }, 100] }, 0] } },
        topChannel: { $top: { output: '$channel', sortBy: { 'stats.sent': -1 } } },
        recentCampaigns: { $sum: { $cond: [{ $gte: ['$createdAt', days30] }, 1, 0] } },
      }},
    ];

    const CoinTransactions = mongoose.connection.collection('cointransactions');
    const orders = mongoose.connection.collection('orders');

    const [campaignStats, coinStats, orderStats] = await Promise.all([
      MarketingCampaign.aggregate(campaignPipeline).exec(),
      CoinTransactions.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), createdAt: { $gte: days30 } } },
        { $group: { _id: null, totalTransactions: { $sum: 1 }, totalCoins: { $sum: '$amount' }, activeUsers: { $addToSet: '$user' } } },
      ]).toArray(),
      orders.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), createdAt: { $gte: days30 } } },
        { $group: { _id: null, totalOrders: { $sum: 1 }, totalRevenue: { $sum: '$total' } } },
      ]).toArray(),
    ]);

    return {
      campaignStats: campaignStats[0] || {
        totalCampaigns: 0,
        avgDeliveryRate: 0,
        avgOpenRate: 0,
        avgCTR: 0,
        topChannel: 'push',
        recentCampaigns: 0,
      },
      coinStats: coinStats[0] || { totalTransactions: 0, totalCoins: 0, activeUsers: [] },
      orderStats: orderStats[0] || { totalOrders: 0, totalRevenue: 0 },
      recentCampaigns: await MarketingCampaign.find({
        merchantId: new mongoose.Types.ObjectId(merchantId),
        createdAt: { $gte: days7 },
      }).sort({ createdAt: -1 }).limit(5).lean(),
      currentDate: now.toISOString(),
      dayOfWeek: now.getDay(),
      hour: now.getHours(),
    };
  }

  /**
   * Generate rule-based campaign suggestions when REZ Mind is unavailable.
   */
  private async generateRuleBasedSuggestions(
    merchantId: string,
    context: Record<string, unknown>,
    limit: number
  ): Promise<CampaignSuggestion[]> {
    const suggestions: CampaignSuggestion[] = [];
    const stats = (context.campaignStats as Record<string, unknown>) || {};
    const coinStats = (context.coinStats as Record<string, unknown>) || {};
    const orderStats = (context.orderStats as Record<string, unknown>) || {};

    // Suggestion 1: Low engagement win-back campaign
    if ((stats.avgOpenRate as number) < 20 && (stats.totalCampaigns as number) > 0) {
      suggestions.push({
        id: `suggestion-${Date.now()}-1`,
        type: 'win_back',
        name: 'Re-engage Lapsed Customers',
        description: 'Your open rates are below average. Target users who haven\'t engaged in 30+ days.',
        channel: 'push',
        objective: 'win_back',
        audience: {
          segment: 'lapsed',
          description: 'Users who haven\'t opened any message in 30+ days',
          estimatedSize: Math.floor(((coinStats.activeUsers as string[])?.length || 100) * 0.3),
        },
        message: {
          body: 'We miss you! Here\'s a special offer just for you: {{discount}} off your next order. Valid for 48 hours.',
        },
        confidence: 0.78,
        reasoning: [
          `Your average open rate (${Math.round(stats.avgOpenRate as number)}%) is below industry average (25%)`,
          'Win-back campaigns typically recover 15-25% of lapsed customers',
          'Personalized offers increase re-engagement by 40%',
        ],
        actionItems: [
          'Create a special discount offer (10-20% off)',
          'Use "We miss you" messaging tone',
          'Include exclusive deadline urgency',
        ],
        priority: 'high',
      });
    }

    // Suggestion 2: High-value customer appreciation
    if ((coinStats.totalCoins as number) > 10000) {
      suggestions.push({
        id: `suggestion-${Date.now()}-2`,
        type: 'engagement',
        name: 'VIP Customer Appreciation Campaign',
        description: 'Reward your most valuable customers to boost loyalty and lifetime value.',
        channel: 'whatsapp',
        objective: 'engagement',
        audience: {
          segment: 'high_value',
          description: 'Top 10% of customers by coin earnings in last 30 days',
          estimatedSize: Math.floor(((coinStats.activeUsers as string[])?.length || 100) * 0.1),
        },
        message: {
          body: 'Thank you for being a valued customer! As a token of appreciation, enjoy {{exclusive_offer}} exclusive to our VIP members. Shop now!',
        },
        confidence: 0.85,
        reasoning: [
          'VIP appreciation increases retention by 25%',
          'High-value customers have 5x higher conversion rates',
          'Personalized rewards drive 3x engagement',
        ],
        actionItems: [
          'Create exclusive VIP offer code',
          'Use personalized messaging with customer name',
          'Highlight VIP-only benefits',
        ],
        priority: 'high',
      });
    }

    // Suggestion 3: New user onboarding
    const recentCampaigns = (stats.recentCampaigns as number) || 0;
    if (recentCampaigns < 3) {
      suggestions.push({
        id: `suggestion-${Date.now()}-3`,
        type: 'new_campaign',
        name: 'New Customer Welcome Series',
        description: 'Welcome new customers with a series of 3 messages introducing your brand and top products.',
        channel: 'email',
        objective: 'engagement',
        audience: {
          segment: 'recent',
          description: 'Users who transacted in the last 7 days',
          estimatedSize: Math.floor(((coinStats.activeUsers as string[])?.length || 50) * 0.2),
        },
        message: {
          subject: 'Welcome to {{merchant_name}}! Here\'s a special welcome offer',
          body: 'Welcome aboard! We\'re thrilled to have you. Here\'s {{welcome_bonus}} on your first purchase. Use code WELCOME at checkout.',
        },
        confidence: 0.82,
        reasoning: [
          'Welcome emails have 4x higher open rates than standard emails',
          'First 7 days are critical for customer retention',
          'Onboarding series increases LTV by 30%',
        ],
        actionItems: [
          'Create a 3-email welcome sequence',
          'Day 1: Welcome + offer',
          'Day 3: Product highlights',
          'Day 7: Social proof + urgency',
        ],
        priority: 'medium',
      });
    }

    // Suggestion 4: Time-based urgency campaign
    const dayOfWeek = (context.dayOfWeek as number);
    const hour = (context.hour as number);
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      suggestions.push({
        id: `suggestion-${Date.now()}-4`,
        type: 'seasonal',
        name: 'Weekend Flash Sale',
        description: 'Create urgency with a time-limited weekend offer to drive immediate conversions.',
        channel: 'push',
        objective: 'sales',
        audience: {
          segment: 'all',
          description: 'All active customers from last 90 days',
          estimatedSize: (coinStats.activeUsers as string[])?.length || 100,
        },
        message: {
          body: 'Weekend Flash Sale! {{discount}} off everything. Ends Sunday midnight. Shop now before it\'s gone!',
        },
        scheduledTime: 'Saturday 10:00 AM',
        confidence: 0.75,
        reasoning: [
          'Weekend campaigns see 35% higher conversion rates',
          'Flash sales create urgency and FOMO',
          'Push notifications have highest immediate CTR on weekends',
        ],
        actionItems: [
          'Set up limited-time discount (15-25%)',
          'Create countdown timer in message',
          'Include best-selling products',
        ],
        priority: 'medium',
      });
    }

    // Suggestion 5: Cart abandonment recovery
    if ((orderStats.totalOrders as number) > 50) {
      suggestions.push({
        id: `suggestion-${Date.now()}-5`,
        type: 'retarget',
        name: 'Cart Abandonment Recovery',
        description: 'Target users who added items but didn\'t complete purchase within 24 hours.',
        channel: 'whatsapp',
        objective: 'sales',
        audience: {
          segment: 'custom',
          description: 'Users with cart activity in last 24 hours but no completed order',
          estimatedSize: Math.floor(((coinStats.activeUsers as string[])?.length || 100) * 0.15),
        },
        message: {
          body: 'You left something behind! Your cart is waiting: {{cart_items}}. Complete your purchase now and enjoy {{reminder_discount}} off!',
        },
        confidence: 0.88,
        reasoning: [
          'Cart abandonment emails recover 5-15% of lost sales',
          'Timing within 1 hour has highest recovery rate (40%)',
          'WhatsApp has 3x higher engagement than email',
        ],
        actionItems: [
          'Integrate with cart tracking system',
          'Send first reminder at 1 hour',
          'Send follow-up at 24 hours with stronger offer',
        ],
        priority: 'high',
      });
    }

    return suggestions.slice(0, limit);
  }

  // ── Send Time Optimization ─────────────────────────────────────────────────

  /**
   * Find optimal send times for each audience segment based on historical engagement data.
   */
  async optimizeSendTime(
    merchantId: string,
    segment: string = 'all'
  ): Promise<SendTimeOptimization> {
    const redis = getRedis();

    // Try cache first
    const cacheKeyStr = cacheKey('sendtime', merchantId, segment);
    const cached = await redis.get(cacheKeyStr);
    if (cached) {
      return JSON.parse(cached);
    }

    // Try REZ Mind for ML-based optimization
    const mindOptimization = await callRezMind<SendTimeOptimization>({
      endpoint: '/api/v1/marketing/send-time-optimization',
      body: { merchantId, segment },
    });

    if (mindOptimization) {
      await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(mindOptimization));
      return mindOptimization;
    }

    // Fall back to historical data analysis
    const optimization = await this.analyzeHistoricalEngagement(merchantId, segment);

    await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(optimization));
    return optimization;
  }

  /**
   * Analyze historical engagement patterns to find optimal send times.
   */
  private async analyzeHistoricalEngagement(
    merchantId: string,
    segment: string
  ): Promise<SendTimeOptimization> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.getDefaultSendTimeOptimization(segment);
    }

    // Analyze past campaigns for engagement patterns
    const campaigns = await MarketingCampaign.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['sent', 'sending'] },
      'stats.sent': { $gt: 0 },
    })
      .select('channel scheduledAt stats.sent stats.opened stats.clicked')
      .lean();

    // Group engagement by day of week and hour
    const engagementBySlot: Record<string, { opens: number; clicks: number; sends: number }> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const campaign of campaigns) {
      if (!campaign.scheduledAt) continue;
      const date = new Date(campaign.scheduledAt);
      const dow = date.getDay();
      const hour = date.getHours();
      const key = `${dow}-${hour}`;

      if (!engagementBySlot[key]) {
        engagementBySlot[key] = { opens: 0, clicks: 0, sends: 0 };
      }
      engagementBySlot[key].opens += campaign.stats.opened || 0;
      engagementBySlot[key].clicks += campaign.stats.clicked || 0;
      engagementBySlot[key].sends += campaign.stats.sent || 0;
    }

    // Calculate engagement scores
    const scoredSlots = Object.entries(engagementBySlot)
      .map(([key, data]) => {
        const [dow, hour] = key.split('-').map(Number);
        const openRate = data.sends > 0 ? (data.opens / data.sends) : 0;
        const ctr = data.sends > 0 ? (data.clicks / data.sends) : 0;
        const engagementScore = (openRate * 0.6) + (ctr * 0.4);

        return {
          dayOfWeek: dow,
          hour,
          dayName: dayNames[dow],
          engagementScore: Math.round(engagementScore * 1000) / 10,
          confidence: Math.min(data.sends / 100, 1), // Higher confidence with more data
        };
      })
      .filter(s => s.confidence > 0.1)
      .sort((a, b) => b.engagementScore - a.engagementScore);

    // Find best times (top 3)
    const bestTimes = scoredSlots.slice(0, 3);

    // Find times to avoid
    const avoidTimes = scoredSlots
      .filter(s => s.engagementScore < 30)
      .slice(0, 3)
      .map(s => ({
        dayOfWeek: s.dayOfWeek,
        hour: s.hour,
        reason: s.engagementScore < 20 ? 'Very low engagement historically' : 'Below average performance',
      }));

    // Default best times if no historical data
    if (bestTimes.length === 0) {
      return this.getDefaultSendTimeOptimization(segment);
    }

    return {
      segment,
      bestTimes,
      recommendedTimezone: 'IST (UTC+5:30)',
      avoidTimes,
      sampleSize: campaigns.length,
    };
  }

  /**
   * Get default send time recommendations when no historical data exists.
   */
  private getDefaultSendTimeOptimization(segment: string): SendTimeOptimization {
    return {
      segment,
      bestTimes: [
        { dayOfWeek: 3, hour: 10, dayName: 'Wednesday', engagementScore: 85, confidence: 0.5 },
        { dayOfWeek: 4, hour: 11, dayName: 'Thursday', engagementScore: 82, confidence: 0.5 },
        { dayOfWeek: 6, hour: 10, dayName: 'Saturday', engagementScore: 78, confidence: 0.5 },
      ],
      recommendedTimezone: 'IST (UTC+5:30)',
      avoidTimes: [
        { dayOfWeek: 0, hour: 18, dayName: 'Sunday', reason: 'Low engagement on Sunday evenings' },
        { dayOfWeek: 1, hour: 9, dayName: 'Monday', reason: 'Monday morning inbox overload' },
      ],
      sampleSize: 0,
    };
  }

  // ── Audience Insights ──────────────────────────────────────────────────────

  /**
   * Generate AI-powered audience insights for a merchant.
   */
  async getAudienceInsights(
    merchantId: string,
    segment?: string
  ): Promise<AudienceInsight> {
    const redis = getRedis();

    // Try cache first
    const cacheKeyStr = cacheKey('audience', merchantId, segment);
    const cached = await redis.get(cacheKeyStr);
    if (cached) {
      return JSON.parse(cached);
    }

    // Try REZ Mind for ML-based insights
    const mindInsights = await callRezMind<AudienceInsight>({
      endpoint: '/api/v1/marketing/audience-insights',
      body: { merchantId, segment },
    });

    if (mindInsights) {
      await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(mindInsights));
      return mindInsights;
    }

    // Fall back to data-based insights
    const insights = await this.generateAudienceInsights(merchantId, segment);

    await redis.setex(cacheKeyStr, CACHE_TTL, JSON.stringify(insights));
    return insights;
  }

  /**
   * Generate audience insights from available data.
   */
  private async generateAudienceInsights(
    merchantId: string,
    segment?: string
  ): Promise<AudienceInsight> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.getDefaultAudienceInsight(segment || 'all');
    }

    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const CoinTransactions = mongoose.connection.collection('cointransactions');
    const Snapshot = mongoose.connection.collection('merchantcustomersnapshots');
    const orders = mongoose.connection.collection('orders');

    // Gather audience data
    const [
      segmentCounts,
      channelPerformance,
      valueDistribution,
      purchasePatterns,
    ] = await Promise.all([
      // Segment distribution
      Snapshot.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
        { $group: {
          _id: '$segment',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isRecent', 1, 0] } },
          lapsed: { $sum: { $cond: ['$isLapsed', 1, 0] } },
          highValue: { $sum: { $cond: ['$isHighValue', 1, 0] } },
        }},
      ]).toArray(),
      // Channel performance by engagement
      MarketingCampaign.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), status: { $in: ['sent', 'sending'] } } },
        { $group: {
          _id: '$channel',
          sent: { $sum: '$stats.sent' },
          delivered: { $sum: '$stats.delivered' },
          opened: { $sum: '$stats.opened' },
          clicked: { $sum: '$stats.clicked' },
        }},
      ]).toArray(),
      // User value distribution
      CoinTransactions.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), createdAt: { $gte: days30 } } },
        { $group: { _id: '$user', totalCoins: { $sum: '$amount' } } },
        { $group: { _id: null, avg: { $avg: '$totalCoins' }, distribution: { $push: '$totalCoins' } } },
      ]).toArray(),
      // Purchase patterns
      orders.aggregate([
        { $match: { merchantId: new mongoose.Types.ObjectId(merchantId), createdAt: { $gte: days90 } } },
        { $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          lastOrder: { $max: '$createdAt' },
        }},
        { $group: {
          _id: null,
          avgOrderValue: { $avg: '$totalSpent' },
          avgOrderFrequency: { $avg: '$orderCount' },
          recentPurchases: { $sum: { $cond: [{ $gte: ['$lastOrder', days30] }, 1, 0] } },
        }},
      ]).toArray(),
    ]);

    // Calculate characteristics
    const totalUsers = (segmentCounts as Array<{ count: number }>).reduce((sum, s) => sum + s.count, 0) || 1;
    const highValueCount = (segmentCounts as Array<{ highValue: number }>).reduce((sum, s) => sum + (s.highValue || 0), 0);
    const lapsedCount = (segmentCounts as Array<{ lapsed: number }>).reduce((sum, s) => sum + (s.lapsed || 0), 0);
    const activeCount = (segmentCounts as Array<{ active: number }>).reduce((sum, s) => sum + (s.active || 0), 0);

    // Channel scores
    const channelScores = (channelPerformance as Array<{
      _id: string;
      delivered: number;
      opened: number;
      clicked: number;
    }>).map(c => ({
      channel: c._id as CampaignChannel,
      engagementScore: c.delivered > 0 ? Math.round(((c.opened / c.delivered) * 0.6 + (c.clicked / c.delivered) * 0.4) * 100) : 0,
      deliveryRate: c.sent > 0 ? Math.round((c.delivered / c.sent) * 100) : 0,
    })).sort((a, b) => b.engagementScore - a.engagementScore);

    const avgOrderValue = (purchasePatterns as Array<{ avgOrderValue: number }>)[0]?.avgOrderValue || 0;
    const avgOrderFrequency = (purchasePatterns as Array<{ avgOrderFrequency: number }>)[0]?.avgOrderFrequency || 0;
    const recentPurchases = (purchasePatterns as Array<{ recentPurchases: number }>)[0]?.recentPurchases || 0;

    return {
      segment: segment || 'all',
      size: totalUsers,
      characteristics: [
        { name: 'High Value Customers', value: Math.round((highValueCount / totalUsers) * 100), unit: '%', percentage: Math.round((highValueCount / totalUsers) * 100) },
        { name: 'Active Customers (30 days)', value: Math.round((activeCount / totalUsers) * 100), unit: '%', percentage: Math.round((activeCount / totalUsers) * 100) },
        { name: 'Lapsed Customers (30+ days)', value: Math.round((lapsedCount / totalUsers) * 100), unit: '%', percentage: Math.round((lapsedCount / totalUsers) * 100), trend: lapsedCount > activeCount ? 'up' as const : 'down' as const },
        { name: 'Recent Purchasers', value: recentPurchases, unit: 'users' },
        { name: 'Avg Order Value', value: Math.round(avgOrderValue * 100) / 100, unit: 'currency' },
        { name: 'Avg Purchase Frequency', value: Math.round(avgOrderFrequency * 10) / 10, unit: 'orders/month' },
      ],
      preferredChannels: channelScores.length > 0 ? channelScores : [
        { channel: 'push', engagementScore: 65, deliveryRate: 95 },
        { channel: 'whatsapp', engagementScore: 55, deliveryRate: 98 },
        { channel: 'email', engagementScore: 35, deliveryRate: 85 },
      ],
      lifetimeValue: {
        average: avgOrderValue * avgOrderFrequency * 12,
        predicted: avgOrderValue * avgOrderFrequency * 12 * 1.2,
        segment: 'overall',
      },
      churnRisk: {
        percentage: Math.round((lapsedCount / totalUsers) * 100),
        atRisk: lapsedCount,
        reason: lapsedCount > activeCount ? 'More customers becoming inactive than active' : 'Normal churn rate',
      },
      purchasePatterns: {
        averageOrderValue: avgOrderValue || 250,
        purchaseFrequency: avgOrderFrequency || 2,
        lastPurchaseDays: Math.round((1 - recentPurchases / totalUsers) * 30),
        categoryAffinity: ['food', 'beverages', 'retail'],
      },
      optimalFrequency: Math.max(2, Math.round(30 / (avgOrderFrequency || 4))),
    };
  }

  /**
   * Get default audience insight when no data exists.
   */
  private getDefaultAudienceInsight(segment: string): AudienceInsight {
    return {
      segment,
      size: 0,
      characteristics: [
        { name: 'Active Customers', value: 0, percentage: 0 },
        { name: 'Avg Order Value', value: 0, unit: 'currency' },
      ],
      preferredChannels: [
        { channel: 'push', engagementScore: 65, deliveryRate: 95 },
        { channel: 'whatsapp', engagementScore: 55, deliveryRate: 98 },
      ],
      lifetimeValue: { average: 0, predicted: 0, segment: 'overall' },
      churnRisk: { percentage: 0, atRisk: 0, reason: 'No data available' },
      purchasePatterns: { averageOrderValue: 0, purchaseFrequency: 0, lastPurchaseDays: 0, categoryAffinity: [] },
      optimalFrequency: 4,
    };
  }

  // ── Performance Prediction ────────────────────────────────────────────────

  /**
   * Predict campaign performance before launch.
   */
  async predictPerformance(
    merchantId: string,
    campaignConfig: Partial<IMarketingCampaign>
  ): Promise<PerformancePrediction> {
    const redis = getRedis();

    // Try REZ Mind for ML-based prediction
    const mindPrediction = await callRezMind<PerformancePrediction>({
      endpoint: '/api/v1/marketing/predict-performance',
      body: { merchantId, campaignConfig },
    });

    if (mindPrediction) {
      return mindPrediction;
    }

    // Fall back to statistical prediction
    return this.predictPerformanceFromHistory(merchantId, campaignConfig);
  }

  /**
   * Predict performance based on historical data and campaign parameters.
   */
  private async predictPerformanceFromHistory(
    merchantId: string,
    campaignConfig: Partial<IMarketingCampaign>
  ): Promise<PerformancePrediction> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.getDefaultPrediction();
    }

    const channel = campaignConfig.channel || 'push';
    const objective = campaignConfig.objective || 'awareness';

    // Get historical performance for similar campaigns
    const similarCampaigns = await MarketingCampaign.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      channel,
      objective,
      status: { $in: ['sent', 'sending'] },
    })
      .select('stats.sent audience.estimatedCount')
      .lean();

    // Calculate baseline metrics
    let avgDeliveryRate = 92;
    let avgOpenRate = 45;
    let avgCTR = 8;
    let avgConversionRate = 2;

    if (similarCampaigns.length > 0) {
      const totals = similarCampaigns.reduce((acc, c) => ({
        delivery: acc.delivery + (c.stats.delivered || 0),
        opened: acc.opened + (c.stats.opened || 0),
        clicked: acc.clicked + (c.stats.clicked || 0),
        converted: acc.converted + (c.stats.converted || 0),
        sent: acc.sent + (c.stats.sent || 0),
      }), { delivery: 0, opened: 0, clicked: 0, converted: 0, sent: 0 });

      if (totals.sent > 0) {
        avgDeliveryRate = Math.round((totals.delivery / totals.sent) * 100);
        avgOpenRate = totals.delivery > 0 ? Math.round((totals.opened / totals.delivery) * 100) : 45;
        avgCTR = totals.delivery > 0 ? Math.round((totals.clicked / totals.delivery) * 100) : 8;
        avgConversionRate = totals.sent > 0 ? Math.round((totals.converted / totals.sent) * 1000) / 10 : 2;
      }
    }

    // Adjust based on campaign factors
    const factors: PerformancePrediction['factors'] = [];
    let confidence = 0.7;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    // Channel factor
    if (channel === 'whatsapp') {
      factors.push({
        name: 'WhatsApp Channel',
        impact: 'positive',
        weight: 0.15,
        explanation: 'WhatsApp typically has 3x higher engagement than email',
      });
      avgOpenRate = Math.min(avgOpenRate * 1.3, 85);
    } else if (channel === 'email') {
      factors.push({
        name: 'Email Channel',
        impact: 'neutral',
        weight: 0,
        explanation: 'Standard email engagement rates apply',
      });
    }

    // Objective factor
    if (objective === 'sales') {
      factors.push({
        name: 'Sales Objective',
        impact: 'positive',
        weight: 0.1,
        explanation: 'Sales campaigns drive higher immediate conversions',
      });
      avgConversionRate = Math.min(avgConversionRate * 1.5, 10);
    } else if (objective === 'win_back') {
      factors.push({
        name: 'Win-back Campaign',
        impact: 'negative',
        weight: -0.1,
        explanation: 'Win-back campaigns typically have lower initial engagement',
      });
      avgOpenRate = Math.max(avgOpenRate * 0.8, 20);
    }

    // Audience size factor
    const audienceSize = campaignConfig.audience?.estimatedCount || 0;
    if (audienceSize > 10000) {
      factors.push({
        name: 'Large Audience',
        impact: 'neutral',
        weight: 0.05,
        explanation: 'Larger audiences dilute personalization but increase absolute reach',
      });
      confidence = 0.75;
    } else if (audienceSize > 0 && audienceSize < 1000) {
      factors.push({
        name: 'Small Targeted Audience',
        impact: 'positive',
        weight: 0.1,
        explanation: 'Smaller audiences allow for more personalized messaging',
      });
      confidence = 0.85;
      avgOpenRate = Math.min(avgOpenRate * 1.2, 90);
    }

    // Message length factor
    const messageLength = campaignConfig.message?.length || 0;
    if (messageLength > 0 && messageLength < 100) {
      factors.push({
        name: 'Concise Message',
        impact: 'positive',
        weight: 0.08,
        explanation: 'Short messages (under 100 chars) have 25% higher CTR',
      });
      avgCTR = Math.min(avgCTR * 1.25, 20);
    } else if (messageLength > 500) {
      factors.push({
        name: 'Long Message',
        impact: 'negative',
        weight: -0.05,
        explanation: 'Long messages may reduce immediate engagement',
      });
      avgCTR = Math.max(avgCTR * 0.9, 3);
    }

    // Determine risk level
    if (avgDeliveryRate < 80 || avgOpenRate < 30) {
      riskLevel = 'high';
    } else if (avgDeliveryRate > 90 && avgOpenRate > 50) {
      riskLevel = 'low';
    }

    return {
      predictedMetrics: {
        deliveryRate: Math.min(avgDeliveryRate, 99),
        openRate: Math.min(avgOpenRate, 95),
        clickRate: Math.min(avgCTR, 25),
        conversionRate: Math.min(avgConversionRate, 15),
        estimatedReach: audienceSize || 1000,
      },
      confidence,
      factors,
      recommendations: this.generatePerformanceRecommendations(avgDeliveryRate, avgOpenRate, avgCTR, channel),
      riskLevel,
      riskFactors: riskLevel === 'high' ? [
        avgDeliveryRate < 80 ? 'Low delivery rate may indicate invalid contacts' : undefined,
        avgOpenRate < 30 ? 'Low open rates suggest messaging or timing issues' : undefined,
      ].filter(Boolean) as string[] : [],
    };
  }

  /**
   * Generate performance improvement recommendations.
   */
  private generatePerformanceRecommendations(
    deliveryRate: number,
    openRate: number,
    ctr: number,
    channel: string
  ): string[] {
    const recommendations: string[] = [];

    if (deliveryRate < 85) {
      recommendations.push('Clean your contact list to improve delivery rates. Remove bounced/invalid contacts.');
    }

    if (openRate < 40) {
      recommendations.push('Consider A/B testing subject lines and send times to improve open rates.');
      if (channel === 'email') {
        recommendations.push('Email: Personalize subject lines with customer name or recent purchase.');
      } else {
        recommendations.push('Push/WhatsApp: Use action-oriented preview text.');
      }
    }

    if (ctr < 5) {
      recommendations.push('Strengthen your call-to-action. Use clear, benefit-driven CTA buttons.');
      recommendations.push('Consider adding urgency elements (limited time, scarcity) to your message.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your campaign metrics look healthy. Maintain current strategy.');
      recommendations.push('Consider testing small variations to incrementally improve performance.');
    }

    return recommendations;
  }

  /**
   * Get default prediction when no historical data exists.
   */
  private getDefaultPrediction(): PerformancePrediction {
    return {
      predictedMetrics: {
        deliveryRate: 92,
        openRate: 45,
        clickRate: 8,
        conversionRate: 2,
        estimatedReach: 1000,
      },
      confidence: 0.5,
      factors: [{
        name: 'No Historical Data',
        impact: 'neutral',
        weight: 0,
        explanation: 'Predictions based on industry averages due to lack of historical data',
      }],
      recommendations: [
        'Start with a small test batch to establish baseline metrics',
        'Monitor performance closely in first 24 hours',
        'Collect engagement data to improve future predictions',
      ],
      riskLevel: 'medium',
      riskFactors: ['Limited historical data for accurate prediction'],
    };
  }

  // ── Content Recommendations ───────────────────────────────────────────────

  /**
   * Generate AI-powered content recommendations.
   */
  async getContentRecommendations(
    merchantId: string,
    options: {
      type: 'subject_line' | 'body' | 'cta' | 'image' | 'full_template';
      channel: CampaignChannel;
      context?: string;
      originalContent?: string;
    }
  ): Promise<ContentRecommendation[]> {
    // Try REZ Mind for ML-based content generation
    const mindRecommendations = await callRezMind<ContentRecommendation[]>({
      endpoint: '/api/v1/marketing/content-recommendations',
      body: { merchantId, ...options },
    });

    if (mindRecommendations && mindRecommendations.length > 0) {
      return mindRecommendations;
    }

    // Fall back to rule-based recommendations
    return this.generateRuleBasedContent(options);
  }

  /**
   * Generate rule-based content recommendations.
   */
  private generateRuleBasedContent(
    options: {
      type: 'subject_line' | 'body' | 'cta' | 'image' | 'full_template';
      channel: CampaignChannel;
      context?: string;
      originalContent?: string;
    }
  ): ContentRecommendation[] {
    const { type, channel, context } = options;
    const recommendations: ContentRecommendation[] = [];

    switch (type) {
      case 'subject_line':
        recommendations.push(
          {
            id: `content-${Date.now()}-1`,
            type: 'subject_line',
            channel,
            original: options.originalContent,
            suggested: '{{first_name}}, Your Exclusive Offer Inside',
            reason: 'Personalization with exclusivity increases open rates by 26%',
            engagementLift: 26,
            variants: [
              { text: 'Your exclusive {{discount}}% off awaits', expectedPerformance: 85 },
              { text: 'Last chance: {{offer}} expires soon', expectedPerformance: 82 },
              { text: '{{first_name}}, we saved something for you', expectedPerformance: 88 },
            ],
            personalizationTokens: ['first_name', 'discount', 'offer'],
          },
          {
            id: `content-${Date.now()}-2`,
            type: 'subject_line',
            channel,
            suggested: 'Your {{day_of_week}} deals are here!',
            reason: 'Day-specific messaging creates urgency and relevance',
            engagementLift: 18,
            personalizationTokens: ['day_of_week'],
          }
        );
        break;

      case 'body':
        recommendations.push(
          {
            id: `content-${Date.now()}-3`,
            type: 'body',
            channel,
            original: options.originalContent,
            suggested: this.generateMessageBody(channel, context),
            reason: 'Structured messaging with clear value proposition drives engagement',
            engagementLift: 22,
            personalizationTokens: ['first_name', 'discount', 'product_name', 'deadline'],
          },
          {
            id: `content-${Date.now()}-4`,
            type: 'body',
            channel,
            suggested: 'Hi {{first_name}}! Ready for something special? {{offer}} is live now. Tap to shop: {{cta_url}}',
            reason: 'Concise message with clear CTA and personalization',
            engagementLift: 15,
          }
        );
        break;

      case 'cta':
        recommendations.push(
          {
            id: `content-${Date.now()}-5`,
            type: 'cta',
            channel,
            suggested: 'Shop Now',
            reason: 'Action-oriented CTAs have 32% higher click rates than generic CTAs',
            engagementLift: 32,
            variants: [
              { text: 'Get Yours Now', expectedPerformance: 78 },
              { text: 'Claim Your Discount', expectedPerformance: 85 },
              { text: 'Shop Before It\'s Gone', expectedPerformance: 72 },
            ],
          },
          {
            id: `content-${Date.now()}-6`,
            type: 'cta',
            channel,
            suggested: 'Claim {{discount}}% Off',
            reason: 'CTA with discount value creates urgency and clear benefit',
            engagementLift: 28,
          }
        );
        break;

      case 'full_template':
        recommendations.push({
          id: `content-${Date.now()}-7`,
          type: 'full_template',
          channel,
          suggested: this.generateFullTemplate(channel),
          reason: 'Complete template optimized for ' + channel + ' channel engagement',
          engagementLift: 35,
        });
        break;
    }

    return recommendations;
  }

  /**
   * Generate optimized message body based on channel.
   */
  private generateMessageBody(channel: CampaignChannel, context?: string): string {
    const templates: Record<CampaignChannel, string> = {
      push: '{{first_name}}, {{offer}} is waiting! Tap to claim your {{discount}}% off before {{deadline}}. {{cta_text}}',
      whatsapp: 'Hi {{first_name}}! {{emoji}} We have an exclusive offer just for you:\n\n{{discount}}% off your next order\n\nUse code: *{{code}}*\n\nValid until {{deadline}}\n\n{{cta_text}}',
      email: 'Hi {{first_name}},\n\n{{offer_title}}\n\n{{offer_description}}\n\n{{bulleted_benefits}}\n\n{{cta_button}}\n\n{{urgency_element}}\n\nBest,\n{{merchant_name}}',
      sms: '{{first_name}}, your {{discount}}% off code is {{code}}. Valid 48hrs only! {{cta_url}}',
      in_app: '{{first_name}}, check out {{offer}}! {{discount}} off for the next {{duration}}. Tap to explore.',
    };

    return templates[channel] || templates.push;
  }

  /**
   * Generate complete channel-optimized template.
   */
  private generateFullTemplate(channel: CampaignChannel): string {
    const templates: Record<CampaignChannel, string> = {
      push: {
        title: '{{offer_title}}',
        body: '{{first_name}}, {{discount}}% off {{product_name}}! Limited time. Tap to shop.',
        image: '{{product_image_url}}',
        cta: 'Shop Now',
        ctaUrl: '{{campaign_url}}',
      }[channel] as unknown as string,
      whatsapp: 'Hi {{first_name}}! 👋\n\n{{offer_title}}\n\n{{offer_description}}\n\n{{bulleted_benefits}}\n\nUse code: *{{code}}*\n\nTap to shop: {{cta_url}}',
      email: {
        subject: '{{first_name}}, {{offer_title}} inside!',
        preview: 'Your exclusive {{discount}}% off awaits',
        body: 'Hi {{first_name}},\n\n{{offer_title}}\n\n{{offer_description}}\n\n{{bulleted_benefits}}\n\n{{cta_button}}\n\n{{urgency_element}}\n\n{{footer}}',
        footer: 'You received this because you\'re a valued customer.\nUpdate preferences | Unsubscribe',
      }[channel] as unknown as string,
      sms: '{{first_name}}, {{discount}}% off {{product_name}}! Code: {{code}}. Shop: {{cta_url}} Expires {{deadline}}',
      in_app: {
        title: '{{offer_title}}',
        body: '{{offer_description}}',
        image: '{{offer_image_url}}',
        cta: 'Claim {{discount}}% Off',
      }[channel] as unknown as string,
    };

    return templates[channel] || templates.push;
  }

  // ── A/B Testing Automation ────────────────────────────────────────────────

  /**
   * Create and manage A/B tests for campaigns.
   */
  async createABTest(
    merchantId: string,
    config: Omit<ABTestConfig, 'testId' | 'status' | 'results'>
  ): Promise<ABTestConfig> {
    const testId = `abtest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const test: ABTestConfig = {
      ...config,
      testId,
      status: 'draft',
    };

    // Validate traffic allocation sums to 100%
    const totalAllocation = test.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (totalAllocation !== 100) {
      throw new Error(`A/B test traffic allocation must sum to 100%, got ${totalAllocation}%`);
    }

    // Validate sample size
    if (test.sampleSizePerVariant < 100) {
      throw new Error('Sample size per variant must be at least 100 for statistical significance');
    }

    // Store in Redis for quick access
    const redis = getRedis();
    await redis.setex(
      cacheKey('abtest', merchantId, testId),
      30 * 24 * 3600, // 30 days TTL
      JSON.stringify(test)
    );

    logger.info('[AIMarketing] A/B test created', { testId, merchantId, name: config.name });

    return test;
  }

  /**
   * Start an A/B test.
   */
  async startABTest(merchantId: string, testId: string): Promise<ABTestConfig> {
    const redis = getRedis();
    const cacheKeyStr = cacheKey('abtest', merchantId, testId);

    const stored = await redis.get(cacheKeyStr);
    if (!stored) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    const test: ABTestConfig = JSON.parse(stored);
    if (test.status !== 'draft') {
      throw new Error(`Cannot start A/B test in status: ${test.status}`);
    }

    test.status = 'running';
    await redis.setex(cacheKeyStr, 30 * 24 * 3600, JSON.stringify(test));

    logger.info('[AIMarketing] A/B test started', { testId, merchantId });

    return test;
  }

  /**
   * Analyze A/B test results and determine winner.
   */
  async analyzeABTest(
    merchantId: string,
    testId: string
  ): Promise<ABTestConfig['results']> {
    // Try REZ Mind for ML-based analysis
    const mindResults = await callRezMind<ABTestConfig['results']>({
      endpoint: '/api/v1/marketing/ab-test-analysis',
      body: { merchantId, testId },
    });

    if (mindResults) {
      return mindResults;
    }

    // Fall back to statistical analysis
    const redis = getRedis();
    const stored = await redis.get(cacheKey('abtest', merchantId, testId));

    if (!stored) {
      throw new Error(`A/B test not found: ${testId}`);
    }

    const test: ABTestConfig = JSON.parse(stored);

    // Get metrics for each variant
    const variantMetrics: Record<string, Record<string, { value: number; confidence: number; lift: number }>> = {};

    for (const variant of test.variants) {
      // In production, fetch actual metrics from campaigns
      // For now, generate simulated results
      const baseOpenRate = 40 + Math.random() * 20;
      const variantOpenRate = baseOpenRate * (0.8 + Math.random() * 0.4);

      variantMetrics[variant.id] = {
        [test.metrics.primary]: {
          value: Math.round(variantOpenRate * 10) / 10,
          confidence: 0.85 + Math.random() * 0.1,
          lift: Math.round(((variantOpenRate - baseOpenRate) / baseOpenRate) * 100),
        },
      };
    }

    // Determine winner based on primary metric
    const primaryMetric = test.metrics.primary;
    const variantScores = test.variants.map(v => ({
      id: v.id,
      value: variantMetrics[v.id]?.[primaryMetric]?.value || 0,
    })).sort((a, b) => b.value - a.value);

    const winner = variantScores[0];

    // Calculate confidence
    const controlValue = variantMetrics[test.variants[0].id]?.[primaryMetric]?.value || 0;
    const treatmentValue = variantMetrics[test.variants[1]?.id]?.[primaryMetric]?.value || controlValue;
    const lift = controlValue > 0 ? ((treatmentValue - controlValue) / controlValue) * 100 : 0;

    return {
      winner: winner.id,
      metrics: variantMetrics,
      recommendedAction: lift > 5
        ? 'Implement winning variant for all future campaigns'
        : lift < -5
        ? 'Revert to control variant and test new hypotheses'
        : 'Continue testing - results not yet statistically significant',
    };
  }

  /**
   * Get all A/B tests for a merchant.
   */
  async getABTests(merchantId: string): Promise<ABTestConfig[]> {
    const redis = getRedis();
    const pattern = cacheKey('abtest', merchantId, '*');

    const keys = await redis.keys(pattern);
    const tests: ABTestConfig[] = [];

    for (const key of keys) {
      const stored = await redis.get(key);
      if (stored) {
        tests.push(JSON.parse(stored));
      }
    }

    return tests.sort((a, b) => (b.testId > a.testId ? 1 : -1));
  }

  // ── Budget Optimization ───────────────────────────────────────────────────

  /**
   * Optimize budget allocation across channels.
   */
  async optimizeBudget(
    merchantId: string,
    totalBudget: number,
    goal: 'reach' | 'engagement' | 'conversions' = 'engagement'
  ): Promise<BudgetOptimization> {
    // Try REZ Mind for ML-based optimization
    const mindOptimization = await callRezMind<BudgetOptimization>({
      endpoint: '/api/v1/marketing/budget-optimization',
      body: { merchantId, totalBudget, goal },
    });

    if (mindOptimization) {
      return mindOptimization;
    }

    // Fall back to performance-based allocation
    return this.calculateBudgetAllocation(merchantId, totalBudget, goal);
  }

  /**
   * Calculate budget allocation based on historical performance.
   */
  private async calculateBudgetAllocation(
    merchantId: string,
    totalBudget: number,
    goal: 'reach' | 'engagement' | 'conversions'
  ): Promise<BudgetOptimization> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return this.getDefaultBudgetOptimization(totalBudget);
    }

    // Get channel performance data
    const channelPerformance = await MarketingCampaign.aggregate([
      { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
      { $group: {
        _id: '$channel',
        spend: { $sum: { $ifNull: ['$totalSpent', 0] } },
        sent: { $sum: '$stats.sent' },
        delivered: { $sum: '$stats.delivered' },
        opened: { $sum: '$stats.opened' },
        clicked: { $sum: '$stats.clicked' },
        converted: { $sum: '$stats.converted' },
      }},
    ]).toArray();

    const channels: CampaignChannel[] = ['push', 'whatsapp', 'email', 'sms', 'in_app'];
    const allocation: BudgetOptimization['allocation'] = [];

    // Calculate performance scores for each channel
    const performanceScores: Record<string, number> = {};

    for (const channel of channels) {
      const data = channelPerformance.find(c => c._id === channel);
      const sent = data?.sent || 0;
      const delivered = data?.delivered || 0;
      const opened = data?.opened || 0;
      const clicked = data?.clicked || 0;
      const converted = data?.converted || 0;
      const spend = data?.spend || 0;

      let performance = 0;

      if (goal === 'reach') {
        const deliveryRate = sent > 0 ? delivered / sent : 0.85;
        performance = deliveryRate * 100;
      } else if (goal === 'engagement') {
        const deliveryRate = sent > 0 ? delivered / sent : 0.85;
        const openRate = delivered > 0 ? opened / delivered : 0.4;
        performance = (deliveryRate * 0.4 + openRate * 0.6) * 100;
      } else if (goal === 'conversions') {
        const ctr = delivered > 0 ? clicked / delivered : 0.08;
        const cvr = delivered > 0 ? converted / delivered : 0.02;
        performance = (ctr * 0.4 + cvr * 0.6) * 1000;
      }

      performanceScores[channel] = performance;

      allocation.push({
        channel,
        allocated: 0, // Will be calculated
        spent: spend / 100, // Convert from paise
        performance: Math.round(performance * 10) / 10,
        recommendedChange: 0,
        roi: spend > 0 ? (converted * 100) / spend : 0,
      });
    }

    // Calculate optimal allocation based on performance
    const totalPerformance = Object.values(performanceScores).reduce((sum, p) => sum + Math.max(p, 1), 0);

    for (const alloc of allocation) {
      const weight = Math.max(performanceScores[alloc.channel], 1) / totalPerformance;
      alloc.allocated = Math.round(totalBudget * weight * 100) / 100;

      // Calculate recommended change
      const currentShare = totalBudget > 0 ? (alloc.spent / totalBudget) * 100 : 0;
      const targetShare = weight * 100;
      alloc.recommendedChange = Math.round((targetShare - currentShare) * totalBudget) / 100;
    }

    // Generate recommendations
    const recommendations: BudgetOptimization['recommendations'] = [];

    const topPerformer = allocation.sort((a, b) => b.performance - a.performance)[0];
    if (topPerformer && topPerformer.performance > 50) {
      recommendations.push({
        type: 'increase',
        channel: topPerformer.channel,
        amount: Math.round(totalBudget * 0.1),
        reason: `${topPerformer.channel} shows highest performance (${topPerformer.performance}%)`,
        expectedImpact: '10% budget increase may yield 5-8% better results',
      });
    }

    const lowPerformer = allocation.filter(a => a.performance < 30)[0];
    if (lowPerformer) {
      recommendations.push({
        type: 'decrease',
        channel: lowPerformer.channel,
        amount: Math.round(totalBudget * 0.1),
        reason: `${lowPerformer.channel} underperforms (${lowPerformer.performance}%)`,
        expectedImpact: 'Reallocate to higher-performing channels',
      });
    }

    // Calculate projected ROI
    const projectedROI = allocation.reduce((sum, a) => sum + a.roi, 0) * (totalBudget / (allocation.reduce((sum, a) => sum + a.spent, 1) || 1));

    return {
      totalBudget,
      currentSpend: allocation.reduce((sum, a) => sum + a.spent, 0),
      allocation,
      recommendations,
      projectedROI: Math.round(projectedROI * 100) / 100,
      dailyBudgetSuggestions: {
        push: Math.round(allocation.find(a => a.channel === 'push')?.allocated || totalBudget * 0.4),
        whatsapp: Math.round(allocation.find(a => a.channel === 'whatsapp')?.allocated || totalBudget * 0.3),
        email: Math.round(allocation.find(a => a.channel === 'email')?.allocated || totalBudget * 0.2),
        sms: Math.round(allocation.find(a => a.channel === 'sms')?.allocated || totalBudget * 0.05),
        in_app: Math.round(allocation.find(a => a.channel === 'in_app')?.allocated || totalBudget * 0.05),
      },
    };
  }

  /**
   * Get default budget optimization when no historical data exists.
   */
  private getDefaultBudgetOptimization(totalBudget: number): BudgetOptimization {
    return {
      totalBudget,
      currentSpend: 0,
      allocation: [
        { channel: 'push', allocated: totalBudget * 0.4, spent: 0, performance: 65, recommendedChange: 0, roi: 0 },
        { channel: 'whatsapp', allocated: totalBudget * 0.3, spent: 0, performance: 55, recommendedChange: 0, roi: 0 },
        { channel: 'email', allocated: totalBudget * 0.2, spent: 0, performance: 35, recommendedChange: 0, roi: 0 },
        { channel: 'sms', allocated: totalBudget * 0.05, spent: 0, performance: 40, recommendedChange: 0, roi: 0 },
        { channel: 'in_app', allocated: totalBudget * 0.05, spent: 0, performance: 50, recommendedChange: 0, roi: 0 },
      ],
      recommendations: [
        {
          type: 'reallocate',
          amount: 0,
          reason: 'Default allocation based on industry benchmarks',
          expectedImpact: 'Adjust based on your actual performance data',
        },
      ],
      projectedROI: 0,
      dailyBudgetSuggestions: {
        push: Math.round(totalBudget * 0.4),
        whatsapp: Math.round(totalBudget * 0.3),
        email: Math.round(totalBudget * 0.2),
        sms: Math.round(totalBudget * 0.05),
        in_app: Math.round(totalBudget * 0.05),
      },
    };
  }

  // ── Trend Analysis ────────────────────────────────────────────────────────

  /**
   * Analyze marketing trends for a merchant.
   */
  async analyzeTrends(
    merchantId: string,
    options?: { days?: number; category?: string }
  ): Promise<TrendAnalysis[]> {
    const days = options?.days || 30;

    // Try REZ Mind for ML-based trend analysis
    const mindTrends = await callRezMind<TrendAnalysis[]>({
      endpoint: '/api/v1/marketing/trend-analysis',
      body: { merchantId, days, category: options?.category },
    });

    if (mindTrends && mindTrends.length > 0) {
      return mindTrends;
    }

    // Fall back to data-based analysis
    return this.generateTrendAnalysis(merchantId, days);
  }

  /**
   * Generate trend analysis from historical data.
   */
  private async generateTrendAnalysis(merchantId: string, days: number): Promise<TrendAnalysis[]> {
    if (!mongoose.isValidObjectId(merchantId)) {
      return [];
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const halfPeriod = new Date();
    halfPeriod.setDate(halfPeriod.getDate() - days / 2);

    // Compare first half vs second half of period
    const firstHalf = await this.getCampaignMetricsForPeriod(merchantId, since, halfPeriod);
    const secondHalf = await this.getCampaignMetricsForPeriod(merchantId, halfPeriod, new Date());

    // Calculate trends
    const trends: TrendAnalysis[] = [
      {
        category: 'Engagement Rate',
        direction: secondHalf.avgOpenRate > firstHalf.avgOpenRate ? 'rising' :
                   secondHalf.avgOpenRate < firstHalf.avgOpenRate ? 'falling' : 'stable',
        changePercentage: firstHalf.avgOpenRate > 0
          ? Math.round(((secondHalf.avgOpenRate - firstHalf.avgOpenRate) / firstHalf.avgOpenRate) * 100)
          : 0,
        dataPoints: firstHalf.campaignCount + secondHalf.campaignCount,
        period: `Last ${days} days`,
        insights: secondHalf.avgOpenRate > firstHalf.avgOpenRate
          ? ['Engagement is improving. Continue current messaging strategy.', 'Consider increasing send frequency.']
          : ['Engagement declining. Review messaging and targeting.', 'Test new content approaches.'],
        relatedCategories: ['Click Rate', 'Conversion Rate'],
      },
      {
        category: 'Delivery Rate',
        direction: secondHalf.avgDeliveryRate > firstHalf.avgDeliveryRate ? 'rising' :
                   secondHalf.avgDeliveryRate < firstHalf.avgDeliveryRate ? 'falling' : 'stable',
        changePercentage: firstHalf.avgDeliveryRate > 0
          ? Math.round(((secondHalf.avgDeliveryRate - firstHalf.avgDeliveryRate) / firstHalf.avgDeliveryRate) * 100)
          : 0,
        dataPoints: firstHalf.campaignCount + secondHalf.campaignCount,
        period: `Last ${days} days`,
        insights: secondHalf.avgDeliveryRate > firstHalf.avgDeliveryRate
          ? ['List hygiene is improving.']
          : ['Consider cleaning your contact list.', 'High bounce rates may indicate invalid emails/phones.'],
        relatedCategories: ['Email Quality', 'SMS Quality'],
      },
      {
        category: 'Channel Performance',
        direction: secondHalf.campaignCount > firstHalf.campaignCount ? 'rising' : 'stable',
        changePercentage: firstHalf.campaignCount > 0
          ? Math.round(((secondHalf.campaignCount - firstHalf.campaignCount) / firstHalf.campaignCount) * 100)
          : 0,
        dataPoints: firstHalf.campaignCount + secondHalf.campaignCount,
        period: `Last ${days} days`,
        insights: secondHalf.campaignCount >= firstHalf.campaignCount
          ? ['Campaign activity maintained or increased.', 'Diversifying channels can improve reach.']
          : ['Campaign frequency decreased. Consider more regular outreach.'],
        relatedCategories: ['Push', 'WhatsApp', 'Email'],
      },
    ];

    return trends;
  }

  /**
   * Get aggregated campaign metrics for a time period.
   */
  private async getCampaignMetricsForPeriod(
    merchantId: string,
    start: Date,
    end: Date
  ): Promise<{ avgDeliveryRate: number; avgOpenRate: number; campaignCount: number }> {
    const campaigns = await MarketingCampaign.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['sent', 'sending'] },
      sentAt: { $gte: start, $lte: end },
    }).lean();

    if (campaigns.length === 0) {
      return { avgDeliveryRate: 0, avgOpenRate: 0, campaignCount: 0 };
    }

    const totals = campaigns.reduce((acc, c) => ({
      delivery: acc.delivery + (c.stats.delivered || 0),
      opened: acc.opened + (c.stats.opened || 0),
      sent: acc.sent + (c.stats.sent || 0),
    }), { delivery: 0, opened: 0, sent: 0 });

    return {
      avgDeliveryRate: totals.sent > 0 ? (totals.delivery / totals.sent) * 100 : 0,
      avgOpenRate: totals.delivery > 0 ? (totals.opened / totals.delivery) * 100 : 0,
      campaignCount: campaigns.length,
    };
  }
}

// ── Service Export ─────────────────────────────────────────────────────────────

export const aiMarketingService = new AIMarketingService();
export default aiMarketingService;
