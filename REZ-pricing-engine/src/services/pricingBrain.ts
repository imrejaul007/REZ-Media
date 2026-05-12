/**
 * REZ Pricing Brain
 *
 * AI-Powered Commerce Media Exchange Engine
 * Like Google Ads Auction + Uber Surge + Airbnb Smart Pricing
 * For real-world + digital ad inventory
 *
 * Components:
 * - Demand Engine
 * - Surge Engine
 * - Quality Score Engine
 * - Inventory Optimizer
 * - Smart Budget AI
 * - Yield Maximizer
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// TYPES
// ============================================================================

export interface PricingRequest {
  adType: AdType;
  placement: string;
  location?: Location;
  targetAudience?: Audience;
  scheduledTime?: TimeSlot;
  budget?: number;
  goalType: GoalType;
  vendorMinimumPrice?: number;
  campaignMode: 'auction' | 'reserved';
  performanceTier?: 'basic' | 'smart' | 'premium' | 'enterprise';
}

export type AdType = 'banner' | 'feed' | 'search' | 'store' | 'push' | 'whatsapp' | 'email' | 'dooh' | 'offline' | 'qr';

export type GoalType = 'awareness' | 'clicks' | 'conversions' | 'sales' | 'footfall' | 'qr_scans' | 'leads';

export interface Location {
  city?: string;
  area?: string;
  tier?: 'tier1' | 'tier2' | 'tier3';
  coordinates?: { lat: number; lng: number };
}

export interface Audience {
  segment: string;
  income: 'low' | 'medium' | 'high';
  ageGroup?: string;
  category?: CategoryType;
}

export type CategoryType = 'luxury' | 'real_estate' | 'restaurant' | 'events' | 'healthcare' | 'retail' | 'services';

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface PricingResponse {
  finalPrice: number;
  unit: PricingUnit;
  basePrice: number;
  maxCap: number;
  floorPrice: number;
  qualityScore: number;
  effectivePrice: number;
  confidenceScore: number;
  multipliers: Multipliers;
  breakdown: BreakdownItem[];
  auctionDetails?: AuctionDetails;
  performanceGuarantee?: PerformanceMetrics;
  recommendedBid: number;
  estimatedResults: EstimatedResults;
  validUntil: Date;
}

export interface Multipliers {
  demand: number;
  competition: number;
  peakTime: number;
  dayOfWeek: number;
  seasonal: number;
  location: number;
  category: number;
  weather: number;
  event: number;
  quality: number;
  confidence: number;
}

export interface BreakdownItem {
  component: string;
  multiplier: number;
  contribution: number;
  capped?: boolean;
}

export interface AuctionDetails {
  mode: 'auction' | 'reserved';
  competingAds: number;
  yourRank: number;
  winningBid: number;
  reservePrice: number;
}

export interface PerformanceMetrics {
  tier: string;
  guarantee: string;
  estimatedClicks: number;
  estimatedConversions: number;
  minimumClicks?: number;
  minimumConversions?: number;
}

export interface EstimatedResults {
  reach: number;
  clicks: number;
  conversions: number;
  visits: number;
  scans: number;
}

// ============================================================================
// PRICE CAPS (Safety Limits)
// ============================================================================

const MAX_SURGE_CAPS: Record<AdType, number> = {
  banner: 5,
  feed: 4,
  search: 6,
  store: 5,
  push: 4,
  whatsapp: 3,
  email: 2,
  dooh: 8,
  offline: 4,
  qr: 5,
};

const MINIMUM_CAMPAIGN_SPEND: Record<AdType, number> = {
  banner: 500,
  feed: 500,
  search: 500,
  store: 500,
  push: 300,
  whatsapp: 1000,
  email: 300,
  dooh: 3000,
  offline: 5000,
  qr: 500,
};

// ============================================================================
// BASE PRICING (INR)
// ============================================================================

const BASE_PRICES: Record<AdType, Record<PricingUnit, number>> = {
  banner: { CPM: 150, CPC: 5, CPA: 50, CPV: 8, CPS: 3 },
  feed: { CPM: 100, CPC: 3, CPA: 40, CPV: 6, CPS: 2 },
  search: { CPM: 250, CPC: 12, CPA: 80, CPV: 15, CPS: 5 },
  store: { CPM: 300, CPC: 15, CPA: 100, CPV: 20, CPS: 8 },
  push: { CPM: 30, CPC: 1, CPA: 15, CPV: 3, CPS: 1 },
  whatsapp: { CPM: 80, CPC: 3, CPA: 25, CPV: 5, CPS: 2 },
  email: { CPM: 20, CPC: 0.5, CPA: 10, CPV: 2, CPS: 0.5 },
  dooh: { CPM: 200, CPC: 8, CPA: 60, CPV: 12, CPS: 5 },
  offline: { CPM: 50, CPC: 2, CPA: 30, CPV: 5, CPS: 2 },
  qr: { CPM: 40, CPC: 2, CPA: 20, CPV: 4, CPS: 3 },
};

type PricingUnit = 'CPM' | 'CPC' | 'CPA' | 'CPV' | 'CPS';

// ============================================================================
// REZ PRICING BRAIN
// ============================================================================

export class REZPricingBrain {

  /**
   * Calculate dynamic price with all improvements
   */
  async calculatePrice(request: PricingRequest): Promise<PricingResponse> {
    const startTime = Date.now();

    // 1. Get base price
    const unit = this.getUnitForGoal(request.goalType);
    const basePrice = BASE_PRICES[request.adType]?.[unit] || 100;
    const maxCap = basePrice * MAX_SURGE_CAPS[request.adType];

    // 2. Calculate all multipliers
    const multipliers = await this.calculateMultipliers(request);

    // 3. Calculate confidence score (affects final pricing)
    const confidenceScore = this.calculateConfidence(multipliers);

    // 4. Calculate quality score
    const qualityScore = await this.calculateQualityScore(request);

    // 5. Apply multipliers
    const rawMultiplier = this.calculateTotalMultiplier(multipliers);

    // 6. Apply confidence dampening (low confidence = stay near floor)
    const confidenceMultiplier = 0.5 + (confidenceScore * 0.5);
    const adjustedMultiplier = rawMultiplier * confidenceMultiplier;

    // 7. Calculate final price with cap
    let finalPrice = basePrice * adjustedMultiplier;
    finalPrice = Math.min(finalPrice, maxCap);
    finalPrice = Math.max(finalPrice, request.vendorMinimumPrice || basePrice * 0.3);

    // 8. Calculate effective price (with quality score)
    const effectivePrice = finalPrice / (1 + (qualityScore - 1) * 0.2);

    // 9. Generate breakdown
    const breakdown = this.generateBreakdown(basePrice, multipliers, finalPrice, maxCap);

    // 10. Get auction details
    const auctionDetails = request.campaignMode === 'auction'
      ? await this.getAuctionDetails(request, finalPrice)
      : undefined;

    // 11. Performance guarantee
    const performanceGuarantee = this.getPerformanceGuarantee(request, effectivePrice);

    // 12. Recommended bid (15% premium for better placement)
    const recommendedBid = finalPrice * 1.15;

    // 13. Estimated results
    const estimatedResults = this.estimateResults(request, finalPrice);

    return {
      finalPrice: Math.round(finalPrice * 100) / 100,
      unit,
      basePrice,
      maxCap,
      floorPrice: request.vendorMinimumPrice || basePrice * 0.3,
      qualityScore,
      effectivePrice: Math.round(effectivePrice * 100) / 100,
      confidenceScore,
      multipliers,
      breakdown,
      auctionDetails,
      performanceGuarantee,
      recommendedBid: Math.round(recommendedBid * 100) / 100,
      estimatedResults,
      validUntil: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  /**
   * Calculate all pricing multipliers
   */
  private async calculateMultipliers(request: PricingRequest): Promise<Multipliers> {
    const multipliers: Multipliers = {
      demand: 1.0,
      competition: 1.0,
      peakTime: 1.0,
      dayOfWeek: 1.0,
      seasonal: 1.0,
      location: 1.0,
      category: 1.0,
      weather: 1.0,
      event: 1.0,
      quality: 1.0,
      confidence: 1.0,
    };

    // Time multipliers
    if (request.scheduledTime) {
      const hour = new Date(request.scheduledTime.start).getHours();
      const day = new Date(request.scheduledTime.start).getDay();
      const month = new Date(request.scheduledTime.start).getMonth();

      multipliers.peakTime = this.getPeakTimeMultiplier(hour);
      multipliers.dayOfWeek = this.getDayMultiplier(day);
      multipliers.seasonal = this.getSeasonalMultiplier(month);
    }

    // Location multipliers
    if (request.location) {
      multipliers.location = this.getLocationMultiplier(request.location);
    }

    // Audience multipliers
    if (request.targetAudience) {
      multipliers.category = this.getCategoryMultiplier(request.targetAudience.category);
      multipliers.demand = this.getDemandMultiplier(request.targetAudience);
    }

    // Competition (would come from real data)
    multipliers.competition = await this.getCompetitionMultiplier(request);

    // Weather (would come from weather API)
    multipliers.weather = await this.getWeatherMultiplier(request.location);

    // Events (would come from events API)
    multipliers.event = await this.getEventMultiplier(request.location);

    return multipliers;
  }

  /**
   * Peak time multipliers
   */
  private getPeakTimeMultiplier(hour: number): number {
    const peakHours: Record<number, number> = {
      6: 0.6, 7: 0.8, 8: 1.2, 9: 1.5, 10: 1.8, 11: 2.0,
      12: 1.8, 13: 1.3, 14: 1.2, 15: 1.0, 16: 1.1, 17: 1.4,
      18: 1.8, 19: 2.2, 20: 2.5, 21: 2.0, 22: 1.5, 23: 0.9,
      0: 0.5, 1: 0.4, 2: 0.3, 3: 0.3, 4: 0.4, 5: 0.5,
    };
    return peakHours[hour] || 1.0;
  }

  /**
   * Day of week multipliers
   */
  private getDayMultiplier(day: number): number {
    const days: Record<number, number> = {
      0: 0.7, 1: 0.9, 2: 0.95, 3: 1.0, 4: 1.1, 5: 1.3, 6: 1.4,
    };
    return days[day] || 1.0;
  }

  /**
   * Seasonal multipliers
   */
  private getSeasonalMultiplier(month: number): number {
    if ([9, 10, 11].includes(month)) return 2.0; // Oct-Dec festivals
    if ([2, 3].includes(month)) return 1.5; // Holi
    if ([4, 5].includes(month)) return 1.3; // Summer
    if ([6, 7].includes(month)) return 0.8; // Monsoon
    return 1.0;
  }

  /**
   * Location multipliers
   */
  private getLocationMultiplier(location: Location): number {
    const tierMultipliers: Record<string, number> = {
      tier1: 2.5,
      tier2: 1.5,
      tier3: 1.0,
    };
    return tierMultipliers[location.tier || 'tier2'];
  }

  /**
   * Category multipliers (certain industries pay more)
   */
  private getCategoryMultiplier(category?: CategoryType): number {
    const categoryMultipliers: Record<string, number> = {
      luxury: 2.5,
      real_estate: 3.0,
      restaurant: 1.0,
      events: 1.8,
      healthcare: 2.0,
      retail: 1.2,
      services: 1.0,
    };
    return category ? (categoryMultipliers[category] || 1.0) : 1.0;
  }

  /**
   * Demand multiplier based on audience
   */
  private getDemandMultiplier(audience: Audience): number {
    let demand = 1.0;
    if (audience.income === 'high') demand *= 1.5;
    if (audience.income === 'medium') demand *= 1.2;
    return demand;
  }

  /**
   * Competition multiplier (would query active campaigns)
   */
  private async getCompetitionMultiplier(request: PricingRequest): Promise<number> {
    // Simulated - would query active campaigns count
    const activeCampaigns = await this.getActiveCampaignsCount(request);
    if (activeCampaigns > 50) return 1.8;
    if (activeCampaigns > 20) return 1.4;
    if (activeCampaigns > 10) return 1.2;
    if (activeCampaigns < 3) return 0.7;
    return 1.0;
  }

  /**
   * Weather multiplier (rainy = food delivery up, mall down)
   */
  private async getWeatherMultiplier(location?: Location): Promise<number> {
    // Simulated - would query weather API
    return 1.0;
  }

  /**
   * Event multiplier (IPL, concerts, etc.)
   */
  private async getEventMultiplier(location?: Location): Promise<number> {
    // Simulated - would query events API
    return 1.0;
  }

  /**
   * Get active campaigns count (simulated)
   */
  private async getActiveCampaignsCount(request: PricingRequest): Promise<number> {
    return Math.floor(Math.random() * 30) + 5;
  }

  /**
   * Calculate quality score (like Google Ads)
   */
  private async calculateQualityScore(request: PricingRequest): Promise<number> {
    // Base quality score (1.0 - 10.0 scale)
    let score = 5.0;

    // Would query historical data for:
    // - CTR: +0-2 points
    // - Conversion rate: +0-2 points
    // - QR engagement: +0-1.5 points
    // - User feedback: +0-1 point
    // - Ad relevance: +0-1.5 points
    // - Landing page: +0-1 point

    return score / 5; // Normalize to 0.5 - 2.0
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(multipliers: Multipliers): number {
    let confidence = 0.5; // Base

    // More historical data = higher confidence
    // New inventory = lower confidence
    if (multipliers.quality !== 1.0) confidence += 0.1;
    if (multipliers.peakTime !== 1.0) confidence += 0.1;
    if (multipliers.seasonal !== 1.0) confidence += 0.1;
    if (multipliers.location !== 1.0) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate total multiplier with cap
   */
  private calculateTotalMultiplier(m: Multipliers): number {
    return m.demand *
      m.competition *
      m.peakTime *
      m.dayOfWeek *
      m.seasonal *
      m.location *
      m.category *
      m.weather *
      m.event;
  }

  /**
   * Get pricing unit for goal
   */
  private getUnitForGoal(goal: GoalType): PricingUnit {
    switch (goal) {
      case 'awareness': return 'CPM';
      case 'clicks': return 'CPC';
      case 'conversions':
      case 'sales':
      case 'leads': return 'CPA';
      case 'footfall': return 'CPV';
      case 'qr_scans': return 'CPS';
      default: return 'CPM';
    }
  }

  /**
   * Generate pricing breakdown
   */
  private generateBreakdown(base: number, m: Multipliers, final: number, cap: number): BreakdownItem[] {
    const items: BreakdownItem[] = [
      { component: 'Base Price', multiplier: 1.0, contribution: base },
    ];

    const addMultiplier = (name: string, value: number) => {
      if (value !== 1.0) {
        items.push({
          component: name,
          multiplier: value,
          contribution: base * (value - 1),
        });
      }
    };

    addMultiplier('Demand', m.demand);
    addMultiplier('Competition', m.competition);
    addMultiplier('Peak Time', m.peakTime);
    addMultiplier('Day of Week', m.dayOfWeek);
    addMultiplier('Seasonal', m.seasonal);
    addMultiplier('Location', m.location);
    addMultiplier('Category', m.category);
    addMultiplier('Weather', m.weather);
    addMultiplier('Event', m.event);

    if (final >= cap * 0.95) {
      items.push({ component: 'MAX CAP APPLIED', multiplier: 1.0, contribution: 0, capped: true });
    }

    return items;
  }

  /**
   * Get auction details
   */
  private async getAuctionDetails(request: PricingRequest, currentBid: number): Promise<AuctionDetails> {
    const competingAds = await this.getActiveCampaignsCount(request);
    return {
      mode: 'auction',
      competingAds,
      yourRank: Math.floor(Math.random() * competingAds) + 1,
      winningBid: currentBid * (1 + Math.random() * 0.3),
      reservePrice: currentBid * 0.6,
    };
  }

  /**
   * Get performance guarantee based on tier
   */
  private getPerformanceGuarantee(request: PricingRequest, price: number): PerformanceMetrics | undefined {
    if (!request.performanceTier || request.performanceTier === 'basic') return undefined;

    const baseClicks = this.estimateClicks(request.budget || 1000, price);

    if (request.performanceTier === 'smart') {
      return {
        tier: 'smart',
        guarantee: 'CTR optimization',
        estimatedClicks: baseClicks,
        estimatedConversions: Math.round(baseClicks * 0.05),
      };
    }

    if (request.performanceTier === 'premium') {
      return {
        tier: 'premium',
        guarantee: 'Conversion optimization',
        estimatedClicks: baseClicks,
        estimatedConversions: Math.round(baseClicks * 0.08),
        minimumConversions: Math.round(baseClicks * 0.05),
      };
    }

    if (request.performanceTier === 'enterprise') {
      return {
        tier: 'enterprise',
        guarantee: 'Minimum footfall guarantee',
        estimatedClicks: baseClicks,
        estimatedConversions: Math.round(baseClicks * 0.1),
        minimumClicks: Math.round(baseClicks * 0.8),
      };
    }

    return undefined;
  }

  /**
   * Estimate results
   */
  private estimateResults(request: PricingRequest, price: number): EstimatedResults {
    const budget = request.budget || 1000;
    const ctr = 0.02; // 2% average CTR
    const conversionRate = 0.05; // 5% conversion rate

    const clicks = Math.round(budget / price);
    const conversions = Math.round(clicks * conversionRate);

    return {
      reach: Math.round(clicks / ctr),
      clicks,
      conversions,
      visits: Math.round(clicks * 0.7),
      scans: request.adType === 'qr' ? Math.round(clicks * 0.4) : 0,
    };
  }

  /**
   * Estimate clicks from budget
   */
  private estimateClicks(budget: number, cpc: number): number {
    return Math.round(budget / cpc);
  }

  /**
   * Calculate inventory liquidation price (unsold inventory)
   */
  async calculateLiquidationPrice(
    originalPrice: number,
    hoursUntilSlot: number,
    percentSold: number
  ): Promise<number> {
    let discount = 0;

    // Last minute = bigger discount
    if (hoursUntilSlot < 1) discount += 0.5; // 50% off
    else if (hoursUntilSlot < 4) discount += 0.3; // 30% off
    else if (hoursUntilSlot < 24) discount += 0.15; // 15% off

    // Unsold inventory = bigger discount
    if (percentSold < 25) discount += 0.25;
    else if (percentSold < 50) discount += 0.15;
    else if (percentSold < 75) discount += 0.05;

    return originalPrice * (1 - Math.min(discount, 0.7)); // Max 70% off
  }

  /**
   * Smart budget allocation (AI recommends distribution)
   */
  async allocateBudget(totalBudget: number, goal: GoalType, location: Location): Promise<BudgetAllocation[]> {
    const allocations: BudgetAllocation[] = [];

    // AI recommendation based on goal and location
    const distribution = this.getRecommendedDistribution(goal);

    for (const [channel, percentage] of Object.entries(distribution)) {
      const amount = totalBudget * (percentage / 100);
      const adType = channel as AdType;
      const estimatedResults = this.estimateResults({ adType, goalType: goal, budget: amount }, BASE_PRICES[adType]?.CPA || 50);

      allocations.push({
        channel: adType,
        amount: Math.round(amount),
        percentage,
        estimatedReach: estimatedResults.reach,
        estimatedClicks: estimatedResults.clicks,
        estimatedConversions: estimatedResults.conversions,
        cpm: BASE_PRICES[adType]?.CPM || 100,
      });
    }

    return allocations.sort((a, b) => b.amount - a.amount);
  }

  /**
   * Get recommended channel distribution
   */
  private getRecommendedDistribution(goal: GoalType): Record<string, number> {
    const distributions: Record<GoalType, Record<string, number>> = {
      awareness: { push: 30, feed: 25, banner: 20, whatsapp: 15, email: 10 },
      clicks: { search: 30, feed: 25, push: 20, banner: 15, whatsapp: 10 },
      conversions: { whatsapp: 30, search: 25, feed: 20, push: 15, email: 10 },
      sales: { whatsapp: 35, feed: 25, push: 20, banner: 15, email: 5 },
      footfall: { dooh: 40, push: 25, qr: 20, offline: 15 },
      qr_scans: { qr: 50, offline: 30, push: 20 },
      leads: { whatsapp: 30, feed: 25, search: 20, push: 15, email: 10 },
    };

    return distributions[goal] || distributions.awareness;
  }

  /**
   * Validate minimum spend
   */
  validateMinimumSpend(adType: AdType, budget: number): { valid: boolean; message?: string } {
    const minimum = MINIMUM_CAMPAIGN_SPEND[adType];
    if (budget < minimum) {
      return {
        valid: false,
        message: `Minimum campaign spend for ${adType} is ₹${minimum}`,
      };
    }
    return { valid: true };
  }
}

export interface BudgetAllocation {
  channel: AdType;
  amount: number;
  percentage: number;
  estimatedReach: number;
  estimatedClicks: number;
  estimatedConversions: number;
  cpm: number;
}

export const pricingBrain = new REZPricingBrain();
