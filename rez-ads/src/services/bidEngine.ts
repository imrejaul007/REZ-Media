import Decimal from 'decimal.js';
import Redis from 'ioredis';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { CampaignModel, AdModel, PlacementModel } from '../models/index.js';
import { CampaignStatus, BidStrategy, BidRequest, BidResult, Campaign, Ad, Placement, PricingData } from '../types/index.js';

// Bid scoring weights
const SCORING_WEIGHTS = {
  bidAmount: 0.35,
  qualityScore: 0.25,
  relevanceScore: 0.20,
  historicalPerformance: 0.15,
  freshness: 0.05,
};

interface ScoredBid extends BidResult {
  campaign: Campaign;
  ad: Ad;
  finalScore: number;
  adjustedBid: number;
}

interface BidContext {
  placementId: string;
  placement: Placement;
  targeting: BidRequest['targeting'];
  pageContext?: {
    pageUrl?: string;
    keywords?: string[];
    category?: string;
  };
  userContext?: {
    userId?: string;
    sessionId?: string;
    interests?: string[];
    pastClicks?: string[];
  };
  auctionId: string;
}

export class BidEngine {
  private redis: Redis;
  private pricingEngineUrl: string;
  private readonly BID_CACHE_TTL = 60; // 60 seconds
  private readonly MIN_BID_CPM = parseFloat(process.env.MIN_BID_CPM || '0.01');
  private readonly MAX_BID_CPM = parseFloat(process.env.MAX_BID_CPM || '10.00');

  constructor(redis: Redis, pricingEngineUrl?: string) {
    this.redis = redis;
    this.pricingEngineUrl = pricingEngineUrl || process.env.PRICING_ENGINE_URL || 'http://localhost:4006';
  }

  /**
   * Execute a real-time bidding auction for a placement
   */
  async executeAuction(bidRequest: BidRequest): Promise<BidResult | null> {
    const startTime = Date.now();
    const auctionId = uuidv4();

    try {
      // Get eligible campaigns and ads
      const eligibleBids = await this.findEligibleBidders(bidRequest);

      if (eligibleBids.length === 0) {
        return null;
      }

      // Get placement info
      const placement = await PlacementModel.findOne({ placementId: bidRequest.placementId });
      if (!placement) {
        return null;
      }

      // Create bid context
      const context: BidContext = {
        placementId: bidRequest.placementId,
        placement,
        targeting: bidRequest.targeting,
        auctionId,
      };

      // Calculate scores and bids for each eligible advertiser
      const scoredBids = await Promise.all(
        eligibleBids.map(async ({ campaign, ad }) => {
          return this.scoreAndCalculateBid(campaign, ad, context);
        })
      );

      // Sort by final score (descending)
      scoredBids.sort((a, b) => b.finalScore - a.finalScore);

      // Second-price auction: winner pays second-highest bid
      const winner = scoredBids[0];
      if (!winner) {
        return null;
      }

      // Calculate winning bid using second-price mechanism
      const winningBid = this.calculateSecondPrice(scoredBids, winner, placement.floorPrice);

      // Cache the winning bid
      await this.cacheWinningBid(bidRequest, winner, winningBid);

      // Log auction
      await this.logAuction(auctionId, bidRequest, scoredBids, winner, winningBid, Date.now() - startTime);

      return {
        adId: winner.adId,
        campaignId: winner.campaignId,
        bidAmount: winningBid,
        bidType: winner.bidType,
        score: winner.finalScore,
        reason: 'Highest scored bid',
      };
    } catch (error) {
      console.error('Auction execution error:', error);
      return null;
    }
  }

  /**
   * Find all eligible bidders for the request
   */
  private async findEligibleBidders(bidRequest: BidRequest): Promise<Array<{ campaign: Campaign; ad: Ad }>> {
    // Find active campaigns with ads
    const campaigns = await CampaignModel.find({
      status: CampaignStatus.ACTIVE,
      'budget.spent': { $lt: '$budget.total' },
    });

    const eligible: Array<{ campaign: Campaign; ad: Ad }> = [];

    for (const campaign of campaigns) {
      // Filter by targeting
      if (!this.matchesTargeting(campaign, bidRequest.targeting)) {
        continue;
      }

      // Check budget availability
      if (!campaign.isWithinBudget(campaign.bidStrategy.amount)) {
        continue;
      }

      // Get ads for this campaign
      const ads = await AdModel.findActiveByCampaign(campaign.campaignId as string);

      for (const ad of ads) {
        eligible.push({ campaign: campaign as unknown as Campaign, ad: ad as unknown as Ad });
      }
    }

    return eligible;
  }

  /**
   * Check if campaign matches targeting criteria
   */
  private matchesTargeting(campaign: Campaign, targeting: BidRequest['targeting']): boolean {
    if (!campaign.targeting) {
      return true; // No targeting = match all
    }

    // Geo targeting
    if (campaign.targeting.geo && targeting.country) {
      const { countries, regions, cities } = campaign.targeting.geo;
      if (countries && !countries.includes(targeting.country)) return false;
      if (regions && targeting.region && !regions.includes(targeting.region)) return false;
      if (cities && targeting.city && !cities.includes(targeting.city)) return false;
    }

    // Device targeting
    if (campaign.targeting.devices && targeting.device) {
      const { devices } = campaign.targeting.devices;
      if (devices && !devices.includes(targeting.device as any)) return false;
    }

    // Keyword targeting
    if (campaign.targeting.keywords && targeting.keywords) {
      const hasKeyword = campaign.targeting.keywords.some(
        keyword => targeting.keywords!.some(
          pageKeyword => pageKeyword.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      if (!hasKeyword) return false;
    }

    // Interest targeting
    if (campaign.targeting.interests && targeting.userId) {
      // In real implementation, would check user interest profile
      // For now, pass through
    }

    return true;
  }

  /**
   * Score and calculate bid for a campaign/ad combination
   */
  private async scoreAndCalculateBid(
    campaign: Campaign,
    ad: Ad,
    context: BidContext
  ): Promise<ScoredBid> {
    // Base bid from campaign settings
    const baseBid = new Decimal(campaign.bidStrategy.amount);

    // Apply dynamic pricing from pricing engine
    const pricing = await this.getDynamicPricing(campaign, ad, context);

    // Adjust bid based on pricing
    const adjustedBid = baseBid.times(pricing.finalPrice / pricing.basePrice);

    // Cap bid to max bid if set
    let finalBid = adjustedBid;
    if (campaign.bidStrategy.maxBid) {
      finalBid = Decimal.min(finalBid, new Decimal(campaign.bidStrategy.maxBid));
    }

    // Ensure minimum bid
    finalBid = Decimal.max(finalBid, new Decimal(this.MIN_BID_CPM));

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(campaign, ad);

    // Calculate relevance score
    const relevanceScore = this.calculateRelevanceScore(campaign, ad, context);

    // Calculate historical performance score
    const historicalScore = this.calculateHistoricalScore(campaign);

    // Calculate freshness score
    const freshnessScore = this.calculateFreshnessScore(campaign);

    // Calculate final weighted score
    const finalScore =
      (adjustedBid.toNumber() / this.MAX_BID_CPM * 100 * SCORING_WEIGHTS.bidAmount) +
      (qualityScore * SCORING_WEIGHTS.qualityScore) +
      (relevanceScore * SCORING_WEIGHTS.relevanceScore) +
      (historicalScore * SCORING_WEIGHTS.historicalPerformance) +
      (freshnessScore * SCORING_WEIGHTS.freshness);

    return {
      adId: ad.adId,
      campaignId: campaign.campaignId,
      bidAmount: finalBid.toNumber(),
      bidType: campaign.bidStrategy.type,
      score: finalScore,
      campaign,
      ad,
      finalScore,
      adjustedBid: finalBid.toNumber(),
      reason: this.getScoreReason(qualityScore, relevanceScore, historicalScore),
    };
  }

  /**
   * Get dynamic pricing from pricing engine
   */
  private async getDynamicPricing(
    campaign: Campaign,
    ad: Ad,
    context: BidContext
  ): Promise<PricingData> {
    try {
      const response = await axios.post(`${this.pricingEngineUrl}/api/calculate`, {
        basePrice: campaign.bidStrategy.amount,
        factors: {
          competition: await this.getCompetitionLevel(context.placementId),
          timeOfDay: this.getTimeOfDayFactor(),
          dayOfWeek: this.getDayOfWeekFactor(),
          device: context.targeting.device ? 1.0 : 1.0,
          geo: context.targeting.country ? 1.0 : 1.0,
          seasonality: this.getSeasonalityFactor(),
        },
        context: {
          campaignId: campaign.campaignId,
          adId: ad.adId,
          placementId: context.placementId,
          targeting: context.targeting,
        },
      }, {
        timeout: 100,
      });

      return response.data;
    } catch (error) {
      // Return default pricing on error
      return {
        basePrice: campaign.bidStrategy.amount,
        dynamicFactors: {
          competition: 1.0,
          timeOfDay: 1.0,
          dayOfWeek: 1.0,
          device: 1.0,
          geo: 1.0,
          seasonality: 1.0,
        },
        finalPrice: campaign.bidStrategy.amount,
      };
    }
  }

  /**
   * Get competition level for a placement
   */
  private async getCompetitionLevel(placementId: string): Promise<number> {
    const key = `bid:competition:${placementId}`;
    const cached = await this.redis.get(key);

    if (cached) {
      return parseFloat(cached);
    }

    // Count active bids in last minute
    const activeBids = await this.redis.zcount(
      'bid:auctions:active',
      Date.now() - 60000,
      Date.now()
    );

    // Normalize to 0.5 - 2.0 range
    const competition = Math.min(2.0, Math.max(0.5, 0.5 + (activeBids / 100)));

    await this.redis.setex(key, 300, competition.toString());

    return competition;
  }

  /**
   * Get time of day pricing factor
   */
  private getTimeOfDayFactor(): number {
    const hour = new Date().getHours();

    // Peak hours (10am-8pm): 1.2-1.5x
    if (hour >= 10 && hour <= 20) {
      return 1.3;
    }
    // Low hours (12am-6am): 0.5x
    if (hour >= 0 && hour < 6) {
      return 0.5;
    }
    // Normal hours: 1.0x
    return 1.0;
  }

  /**
   * Get day of week pricing factor
   */
  private getDayOfWeekFactor(): number {
    const day = new Date().getDay();

    // Weekends: 1.1x
    if (day === 0 || day === 6) {
      return 1.1;
    }
    // Weekdays: 1.0x
    return 1.0;
  }

  /**
   * Get seasonality factor
   */
  private getSeasonalityFactor(): number {
    const month = new Date().getMonth();

    // Holiday seasons: 1.3x
    if (month === 10 || month === 11) { // Nov, Dec
      return 1.3;
    }
    // Summer: 0.9x
    if (month >= 5 && month <= 7) { // Jun-Aug
      return 0.9;
    }
    return 1.0;
  }

  /**
   * Calculate quality score based on ad and campaign metrics
   */
  private calculateQualityScore(campaign: Campaign, ad: Ad): number {
    let score = 50; // Base score

    // Creative quality
    if (ad.creative.headline && ad.creative.description) {
      score += 10;
    }
    if (ad.creative.imageUrl || ad.creative.videoUrl) {
      score += 15;
    }
    if (ad.creative.callToAction) {
      score += 10;
    }

    // Landing page quality (would check in real implementation)
    if (ad.creative.destinationUrl) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate relevance score based on targeting match
   */
  private calculateRelevanceScore(campaign: Campaign, ad: Ad, context: BidContext): number {
    let score = 50;

    // Keyword match
    if (campaign.targeting?.keywords && context.targeting.keywords) {
      const matchCount = campaign.targeting.keywords.filter(keyword =>
        context.targeting.keywords!.some(pk =>
          pk.toLowerCase().includes(keyword.toLowerCase())
        )
      ).length;
      score += Math.min(30, matchCount * 10);
    }

    // Interest match
    if (campaign.targeting?.interests) {
      score += 10;
    }

    // Geo match
    if (campaign.targeting?.geo?.countries && context.targeting.country) {
      if (campaign.targeting.geo.countries.includes(context.targeting.country)) {
        score += 10;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Calculate historical performance score
   */
  private calculateHistoricalScore(campaign: Campaign): number {
    const stats = campaign.statistics;

    if (stats.impressions === 0) {
      return 50; // New campaign
    }

    let score = 50;

    // CTR score (target 2%)
    if (stats.ctr > 0) {
      const ctrScore = Math.min(30, (stats.ctr / 2) * 30);
      score += ctrScore;
    }

    // Conversion score
    if (stats.conversions > 0) {
      const conversionRate = stats.conversions / stats.impressions;
      const convScore = Math.min(20, conversionRate * 1000);
      score += convScore;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate freshness score (newer campaigns get slight boost)
   */
  private calculateFreshnessScore(campaign: Campaign): number {
    const ageInDays = (Date.now() - new Date(campaign.createdAt).getTime()) / (1000 * 60 * 60 * 24);

    // New campaigns (< 7 days): boost
    if (ageInDays < 7) {
      return 80;
    }
    // Active campaigns (7-30 days): normal
    if (ageInDays < 30) {
      return 60;
    }
    // Older campaigns: slightly lower
    return 50;
  }

  /**
   * Get human-readable reason for bid score
   */
  private getScoreReason(quality: number, relevance: number, historical: number): string {
    const reasons: string[] = [];

    if (quality > 70) reasons.push('High creative quality');
    if (relevance > 70) reasons.push('Strong keyword relevance');
    if (historical > 70) reasons.push('Strong historical performance');

    return reasons.join(', ') || 'Competitive bid';
  }

  /**
   * Calculate second-price winning bid
   */
  private calculateSecondPrice(
    scoredBids: ScoredBid[],
    winner: ScoredBid,
    floorPrice: number
  ): number {
    if (scoredBids.length < 2) {
      // Only one bidder, pay max of floor or their bid
      return Math.max(floorPrice, winner.adjustedBid);
    }

    // Second highest bid
    const secondPrice = scoredBids[1].adjustedBid;

    // Winner pays max of second price and floor
    return Math.max(floorPrice, secondPrice);
  }

  /**
   * Cache winning bid for impression tracking
   */
  private async cacheWinningBid(
    request: BidRequest,
    winner: ScoredBid,
    bid: number
  ): Promise<void> {
    const key = `bid:win:${request.placementId}:${request.timestamp}`;
    const cacheEntry = {
      adId: winner.adId,
      campaignId: winner.campaignId,
      bidAmount: bid,
      bidType: winner.bidType,
      sessionId: request.targeting.sessionId,
      userId: request.targeting.userId,
    };

    await this.redis.setex(key, 3600, JSON.stringify(cacheEntry));

    // Track active auction
    await this.redis.zadd('bid:auctions:active', Date.now(), `${request.placementId}:${request.timestamp}`);
  }

  /**
   * Log auction for analytics
   */
  private async logAuction(
    auctionId: string,
    request: BidRequest,
    bids: ScoredBid[],
    winner: ScoredBid | null,
    winningBid: number,
    durationMs: number
  ): Promise<void> {
    const logEntry = {
      auctionId,
      placementId: request.placementId,
      timestamp: new Date().toISOString(),
      durationMs,
      bidderCount: bids.length,
      winner: winner ? {
        adId: winner.adId,
        campaignId: winner.campaignId,
        bid: winningBid,
        score: winner.finalScore,
      } : null,
      allBids: bids.map(b => ({
        adId: b.adId,
        bid: b.adjustedBid,
        score: b.finalScore,
      })),
    };

    await this.redis.lpush('bid:auctions:logs', JSON.stringify(logEntry));
    await this.redis.ltrim('bid:auctions:logs', 0, 9999);
  }

  /**
   * Get bid for a specific request (used for impression confirmation)
   */
  async getWinningBid(
    placementId: string,
    timestamp: number
  ): Promise<ScoredBid | null> {
    const key = `bid:win:${placementId}:${timestamp}`;
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  }

  /**
   * Calculate estimated CPC for a campaign
   */
  async estimateCPC(campaignId: string): Promise<number> {
    const campaign = await CampaignModel.findOne({ campaignId });
    if (!campaign) {
      return 0;
    }

    if (campaign.bidStrategy.type === BidStrategy.CPC) {
      return campaign.bidStrategy.amount;
    }

    // Estimate CPC from CPM based on expected CTR
    const expectedCTR = 0.02; // 2%
    const estimatedCPC = (campaign.bidStrategy.amount * expectedCTR) / 1000;

    return estimatedCPC;
  }

  /**
   * Get bid statistics for a campaign
   */
  async getBidStats(campaignId: string): Promise<{
    totalAuctions: number;
    winRate: number;
    averageBid: number;
    totalSpend: number;
  }> {
    const logs = await this.redis.lrange('bid:auctions:logs', 0, 9999);

    let totalAuctions = 0;
    let wins = 0;
    let totalBid = 0;
    let totalSpend = 0;

    for (const log of logs) {
      try {
        const entry = JSON.parse(log);
        const campaignBids = entry.allBids?.filter(
          (b: any) => b.campaignId === campaignId
        ) || [];

        if (campaignBids.length > 0) {
          totalAuctions += campaignBids.length;
          totalBid += campaignBids.reduce(
            (sum: number, b: any) => sum + b.bid,
            0
          );

          if (entry.winner?.campaignId === campaignId) {
            wins++;
            totalSpend += entry.winner.bid;
          }
        }
      } catch {
        continue;
      }
    }

    return {
      totalAuctions,
      winRate: totalAuctions > 0 ? (wins / totalAuctions) * 100 : 0,
      averageBid: totalAuctions > 0 ? totalBid / totalAuctions : 0,
      totalSpend,
    };
  }
}

// Singleton instance
let bidEngine: BidEngine | null = null;

export function getBidEngine(redis: Redis): BidEngine {
  if (!bidEngine) {
    bidEngine = new BidEngine(redis);
  }
  return bidEngine;
}

export function createBidEngine(redis: Redis, pricingEngineUrl?: string): BidEngine {
  bidEngine = new BidEngine(redis, pricingEngineUrl);
  return bidEngine;
}
