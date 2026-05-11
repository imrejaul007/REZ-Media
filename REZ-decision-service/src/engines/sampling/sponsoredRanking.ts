/**
 * REZ SPONSORED RANKING ENGINE
 *
 * Scores, ranks, and auctions sponsored listings (merchants/products/offers)
 * alongside organic results to determine which sponsored content appears
 * in search results, recommendations, and ad slots.
 *
 * INTEGRATION:
 * - Called by RDE Supreme Controller for ranking decisions
 * - Uses Auction Engine for second-price auctions
 * - Returns ranked sponsored + organic results with slot positions
 *
 * FORMULA:
 * Score = (relevance × 0.35) + (bid × 0.25) + (quality × 0.20) + (offer × 0.15) + (affinity × 0.05)
 */

import Redis from 'ioredis';
import { AuctionEngine, runAuction as runGenericAuction } from './auctionEngine';
import { getUserIntent } from './rezMindIntegration';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIX = 'rde:sponsored:';

// ============================================
// SCORING WEIGHTS (Configurable)
// ============================================

const SCORING_WEIGHTS = {
  relevance: 0.35,
  bid: 0.25,
  quality: 0.20,
  offer: 0.15,
  affinity: 0.05
};

// ============================================
// TYPES
// ============================================

export interface SponsoredListing {
  id: string;
  type: 'merchant' | 'product' | 'offer';
  merchantId: string;
  campaignId?: string;

  // Bidding info
  bid: number;
  cpc: number;
  cpa: number;
  maxBid: number;

  // Offer details
  offer: {
    discount: number;    // Percentage discount (0-100)
    coins: number;        // Coins per action
    freebie?: string;     // Free item description
    cashback?: number;   // Cashback percentage
  };

  // Computed scores
  relevance: number;      // 0-100: Intent match score
  qualityScore: number;   // 0-100: CTR + conversion history
  affinityScore: number; // 0-100: User-merchant history
  offerScore: number;     // 0-100: Offer attractiveness
  bidScore: number;      // 0-100: Normalized bid amount
  finalScore: number;     // 0-100: Combined score

  // Metadata
  category?: string;
  tags?: string[];
  thumbnail?: string;
  title?: string;
  description?: string;
}

export interface RankingRequest {
  userId: string;
  intent: string;
  context: {
    location?: { lat: number; lng: number };
    category?: string;
    priceRange?: string;
    device?: string;
    timeOfDay?: string;
  };
  slotCount: number;           // Number of sponsored slots available
  organicIds?: string[];       // IDs of organic results to intermix
  filters?: {
    minBid?: number;
    minQualityScore?: number;
    categories?: string[];
    excludeMerchantIds?: string[];
  };
}

export interface RankingResult {
  sponsored: SponsoredListing[];              // Ranked sponsored listings
  organic: string[];                           // Organic result IDs
  slots: SlotAllocation[];                    // Final slot assignments
  auctionResults: AuctionResult[];            // Winning prices per slot
  metrics: {
    totalEligible: number;
    totalAuctioned: number;
    avgWinningBid: number;
    fillRate: number;
  };
}

export interface SlotAllocation {
  position: number;           // 1, 2, 3... (slot position)
  type: 'sponsored' | 'organic';
  listing: SponsoredListing | null;
  organicId?: string;
  auctionPrice: number;       // What winner pays
  secondPrice: number;       // Second-highest bid
}

export interface AuctionResult {
  listingId: string;
  winningPrice: number;
  secondPrice: number;
  position: number;
  isWinner: boolean;
}

export interface ScoredListing {
  listing: SponsoredListing;
  components: {
    relevance: number;
    bid: number;
    quality: number;
    offer: number;
    affinity: number;
  };
  finalScore: number;
}

export interface UserAffinity {
  interactionCount: number;
  totalSpend: number;
  lastInteraction: Date;
  avgOrderValue: number;
  conversionCount: number;
  affinityScore: number;      // Computed affinity (0-100)
}

// ============================================
// SPONSORED RANKING ENGINE
// ============================================

export class SponsoredRankingEngine {

  /**
   * Main entry point: Rank sponsored listings and determine slot allocations
   */
  async rankListings(request: RankingRequest): Promise<RankingResult> {
    const startTime = Date.now();

    // 1. Fetch all eligible sponsored listings
    const eligibleListings = await this.fetchEligibleListings(request);

    // 2. Calculate scores for each listing
    const scoredListings = await this.calculateScores(eligibleListings, request);

    // 3. Sort by final score
    scoredListings.sort((a, b) => b.finalScore - a.finalScore);

    // 4. Run auction for slot positions
    const auctionResults = await this.runAuction(scoredListings, request.slotCount);

    // 5. Determine slot allocations
    const slots = await this.determineSlots(scoredListings, request);

    // 6. Calculate metrics
    const metrics = this.calculateMetrics(eligibleListings, slots, auctionResults);

    const result: RankingResult = {
      sponsored: scoredListings.map(s => s.listing),
      organic: request.organicIds || [],
      slots,
      auctionResults,
      metrics
    };

    // Record for learning
    await this.recordRankingResult(request, result, Date.now() - startTime);

    return result;
  }

  /**
   * Calculate all component scores for a listing
   */
  async calculateScores(
    listings: SponsoredListing[],
    request: RankingRequest
  ): Promise<ScoredListing[]> {
    // Get user affinity data for all merchants in batch
    const merchantIds = [...new Set(listings.map(l => l.merchantId))];
    const affinities = await this.batchGetAffinities(request.userId, merchantIds);

    // Get user intent data from ReZ Mind
    const userIntent = await getUserIntent(request.userId);

    const scoredListings: ScoredListing[] = [];

    for (const listing of listings) {
      const affinity = affinities.get(listing.merchantId);
      const components = this.computeComponents(listing, request, affinity, userIntent);
      const finalScore = this.computeFinalScore(components);

      // Update listing with computed scores
      const updatedListing: SponsoredListing = {
        ...listing,
        relevance: components.relevance / SCORING_WEIGHTS.relevance,
        qualityScore: components.quality / SCORING_WEIGHTS.quality,
        affinityScore: affinity?.affinityScore || 0,
        offerScore: components.offer / SCORING_WEIGHTS.offer,
        bidScore: components.bid / SCORING_WEIGHTS.bid,
        finalScore
      };

      scoredListings.push({
        listing: updatedListing,
        components,
        finalScore
      });
    }

    return scoredListings;
  }

  /**
   * Compute score components for a single listing
   */
  private computeComponents(
    listing: SponsoredListing,
    request: RankingRequest,
    userAffinity: UserAffinity | undefined,
    userIntent: any
  ): ScoredListing['components'] {
    // 1. RELEVANCE SCORE (35%) - Intent match
    const relevance = this.calculateRelevanceScore(listing, request, userIntent);

    // 2. BID SCORE (25%) - How much merchant is willing to pay
    const bid = this.calculateBidScore(listing);

    // 3. QUALITY SCORE (20%) - CTR and conversion history
    const quality = this.calculateQualityScore(listing);

    // 4. OFFER SCORE (15%) - How good the offer is
    const offer = this.calculateOfferScore(listing);

    // 5. AFFINITY SCORE (5%) - User-merchant history
    const affinity = this.calculateAffinityScore(userAffinity);

    return { relevance, bid, quality, offer, affinity };
  }

  /**
   * Calculate relevance score (intent match)
   */
  private calculateRelevanceScore(
    listing: SponsoredListing,
    request: RankingRequest,
    userIntent: any
  ): number {
    let score = 50; // Base score

    // Category match (highest weight)
    if (request.context.category && listing.category) {
      if (listing.category.toLowerCase() === request.context.category.toLowerCase()) {
        score += 30;
      } else if (listing.category.toLowerCase().includes(request.context.category.toLowerCase()) ||
                 request.context.category.toLowerCase().includes(listing.category.toLowerCase())) {
        score += 15;
      }
    }

    // Intent keyword match
    if (request.intent && listing.tags && listing.tags.length > 0) {
      const intentLower = request.intent.toLowerCase();
      const matchingTags = listing.tags.filter(tag =>
        tag.toLowerCase().includes(intentLower) ||
        intentLower.includes(tag.toLowerCase())
      );
      score += matchingTags.length * 10;
    }

    // ReZ Mind intent match
    if (userIntent?.topIntents && userIntent.topIntents.length > 0) {
      const topIntent = userIntent.topIntents[0].category.toLowerCase();
      if (listing.category?.toLowerCase() === topIntent) {
        score += 20;
      } else if (listing.tags?.some(tag => tag.toLowerCase() === topIntent)) {
        score += 10;
      }
    }

    // User intent affinity from ReZ Mind
    if (userIntent?.affinity && listing.merchantId) {
      const merchantAffinity = userIntent.affinity[listing.merchantId];
      if (merchantAffinity) {
        score += merchantAffinity * 0.2; // Scale up to 20 points
      }
    }

    return Math.min(100, score) * SCORING_WEIGHTS.relevance;
  }

  /**
   * Calculate bid score (normalized bid amount)
   */
  private calculateBidScore(listing: SponsoredListing): number {
    // Normalize bid to 0-100 scale
    // Assume max reasonable bid is $10
    const maxExpectedBid = 10;
    const normalizedBid = Math.min(100, (listing.bid / maxExpectedBid) * 100);

    // Boost for higher CPC potential
    let boost = 0;
    if (listing.cpc > 0.5) boost += 5;
    if (listing.cpc > 1.0) boost += 5;
    if (listing.cpa > 0 && listing.cpa < 10) boost += 5; // Good CPA

    return Math.min(100, normalizedBid + boost) * SCORING_WEIGHTS.bid;
  }

  /**
   * Calculate quality score (CTR, conversion history)
   */
  private calculateQualityScore(listing: SponsoredListing): number {
    // Base quality from listing's historical data
    let score = listing.qualityScore || 50;

    // Location bonus (if user is near merchant)
    // This would be calculated with actual distance in production
    score += 5;

    // Time of day relevance (bonus for relevant times)
    const hour = new Date().getHours();
    if (hour >= 11 && hour <= 14) {
      // Lunch hours - food merchants get boost
      if (listing.category?.toLowerCase().includes('food') ||
          listing.category?.toLowerCase().includes('restaurant')) {
        score += 10;
      }
    }
    if (hour >= 17 && hour <= 21) {
      // Dinner hours
      if (listing.category?.toLowerCase().includes('food') ||
          listing.category?.toLowerCase().includes('restaurant')) {
        score += 10;
      }
    }

    return Math.min(100, score) * SCORING_WEIGHTS.quality;
  }

  /**
   * Calculate offer score (attractiveness of the offer)
   */
  private calculateOfferScore(listing: SponsoredListing): number {
    let score = 0;
    const { offer } = listing;

    // Discount score (0-40 points)
    if (offer.discount > 0) {
      score += Math.min(40, offer.discount * 0.8);
    }

    // Coin reward score (0-30 points)
    if (offer.coins > 0) {
      score += Math.min(30, offer.coins * 0.3);
    }

    // Cashback score (0-20 points)
    if (offer.cashback && offer.cashback > 0) {
      score += Math.min(20, offer.cashback * 0.5);
    }

    // Freebie bonus (0-10 points)
    if (offer.freebie) {
      score += 10;
    }

    return Math.min(100, score) * SCORING_WEIGHTS.offer;
  }

  /**
   * Calculate affinity score (user-merchant history)
   */
  private calculateAffinityScore(affinity: UserAffinity | undefined): number {
    if (!affinity) return 0 * SCORING_WEIGHTS.affinity;

    // Pre-computed affinity score
    return affinity.affinityScore * SCORING_WEIGHTS.affinity;
  }

  /**
   * Compute final combined score
   */
  private computeFinalScore(components: ScoredListing['components']): number {
    return Math.round(
      components.relevance +
      components.bid +
      components.quality +
      components.offer +
      components.affinity
    );
  }

  /**
   * Run auction for sponsored slots
   */
  async runAuction(
    scoredListings: ScoredListing[],
    slotCount: number
  ): Promise<AuctionResult[]> {
    const results: AuctionResult[] = [];
    const topListings = scoredListings.slice(0, slotCount * 2); // Consider extra for fallback

    if (topListings.length === 0) {
      return results;
    }

    // Second-price auction: winners pay second-highest bid + epsilon
    for (let i = 0; i < Math.min(slotCount, topListings.length); i++) {
      const current = topListings[i];
      const secondPlace = topListings[i + 1];

      // Calculate second price (second-price auction model)
      const secondPrice = secondPlace
        ? this.calculateSecondPrice(current.finalScore, secondPlace.finalScore)
        : current.finalScore;

      // Winning price is the second price
      const winningPrice = secondPrice;

      results.push({
        listingId: current.listing.id,
        winningPrice,
        secondPrice,
        position: i + 1,
        isWinner: true
      });

      // Record auction win
      await this.recordAuctionWin(current, winningPrice, i + 1);
    }

    // Mark non-winners
    for (let i = slotCount; i < topListings.length; i++) {
      results.push({
        listingId: topListings[i].listing.id,
        winningPrice: 0,
        secondPrice: 0,
        position: -1,
        isWinner: false
      });
    }

    return results;
  }

  /**
   * Calculate second price for auction
   * Second-price = second score + 10% markup (simulating competitive pressure)
   */
  private calculateSecondPrice(winnerScore: number, secondScore: number): number {
    const markup = 1.1;
    return Math.round(secondScore * markup);
  }

  /**
   * Determine final slot allocations
   */
  async determineSlots(
    scoredListings: ScoredListing[],
    request: RankingRequest
  ): Promise<SlotAllocation[]> {
    const slots: SlotAllocation[] = [];
    const organicIds = request.organicIds || [];
    let organicIndex = 0;

    // Interleave sponsored and organic based on scores
    // Rule: After every 3 organic results, show 1 sponsored (if available)
    let organicCount = 0;

    for (let position = 1; position <= request.slotCount; position++) {
      // Check if this should be a sponsored slot
      const isSponsoredSlot = position <= scoredListings.length;

      if (isSponsoredSlot && organicCount >= 3) {
        // Show sponsored listing
        const listing = scoredListings[position - 1];
        const auctionResult = await this.getAuctionResult(listing.listing.id);

        slots.push({
          position,
          type: 'sponsored',
          listing: listing.listing,
          auctionPrice: auctionResult?.winningPrice || 0,
          secondPrice: auctionResult?.secondPrice || 0
        });

        organicCount = 0;
      } else if (organicIndex < organicIds.length) {
        // Show organic result
        slots.push({
          position,
          type: 'organic',
          listing: null,
          organicId: organicIds[organicIndex],
          auctionPrice: 0,
          secondPrice: 0
        });

        organicIndex++;
        organicCount++;
      } else if (isSponsoredSlot) {
        // No more organic, fill with sponsored
        const listing = scoredListings[slots.filter(s => s.type === 'sponsored').length];
        const auctionResult = await this.getAuctionResult(listing.listing.id);

        slots.push({
          position,
          type: 'sponsored',
          listing: listing.listing,
          auctionPrice: auctionResult?.winningPrice || 0,
          secondPrice: auctionResult?.secondPrice || 0
        });
      }
    }

    return slots;
  }

  /**
   * Fetch eligible sponsored listings
   */
  private async fetchEligibleListings(request: RankingRequest): Promise<SponsoredListing[]> {
    // Get all active sponsored campaigns
    const campaignIds = await redis.smembers(`${PREFIX}campaigns:active`);

    if (campaignIds.length === 0) {
      return [];
    }

    const listings: SponsoredListing[] = [];

    for (const campaignId of campaignIds) {
      const listingData = await redis.hgetall(`${PREFIX}campaign:${campaignId}`);

      if (!listingData || Object.keys(listingData).length === 0) continue;

      const listing = this.parseListing(listingData);

      // Apply filters
      if (request.filters) {
        if (request.filters.minBid && listing.bid < request.filters.minBid) continue;
        if (request.filters.minQualityScore && listing.qualityScore < request.filters.minQualityScore) continue;
        if (request.filters.categories && listing.category &&
            !request.filters.categories.includes(listing.category)) continue;
        if (request.filters.excludeMerchantIds?.includes(listing.merchantId)) continue;
      }

      listings.push(listing);
    }

    return listings;
  }

  /**
   * Get user affinity for multiple merchants (batch)
   */
  private async batchGetAffinities(
    userId: string,
    merchantIds: string[]
  ): Promise<Map<string, UserAffinity>> {
    const affinities = new Map<string, UserAffinity>();

    const pipeline = redis.pipeline();

    for (const merchantId of merchantIds) {
      pipeline.hgetall(`${PREFIX}user:${userId}:affinity:${merchantId}`);
    }

    const results = await pipeline.exec();

    if (results) {
      for (let i = 0; i < merchantIds.length; i++) {
        const [err, data] = results[i];
        if (!err && data && typeof data === 'object' && Object.keys(data).length > 0) {
          affinities.set(merchantIds[i], this.parseAffinity(data as Record<string, string>));
        }
      }
    }

    return affinities;
  }

  /**
   * Parse listing from Redis hash
   */
  private parseListing(data: Record<string, string>): SponsoredListing {
    return {
      id: data.id || '',
      type: (data.type as 'merchant' | 'product' | 'offer') || 'merchant',
      merchantId: data.merchantId || '',
      campaignId: data.campaignId,
      bid: parseFloat(data.bid) || 0,
      cpc: parseFloat(data.cpc) || 0,
      cpa: parseFloat(data.cpa) || 0,
      maxBid: parseFloat(data.maxBid) || parseFloat(data.bid) || 10,
      offer: {
        discount: parseFloat(data.discount) || 0,
        coins: parseFloat(data.coins) || 0,
        freebie: data.freebie || undefined,
        cashback: parseFloat(data.cashback) || undefined
      },
      relevance: parseFloat(data.relevance) || 50,
      qualityScore: parseFloat(data.qualityScore) || 50,
      // Computed scores - will be filled by calculateScores()
      affinityScore: parseFloat(data.affinityScore) || 0,
      offerScore: 0,
      bidScore: 0,
      finalScore: 0,
      category: data.category,
      tags: data.tags ? JSON.parse(data.tags) : [],
      thumbnail: data.thumbnail,
      title: data.title,
      description: data.description
    };
  }

  /**
   * Parse affinity from Redis hash
   */
  private parseAffinity(data: Record<string, string>): UserAffinity {
    const interactionCount = parseInt(data.interactionCount) || 0;
    const conversionCount = parseInt(data.conversionCount) || 0;
    const totalSpend = parseFloat(data.totalSpend) || 0;

    // Calculate affinity score
    let affinityScore = 0;

    // Recency bonus (0-20)
    if (data.lastInteraction) {
      const daysSince = (Date.now() - new Date(data.lastInteraction).getTime()) / 86400000;
      if (daysSince < 7) affinityScore += 20;
      else if (daysSince < 30) affinityScore += 10;
      else if (daysSince < 90) affinityScore += 5;
    }

    // Frequency bonus (0-30)
    affinityScore += Math.min(30, interactionCount * 2);

    // Recency + Frequency combined (0-30)
    if (interactionCount >= 5 && conversionCount > 0) {
      affinityScore += 30;
    } else if (interactionCount >= 3 && conversionCount > 0) {
      affinityScore += 20;
    } else if (interactionCount >= 1) {
      affinityScore += 10;
    }

    // Spend affinity (0-20)
    if (totalSpend > 1000) affinityScore += 20;
    else if (totalSpend > 500) affinityScore += 15;
    else if (totalSpend > 100) affinityScore += 10;
    else if (totalSpend > 0) affinityScore += 5;

    return {
      interactionCount,
      totalSpend,
      lastInteraction: data.lastInteraction ? new Date(data.lastInteraction) : new Date(0),
      avgOrderValue: interactionCount > 0 ? totalSpend / interactionCount : 0,
      conversionCount,
      affinityScore: Math.min(100, affinityScore)
    };
  }

  /**
   * Get auction result for a listing
   */
  private async getAuctionResult(listingId: string): Promise<AuctionResult | null> {
    const key = `${PREFIX}auction:${listingId}`;
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) return null;

    return {
      listingId,
      winningPrice: parseFloat(data.winningPrice) || 0,
      secondPrice: parseFloat(data.secondPrice) || 0,
      position: parseInt(data.position) || 0,
      isWinner: true
    };
  }

  /**
   * Record auction win
   */
  private async recordAuctionWin(
    scored: ScoredListing,
    winningPrice: number,
    position: number
  ): Promise<void> {
    const key = `${PREFIX}auction:${scored.listing.id}`;

    await redis.hmset(key, {
      listingId: scored.listing.id,
      merchantId: scored.listing.merchantId,
      winningPrice: winningPrice.toString(),
      secondPrice: scored.finalScore.toString(),
      position: position.toString(),
      timestamp: Date.now().toString()
    });

    // Keep auction results for 7 days
    await redis.expire(key, 86400 * 7);

    // Increment merchant's win count
    await redis.zincrby(`${PREFIX}merchant:${scored.listing.merchantId}:wins`, 1);

    // Update campaign spend
    if (scored.listing.campaignId) {
      await redis.zincrby(
        `${PREFIX}campaign:${scored.listing.campaignId}:spend`,
        winningPrice
      );
    }
  }

  /**
   * Calculate metrics for the ranking result
   */
  private calculateMetrics(
    eligible: SponsoredListing[],
    slots: SlotAllocation[],
    auctionResults: AuctionResult[]
  ): RankingResult['metrics'] {
    const sponsoredSlots = slots.filter(s => s.type === 'sponsored' && s.listing);
    const winners = auctionResults.filter(r => r.isWinner);
    const totalSpend = winners.reduce((sum, r) => sum + r.winningPrice, 0);

    return {
      totalEligible: eligible.length,
      totalAuctioned: winners.length,
      avgWinningBid: winners.length > 0 ? totalSpend / winners.length : 0,
      fillRate: sponsoredSlots.length > 0
        ? (sponsoredSlots.length / slots.length) * 100
        : 0
    };
  }

  /**
   * Record ranking result for analysis
   */
  private async recordRankingResult(
    request: RankingRequest,
    result: RankingResult,
    durationMs: number
  ): Promise<void> {
    const key = `${PREFIX}ranking:${Date.now()}`;

    await redis.hmset(key, {
      userId: request.userId,
      intent: request.intent,
      slotCount: request.slotCount.toString(),
      eligibleListings: result.metrics.totalEligible.toString(),
      winners: result.metrics.totalAuctioned.toString(),
      fillRate: result.metrics.fillRate.toString(),
      avgWinningBid: result.metrics.avgWinningBid.toString(),
      duration: durationMs.toString(),
      timestamp: Date.now().toString()
    });

    await redis.expire(key, 86400 * 30); // 30 days
  }

  // ============================================
  // ADMIN METHODS
  // ============================================

  /**
   * Register a new sponsored listing/campaign
   */
  async registerListing(listing: SponsoredListing): Promise<boolean> {
    if (!listing.id || !listing.merchantId) {
      return false;
    }

    const key = `${PREFIX}campaign:${listing.id}`;

    await redis.hmset(key, {
      id: listing.id,
      type: listing.type,
      merchantId: listing.merchantId,
      campaignId: listing.campaignId || listing.id,
      bid: listing.bid.toString(),
      cpc: (listing.cpc || 0).toString(),
      cpa: (listing.cpa || 0).toString(),
      maxBid: (listing.maxBid || listing.bid).toString(),
      discount: listing.offer.discount.toString(),
      coins: listing.offer.coins.toString(),
      freebie: listing.offer.freebie || '',
      cashback: (listing.offer.cashback || 0).toString(),
      relevance: (listing.relevance || 50).toString(),
      qualityScore: (listing.qualityScore || 50).toString(),
      category: listing.category || '',
      tags: JSON.stringify(listing.tags || []),
      thumbnail: listing.thumbnail || '',
      title: listing.title || '',
      description: listing.description || '',
      status: 'active'
    });

    // Add to active campaigns set
    await redis.sadd(`${PREFIX}campaigns:active`, listing.id);

    // Set expiry (campaign duration or default 30 days)
    await redis.expire(key, 86400 * 30);

    return true;
  }

  /**
   * Update a sponsored listing
   */
  async updateListing(id: string, updates: Partial<SponsoredListing>): Promise<boolean> {
    const key = `${PREFIX}campaign:${id}`;
    const exists = await redis.exists(key);

    if (!exists) return false;

    const setData: Record<string, string> = {};

    if (updates.bid !== undefined) setData.bid = updates.bid.toString();
    if (updates.cpc !== undefined) setData.cpc = updates.cpc.toString();
    if (updates.cpa !== undefined) setData.cpa = updates.cpa.toString();
    if (updates.maxBid !== undefined) setData.maxBid = updates.maxBid.toString();
    if (updates.offer) {
      if (updates.offer.discount !== undefined) setData.discount = updates.offer.discount.toString();
      if (updates.offer.coins !== undefined) setData.coins = updates.offer.coins.toString();
      if (updates.offer.freebie !== undefined) setData.freebie = updates.offer.freebie;
      if (updates.offer.cashback !== undefined) setData.cashback = updates.offer.cashback.toString();
    }
    if (updates.qualityScore !== undefined) setData.qualityScore = updates.qualityScore.toString();
    if (updates.category !== undefined) setData.category = updates.category;

    if (Object.keys(setData).length > 0) {
      await redis.hmset(key, setData);
    }

    return true;
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(listingId: string): Promise<void> {
    const key = `${PREFIX}campaign:${listingId}`;
    await redis.hset(key, 'status', 'paused');
    await redis.srem(`${PREFIX}campaigns:active`, listingId);
  }

  /**
   * Resume a campaign
   */
  async resumeCampaign(listingId: string): Promise<void> {
    const key = `${PREFIX}campaign:${listingId}`;
    await redis.hset(key, 'status', 'active');
    await redis.sadd(`${PREFIX}campaigns:active`, listingId);
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(listingId: string): Promise<void> {
    const key = `${PREFIX}campaign:${listingId}`;
    await redis.del(key);
    await redis.srem(`${PREFIX}campaigns:active`, listingId);
  }

  /**
   * Update user affinity for a merchant
   */
  async updateUserAffinity(
    userId: string,
    merchantId: string,
    interaction: {
      type: 'view' | 'click' | 'visit' | 'purchase';
      value?: number;
    }
  ): Promise<void> {
    const key = `${PREFIX}user:${userId}:affinity:${merchantId}`;

    const pipeline = redis.pipeline();

    // Increment interaction count
    pipeline.hincrby(key, 'interactionCount', 1);

    // Update last interaction time
    pipeline.hset(key, 'lastInteraction', Date.now().toString());

    // Update total spend for purchases
    if (interaction.type === 'purchase' && interaction.value) {
      pipeline.hincrbyfloat(key, 'totalSpend', interaction.value);
      pipeline.hincrby(key, 'conversionCount', 1);
    }

    await pipeline.exec();

    // Update affinity score asynchronously
    this.recalculateAffinity(userId, merchantId);
  }

  /**
   * Recalculate user's affinity score for a merchant
   */
  private async recalculateAffinity(userId: string, merchantId: string): Promise<void> {
    const key = `${PREFIX}user:${userId}:affinity:${merchantId}`;
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) return;

    const affinity = this.parseAffinity(data);
    await redis.hset(key, 'affinityScore', affinity.affinityScore.toString());
  }

  /**
   * Get merchant statistics
   */
  async getMerchantStats(merchantId: string): Promise<{
    totalWins: number;
    totalSpend: number;
    avgBid: number;
    conversionRate: number;
  }> {
    const wins = await redis.zscore(`${PREFIX}merchant:${merchantId}:wins`) || '0';

    // Get all campaigns for this merchant
    const campaignIds = await redis.smembers(`${PREFIX}campaigns:active`);
    let totalSpend = 0;
    let totalBids = 0;
    let campaignCount = 0;

    for (const campaignId of campaignIds) {
      const data = await redis.hgetall(`${PREFIX}campaign:${campaignId}`);
      if (data.merchantId === merchantId) {
        totalBids += parseFloat(data.bid) || 0;
        campaignCount++;
      }
    }

    return {
      totalWins: parseInt(wins),
      totalSpend,
      avgBid: campaignCount > 0 ? totalBids / campaignCount : 0,
      conversionRate: parseFloat(wins) > 0 ? 0.05 : 0 // Simplified
    };
  }

  /**
   * Get campaign performance
   */
  async getCampaignPerformance(campaignId: string): Promise<{
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    spend: number;
    avgPosition: number;
  }> {
    const key = `${PREFIX}campaign:${campaignId}:stats`;
    const data = await redis.hgetall(key);

    const impressions = parseInt(data?.impressions || '0');
    const clicks = parseInt(data?.clicks || '0');
    const conversions = parseInt(data?.conversions || '0');
    const spend = parseFloat(data?.spend || '0');

    return {
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      conversions,
      spend,
      avgPosition: parseFloat(data?.avgPosition || '1')
    };
  }

  /**
   * Record impression event
   */
  async recordImpression(campaignId: string, position: number): Promise<void> {
    const key = `${PREFIX}campaign:${campaignId}:stats`;
    await redis.hincrby(key, 'impressions', 1);

    // Update average position
    const current = await redis.hget(key, 'avgPosition');
    const currentImpressions = await redis.hget(key, 'impressions');
    if (current && currentImpressions) {
      const newAvg = (parseFloat(current) + position) / parseInt(currentImpressions);
      await redis.hset(key, 'avgPosition', newAvg.toString());
    } else {
      await redis.hset(key, 'avgPosition', position.toString());
    }
  }

  /**
   * Record click event
   */
  async recordClick(campaignId: string): Promise<void> {
    const key = `${PREFIX}campaign:${campaignId}:stats`;
    await redis.hincrby(key, 'clicks', 1);
  }

  /**
   * Record conversion event
   */
  async recordConversion(campaignId: string, value: number): Promise<void> {
    const key = `${PREFIX}campaign:${campaignId}:stats`;
    await redis.hincrby(key, 'conversions', 1);
    await redis.hincrbyfloat(key, 'conversionValue', value);
  }
}

// ============================================
// EXPORTS
// ============================================

// Export singleton instance
export const sponsoredRankingEngine = new SponsoredRankingEngine();

// Convenience exports
export async function rankListings(request: RankingRequest): Promise<RankingResult> {
  return sponsoredRankingEngine.rankListings(request);
}

export async function calculateScores(
  listings: SponsoredListing[],
  request: RankingRequest
): Promise<ScoredListing[]> {
  return sponsoredRankingEngine.calculateScores(listings, request);
}

export async function runAuction(
  listings: ScoredListing[],
  slotCount: number
): Promise<AuctionResult[]> {
  return sponsoredRankingEngine.runAuction(listings, slotCount);
}

export async function determineSlots(
  listings: ScoredListing[],
  request: RankingRequest
): Promise<SlotAllocation[]> {
  return sponsoredRankingEngine.determineSlots(listings, request);
}

// Admin exports
export async function registerListing(listing: SponsoredListing): Promise<boolean> {
  return sponsoredRankingEngine.registerListing(listing);
}

export async function updateUserAffinity(
  userId: string,
  merchantId: string,
  interaction: { type: 'view' | 'click' | 'visit' | 'purchase'; value?: number }
): Promise<void> {
  return sponsoredRankingEngine.updateUserAffinity(userId, merchantId, interaction);
}

export async function getMerchantStats(merchantId: string) {
  return sponsoredRankingEngine.getMerchantStats(merchantId);
}

export async function getCampaignPerformance(campaignId: string) {
  return sponsoredRankingEngine.getCampaignPerformance(campaignId);
}

// Scoring weights export for configuration
export { SCORING_WEIGHTS };
