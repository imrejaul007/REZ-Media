/**
 * Lead Intelligence Service
 * Core business logic for lead scoring, detection, and re-engagement
 */

import axios, { AxiosInstance } from 'axios';
import config from '../config';
import {
  LeadScore,
  AbandonedSearch,
  AbandonedCart,
  RecommendedChannel,
  LeadTemperature,
  ChannelPreference,
  ChannelScore,
  ReEngagementResult,
  PurchasePrediction,
  LeadSignalEvent,
} from '../types';
import {
  LeadScoreModel,
  AbandonedSearchModel,
  AbandonedCartModel,
  ChannelPreferenceModel,
  EngagementActionModel,
  UserActivityCacheModel,
} from '../models';
import { logger } from '@rez/shared';

// ============================================================================
// ReZ Mind Integration
// ============================================================================

class ReZMindClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.services.mind || 'https://rez-event-platform.onrender.com';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send lead signal event to ReZ Mind for learning
   */
  async sendSignalEvent(event: LeadSignalEvent): Promise<{ success: boolean; correlationId?: string }> {
    try {
      const response = await this.client.post('/webhook/lead/signal', {
        ...event,
        source: 'lead_intelligence_service',
        timestamp: new Date().toISOString(),
      });

      return {
        success: response.data?.success !== false,
        correlationId: response.data?.correlationId || response.data?.correlation_id,
      };
    } catch (error: any) {
      logger.warn('[ReZ Mind] Failed to send signal event', {
        error: error.message,
        eventType: event.eventType,
        userId: event.userId,
      });
      return { success: false };
    }
  }

  /**
   * Send lead score update to ReZ Mind
   */
  async sendLeadScoreUpdate(
    userId: string,
    score: LeadScore
  ): Promise<{ success: boolean }> {
    return this.sendSignalEvent({
      eventType: 'lead_score_updated',
      userId,
      timestamp: new Date(),
      data: {
        temperature: score.temperature,
        score: score.score,
        signals: score.signals,
        recommendedChannel: score.recommendedChannel,
      },
    });
  }

  /**
   * Send abandoned cart event to ReZ Mind
   */
  async sendAbandonedCartEvent(cart: AbandonedCart): Promise<{ success: boolean }> {
    return this.sendSignalEvent({
      eventType: 'abandoned_cart',
      userId: cart.userId,
      timestamp: new Date(),
      data: {
        cartId: cart.cartId,
        totalValue: cart.totalValue,
        itemCount: cart.items.length,
        urgencyLevel: cart.items.length > 3 ? 'high' : cart.totalValue > 100 ? 'high' : 'medium',
      },
    });
  }

  /**
   * Send abandoned search event to ReZ Mind
   */
  async sendAbandonedSearchEvent(search: AbandonedSearch): Promise<{ success: boolean }> {
    return this.sendSignalEvent({
      eventType: 'abandoned_search',
      userId: search.userId,
      timestamp: new Date(),
      data: {
        query: search.query,
        resultsCount: search.resultsShown.length,
        intentDetected: search.intentDetected,
        urgencyLevel: search.urgencyLevel,
      },
    });
  }
}

// ============================================================================
// Marketing Service Integration
// ============================================================================

class MarketingServiceClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = config.services.marketing || 'https://rez-marketing-service.onrender.com';
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Notify marketing service of re-engagement action
   */
  async notifyReEngagement(
    userId: string,
    channel: RecommendedChannel,
    action: string
  ): Promise<{ success: boolean }> {
    try {
      await this.client.post('/api/v1/engagement/track', {
        userId,
        channel,
        action,
        source: 'lead_intelligence_service',
        timestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error: any) {
      logger.warn('[Marketing] Failed to notify engagement', {
        error: error.message,
        userId,
        channel,
      });
      return { success: false };
    }
  }

  /**
   * Get campaign recommendations for user segment
   */
  async getCampaignRecommendations(
    temperature: LeadTemperature
  ): Promise<{ success: boolean; campaigns?: string[] }> {
    try {
      const response = await this.client.get(`/api/v1/campaigns/recommend`, {
        params: { segment: temperature },
      });
      return {
        success: true,
        campaigns: response.data?.campaigns,
      };
    } catch (error) {
      return { success: false };
    }
  }
}

// ============================================================================
// Notification Service Integration
// ============================================================================

class NotificationServiceClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = config.services.notification || 'https://rez-notification-service.onrender.com';
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send notification via specified channel
   */
  async sendNotification(
    userId: string,
    channel: RecommendedChannel,
    message: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const payload = {
        userId,
        channel,
        message,
        metadata: {
          ...metadata,
          source: 'lead_intelligence_service',
        },
      };

      const response = await this.client.post('/api/v1/notifications/send', payload);

      return {
        success: response.data?.success !== false,
        messageId: response.data?.messageId,
      };
    } catch (error: any) {
      logger.warn('[Notification] Failed to send notification', {
        error: error.message,
        userId,
        channel,
      });
      return { success: false };
    }
  }
}

// ============================================================================
// Main Lead Intelligence Service
// ============================================================================

export class LeadIntelligenceService {
  private rezMind: ReZMindClient;
  private marketing: MarketingServiceClient;
  private notifications: NotificationServiceClient;

  constructor() {
    this.rezMind = new ReZMindClient();
    this.marketing = new MarketingServiceClient();
    this.notifications = new NotificationServiceClient();
  }

  // ==========================================================================
  // Lead Scoring
  // ==========================================================================

  /**
   * Calculate comprehensive lead score for a user
   */
  async getLeadScore(userId: string): Promise<LeadScore> {
    logger.info('[LeadIntelligence] Calculating lead score', { userId });

    // Get user activity signals
    const signals = await this.calculateSignals(userId);

    // Calculate individual signal scores
    const signalScores = {
      recentSearches: this.scoreRecentSearches(signals.recentSearches),
      abandonedCarts: this.scoreAbandonedCarts(signals.abandonedCarts),
      viewedProducts: this.scoreViewedProducts(signals.viewedProducts),
      lastActiveHours: this.scoreLastActive(signals.lastActiveHours),
      intentStrength: signals.intentStrength,
      purchaseProbability: signals.purchaseProbability,
    };

    // Calculate weighted total score
    const weights = config.scoring.weights;
    const score =
      signalScores.recentSearches * weights.recentSearches +
      signalScores.abandonedCarts * weights.abandonedCarts +
      signalScores.viewedProducts * weights.viewedProducts +
      signalScores.lastActiveHours * weights.lastActiveHours +
      signalScores.intentStrength * weights.intentStrength +
      signalScores.purchaseProbability * weights.purchaseProbability;

    // Determine temperature
    const temperature = this.determineTemperature(score);

    // Determine recommended channel
    const recommendedChannel = await this.getRecommendedChannel(userId);

    // Determine recommended action
    const recommendedAction = this.determineRecommendedAction(temperature, signals);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.cache.leadScoreTTL * 1000);

    const leadScore: LeadScore = {
      userId,
      temperature,
      score: Math.round(score * 100) / 100,
      signals,
      recommendedChannel,
      recommendedAction,
      calculatedAt: now,
      expiresAt,
    };

    // Save/update lead score in database
    await this.saveLeadScore(leadScore);

    // Send to ReZ Mind for learning
    await this.rezMind.sendLeadScoreUpdate(userId, leadScore);

    logger.info('[LeadIntelligence] Lead score calculated', {
      userId,
      temperature,
      score: leadScore.score,
      recommendedChannel,
    });

    return leadScore;
  }

  /**
   * Calculate signals from user activity
   */
  private async calculateSignals(userId: string): Promise<LeadScore['signals']> {
    // Get cached activity data
    const activityCache = await UserActivityCacheModel.findOne({ userId });

    if (!activityCache) {
      return {
        recentSearches: 0,
        abandonedCarts: 0,
        viewedProducts: 0,
        lastActiveHours: 0,
        intentStrength: 0,
        purchaseProbability: 0,
      };
    }

    // Calculate recent searches (last 24 hours)
    const recentSearches = activityCache.searches.filter(
      (s) => new Date(s.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    // Get abandoned cart count
    const abandonedCarts = await AbandonedCartModel.countDocuments({
      userId,
      recovered: false,
      abandonedAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Calculate viewed products
    const viewedProducts = activityCache.views.filter(
      (v) => new Date(v.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    // Calculate hours since last active
    const lastActiveHours = activityCache.lastActive
      ? Math.round((Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60))
      : 999;

    // Calculate intent strength based on search patterns
    const intentStrength = this.calculateIntentStrength(activityCache);

    // Calculate purchase probability
    const purchaseProbability = await this.predictPurchaseProbability(userId, activityCache);

    return {
      recentSearches,
      abandonedCarts,
      viewedProducts,
      lastActiveHours,
      intentStrength,
      purchaseProbability,
    };
  }

  /**
   * Calculate intent strength based on search behavior
   */
  private calculateIntentStrength(activityCache: any): number {
    if (!activityCache.searches || activityCache.searches.length === 0) {
      return 0;
    }

    const searches = activityCache.searches;
    let strength = 0;

    // Factor 1: Number of searches (more searches = higher intent)
    strength += Math.min(searches.length * 0.1, 0.3);

    // Factor 2: Search refinement (user searching again for similar terms = higher intent)
    const uniqueQueries = new Set(searches.map((s: any) => s.query.toLowerCase()));
    const refinementBonus = searches.length > uniqueQueries.size ? 0.2 : 0;
    strength += refinementBonus;

    // Factor 3: Results clicked vs shown (engagement ratio)
    const totalShown = searches.reduce((sum: number, s: any) => sum + (s.resultsCount || 0), 0);
    const totalClicked = searches.reduce(
      (sum: number, s: any) => sum + (s.clickedResults?.length || 0),
      0
    );
    if (totalShown > 0) {
      strength += Math.min((totalClicked / totalShown) * 0.3, 0.3);
    }

    // Factor 4: Intent detected
    const hasStrongIntent = searches.some(
      (s: any) => s.intentDetected && ['buy', 'purchase', 'order', 'price'].includes(s.intentDetected.toLowerCase())
    );
    if (hasStrongIntent) {
      strength += 0.2;
    }

    return Math.min(strength, 1);
  }

  /**
   * Predict purchase probability using ML model or heuristic fallback
   */
  private async predictPurchaseProbability(
    userId: string,
    activityCache: any
  ): Promise<number> {
    try {
      // Try to call ML model server
      const response = await axios.post(`${config.ml.modelServer}/predict/purchase`, {
        userId,
        features: {
          viewCount: activityCache.views?.length || 0,
          searchCount: activityCache.searches?.length || 0,
          cartAddCount: activityCache.cartActions?.filter(
            (a: any) => a.action === 'add'
          ).length || 0,
          sessionCount: activityCache.sessionCount || 1,
          lastActiveHours: activityCache.lastActive
            ? (Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60)
            : 999,
        },
      }, {
        timeout: 3000,
      });

      return response.data?.probability || this.heuristicPurchaseProbability(activityCache);
    } catch {
      // Fallback to heuristic
      return this.heuristicPurchaseProbability(activityCache);
    }
  }

  /**
   * Heuristic-based purchase probability calculation
   */
  private heuristicPurchaseProbability(activityCache: any): number {
    let probability = 0.1; // Base probability

    // Cart additions increase probability significantly
    const cartAdds = activityCache.cartActions?.filter(
      (a: any) => a.action === 'add'
    ).length || 0;
    probability += Math.min(cartAdds * 0.15, 0.45);

    // Multiple product views increase probability
    const views = activityCache.views?.length || 0;
    probability += Math.min(views * 0.05, 0.25);

    // Active searchers are more likely to purchase
    const searches = activityCache.searches?.length || 0;
    probability += Math.min(searches * 0.03, 0.15);

    // Recent activity is better
    if (activityCache.lastActive) {
      const hoursSinceActive =
        (Date.now() - new Date(activityCache.lastActive).getTime()) / (1000 * 60 * 60);
      if (hoursSinceActive < 24) {
        probability += 0.1;
      } else if (hoursSinceActive < 72) {
        probability += 0.05;
      }
    }

    return Math.min(probability, 1);
  }

  /**
   * Score recent searches (0-100)
   */
  private scoreRecentSearches(count: number): number {
    if (count === 0) return 0;
    if (count <= 2) return 30;
    if (count <= 5) return 60;
    if (count <= 10) return 80;
    return 100;
  }

  /**
   * Score abandoned carts (0-100)
   */
  private scoreAbandonedCarts(count: number): number {
    if (count === 0) return 0;
    if (count === 1) return 70; // Has cart but abandoned
    if (count === 2) return 85;
    return 100; // Multiple carts = high intent
  }

  /**
   * Score viewed products (0-100)
   */
  private scoreViewedProducts(count: number): number {
    if (count === 0) return 0;
    if (count <= 3) return 30;
    if (count <= 7) return 60;
    if (count <= 15) return 80;
    return 100;
  }

  /**
   * Score last active hours (0-100, recent = higher)
   */
  private scoreLastActive(hours: number): number {
    if (hours <= 1) return 100;
    if (hours <= 6) return 80;
    if (hours <= 24) return 60;
    if (hours <= 72) return 30;
    if (hours <= 168) return 15; // 7 days
    return 0;
  }

  /**
   * Determine temperature based on score
   */
  private determineTemperature(score: number): LeadTemperature {
    if (score >= config.thresholds.hot) return 'hot';
    if (score >= config.thresholds.warm) return 'warm';
    return 'cold';
  }

  /**
   * Save lead score to database
   */
  private async saveLeadScore(leadScore: LeadScore): Promise<void> {
    await LeadScoreModel.findOneAndUpdate(
      { userId: leadScore.userId },
      {
        userId: leadScore.userId,
        temperature: leadScore.temperature,
        score: leadScore.score,
        signals: leadScore.signals,
        recommendedChannel: leadScore.recommendedChannel,
        recommendedAction: leadScore.recommendedAction,
        calculatedAt: leadScore.calculatedAt,
        expiresAt: leadScore.expiresAt,
      },
      { upsert: true, new: true }
    );
  }

  // ==========================================================================
  // Lead Detection
  // ==========================================================================

  /**
   * Detect all hot leads
   */
  async detectHotLeads(options: { limit?: number; offset?: number } = {}): Promise<LeadScore[]> {
    const { limit = 100, offset = 0 } = options;

    logger.info('[LeadIntelligence] Detecting hot leads', { limit, offset });

    const leads = await LeadScoreModel.find({
      temperature: 'hot',
      expiresAt: { $gt: new Date() },
    })
      .sort({ score: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    logger.info('[LeadIntelligence] Hot leads detected', { count: leads.length });

    return leads as LeadScore[];
  }

  /**
   * Detect all warm leads
   */
  async detectWarmLeads(options: { limit?: number; offset?: number } = {}): Promise<LeadScore[]> {
    const { limit = 100, offset = 0 } = options;

    logger.info('[LeadIntelligence] Detecting warm leads', { limit, offset });

    const leads = await LeadScoreModel.find({
      temperature: 'warm',
      expiresAt: { $gt: new Date() },
    })
      .sort({ score: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    logger.info('[LeadIntelligence] Warm leads detected', { count: leads.length });

    return leads as LeadScore[];
  }

  /**
   * Detect all cold leads
   */
  async detectColdLeads(options: { limit?: number; offset?: number } = {}): Promise<LeadScore[]> {
    const { limit = 100, offset = 0 } = options;

    logger.info('[LeadIntelligence] Detecting cold leads', { limit, offset });

    const leads = await LeadScoreModel.find({
      temperature: 'cold',
      expiresAt: { $gt: new Date() },
    })
      .sort({ score: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    logger.info('[LeadIntelligence] Cold leads detected', { count: leads.length });

    return leads as LeadScore[];
  }

  // ==========================================================================
  // Abandoned Cart Tracking
  // ==========================================================================

  /**
   * Track an abandoned cart
   */
  async trackAbandonedCart(
    userId: string,
    cartId: string,
    items: AbandonedCart['items'],
    totalValue: number
  ): Promise<AbandonedCart> {
    logger.info('[LeadIntelligence] Tracking abandoned cart', { userId, cartId, totalValue });

    const expiresAt = new Date(Date.now() + config.reEngagement.cartExpiryHours * 60 * 60 * 1000);

    const abandonedCart = await AbandonedCartModel.findOneAndUpdate(
      { cartId },
      {
        userId,
        cartId,
        items,
        totalValue,
        abandonedAt: new Date(),
        reminderCount: 0,
        recovered: false,
        expiresAt,
      },
      { upsert: true, new: true }
    );

    // Update user activity cache
    await this.updateUserActivityCache(userId, { cartActions: items.map((i) => ({ action: 'add' as const, productId: i.productId, quantity: i.quantity })) });

    // Send to ReZ Mind for learning
    await this.rezMind.sendAbandonedCartEvent(abandonedCart);

    // Recalculate lead score
    await this.getLeadScore(userId);

    logger.info('[LeadIntelligence] Abandoned cart tracked', {
      userId,
      cartId,
      itemCount: items.length,
      totalValue,
    });

    return abandonedCart;
  }

  /**
   * Get all abandoned carts for a user
   */
  async getAbandonedCarts(userId: string): Promise<AbandonedCart[]> {
    return AbandonedCartModel.find({
      userId,
      recovered: false,
      expiresAt: { $gt: new Date() },
    }).lean() as unknown as AbandonedCart[];
  }

  /**
   * Mark cart as recovered
   */
  async markCartRecovered(cartId: string): Promise<void> {
    await AbandonedCartModel.findOneAndUpdate(
      { cartId },
      {
        recovered: true,
        recoveredAt: new Date(),
      }
    );
  }

  // ==========================================================================
  // Abandoned Search Tracking
  // ==========================================================================

  /**
   * Track an abandoned search
   */
  async trackAbandonedSearch(
    userId: string,
    query: string,
    resultsShown: string[],
    notClicked: string[],
    intentDetected: string = '',
    urgencyLevel: AbandonedSearch['urgencyLevel'] = 'low'
  ): Promise<AbandonedSearch> {
    logger.info('[LeadIntelligence] Tracking abandoned search', {
      userId,
      query,
      resultCount: resultsShown.length,
      notClickedCount: notClicked.length,
    });

    const abandonedSearch = new AbandonedSearchModel({
      userId,
      query,
      resultsShown,
      notClicked,
      timestamp: new Date(),
      intentDetected,
      urgencyLevel,
      reEngaged: false,
      reEngagementAttempts: 0,
    });

    await abandonedSearch.save();

    // Update user activity cache
    await this.updateUserActivityCache(userId, {
      searches: [{ query, resultsCount: resultsShown.length, clickedResults: [], intentDetected }],
    });

    // Send to ReZ Mind for learning
    await this.rezMind.sendAbandonedSearchEvent(abandonedSearch);

    // Recalculate lead score
    await this.getLeadScore(userId);

    logger.info('[LeadIntelligence] Abandoned search tracked', {
      userId,
      query,
      intentDetected,
      urgencyLevel,
    });

    return abandonedSearch.toObject();
  }

  /**
   * Get all abandoned searches for a user
   */
  async getAbandonedSearches(userId: string): Promise<AbandonedSearch[]> {
    return AbandonedSearchModel.find({
      userId,
      reEngaged: false,
    }).lean() as unknown as AbandonedSearch[];
  }

  /**
   * Mark search as re-engaged
   */
  async markSearchReEngaged(searchId: string): Promise<void> {
    await AbandonedSearchModel.findByIdAndUpdate(searchId, {
      reEngaged: true,
      $inc: { reEngagementAttempts: 1 },
    });
  }

  // ==========================================================================
  // Channel Selection
  // ==========================================================================

  /**
   * Get recommended channel for user
   */
  async getRecommendedChannel(userId: string): Promise<RecommendedChannel> {
    const channelScores = await this.getChannelScores(userId);

    if (channelScores.length === 0) {
      return 'email'; // Default fallback
    }

    // Return the highest scoring channel
    const bestChannel = channelScores.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return bestChannel.channel;
  }

  /**
   * Get channel scores for user
   */
  async getChannelScores(userId: string): Promise<ChannelScore[]> {
    // Get channel preferences
    const preferences = await ChannelPreferenceModel.findOne({ userId });

    // Get lead score for context
    const leadScore = await LeadScoreModel.findOne({ userId });
    const score = leadScore?.score || 50;
    const urgencyLevel = leadScore?.temperature === 'hot' ? 'high' : leadScore?.temperature === 'warm' ? 'medium' : 'low';

    const channels: RecommendedChannel[] = ['whatsapp', 'push', 'sms', 'email'];
    const scores: ChannelScore[] = [];

    for (const channel of channels) {
      // Check if channel is enabled for user
      const isEnabled = preferences
        ? preferences[channel as keyof ChannelPreferenceModel]
        : true;

      if (!isEnabled) {
        continue;
      }

      const weights = config.channelWeights[channel];
      const factors: ChannelScore['factors'] = [];

      // Calculate engagement factor
      const engagementScore = (weights.engagementRate * 100) / 0.35; // Normalize to 0-100
      factors.push({ name: 'engagementRate', weight: 0.3, value: engagementScore });

      // Calculate conversion factor
      const conversionScore = (weights.conversionRate * 100) / 0.30;
      factors.push({ name: 'conversionRate', weight: 0.3, value: conversionScore });

      // Calculate urgency factor
      let urgencyScore = 50;
      if (urgencyLevel === 'high' && channel === 'whatsapp') urgencyScore = 100;
      else if (urgencyLevel === 'high' && channel === 'push') urgencyScore = 90;
      else if (urgencyLevel === 'medium') urgencyScore = 70;
      factors.push({ name: 'urgency', weight: 0.4, value: urgencyScore });

      // Calculate overall score
      const channelScore =
        factors.reduce((sum, f) => sum + f.value * f.weight, 0) * (score / 100);

      scores.push({
        channel,
        score: Math.round(channelScore * 100) / 100,
        factors,
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  // ==========================================================================
  // Re-Engagement
  // ==========================================================================

  /**
   * Trigger re-engagement for a user
   */
  async triggerReEngagement(userId: string): Promise<ReEngagementResult> {
    logger.info('[LeadIntelligence] Triggering re-engagement', { userId });

    // Get lead score
    let leadScore = await LeadScoreModel.findOne({ userId });
    if (!leadScore) {
      leadScore = await this.getLeadScore(userId);
    }

    // Get recommended channel
    const channel = await this.getRecommendedChannel(userId);

    // Generate personalized message
    const message = this.generateReEngagementMessage(userId, leadScore, channel);

    // Check if user should be re-engaged (respect cooldown)
    const lastEngagement = await EngagementActionModel.findOne({ userId })
      .sort({ sentAt: -1 });

    if (lastEngagement) {
      const hoursSinceLastEngagement =
        (Date.now() - new Date(lastEngagement.sentAt).getTime()) / (1000 * 60 * 60);
      const minInterval = this.getMinIntervalForTemperature(leadScore.temperature);

      if (hoursSinceLastEngagement < minInterval) {
        logger.info('[LeadIntelligence] Skipping re-engagement - cooldown period', {
          userId,
          hoursSinceLastEngagement,
          minInterval,
        });

        return {
          userId,
          success: false,
          channel,
          action: 'cooldown',
          message: 'User is in cooldown period',
          sentAt: new Date(),
        };
      }
    }

    // Send notification
    const notificationResult = await this.notifications.sendNotification(
      userId,
      channel,
      message,
      {
        leadScore: leadScore.score,
        temperature: leadScore.temperature,
        action: leadScore.recommendedAction,
      }
    );

    // Record engagement action
    const engagementAction = new EngagementActionModel({
      userId,
      channel,
      actionType: this.getActionType(leadScore.temperature),
      message,
      sentAt: new Date(),
      delivered: notificationResult.success,
    });
    await engagementAction.save();

    // Notify marketing service
    await this.marketing.notifyReEngagement(userId, channel, leadScore.recommendedAction);

    // Send to ReZ Mind
    await this.rezMind.sendSignalEvent({
      eventType: 're_engagement_sent',
      userId,
      timestamp: new Date(),
      data: {
        channel,
        action: leadScore.recommendedAction,
        success: notificationResult.success,
      },
    });

    logger.info('[LeadIntelligence] Re-engagement triggered', {
      userId,
      channel,
      success: notificationResult.success,
    });

    return {
      userId,
      success: notificationResult.success,
      channel,
      action: leadScore.recommendedAction,
      message,
      sentAt: new Date(),
    };
  }

  /**
   * Generate personalized re-engagement message
   */
  private generateReEngagementMessage(
    userId: string,
    leadScore: LeadScore,
    channel: RecommendedChannel
  ): string {
    const templates = {
      hot: {
        whatsapp: "Hi! We noticed you were interested in some items. They're still available - complete your purchase now and get 10% off!",
        push: "Complete your purchase now and save 10%!",
        sms: "Your cart items are waiting! Use code SAVE10 for 10% off. Valid for 24 hours.",
        email: "Complete Your Purchase - 10% Off Exclusive Offer",
      },
      warm: {
        whatsapp: "Hi! Just a reminder - you left some items in your cart. They might be selling out soon!",
        push: "Don't miss out! Your cart items are still available.",
        sms: "Reminder: Items in your cart are waiting. Check them out!",
        email: "You Left Something Behind - Complete Your Purchase",
      },
      cold: {
        whatsapp: "Hi there! We miss you! Here's a special offer - 15% off your next order.",
        push: "We have something special for you!",
        sms: "Hey! Use code WELCOME15 for 15% off your next order.",
        email: "We Miss You - Here's 15% Off Your Next Order",
      },
    };

    return templates[leadScore.temperature][channel];
  }

  /**
   * Get action type based on temperature
   */
  private getActionType(temperature: LeadTemperature): string {
    const actionTypes: Record<LeadTemperature, string> = {
      hot: 'cart_recovery',
      warm: 'browse_reminder',
      cold: 'loyalty_offer',
    };
    return actionTypes[temperature];
  }

  /**
   * Get minimum re-engagement interval based on temperature
   */
  private getMinIntervalForTemperature(temperature: LeadTemperature): number {
    const intervals = {
      hot: config.reEngagement.hotLeadsIntervalHours,
      warm: config.reEngagement.warmLeadsIntervalHours,
      cold: config.reEngagement.coldLeadsIntervalHours,
    };
    return intervals[temperature];
  }

  // ==========================================================================
  // User Activity Management
  // ==========================================================================

  /**
   * Update user activity cache
   */
  private async updateUserActivityCache(
    userId: string,
    updates: {
      searches?: any[];
      views?: any[];
      cartActions?: any[];
    }
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const updateOps: Record<string, any> = {
      lastActive: now,
      expiresAt,
      $inc: updates.searches || updates.views || updates.cartActions ? { sessionCount: 1 } : {},
    };

    if (updates.searches) {
      updateOps.$push = { searches: { $each: updates.searches } };
    }
    if (updates.views) {
      updateOps.$push = { ...updateOps.$push, views: { $each: updates.views } };
    }
    if (updates.cartActions) {
      updateOps.$push = { ...updateOps.$push, cartActions: { $each: updates.cartActions } };
    }

    await UserActivityCacheModel.findOneAndUpdate(
      { userId },
      updateOps,
      { upsert: true, new: true }
    );
  }

  /**
   * Track user activity
   */
  async trackUserActivity(
    userId: string,
    activityType: 'search' | 'view' | 'cart',
    data: Record<string, unknown>
  ): Promise<void> {
    const updates: Record<string, any[]> = {};

    if (activityType === 'search') {
      updates.searches = [{
        query: data.query as string,
        resultsCount: (data.resultsCount as number) || 0,
        clickedResults: (data.clickedResults as string[]) || [],
        intentDetected: data.intentDetected as string,
      }];
    } else if (activityType === 'view') {
      updates.views = [{
        productId: data.productId as string,
        productName: data.productName as string,
        category: data.category as string,
        durationSeconds: data.durationSeconds as number,
        addedToCart: !!(data.addedToCart),
      }];
    } else if (activityType === 'cart') {
      updates.cartActions = [{
        action: data.action as 'add' | 'remove' | 'update',
        productId: data.productId as string,
        quantity: data.quantity as number,
      }];
    }

    await this.updateUserActivityCache(userId, updates);
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Process all hot leads for re-engagement
   */
  async processHotLeadsBatch(): Promise<{ processed: number; successful: number }> {
    const hotLeads = await this.detectHotLeads({ limit: 1000 });
    let successful = 0;

    for (const lead of hotLeads) {
      const result = await this.triggerReEngagement(lead.userId);
      if (result.success) successful++;
    }

    return { processed: hotLeads.length, successful };
  }

  /**
   * Process abandoned carts for recovery
   */
  async processAbandonedCartsBatch(): Promise<{ processed: number; recovered: number }> {
    const carts = await AbandonedCartModel.find({
      recovered: false,
      expiresAt: { $gt: new Date() },
      reminderCount: { $lt: config.reEngagement.maxAttempts },
    }).limit(100);

    let recovered = 0;

    for (const cart of carts) {
      // Check if enough time has passed since last reminder
      if (cart.lastReminderSent) {
        const hoursSinceReminder =
          (Date.now() - new Date(cart.lastReminderSent).getTime()) / (1000 * 60 * 60);
        if (hoursSinceReminder < config.reEngagement.minIntervalHours) {
          continue;
        }
      }

      // Trigger re-engagement
      const result = await this.triggerReEngagement(cart.userId);
      if (result.success) {
        await AbandonedCartModel.findByIdAndUpdate(cart._id, {
          lastReminderSent: new Date(),
          $inc: { reminderCount: 1 },
        });
      }

      if (result.success) recovered++;
    }

    return { processed: carts.length, recovered };
  }
}

// Export singleton instance
export const leadIntelligenceService = new LeadIntelligenceService();
export default leadIntelligenceService;
