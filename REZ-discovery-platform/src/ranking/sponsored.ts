import { z } from 'zod';

// Types
export interface SponsoredProduct {
  productId: string;
  campaignId: string;
  bidAmount: number;
  dailyBudget: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  targetKeywords: string[];
  targetCategories: string[];
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'paused' | 'completed' | 'exhausted';
}

export interface SponsoredResult {
  productId: string;
  sponsored: boolean;
  campaignId?: string;
  bidAmount?: number;
  boost?: number;
  position?: number;
}

export interface SponsoredOptions {
  maxSponsoredRatio?: number;     // Max % of sponsored results (0-1)
  minBidThreshold?: number;        // Minimum bid to be considered
  positionStrategy?: 'scattered' | 'top' | 'distributed';
  bidMultiplier?: number;          // How much bid affects score
}

export interface Campaign {
  id: string;
  name: string;
  products: string[];
  budget: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'completed';
}

// Zod schemas
export const SponsoredOptionsSchema = z.object({
  maxSponsoredRatio: z.number().min(0).max(1).default(0.2),
  minBidThreshold: z.number().min(0).default(0.01),
  positionStrategy: z.enum(['scattered', 'top', 'distributed']).default('scattered'),
  bidMultiplier: z.number().positive().default(2.0),
});

export const SponsoredProductSchema = z.object({
  productId: z.string(),
  campaignId: z.string(),
  bidAmount: z.number().min(0),
  dailyBudget: z.number().min(0),
  spent: z.number().min(0),
  startDate: z.date(),
  endDate: z.date().optional(),
  targetKeywords: z.array(z.string()),
  targetCategories: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['active', 'paused', 'completed', 'exhausted']),
});

/**
 * SponsoredRanker - Handles sponsored/paid product placement
 *
 * Architecture:
 * - Respects bid amounts and budgets
 * - Enforces max sponsored ratio
 * - Supports multiple positioning strategies
 * - Integrates with auction system
 */
export class SponsoredRanker {
  private campaigns: Map<string, Campaign>;
  private sponsoredProducts: Map<string, SponsoredProduct>;
  private dailyBudgets: Map<string, { spent: number; date: Date }>;
  private auctionHistory: Map<string, number>; // productId -> impressions

  constructor() {
    this.campaigns = new Map();
    this.sponsoredProducts = new Map();
    this.dailyBudgets = new Map();
    this.auctionHistory = new Map();
  }

  /**
   * Register a campaign
   */
  registerCampaign(campaign: Campaign): void {
    this.campaigns.set(campaign.id, {
      ...campaign,
      startDate: new Date(campaign.startDate),
      endDate: campaign.endDate ? new Date(campaign.endDate) : undefined,
    });
  }

  /**
   * Register a sponsored product
   */
  registerSponsoredProduct(product: SponsoredProduct): void {
    const validated = SponsoredProductSchema.parse({
      ...product,
      startDate: new Date(product.startDate),
      endDate: product.endDate ? new Date(product.endDate) : undefined,
    });

    this.sponsoredProducts.set(validated.productId, validated);

    // Update daily budget tracking
    const key = `${product.campaignId}:${this.getDateKey(new Date())}`;
    if (!this.dailyBudgets.has(key)) {
      this.dailyBudgets.set(key, { spent: 0, date: new Date() });
    }
  }

  /**
   * Register multiple sponsored products
   */
  registerSponsoredProducts(products: SponsoredProduct[]): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        this.registerSponsoredProduct(product);
        success++;
      } catch (error) {
        console.error(`Failed to register sponsored product ${product.productId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get eligible sponsored products for a query
   */
  getEligibleSponsored(
    query: string,
    category?: string
  ): SponsoredProduct[] {
    const now = new Date();
    const queryLower = query.toLowerCase();

    return Array.from(this.sponsoredProducts.values()).filter(product => {
      // Check status
      if (product.status !== 'active') return false;

      // Check dates
      if (product.startDate > now) return false;
      if (product.endDate && product.endDate < now) return false;

      // Check budget
      if (!this.hasBudgetRemaining(product)) return false;

      // Check targeting
      const matchesKeyword = product.targetKeywords.some(k =>
        queryLower.includes(k.toLowerCase())
      );
      const matchesCategory = category &&
        product.targetCategories.some(c => c.toLowerCase() === category.toLowerCase());

      return matchesKeyword || matchesCategory;
    });
  }

  /**
   * Rank products with sponsored placement
   */
  rank(
    baseResults: Array<{ productId: string; score: number }>,
    query: string,
    category?: string,
    options: SponsoredOptions = {}
  ): SponsoredResult[] {
    const opts = SponsoredOptionsSchema.parse(options);

    const results: SponsoredResult[] = baseResults.map(r => ({
      productId: r.productId,
      sponsored: false,
      score: r.score,
    }));

    // Get eligible sponsored products
    const eligible = this.getEligibleSponsored(query, category);

    if (eligible.length === 0) {
      return results;
    }

    // Sort by effective bid (bid * priority factor)
    const sortedSponsored = eligible
      .map(p => ({
        ...p,
        effectiveBid: p.bidAmount * this.getPriorityMultiplier(p.priority),
      }))
      .sort((a, b) => b.effectiveBid - a.effectiveBid);

    // Determine how many sponsored slots
    const maxSponsored = Math.floor(results.length * opts.maxSponsoredRatio);

    // Select sponsored products
    const sponsoredToInclude = sortedSponsored.slice(0, maxSponsored);

    // Determine positions based on strategy
    const positions = this.calculatePositions(
      results.length,
      sponsoredToInclude.length,
      opts.positionStrategy
    );

    // Apply sponsored products
    for (let i = 0; i < sponsoredToInclude.length; i++) {
      const sponsored = sponsoredToInclude[i];
      const position = positions[i];

      // Check minimum bid threshold
      if (sponsored.bidAmount < opts.minBidThreshold) continue;

      // Create sponsored result
      const sponsoredResult: SponsoredResult = {
        productId: sponsored.productId,
        sponsored: true,
        campaignId: sponsored.campaignId,
        bidAmount: sponsored.bidAmount,
        boost: this.calculateBoost(sponsored, opts.bidMultiplier),
        position: position + 1,
      };

      // Insert at position
      results.splice(position, 0, sponsoredResult);

      // Track auction
      this.trackAuction(sponsored.productId);
    }

    return results;
  }

  /**
   * Get priority multiplier
   */
  private getPriorityMultiplier(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 1.5;
      case 'medium': return 1.0;
      case 'low': return 0.5;
    }
  }

  /**
   * Calculate boost for sponsored products
   */
  private calculateBoost(product: SponsoredProduct, multiplier: number): number {
    // Higher bids get higher boosts
    const normalizedBid = Math.min(1, product.bidAmount / 10); // Assume 10 is max reasonable bid
    return normalizedBid * multiplier;
  }

  /**
   * Calculate positions for sponsored products
   */
  private calculatePositions(
    totalResults: number,
    sponsoredCount: number,
    strategy: SponsoredOptions['positionStrategy']
  ): number[] {
    const positions: number[] = [];

    switch (strategy) {
      case 'top':
        // Place all at the top
        for (let i = 0; i < sponsoredCount; i++) {
          positions.push(i);
        }
        break;

      case 'scattered':
        // Distribute evenly throughout
        for (let i = 0; i < sponsoredCount; i++) {
          positions.push(Math.floor((i + 1) * (totalResults / (sponsoredCount + 1))));
        }
        break;

      case 'distributed':
        // Every nth position
        const interval = Math.floor(totalResults / (sponsoredCount + 1));
        for (let i = 0; i < sponsoredCount; i++) {
          positions.push(interval * (i + 1));
        }
        break;
    }

    return positions;
  }

  /**
   * Check if product has budget remaining
   */
  private hasBudgetRemaining(product: SponsoredProduct): boolean {
    const key = `${product.campaignId}:${this.getDateKey(new Date())}`;
    const daily = this.dailyBudgets.get(key);

    if (!daily) return true;

    return daily.spent + product.bidAmount <= product.dailyBudget;
  }

  /**
   * Track auction impression
   */
  private trackAuction(productId: string): void {
    const current = this.auctionHistory.get(productId) || 0;
    this.auctionHistory.set(productId, current + 1);
  }

  /**
   * Get date key for budget tracking
   */
  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Record a click (for cost tracking)
   */
  recordClick(productId: string, cost: number): void {
    const product = this.sponsoredProducts.get(productId);
    if (!product) return;

    const key = `${product.campaignId}:${this.getDateKey(new Date())}`;
    const daily = this.dailyBudgets.get(key) || { spent: cost, date: new Date() };
    daily.spent += cost;
    this.dailyBudgets.set(key, daily);

    // Update campaign spent
    const campaign = this.campaigns.get(product.campaignId);
    if (campaign) {
      campaign.spent += cost;
    }
  }

  /**
   * Get campaign statistics
   */
  getCampaignStats(campaignId: string): {
    campaign: Campaign | undefined;
    products: SponsoredProduct[];
    totalImpressions: number;
    totalBudget: number;
    remainingBudget: number;
  } {
    const campaign = this.campaigns.get(campaignId);
    const products = Array.from(this.sponsoredProducts.values())
      .filter(p => p.campaignId === campaignId);

    let totalImpressions = 0;
    for (const product of products) {
      totalImpressions += this.auctionHistory.get(product.productId) || 0;
    }

    const totalBudget = products.reduce((sum, p) => sum + p.dailyBudget, 0);
    const spent = products.reduce((sum, p) => {
      const key = `${campaignId}:${this.getDateKey(new Date())}`;
      return sum + (this.dailyBudgets.get(key)?.spent || 0);
    }, 0);

    return {
      campaign,
      products,
      totalImpressions,
      totalBudget,
      remainingBudget: totalBudget - spent,
    };
  }

  /**
   * Pause a campaign
   */
  pauseCampaign(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    campaign.status = 'paused';

    for (const product of this.sponsoredProducts.values()) {
      if (product.campaignId === campaignId) {
        product.status = 'paused';
      }
    }

    return true;
  }

  /**
   * Resume a campaign
   */
  resumeCampaign(campaignId: string): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    campaign.status = 'active';

    for (const product of this.sponsoredProducts.values()) {
      if (product.campaignId === campaignId) {
        product.status = 'active';
      }
    }

    return true;
  }

  /**
   * Get total sponsored product count
   */
  getProductCount(): number {
    return this.sponsoredProducts.size;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.campaigns.clear();
    this.sponsoredProducts.clear();
    this.dailyBudgets.clear();
    this.auctionHistory.clear();
  }
}

// Factory function
export function createSponsoredRanker(): SponsoredRanker {
  return new SponsoredRanker();
}
