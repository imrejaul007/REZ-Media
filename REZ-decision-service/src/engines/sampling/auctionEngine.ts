/**
 * REZ AUCTION ENGINE
 *
 * Handles competition between merchants for same user
 *
 * When multiple merchants target same user → auction decides winner
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const PREFIX = 'rde:auction:';

// ============================================
// TYPES
// ============================================

export interface MerchantBid {
  merchantId: string;
  campaignId: string;
  userId: string;

  // Bid components
  baseBid: number;        // Base bid amount
  cpm: number;           // Cost per 1000 impressions
  cpc: number;           // Cost per click
  cpa: number;            // Cost per acquisition

  // Quality scores
  qualityScore: number;    // 0-100
  intentMatch: number;     // How well matches user intent
  historicalCTR: number;   // Past click rate
  conversionRate: number;  // Past conversion

  // Offer
  discount: number;         // % discount offered
  coinReward: number;      // Coins per action

  // Timing
  startTime: Date;
  endTime: Date;

  status: 'active' | 'paused' | 'completed' | 'out_of_budget';
}

export interface AuctionRequest {
  userId: string;
  intent?: string;
  location?: { lat: number; lng: number };
  context?: Record<string, any>;
}

export interface AuctionResult {
  winner: MerchantBid | null;
  runnersUp: MerchantBid[];
  auctionId: string;
  timestamp: Date;
  winningPrice: number;
  reasons: string[];
}

export interface BidResult {
  accepted: boolean;
  auctionId: string;
  rank: number;
  message: string;
}

// ============================================
// AUCTION ENGINE
// ============================================

export class AuctionEngine {

  /**
   * Run auction for a user
   * Called when user triggers a slot (search, scan, location)
   */
  async runAuction(request: AuctionRequest): Promise<AuctionResult> {
    const auctionId = `auction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    // 1. Get all active bids targeting this user
    const bids = await this.getActiveBids(request);

    if (bids.length === 0) {
      return {
        winner: null,
        runnersUp: [],
        auctionId,
        timestamp,
        winningPrice: 0,
        reasons: ['No active bids for this user']
      };
    }

    // 2. Score each bid
    const scored = await this.scoreBids(bids, request);

    // 3. Sort by final score
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // 4. Winner is highest scorer
    const winner = scored[0];
    const runnersUp = scored.slice(1, 4); // Top 3 runners up

    // 5. Calculate winning price (second-price auction)
    const winningPrice = scored.length > 1
      ? this.calculateWinningPrice(scored[0], scored[1])
      : winner.baseBid;

    // 6. Record auction
    await this.recordAuction(auctionId, winner, runnersUp, winningPrice, request);

    const reasons = this.generateReasons(winner, scored[1] || null);

    return {
      winner,
      runnersUp,
      auctionId,
      timestamp,
      winningPrice,
      reasons
    };
  }

  /**
   * Submit a bid for auction
   */
  async submitBid(bid: MerchantBid): Promise<BidResult> {
    // Validate bid
    if (!bid.merchantId || !bid.userId || !bid.baseBid) {
      return {
        accepted: false,
        auctionId: '',
        rank: -1,
        message: 'Missing required fields'
      };
    }

    // Check if already bidding
    const existingKey = `${PREFIX}bid:${bid.userId}:${bid.merchantId}`;
    const exists = await redis.exists(existingKey);

    if (exists) {
      // Update existing bid
      await this.updateBid(bid);
      return {
        accepted: true,
        auctionId: existingKey,
        rank: await this.getRank(bid),
        message: 'Bid updated'
      };
    }

    // Create new bid
    await redis.hmset(existingKey, {
      merchantId: bid.merchantId,
      campaignId: bid.campaignId,
      userId: bid.userId,
      baseBid: bid.baseBid.toString(),
      cpm: (bid.cpm || 0).toString(),
      cpc: (bid.cpc || 0).toString(),
      cpa: (bid.cpa || 0).toString(),
      qualityScore: (bid.qualityScore || 50).toString(),
      intentMatch: (bid.intentMatch || 50).toString(),
      historicalCTR: (bid.historicalCTR || 5).toString(),
      conversionRate: (bid.conversionRate || 10).toString(),
      discount: (bid.discount || 0).toString(),
      coinReward: (bid.coinReward || 0).toString(),
      startTime: bid.startTime.toISOString(),
      endTime: bid.endTime.toISOString(),
      status: 'active'
    });

    // Set TTL (7 days or until endTime)
    const ttl = Math.min(7 * 86400, (bid.endTime.getTime() - Date.now()) / 1000);
    await redis.expire(existingKey, ttl);

    // Add to user's bid set
    await redis.sadd(`${PREFIX}user:${bid.userId}:bids`, bid.merchantId);

    return {
      accepted: true,
      auctionId: existingKey,
      rank: await this.getRank(bid),
      message: 'Bid accepted'
    };
  }

  /**
   * Get all active bids for a user
   */
  private async getActiveBids(request: AuctionRequest): Promise<MerchantBid[]> {
    // Get all merchants targeting this user
    const merchantIds = await redis.smembers(`${PREFIX}user:${request.userId}:bids`);

    if (merchantIds.length === 0) return [];

    const bids: MerchantBid[] = [];
    const now = Date.now();

    for (const merchantId of merchantIds) {
      const bidData = await redis.hgetall(`${PREFIX}bid:${request.userId}:${merchantId}`);

      if (!bidData || Object.keys(bidData).length === 0) continue;

      // Check if bid is still active
      if (bidData.status !== 'active') continue;

      const endTime = new Date(bidData.endTime);
      if (endTime.getTime() < now) {
        await redis.hset(`${PREFIX}bid:${request.userId}:${merchantId}`, 'status', 'completed');
        continue;
      }

      bids.push(this.parseBid(bidData));
    }

    return bids;
  }

  /**
   * Score all bids
   */
  private async scoreBids(bids: MerchantBid[], request: AuctionRequest): Promise<{
    bid: MerchantBid;
    finalScore: number;
    components: Record<string, number>;
  }[]> {
    const scored = [];

    for (const bid of bids) {
      const components: Record<string, number> = {};

      // 1. Base bid score (25%)
      const bidScore = Math.min(100, (bid.baseBid / 100) * 100);
      components.bidScore = bidScore * 0.25;

      // 2. Quality score (25%)
      components.qualityScore = bid.qualityScore * 0.25;

      // 3. Intent match (20%)
      if (request.intent) {
        const intentMatch = await this.getIntentMatch(bid, request.intent);
        components.intentMatch = intentMatch * 0.20;
      } else {
        components.intentMatch = 50 * 0.20;
      }

      // 4. Historical CTR (15%)
      components.historicalCTR = bid.historicalCTR * 0.15;

      // 5. Conversion rate (15%)
      components.conversionRate = bid.conversionRate * 0.15;

      const finalScore = Object.values(components).reduce((a, b) => a + b, 0);

      scored.push({ bid, finalScore, components });
    }

    return scored;
  }

  /**
   * Get intent match score
   */
  private async getIntentMatch(bid: MerchantBid, userIntent: string): Promise<number> {
    // Check if merchant has this category
    const categories = await redis.smembers(`${PREFIX}merchant:${bid.merchantId}:categories`);

    if (categories.includes(userIntent.toLowerCase())) {
      return 90; // High match
    }

    // Check partial match
    const intentLower = userIntent.toLowerCase();
    for (const cat of categories) {
      if (cat.includes(intentLower) || intentLower.includes(cat)) {
        return 70;
      }
    }

    return 30; // Low match
  }

  /**
   * Calculate winning price (second-price auction)
   */
  private calculateWinningPrice(winner: { finalScore: number }, second: { finalScore: number }): number {
    // Second-price: winner pays slightly more than second place
    const secondPrice = second.finalScore;
    const markup = 1.1; // 10% markup
    return Math.round(secondPrice * markup);
  }

  /**
   * Record auction result
   */
  private async recordAuction(
    auctionId: string,
    winner: MerchantBid | null,
    runnersUp: MerchantBid[],
    winningPrice: number,
    request: AuctionRequest
  ): Promise<void> {
    const key = `${PREFIX}auction:${auctionId}`;

    await redis.hmset(key, {
      userId: request.userId,
      winnerId: winner?.merchantId || '',
      winnerScore: winner?.finalScore?.toString() || '0',
      winningPrice: winningPrice.toString(),
      runnersUp: JSON.stringify(runnersUp.map(r => r.merchantId)),
      timestamp: Date.now().toString(),
      intent: request.intent || ''
    });

    await redis.expire(key, 86400 * 30); // 30 days
  }

  /**
   * Generate explanation for winner
   */
  private generateReasons(winner: { finalScore: number; components: Record<string, number> }, second: { finalScore: number } | null): string[] {
    const reasons: string[] = [];

    if (winner.components.bidScore > (second?.components?.bidScore || 0)) {
      reasons.push('Higher bid amount');
    }
    if (winner.components.qualityScore > (second?.components?.qualityScore || 0)) {
      reasons.push('Better quality score');
    }
    if (winner.components.intentMatch > (second?.components?.intentMatch || 0)) {
      reasons.push('Better intent match');
    }
    if (winner.components.historicalCTR > (second?.components?.historicalCTR || 0)) {
      reasons.push('Higher historical CTR');
    }
    if (winner.components.conversionRate > (second?.components?.conversionRate || 0)) {
      reasons.push('Better conversion rate');
    }

    return reasons.length > 0 ? reasons : ['Highest overall score'];
  }

  /**
   * Update existing bid
   */
  private async updateBid(bid: MerchantBid): Promise<void> {
    const key = `${PREFIX}bid:${bid.userId}:${bid.merchantId}`;

    await redis.hmset(key, {
      baseBid: bid.baseBid.toString(),
      cpm: (bid.cpm || 0).toString(),
      cpc: (bid.cpc || 0).toString(),
      qualityScore: (bid.qualityScore || 50).toString(),
      discount: (bid.discount || 0).toString(),
      coinReward: (bid.coinReward || 0).toString(),
      status: 'active'
    });
  }

  /**
   * Get rank of a bid
   */
  private async getRank(bid: MerchantBid): Promise<number> {
    const bids = await this.getActiveBids({
      userId: bid.userId,
      intent: bid.campaignId
    });

    const scored = await this.scoreBids(bids, { userId: bid.userId });
    scored.sort((a, b) => b.finalScore - a.finalScore);

    const index = scored.findIndex(s => s.bid.merchantId === bid.merchantId);
    return index + 1;
  }

  /**
   * Parse bid from Redis hash
   */
  private parseBid(data: Record<string, string>): MerchantBid {
    return {
      merchantId: data.merchantId,
      campaignId: data.campaignId,
      userId: data.userId,
      baseBid: parseFloat(data.baseBid) || 0,
      cpm: parseFloat(data.cpm) || 0,
      cpc: parseFloat(data.cpc) || 0,
      cpa: parseFloat(data.cpa) || 0,
      qualityScore: parseFloat(data.qualityScore) || 50,
      intentMatch: parseFloat(data.intentMatch) || 50,
      historicalCTR: parseFloat(data.historicalCTR) || 5,
      conversionRate: parseFloat(data.conversionRate) || 10,
      discount: parseFloat(data.discount) || 0,
      coinReward: parseFloat(data.coinReward) || 0,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: data.status as any
    };
  }

  /**
   * Get user's current auction status
   */
  async getUserAuctionStatus(userId: string): Promise<{
    activeBids: number;
    wonAuctions: number;
    avgWinningBid: number;
    lastAuction: Date | null;
  }> {
    const bids = await redis.smembers(`${PREFIX}user:${userId}:bids`);
    const wonAuctions = await redis.get(`${PREFIX}user:${userId}:wins`) || '0';
    const totalSpend = parseFloat(await redis.get(`${PREFIX}user:${userId}:spend`) || '0');
    const lastAuction = await redis.get(`${PREFIX}user:${userId}:lastAuction`);

    return {
      activeBids: bids.length,
      wonAuctions: parseInt(wonAuctions),
      avgWinningBid: parseInt(wonAuctions) > 0 ? totalSpend / parseInt(wonAuctions) : 0,
      lastAuction: lastAuction ? new Date(parseInt(lastAuction)) : null
    };
  }

  /**
   * Pause a bid
   */
  async pauseBid(userId: string, merchantId: string): Promise<void> {
    await redis.hset(`${PREFIX}bid:${userId}:${merchantId}`, 'status', 'paused');
  }

  /**
   * Resume a bid
   */
  async resumeBid(userId: string, merchantId: string): Promise<void> {
    await redis.hset(`${PREFIX}bid:${userId}:${merchantId}`, 'status', 'active');
  }

  /**
   * Delete a bid
   */
  async deleteBid(userId: string, merchantId: string): Promise<void> {
    const key = `${PREFIX}bid:${userId}:${merchantId}`;
    await redis.del(key);
    await redis.srem(`${PREFIX}user:${userId}:bids`, merchantId);
  }
}

// Export singleton
export const auctionEngine = new AuctionEngine();

// Convenience functions
export async function runAuction(request: AuctionRequest): Promise<AuctionResult> {
  return auctionEngine.runAuction(request);
}

export async function submitBid(bid: MerchantBid): Promise<BidResult> {
  return auctionEngine.submitBid(bid);
}
