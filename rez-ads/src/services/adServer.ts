import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AdModel, CampaignModel, PlacementModel } from '../models/index.js';
import { BidEngine, getBidEngine } from './bidEngine.js';
import { FraudDetectionService, getFraudDetectionService } from './fraudDetection.js';
import {
  BidRequest,
  BidResult,
  AdDecision,
  EventType,
  ServeAdRequestSchema,
  CampaignStatus,
} from '../types/index.js';

interface ServeAdContext {
  requestId: string;
  placementId: string;
  userId?: string;
  sessionId: string;
  targeting: {
    country?: string;
    region?: string;
    city?: string;
    device?: string;
    keywords?: string[];
    pageUrl?: string;
    latitude?: number;
    longitude?: number;
  };
  timestamp: number;
  fraudCheckPassed: boolean;
}

export class AdServer {
  private redis: Redis;
  private bidEngine: BidEngine;
  private fraudDetection: FraudDetectionService;
  private adServerUrl: string;

  constructor(
    redis: Redis,
    bidEngine: BidEngine,
    fraudDetection: FraudDetectionService,
    adServerUrl?: string
  ) {
    this.redis = redis;
    this.bidEngine = bidEngine;
    this.fraudDetection = fraudDetection;
    this.adServerUrl = adServerUrl || process.env.AD_SERVER_URL || 'http://localhost:3005';
  }

  /**
   * Serve an ad to a user
   */
  async serveAd(request: z.infer<typeof ServeAdRequestSchema>): Promise<AdDecision | null> {
    const requestId = uuidv4();
    const sessionId = request.sessionId || uuidv4();
    const timestamp = Date.now();

    // Get placement info
    const placement = await PlacementModel.findOne({ placementId: request.placementId });
    if (!placement || !placement.isActive()) {
      return null;
    }

    // Build targeting context
    const targeting = {
      country: request.country,
      region: request.region,
      city: request.city,
      device: request.device,
      keywords: request.keywords,
      userId: request.userId,
      sessionId,
      pageUrl: request.pageUrl,
      latitude: request.latitude,
      longitude: request.longitude,
    };

    // Create bid request
    const bidRequest: BidRequest = {
      placementId: request.placementId,
      adIds: [],
      minBid: placement.floorPrice,
      targeting,
      timestamp: new Date(),
    };

    // Execute auction
    const bidResult = await this.bidEngine.executeAuction(bidRequest);

    if (!bidResult) {
      // No eligible bidder - serve house ad or empty
      return null;
    }

    // Get ad details
    const ad = await AdModel.findOne({ adId: bidResult.adId });
    if (!ad) {
      return null;
    }

    // Generate tracking URLs
    const trackingParams = new URLSearchParams({
      requestId,
      adId: bidResult.adId,
      campaignId: bidResult.campaignId,
      placementId: request.placementId,
      sessionId,
      ts: timestamp.toString(),
    });

    const baseUrl = `${this.adServerUrl}/api/events`;
    const impressionUrl = `${baseUrl}/impression?${trackingParams}`;
    const clickUrl = `${baseUrl}/click?${trackingParams}`;
    const viewUrl = `${baseUrl}/view?${trackingParams}`;

    // Cache the decision for impression/click verification
    await this.cacheAdDecision(requestId, {
      requestId,
      adId: bidResult.adId,
      campaignId: bidResult.campaignId,
      placementId: request.placementId,
      sessionId,
      userId: request.userId,
      timestamp,
      bidAmount: bidResult.bidAmount,
      bidType: bidResult.bidType,
    });

    // Track auction win
    await this.trackAuctionWin(bidResult.campaignId, bidResult.adId, placement.placementId, bidResult.bidAmount);

    return {
      adId: bidResult.adId,
      campaignId: bidResult.campaignId,
      ad,
      bid: bidResult,
      creative: ad.creative,
      impressionUrl,
      clickUrl,
      viewUrl,
    };
  }

  /**
   * Record an impression event
   */
  async recordImpression(
    requestId: string,
    adId: string,
    campaignId: string,
    placementId: string,
    data: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      timestamp?: number;
    }
  ): Promise<{ success: boolean; charged: boolean }> {
    const timestamp = data.timestamp || Date.now();
    const cachedDecision = await this.getCachedDecision(requestId);

    if (!cachedDecision) {
      // Decision not found, but still record the impression
      return { success: true, charged: false };
    }

    // Check for duplicate impression
    const impressionKey = `impression:${requestId}`;
    const alreadyRecorded = await this.redis.set(
      impressionKey,
      '1',
      'EX',
      3600,
      'NX'
    );

    if (!alreadyRecorded) {
      return { success: false, charged: false };
    }

    // Run fraud check (fire and forget)
    this.fraudDetection.checkEvent(EventType.IMPRESSION, adId, campaignId, {
      ip: data.ip,
      userAgent: data.userAgent,
      sessionId: data.sessionId,
      placementId,
      timestamp,
    }).catch(err => console.error('Fraud check error:', err));

    // Record for fraud tracking
    await this.fraudDetection.recordEvent(EventType.IMPRESSION, adId, campaignId, {
      ip: data.ip,
      sessionId: data.sessionId,
      userAgent: data.userAgent,
      placementId,
    });

    // Update statistics
    await Promise.all([
      CampaignModel.findOneAndUpdate(
        { campaignId },
        {
          $inc: { 'statistics.impressions': 1 },
        }
      ),
      PlacementModel.findOneAndUpdate(
        { placementId },
        {
          $inc: { 'stats.impressions': 1 },
        }
      ),
    ]);

    // Charge for impression (CPM)
    await this.chargeForImpression(cachedDecision, timestamp);

    return { success: true, charged: true };
  }

  /**
   * Record a click event
   */
  async recordClick(
    requestId: string,
    adId: string,
    campaignId: string,
    placementId: string,
    data: {
      ip?: string;
      userAgent?: string;
      sessionId?: string;
      timestamp?: number;
    }
  ): Promise<{ success: boolean; redirectUrl?: string }> {
    const timestamp = data.timestamp || Date.now();
    const cachedDecision = await this.getCachedDecision(requestId);

    if (!cachedDecision) {
      return { success: false };
    }

    // Check fraud before recording click
    const fraudResult = await this.fraudDetection.checkEvent(EventType.CLICK, adId, campaignId, {
      ip: data.ip,
      userAgent: data.userAgent,
      sessionId: data.sessionId,
      placementId,
      timestamp,
    });

    if (fraudResult.recommendedAction === 'block') {
      return { success: false };
    }

    // Check for duplicate click (click dedup window: 1 hour)
    const clickKey = `click:${requestId}:${data.ip || 'unknown'}`;
    const alreadyClicked = await this.redis.set(
      clickKey,
      '1',
      'EX',
      3600,
      'NX'
    );

    if (!alreadyClicked) {
      return { success: false };
    }

    // Record for fraud tracking
    await this.fraudDetection.recordEvent(EventType.CLICK, adId, campaignId, {
      ip: data.ip,
      sessionId: data.sessionId,
      userAgent: data.userAgent,
      placementId,
    });

    // Update statistics
    await Promise.all([
      CampaignModel.findOneAndUpdate(
        { campaignId },
        {
          $inc: { 'statistics.clicks': 1 },
        }
      ),
      PlacementModel.findOneAndUpdate(
        { placementId },
        {
          $inc: { 'stats.clicks': 1 },
        }
      ),
    ]);

    // Charge for click (CPC)
    await this.chargeForClick(cachedDecision, timestamp);

    // Get redirect URL from ad
    const ad = await AdModel.findOne({ adId });
    const redirectUrl = ad?.creative.destinationUrl;

    return { success: true, redirectUrl };
  }

  /**
   * Record a conversion event
   */
  async recordConversion(
    requestId: string,
    adId: string,
    campaignId: string,
    placementId: string,
    data: {
      value?: number;
      currency?: string;
      ip?: string;
      userAgent?: string;
      timestamp?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean }> {
    const timestamp = data.timestamp || Date.now();

    // Update campaign statistics
    await CampaignModel.findOneAndUpdate(
      { campaignId },
      {
        $inc: { 'statistics.conversions': 1 },
      }
    );

    // Record conversion event
    const conversionKey = `conversion:${requestId}`;
    await this.redis.setex(
      conversionKey,
      86400, // 24 hour window
      JSON.stringify({
        adId,
        campaignId,
        placementId,
        value: data.value || 0,
        currency: data.currency || 'USD',
        timestamp,
        metadata: data.metadata,
      })
    );

    return { success: true };
  }

  /**
   * Charge advertiser for impression
   */
  private async chargeForImpression(cachedDecision: any, timestamp: number): Promise<void> {
    const { campaignId, bidAmount, bidType } = cachedDecision;

    if (bidType !== 'cpm') {
      // Only charge for CPM campaigns on impression
      return;
    }

    // CPM: charge per 1000 impressions
    const charge = bidAmount / 1000;

    await CampaignModel.findOne({ campaignId }).then(async (campaign) => {
      if (campaign) {
        await campaign.addSpend(charge);
      }
    });
  }

  /**
   * Charge advertiser for click
   */
  private async chargeForClick(cachedDecision: any, timestamp: number): Promise<void> {
    const { campaignId, bidAmount, bidType } = cachedDecision;

    if (bidType !== 'cpc') {
      // Only charge for CPC campaigns on click
      return;
    }

    await CampaignModel.findOne({ campaignId }).then(async (campaign) => {
      if (campaign) {
        await campaign.addSpend(bidAmount);
      }
    });
  }

  /**
   * Cache ad decision for verification
   */
  private async cacheAdDecision(
    requestId: string,
    decision: {
      requestId: string;
      adId: string;
      campaignId: string;
      placementId: string;
      sessionId: string;
      userId?: string;
      timestamp: number;
      bidAmount: number;
      bidType: string;
    }
  ): Promise<void> {
    const key = `ad:decision:${requestId}`;
    await this.redis.setex(key, 3600, JSON.stringify(decision));
  }

  /**
   * Get cached ad decision
   */
  private async getCachedDecision(requestId: string): Promise<any | null> {
    const key = `ad:decision:${requestId}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Track auction win for analytics
   */
  private async trackAuctionWin(
    campaignId: string,
    adId: string,
    placementId: string,
    bidAmount: number
  ): Promise<void> {
    const key = `auction:win:${campaignId}`;
    await this.redis.lpush(
      key,
      JSON.stringify({
        adId,
        placementId,
        bidAmount,
        timestamp: Date.now(),
      })
    );
    await this.redis.ltrim(key, 0, 999);
    await this.redis.expire(key, 86400 * 7); // 7 days
  }

  /**
   * Get ad decision by request ID
   */
  async getDecisionByRequestId(requestId: string): Promise<any | null> {
    return this.getCachedDecision(requestId);
  }

  /**
   * Get serve statistics
   */
  async getServeStats(placementId?: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCTR: number;
  }> {
    const pipeline = this.redis.pipeline();

    if (placementId) {
      pipeline.hgetall(`placement:stats:${placementId}`);
    } else {
      pipeline.keys('placement:stats:*');
    }

    const result = await pipeline.exec();

    // Aggregate stats
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;

    // This would aggregate from Redis in real implementation
    return {
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    };
  }

  /**
   * Preload ads for a placement (for faster serving)
   */
  async preloadPlacement(placementId: string): Promise<void> {
    const key = `placement:preload:${placementId}`;
    await this.redis.setex(key, 300, 'loading'); // 5 minute cache
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();

    try {
      await Promise.all([
        this.redis.ping(),
        CampaignModel.findOne().select('_id').lean(),
        PlacementModel.findOne().select('_id').lean(),
      ]);

      return {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
      };
    }
  }
}

// Singleton instance
let adServer: AdServer | null = null;

export function getAdServer(
  redis: Redis,
  bidEngine: BidEngine,
  fraudDetection: FraudDetectionService
): AdServer {
  if (!adServer) {
    adServer = new AdServer(redis, bidEngine, fraudDetection);
  }
  return adServer;
}

export function createAdServer(
  redis: Redis,
  bidEngine: BidEngine,
  fraudDetection: FraudDetectionService
): AdServer {
  adServer = new AdServer(redis, bidEngine, fraudDetection);
  return adServer;
}
