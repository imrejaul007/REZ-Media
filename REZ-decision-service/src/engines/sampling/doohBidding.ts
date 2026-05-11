/**
 * DOOH Real-time Bidding Engine
 *
 * Handles auctions for Digital Out-of-Home (DOOH) screen time,
 * supporting multiple campaigns bidding for the same slot.
 *
 * Auction Types:
 * - CPM auction: Per impression pricing
 * - Slot auction: Per time slot pricing
 * - Performance auction: Per scan/conversion pricing
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Interfaces
// ============================================================================

export interface Bid {
  campaignId: string;
  screenId: string;
  amount: number; // CPM or flat rate
  auctionType: 'cpm' | 'slot' | 'performance';
  maxBudget: number;
  status: 'active' | 'won' | 'lost' | 'paused';
  qualityScore?: number; // 0-100, affects tiebreakers
  submittedAt: Date;
  autoBidRuleId?: string;
}

export interface Auction {
  id: string;
  screenId: string;
  startTime: Date;
  endTime: Date;
  reservePrice: number;
  auctionType: 'cpm' | 'slot' | 'performance';
  bids: Bid[];
  winner?: Bid;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  minQualityScore?: number; // Minimum quality score to qualify
}

export interface AutoBidRule {
  id: string;
  campaignId: string;
  maxBidAmount: number;
  bidIncrement: number; // Amount to increase bid in competitive situations
  maxTotalSpend: number;
  currentSpend: number;
  priority: number; // Higher = more aggressive
  conditions: AutoBidCondition[];
  enabled: boolean;
}

export interface AutoBidCondition {
  type: 'time_of_day' | 'day_of_week' | 'screen_location' | 'audience_density' | 'competitor_count';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin';
  value: string | number | string[] | number[];
}

export interface BidResult {
  auctionId: string;
  winningBid: Bid | null;
  allBids: Bid[];
  totalRevenue: number;
  winnerQualityScore: number;
  tiebreakerUsed: boolean;
}

export interface CampaignBidStats {
  campaignId: string;
  totalBids: number;
  wonBids: number;
  lostBids: number;
  winRate: number;
  totalSpend: number;
  avgBidAmount: number;
  avgWinningBid: number;
}

// ============================================================================
// Configuration
// ============================================================================

interface BiddingConfig {
  defaultReservePrice: number;
  minBidIncrement: number;
  maxBidAmount: number;
  auctionDurationMs: number;
  tiebreakerQualityWeight: number;
  autoBidCooldownMs: number;
}

const DEFAULT_CONFIG: BiddingConfig = {
  defaultReservePrice: 0.50,
  minBidIncrement: 0.01,
  maxBidAmount: 100.00,
  auctionDurationMs: 5000, // 5 seconds
  tiebreakerQualityWeight: 0.3,
  autoBidCooldownMs: 100,
};

// ============================================================================
// DOOH Bidding Engine
// ============================================================================

export class DOOHBiddingEngine {
  private auctions: Map<string, Auction> = new Map();
  private bids: Map<string, Bid[]> = new Map(); // campaignId -> bids
  private autoBidRules: Map<string, AutoBidRule> = new Map();
  private campaignStats: Map<string, CampaignBidStats> = new Map();
  private config: BiddingConfig;

  constructor(config: Partial<BiddingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Auction Management
  // ==========================================================================

  /**
   * Create a new auction for a screen slot
   */
  createAuction(
    screenId: string,
    startTime: Date,
    endTime: Date,
    auctionType: 'cpm' | 'slot' | 'performance',
    options: {
      reservePrice?: number;
      minQualityScore?: number;
    } = {}
  ): Auction {
    const auction: Auction = {
      id: uuidv4(),
      screenId,
      startTime,
      endTime,
      auctionType,
      reservePrice: options.reservePrice ?? this.config.defaultReservePrice,
      bids: [],
      status: 'pending',
      minQualityScore: options.minQualityScore,
    };

    this.auctions.set(auction.id, auction);
    return auction;
  }

  /**
   * Start an auction
   */
  startAuction(auctionId: string): Auction | null {
    const auction = this.auctions.get(auctionId);
    if (!auction) return null;

    if (auction.status !== 'pending') {
      throw new Error(`Cannot start auction ${auctionId}: invalid state ${auction.status}`);
    }

    auction.status = 'active';
    return auction;
  }

  /**
   * Close an auction and determine the winner
   */
  closeAuction(auctionId: string): BidResult {
    const auction = this.auctions.get(auctionId);
    if (!auction) {
      throw new Error(`Auction ${auctionId} not found`);
    }

    if (auction.status !== 'active') {
      throw new Error(`Cannot close auction ${auctionId}: invalid state ${auction.status}`);
    }

    const result = this.calculateWinner(auction);
    auction.winner = result.winningBid;
    auction.status = 'closed';

    // Update bid statuses
    for (const bid of auction.bids) {
      if (bid === result.winningBid) {
        bid.status = 'won';
      } else {
        bid.status = 'lost';
      }
    }

    // Update campaign statistics
    this.updateCampaignStats(auction, result);

    return result;
  }

  /**
   * Cancel an auction
   */
  cancelAuction(auctionId: string): boolean {
    const auction = this.auctions.get(auctionId);
    if (!auction) return false;

    if (auction.status === 'closed' || auction.status === 'cancelled') {
      return false;
    }

    auction.status = 'cancelled';

    // Mark all bids as lost
    for (const bid of auction.bids) {
      bid.status = 'lost';
    }

    return true;
  }

  /**
   * Get auction by ID
   */
  getAuction(auctionId: string): Auction | undefined {
    return this.auctions.get(auctionId);
  }

  /**
   * Get all active auctions for a screen
   */
  getActiveAuctionsForScreen(screenId: string): Auction[] {
    return Array.from(this.auctions.values()).filter(
      a => a.screenId === screenId && a.status === 'active'
    );
  }

  // ==========================================================================
  // Bid Management
  // ==========================================================================

  /**
   * Submit a bid to an auction
   */
  submitBid(
    campaignId: string,
    screenId: string,
    amount: number,
    auctionType: 'cpm' | 'slot' | 'performance',
    options: {
      maxBudget?: number;
      qualityScore?: number;
      auctionId?: string;
    } = {}
  ): Bid | null {
    // Find active auction for this screen
    let auction: Auction | undefined;

    if (options.auctionId) {
      auction = this.auctions.get(options.auctionId);
    } else {
      const activeAuctions = this.getActiveAuctionsForScreen(screenId);
      // Find auction matching the type
      auction = activeAuctions.find(a => a.auctionType === auctionType);
    }

    if (!auction) {
      console.warn(`No active auction found for screen ${screenId} of type ${auctionType}`);
      return null;
    }

    // Validate bid
    if (amount < auction.reservePrice) {
      console.warn(`Bid amount ${amount} below reserve price ${auction.reservePrice}`);
      return null;
    }

    if (amount > this.config.maxBidAmount) {
      console.warn(`Bid amount ${amount} exceeds maximum ${this.config.maxBidAmount}`);
      return null;
    }

    // Check if quality score meets minimum
    const qualityScore = options.qualityScore ?? 50;
    if (auction.minQualityScore && qualityScore < auction.minQualityScore) {
      console.warn(`Bid quality score ${qualityScore} below minimum ${auction.minQualityScore}`);
      return null;
    }

    const bid: Bid = {
      campaignId,
      screenId,
      amount,
      auctionType,
      maxBudget: options.maxBudget ?? Infinity,
      status: 'active',
      qualityScore,
      submittedAt: new Date(),
    };

    auction.bids.push(bid);

    // Track bid for campaign
    if (!this.bids.has(campaignId)) {
      this.bids.set(campaignId, []);
    }
    this.bids.get(campaignId)!.push(bid);

    return bid;
  }

  /**
   * Submit a bid with auto-bidding rules
   */
  submitAutoBid(
    campaignId: string,
    screenId: string,
    auctionType: 'cpm' | 'slot' | 'performance',
    auctionId?: string
  ): Bid | null {
    const rule = this.getAutoBidRuleForCampaign(campaignId);
    if (!rule || !rule.enabled) {
      console.warn(`No enabled auto-bid rule for campaign ${campaignId}`);
      return null;
    }

    // Find the current highest bid
    const auction = auctionId
      ? this.auctions.get(auctionId)
      : this.getActiveAuctionsForScreen(screenId).find(a => a.auctionType === auctionType);

    if (!auction) return null;

    const currentHighest = this.getHighestBid(auction);
    const currentHighestAmount = currentHighest?.amount ?? 0;

    // Calculate bid amount
    let bidAmount = Math.max(
      currentHighestAmount + this.config.minBidIncrement,
      rule.maxBidAmount
    );

    // Apply increment if competitive
    if (currentHighestAmount > 0) {
      bidAmount = Math.min(
        currentHighestAmount + rule.bidIncrement,
        rule.maxBidAmount
      );
    }

    // Check budget
    if (rule.currentSpend + bidAmount > rule.maxTotalSpend) {
      bidAmount = Math.min(bidAmount, rule.maxTotalSpend - rule.currentSpend);
    }

    if (bidAmount < auction.reservePrice) {
      return null;
    }

    const bid = this.submitBid(campaignId, screenId, bidAmount, auctionType, {
      auctionId: auction.id,
      maxBudget: rule.maxTotalSpend - rule.currentSpend,
      qualityScore: 75, // Default quality for auto-bids
    });

    if (bid) {
      bid.autoBidRuleId = rule.id;
    }

    return bid;
  }

  /**
   * Get bid status
   */
  getBidStatus(bidId: string): Bid['status'] | null {
    for (const auction of this.auctions.values()) {
      const bid = auction.bids.find(b => this.hashBid(b) === bidId);
      if (bid) return bid.status;
    }
    return null;
  }

  /**
   * Get all bids for a campaign
   */
  getCampaignBids(campaignId: string): Bid[] {
    return this.bids.get(campaignId) ?? [];
  }

  /**
   * Pause a bid
   */
  pauseBid(campaignId: string, screenId: string): boolean {
    for (const auction of this.auctions.values()) {
      if (auction.screenId === screenId && auction.status === 'active') {
        const bid = auction.bids.find(
          b => b.campaignId === campaignId && b.status === 'active'
        );
        if (bid) {
          bid.status = 'paused';
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Resume a paused bid
   */
  resumeBid(campaignId: string, screenId: string): boolean {
    for (const auction of this.auctions.values()) {
      if (auction.screenId === screenId && auction.status === 'active') {
        const bid = auction.bids.find(
          b => b.campaignId === campaignId && b.status === 'paused'
        );
        if (bid) {
          bid.status = 'active';
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get highest bid for an auction
   */
  getHighestBid(auction: Auction): Bid | null {
    const activeBids = auction.bids.filter(b => b.status === 'active');
    if (activeBids.length === 0) return null;

    return activeBids.reduce((highest, bid) => {
      if (!highest) return bid;

      // Compare by amount first
      if (bid.amount !== highest.amount) {
        return bid.amount > highest.amount ? bid : highest;
      }

      // Tiebreaker: quality score
      const bidQuality = bid.qualityScore ?? 0;
      const highestQuality = highest.qualityScore ?? 0;
      return bidQuality > highestQuality ? bid : highest;
    }, null as Bid | null);
  }

  // ==========================================================================
  // Win Calculation
  // ==========================================================================

  /**
   * Calculate the winner of an auction
   * Uses highest CPM with quality score as tiebreaker
   */
  calculateWinner(auction: Auction): BidResult {
    const activeBids = auction.bids.filter(b => b.status === 'active');

    if (activeBids.length === 0) {
      return {
        auctionId: auction.id,
        winningBid: null,
        allBids: auction.bids,
        totalRevenue: 0,
        winnerQualityScore: 0,
        tiebreakerUsed: false,
      };
    }

    // Sort bids by effective score
    const scoredBids = activeBids.map(bid => ({
      bid,
      effectiveScore: this.calculateEffectiveScore(bid, auction),
    }));

    scoredBids.sort((a, b) => {
      // Primary: higher effective score wins
      if (Math.abs(a.effectiveScore - b.effectiveScore) > 0.0001) {
        return b.effectiveScore - a.effectiveScore;
      }

      // Tiebreaker: quality score
      const qualityDiff = (b.bid.qualityScore ?? 0) - (a.bid.qualityScore ?? 0);
      if (Math.abs(qualityDiff) > 0.1) {
        return qualityDiff;
      }

      // Second tiebreaker: earlier submission time
      return a.bid.submittedAt.getTime() - b.bid.submittedAt.getTime();
    });

    const winningBid = scoredBids[0].bid;
    const secondHighest = scoredBids[1];

    // Calculate revenue (second price auction) or full price
    const totalRevenue = secondHighest
      ? this.calculateRevenue(winningBid, secondHighest.bid, auction)
      : winningBid.amount;

    const tiebreakerUsed = secondHighest
      ? Math.abs(scoredBids[0].effectiveScore - scoredBids[1].effectiveScore) < 0.0001
      : false;

    return {
      auctionId: auction.id,
      winningBid,
      allBids: auction.bids,
      totalRevenue,
      winnerQualityScore: winningBid.qualityScore ?? 0,
      tiebreakerUsed,
    };
  }

  /**
   * Calculate effective score for bid ranking
   * Combines amount with quality score
   */
  private calculateEffectiveScore(bid: Bid, auction: Auction): number {
    const amount = bid.amount;
    const quality = (bid.qualityScore ?? 50) / 100;

    // Skip bids below reserve price
    if (amount < auction.reservePrice) {
      return -1;
    }

    // Weighted combination of amount and quality
    // Higher quality = more valuable impressions
    return amount * (1 + this.config.tiebreakerQualityWeight * quality);
  }

  /**
   * Calculate revenue using auction pricing model
   */
  private calculateRevenue(winner: Bid, secondPlace: Bid, auction: Auction): number {
    // Second-price auction: winner pays second-highest bid
    if (auction.auctionType === 'cpm') {
      return secondPlace.amount;
    }

    // First-price auction for slot and performance
    return winner.amount;
  }

  // ==========================================================================
  // Auto-Bid Rules
  // ==========================================================================

  /**
   * Create an auto-bid rule
   */
  createAutoBidRule(
    campaignId: string,
    options: {
      maxBidAmount: number;
      bidIncrement: number;
      maxTotalSpend: number;
      priority?: number;
      conditions?: AutoBidCondition[];
    }
  ): AutoBidRule {
    const rule: AutoBidRule = {
      id: uuidv4(),
      campaignId,
      maxBidAmount: options.maxBidAmount,
      bidIncrement: options.bidIncrement,
      maxTotalSpend: options.maxTotalSpend,
      currentSpend: 0,
      priority: options.priority ?? 50,
      conditions: options.conditions ?? [],
      enabled: true,
    };

    this.autoBidRules.set(rule.id, rule);
    return rule;
  }

  /**
   * Get auto-bid rule for campaign
   */
  getAutoBidRuleForCampaign(campaignId: string): AutoBidRule | null {
    const rules = Array.from(this.autoBidRules.values())
      .filter(r => r.campaignId === campaignId && r.enabled)
      .sort((a, b) => b.priority - a.priority);

    return rules[0] ?? null;
  }

  /**
   * Update auto-bid rule
   */
  updateAutoBidRule(
    ruleId: string,
    updates: Partial<Omit<AutoBidRule, 'id' | 'campaignId'>>
  ): AutoBidRule | null {
    const rule = this.autoBidRules.get(ruleId);
    if (!rule) return null;

    Object.assign(rule, updates);
    return rule;
  }

  /**
   * Delete auto-bid rule
   */
  deleteAutoBidRule(ruleId: string): boolean {
    return this.autoBidRules.delete(ruleId);
  }

  /**
   * Evaluate auto-bid conditions
   */
  evaluateAutoBidConditions(rule: AutoBidRule, context: {
    timeOfDay?: number; // Hour 0-23
    dayOfWeek?: number; // 0-6
    screenLocation?: string;
    audienceDensity?: number;
    competitorCount?: number;
  }): boolean {
    if (rule.conditions.length === 0) return true;

    return rule.conditions.every(condition => {
      const value = context[condition.type.replace('_', '') as keyof typeof context];
      return this.evaluateCondition(condition, value);
    });
  }

  private evaluateCondition(
    condition: AutoBidCondition,
    contextValue: string | number | undefined
  ): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'eq':
        return contextValue === value;
      case 'neq':
        return contextValue !== value;
      case 'gt':
        return typeof contextValue === 'number' && typeof value === 'number' && contextValue > value;
      case 'lt':
        return typeof contextValue === 'number' && typeof value === 'number' && contextValue < value;
      case 'gte':
        return typeof contextValue === 'number' && typeof value === 'number' && contextValue >= value;
      case 'lte':
        return typeof contextValue === 'number' && typeof value === 'number' && contextValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue as string | number);
      case 'nin':
        return Array.isArray(value) && !value.includes(contextValue as string | number);
      default:
        return false;
    }
  }

  // ==========================================================================
  // Statistics & Analytics
  // ==========================================================================

  /**
   * Update campaign statistics after auction closes
   */
  private updateCampaignStats(auction: Auction, result: BidResult): void {
    for (const bid of auction.bids) {
      let stats = this.campaignStats.get(bid.campaignId);

      if (!stats) {
        stats = {
          campaignId: bid.campaignId,
          totalBids: 0,
          wonBids: 0,
          lostBids: 0,
          winRate: 0,
          totalSpend: 0,
          avgBidAmount: 0,
          avgWinningBid: 0,
        };
        this.campaignStats.set(bid.campaignId, stats);
      }

      stats.totalBids++;

      if (bid.status === 'won') {
        stats.wonBids++;
        stats.totalSpend += result.totalRevenue;
      } else {
        stats.lostBids++;
      }

      stats.winRate = stats.totalBids > 0 ? stats.wonBids / stats.totalBids : 0;
      stats.avgBidAmount = this.calculateAverageBid(bid.campaignId);
    }

    // Update auto-bid rule spend if winner used auto-bid
    if (result.winningBid?.autoBidRuleId) {
      const rule = this.autoBidRules.get(result.winningBid.autoBidRuleId);
      if (rule) {
        rule.currentSpend += result.totalRevenue;
      }
    }
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(campaignId: string): CampaignBidStats | null {
    return this.campaignStats.get(campaignId) ?? null;
  }

  /**
   * Calculate average bid amount for a campaign
   */
  private calculateAverageBid(campaignId: string): number {
    const bids = this.bids.get(campaignId) ?? [];
    if (bids.length === 0) return 0;

    const total = bids.reduce((sum, bid) => sum + bid.amount, 0);
    return total / bids.length;
  }

  /**
   * Get competitive analysis for a screen
   */
  getCompetitiveAnalysis(screenId: string): {
    activeAuctions: number;
    totalBids: number;
    avgBidAmount: number;
    highestBid: number;
    topCampaigns: { campaignId: string; bidCount: number }[];
  } {
    const auctions = this.getActiveAuctionsForScreen(screenId);
    const allBids = auctions.flatMap(a => a.bids.filter(b => b.status === 'active'));

    const campaignCounts = new Map<string, number>();
    for (const bid of allBids) {
      campaignCounts.set(bid.campaignId, (campaignCounts.get(bid.campaignId) ?? 0) + 1);
    }

    const topCampaigns = Array.from(campaignCounts.entries())
      .map(([campaignId, bidCount]) => ({ campaignId, bidCount }))
      .sort((a, b) => b.bidCount - a.bidCount)
      .slice(0, 5);

    const amounts = allBids.map(b => b.amount);

    return {
      activeAuctions: auctions.length,
      totalBids: allBids.length,
      avgBidAmount: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
      highestBid: amounts.length > 0 ? Math.max(...amounts) : 0,
      topCampaigns,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate a hash for a bid (for lookup)
   */
  private hashBid(bid: Bid): string {
    return `${bid.campaignId}-${bid.screenId}-${bid.submittedAt.getTime()}`;
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.auctions.clear();
    this.bids.clear();
    this.autoBidRules.clear();
    this.campaignStats.clear();
  }

  /**
   * Get engine configuration
   */
  getConfig(): BiddingConfig {
    return { ...this.config };
  }

  /**
   * Export auction data for persistence
   */
  exportAuctions(): Auction[] {
    return Array.from(this.auctions.values());
  }

  /**
   * Import auction data
   */
  importAuctions(auctions: Auction[]): void {
    for (const auction of auctions) {
      this.auctions.set(auction.id, auction);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDOOHBiddingEngine(config?: Partial<BiddingConfig>): DOOHBiddingEngine {
  return new DOOHBiddingEngine(config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Calculate estimated CPM for a campaign
 */
export function estimateCPM(
  bidAmount: number,
  expectedImpressions: number
): number {
  if (expectedImpressions <= 0) return 0;
  return (bidAmount / expectedImpressions) * 1000;
}

/**
 * Calculate bid amount needed for target CPM
 */
export function calculateBidForTargetCPM(
  targetCPM: number,
  expectedImpressions: number
): number {
  return (targetCPM / 1000) * expectedImpressions;
}

/**
 * Format bid amount for display
 */
export function formatBidAmount(amount: number, auctionType: 'cpm' | 'slot' | 'performance'): string {
  const formatted = amount.toFixed(2);
  switch (auctionType) {
    case 'cpm':
      return `$${formatted} CPM`;
    case 'slot':
      return `$${formatted} / slot`;
    case 'performance':
      return `$${formatted} / conversion`;
    default:
      return `$${formatted}`;
  }
}
