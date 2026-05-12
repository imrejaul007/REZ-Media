/**
 * REZ AI Dynamic Pricing Engine
 *
 * Pricing model like Meta Ads, Google Ads, Uber Surge, Airbnb Smart Pricing
 * For real-world + digital ad inventory
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// Types
// ============================================================================

export interface PricingFactors {
  // Base pricing
  basePrice: number;
  currency: string;

  // Demand factors (0.5 - 2.0)
  demandMultiplier: number;
  competitionMultiplier: number;

  // Time factors (0.5 - 3.0)
  peakTimeMultiplier: number;
  dayOfWeekMultiplier: number;
  seasonalMultiplier: number;

  // Location factors (0.8 - 3.0)
  locationMultiplier: number;
  footTrafficMultiplier: number;
  incomeLevelMultiplier: number;

  // Quality factors (0.5 - 2.0)
  conversionScore: number;
  audienceQuality: number;
  engagementRate: number;

  // QR/Offline factors (0.5 - 2.0)
  qrScanRate?: number;
  historicalPerformance?: number;
}

export interface PricingRequest {
  adType: 'banner' | 'feed' | 'search' | 'store' | 'push' | 'whatsapp' | 'email' | 'dooh' | 'offline' | 'qr';
  placement: string;
  location?: {
    city?: string;
    area?: string;
    coordinates?: { lat: number; lng: number };
  };
  targetAudience?: {
    segment: string;
    income: 'low' | 'medium' | 'high';
    ageGroup?: string;
  };
  scheduledTime?: {
    start: Date;
    end: Date;
  };
  budget?: number;
  goalType: 'awareness' | 'clicks' | 'conversions' | 'sales' | 'footfall' | 'qr_scans';
  vendorMinimumPrice?: number;
  competitionLevel?: 'low' | 'medium' | 'high';
}

export interface PricingResponse {
  finalPrice: number;
  unit: 'CPM' | 'CPC' | 'CPA' | 'CPV' | 'CPS';
  basePrice: number;
  factors: PricingFactors;
  breakdown: {
    component: string;
    multiplier: number;
    contribution: number;
  }[];
  recommendedBid: number;
  estimatedReach: number;
  estimatedClicks: number;
  estimatedConversions: number;
  confidenceScore: number;
  validUntil: Date;
}

// ============================================================================
// AI Pricing Engine
// ============================================================================

export class AIDynamicPricingEngine {

  // Base prices by ad type (in INR)
  private basePrices: Record<string, Record<string, number>> = {
    banner: { CPM: 150, CPC: 5, CPA: 50 },
    feed: { CPM: 100, CPC: 3, CPA: 40 },
    search: { CPM: 250, CPC: 12, CPA: 80 },
    store: { CPM: 300, CPC: 15, CPA: 100 },
    push: { CPM: 30, CPC: 1, CPA: 15 },
    whatsapp: { CPM: 80, CPC: 3, CPA: 25 },
    email: { CPM: 20, CPC: 0.5, CPA: 10 },
    dooh: { CPM: 200, CPC: 8, CPA: 60 },
    offline: { CPM: 50, CPC: 2, CPA: 30 },
    qr: { CPM: 40, CPC: 2, CPA: 20 },
  };

  // Peak time multipliers (hour of day)
  private peakHours: Record<number, number> = {
    6: 0.6, 7: 0.8, 8: 1.2, 9: 1.5, 10: 1.8, 11: 2.0,
    12: 1.8, 13: 1.3, 14: 1.2, 15: 1.0, 16: 1.1, 17: 1.4,
    18: 1.8, 19: 2.2, 20: 2.5, 21: 2.0, 22: 1.5, 23: 0.9,
    0: 0.5, 1: 0.4, 2: 0.3, 3: 0.3, 4: 0.4, 5: 0.5,
  };

  // Day of week multipliers
  private dayMultipliers: Record<number, number> = {
    0: 0.7,  // Sunday
    1: 0.9,  // Monday
    2: 0.95, // Tuesday
    3: 1.0,  // Wednesday
    4: 1.1,  // Thursday
    5: 1.3,  // Friday
    6: 1.4,  // Saturday
  };

  // Seasonal events
  private seasonalEvents: Record<string, number> = {
    'diwali': 3.0,
    'christmas': 2.5,
    'new_year': 2.8,
    'holi': 2.2,
    'eid': 2.5,
    'dussehra': 2.0,
    ' Independence_day': 2.0,
    'republic_day': 2.0,
    'cyber_monday': 2.2,
    'black_friday': 2.5,
    'summer_sale': 1.8,
    'winter_sale': 1.8,
  };

  // Location multipliers by city tier
  private cityMultipliers: Record<string, number> = {
    'tier1': 2.5,      // Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad
    'tier2': 1.5,      // Pune, Ahmedabad, Jaipur, Lucknow, etc.
    'tier3': 1.0,      // Smaller cities
    'rural': 0.6,      // Rural areas
  };

  // Audience income multipliers
  private incomeMultipliers: Record<string, number> = {
    'high': 2.0,
    'medium': 1.3,
    'low': 0.8,
  };

  /**
   * Calculate dynamic price for an ad placement
   */
  async calculatePrice(request: PricingRequest): Promise<PricingResponse> {
    const startTime = Date.now();

    // Get base price
    const basePrice = this.basePrices[request.adType]?.[this.getUnitForGoal(request.goalType)] || 100;

    // Calculate all multipliers
    const factors = await this.calculateFactors(request);

    // Calculate final price
    const multipliers = [
      factors.demandMultiplier,
      factors.competitionMultiplier,
      factors.peakTimeMultiplier,
      factors.dayOfWeekMultiplier,
      factors.seasonalMultiplier,
      factors.locationMultiplier,
      factors.footTrafficMultiplier,
      factors.incomeLevelMultiplier,
      factors.conversionScore,
      factors.audienceQuality,
      factors.engagementRate,
    ];

    const totalMultiplier = multipliers.reduce((a, b) => a * b, 1);
    const rawPrice = basePrice * totalMultiplier;

    // Apply vendor minimum floor
    const vendorMinimum = request.vendorMinimumPrice || 0;
    const finalPrice = Math.max(rawPrice, vendorMinimum);

    // Calculate breakdown
    const breakdown = this.generateBreakdown(basePrice, factors);

    // Generate recommendations
    const recommendedBid = finalPrice * 1.15; // Slight premium for better placement

    // Estimate reach and conversions
    const { estimatedReach, estimatedClicks, estimatedConversions } = this.estimatePerformance(
      request,
      finalPrice
    );

    // Calculate confidence based on data availability
    const confidenceScore = this.calculateConfidence(factors);

    return {
      finalPrice: Math.round(finalPrice * 100) / 100,
      unit: this.getUnitForGoal(request.goalType),
      basePrice,
      factors,
      breakdown,
      recommendedBid: Math.round(recommendedBid * 100) / 100,
      estimatedReach,
      estimatedClicks,
      estimatedConversions,
      confidenceScore,
      validUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  }

  /**
   * Calculate all pricing factors
   */
  private async calculateFactors(request: PricingRequest): Promise<PricingFactors> {
    const factors: PricingFactors = {
      basePrice: this.basePrices[request.adType]?.[this.getUnitForGoal(request.goalType)] || 100,
      currency: 'INR',
      demandMultiplier: 1.0,
      competitionMultiplier: 1.0,
      peakTimeMultiplier: 1.0,
      dayOfWeekMultiplier: 1.0,
      seasonalMultiplier: 1.0,
      locationMultiplier: 1.0,
      footTrafficMultiplier: 1.0,
      incomeLevelMultiplier: 1.0,
      conversionScore: 1.0,
      audienceQuality: 1.0,
      engagementRate: 1.0,
    };

    // Calculate time factors
    if (request.scheduledTime) {
      const hour = new Date(request.scheduledTime.start).getHours();
      factors.peakTimeMultiplier = this.peakHours[hour] || 1.0;

      const day = new Date(request.scheduledTime.start).getDay();
      factors.dayOfWeekMultiplier = this.dayMultipliers[day] || 1.0;

      // Check for seasonal events
      const month = new Date(request.scheduledTime.start).getMonth();
      factors.seasonalMultiplier = this.getSeasonalMultiplier(month);
    }

    // Calculate location factors
    if (request.location?.city) {
      const tier = this.getCityTier(request.location.city);
      factors.locationMultiplier = this.cityMultipliers[tier] || 1.0;
    }

    // Calculate audience factors
    if (request.targetAudience?.income) {
      factors.incomeLevelMultiplier = this.incomeMultipliers[request.targetAudience.income] || 1.0;
    }

    // Calculate competition factor
    factors.competitionMultiplier = this.getCompetitionMultiplier(request.competitionLevel);

    // Fetch additional factors from data sources (simulated)
    const trafficData = await this.fetchTrafficData(request.location);
    factors.footTrafficMultiplier = trafficData.multiplier;

    const conversionData = await this.fetchConversionData(request.adType);
    factors.conversionScore = conversionData.score;

    const engagementData = await this.fetchEngagementData(request.adType, request.targetAudience);
    factors.engagementRate = engagementData.rate;

    return factors;
  }

  /**
   * Get pricing unit based on advertiser goal
   */
  private getUnitForGoal(goal: string): 'CPM' | 'CPC' | 'CPA' | 'CPV' | 'CPS' {
    switch (goal) {
      case 'awareness': return 'CPM';
      case 'clicks': return 'CPC';
      case 'conversions':
      case 'sales': return 'CPA';
      case 'footfall': return 'CPV';
      case 'qr_scans': return 'CPS';
      default: return 'CPM';
    }
  }

  /**
   * Get city tier for location multiplier
   */
  private getCityTier(city: string): string {
    const tier1Cities = ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad'];
    const tier2Cities = ['jaipur', 'lucknow', 'chandigarh', 'indore', 'bhubaneswar', 'nagpur', 'mangalore'];

    const normalizedCity = city.toLowerCase();

    if (tier1Cities.some(c => normalizedCity.includes(c))) return 'tier1';
    if (tier2Cities.some(c => normalizedCity.includes(c))) return 'tier2';
    return 'tier3';
  }

  /**
   * Get competition multiplier
   */
  private getCompetitionMultiplier(level?: string): number {
    switch (level) {
      case 'high': return 1.8;
      case 'medium': return 1.2;
      case 'low': return 0.7;
      default: return 1.0;
    }
  }

  /**
   * Get seasonal multiplier based on month
   */
  private getSeasonalMultiplier(month: number): number {
    // Festival-heavy months get surge pricing
    if ([9, 10, 11].includes(month)) return 2.0; // Oct-Dec (Diwali, Christmas)
    if ([2, 3].includes(month)) return 1.5; // Mar (Holi)
    if ([4, 5].includes(month)) return 1.3; // Summer sale
    if ([6, 7].includes(month)) return 0.8; // Monsoon slump
    return 1.0;
  }

  /**
   * Generate pricing breakdown
   */
  private generateBreakdown(basePrice: number, factors: PricingFactors) {
    return [
      { component: 'Base Price', multiplier: 1.0, contribution: basePrice },
      { component: 'Demand', multiplier: factors.demandMultiplier, contribution: basePrice * (factors.demandMultiplier - 1) },
      { component: 'Competition', multiplier: factors.competitionMultiplier, contribution: basePrice * (factors.competitionMultiplier - 1) },
      { component: 'Peak Time', multiplier: factors.peakTimeMultiplier, contribution: basePrice * (factors.peakTimeMultiplier - 1) },
      { component: 'Day of Week', multiplier: factors.dayOfWeekMultiplier, contribution: basePrice * (factors.dayOfWeekMultiplier - 1) },
      { component: 'Seasonal', multiplier: factors.seasonalMultiplier, contribution: basePrice * (factors.seasonalMultiplier - 1) },
      { component: 'Location', multiplier: factors.locationMultiplier, contribution: basePrice * (factors.locationMultiplier - 1) },
      { component: 'Foot Traffic', multiplier: factors.footTrafficMultiplier, contribution: basePrice * (factors.footTrafficMultiplier - 1) },
      { component: 'Audience Quality', multiplier: factors.audienceQuality, contribution: basePrice * (factors.audienceQuality - 1) },
      { component: 'Engagement', multiplier: factors.engagementRate, contribution: basePrice * (factors.engagementRate - 1) },
    ];
  }

  /**
   * Estimate performance metrics
   */
  private estimatePerformance(request: PricingRequest, price: number) {
    // Base reach estimate (would come from actual data)
    const baseReach = {
      banner: 50000,
      feed: 75000,
      search: 25000,
      store: 15000,
      push: 100000,
      whatsapp: 40000,
      email: 200000,
      dooh: 30000,
      offline: 10000,
      qr: 5000,
    };

    const base = baseReach[request.adType] || 10000;

    // Adjust based on budget
    const budgetFactor = request.budget ? Math.min(request.budget / 10000, 3) : 1;

    // Adjust based on targeting
    const targetingFactor = request.targetAudience ? 0.3 : 1;

    const estimatedReach = Math.round(base * budgetFactor * targetingFactor);
    const estimatedClicks = Math.round(estimatedReach * 0.02); // 2% CTR average
    const estimatedConversions = Math.round(estimatedClicks * 0.05); // 5% conversion average

    return { estimatedReach, estimatedClicks, estimatedConversions };
  }

  /**
   * Calculate confidence score based on data availability
   */
  private calculateConfidence(factors: PricingFactors): number {
    let confidence = 0.5; // Base confidence

    if (factors.footTrafficMultiplier !== 1.0) confidence += 0.1;
    if (factors.conversionScore !== 1.0) confidence += 0.1;
    if (factors.engagementRate !== 1.0) confidence += 0.1;
    if (factors.seasonalMultiplier !== 1.0) confidence += 0.1;
    if (factors.locationMultiplier !== 1.0) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  // Simulated data fetch methods (would connect to actual data sources)
  private async fetchTrafficData(location?: PricingRequest['location']): Promise<{ multiplier: number }> {
    // In production, this would query traffic/footfall APIs
    return { multiplier: 1.0 + Math.random() * 0.5 };
  }

  private async fetchConversionData(adType: string): Promise<{ score: number }> {
    // In production, this would query historical conversion data
    const scores: Record<string, number> = {
      search: 1.5, store: 1.4, feed: 1.1, banner: 0.9, push: 0.8, email: 0.7,
    };
    return { score: scores[adType] || 1.0 };
  }

  private async fetchEngagementData(adType: string, audience?: PricingRequest['targetAudience']): Promise<{ rate: number }> {
    // In production, this would query engagement analytics
    return { rate: 0.8 + Math.random() * 0.4 };
  }
}

export const pricingEngine = new AIDynamicPricingEngine();
