/**
 * DOOH Service - Ad Decision Engine (AdOS Brain)
 *
 * Core decision-making service for:
 * - Ad selection for screens
 * - Campaign scoring and ranking
 * - ROI calculation
 * - Budget allocation
 * - Guardrails enforcement
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DOOHCampaign,
  Creative,
  DeliveryRequest,
  DeliveryResponse,
  DeliverySlot,
  DeliveryContext,
  AdDecision,
  Playlist,
  PlaylistSlot,
  PlaylistRequest,
  Screen,
  AudienceProfile,
  AudienceSegment,
  DOOHTargeting,
  ContextSignal,
  ROIResult,
  ListingMetrics,
  BudgetAllocation,
  AllocationWarning,
  GuardrailConfig,
  GuardrailResult,
  DEFAULT_GUARDRAILS,
  DEFAULT_SCORING_WEIGHTS,
  CampaignMetrics,
} from '../types';
import { ScreenManagementService } from './screenManagement';
import { AreaIntelligenceService } from './areaIntelligence';

// ============================================================================
// Ad Store
// ============================================================================

class AdStore {
  private campaigns: Map<string, DOOHCampaign> = new Map();

  /**
   * Create a new campaign
   */
  createCampaign(campaign: Omit<DOOHCampaign, 'id' | 'created_at' | 'updated_at' | 'metrics'>): DOOHCampaign {
    const newCampaign: DOOHCampaign = {
      ...campaign,
      id: `campaign_${uuidv4()}`,
      metrics: {
        impressions: 0,
        unique_impressions: 0,
        avg_view_duration: 0,
        interactions: 0,
        scans: 0,
        visits: 0,
        purchases: 0,
        revenue: 0,
        scan_rate: 0,
        visit_rate: 0,
        purchase_rate: 0,
        total_spent: 0,
        cpm_actual: 0,
        cpc_actual: 0,
        cpu_actual: 0,
        cpp_actual: 0,
        last_updated: new Date(),
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.campaigns.set(newCampaign.id, newCampaign);
    return newCampaign;
  }

  /**
   * Get campaign by ID
   */
  get(campaignId: string): DOOHCampaign | undefined {
    return this.campaigns.get(campaignId);
  }

  /**
   * Get all campaigns
   */
  getAll(): DOOHCampaign[] {
    return Array.from(this.campaigns.values());
  }

  /**
   * Get active campaigns
   */
  getActive(): DOOHCampaign[] {
    const now = new Date();
    return Array.from(this.campaigns.values()).filter(c =>
      c.status === 'active' &&
      c.spent < c.budget &&
      c.start_date <= now &&
      c.end_date >= now
    );
  }

  /**
   * Get campaigns by merchant
   */
  getByMerchant(merchantId: string): DOOHCampaign[] {
    return Array.from(this.campaigns.values()).filter(c => c.merchant_id === merchantId);
  }

  /**
   * Get campaigns for a screen
   */
  getForScreen(screen: Screen): DOOHCampaign[] {
    const now = new Date();
    return Array.from(this.campaigns.values()).filter(campaign => {
      // Check status
      if (campaign.status !== 'active') return false;

      // Check budget
      if (campaign.spent >= campaign.budget) return false;

      // Check date range
      if (now < campaign.start_date || now > campaign.end_date) return false;

      // Check city targeting
      if (campaign.targeting.cities?.length) {
        if (!campaign.targeting.cities.includes(screen.location.city)) {
          return false;
        }
      }

      // Check area targeting
      if (campaign.targeting.areas?.length) {
        if (!campaign.targeting.areas.includes(screen.location.area)) {
          return false;
        }
      }

      // Check screen type targeting
      if (campaign.targeting.screen_types?.length) {
        if (!campaign.targeting.screen_types.includes(screen.type)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Update campaign
   */
  update(campaignId: string, updates: Partial<DOOHCampaign>): DOOHCampaign | null {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return null;

    const updated: DOOHCampaign = {
      ...campaign,
      ...updates,
      id: campaign.id, // Prevent ID change
      updated_at: new Date(),
    };

    this.campaigns.set(campaignId, updated);
    return updated;
  }

  /**
   * Update campaign metrics
   */
  updateMetrics(campaignId: string, updates: Partial<CampaignMetrics>): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    campaign.metrics = { ...campaign.metrics, ...updates, last_updated: new Date() };
    this.campaigns.set(campaignId, campaign);
    return true;
  }

  /**
   * Update campaign spend
   */
  updateSpend(campaignId: string, amount: number): boolean {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return false;

    campaign.spent += amount;
    campaign.metrics.total_spent += amount;

    if (campaign.spent >= campaign.budget) {
      campaign.status = 'budget_exhausted';
    }

    campaign.updated_at = new Date();
    this.campaigns.set(campaignId, campaign);
    return true;
  }

  /**
   * Delete campaign
   */
  delete(campaignId: string): boolean {
    return this.campaigns.delete(campaignId);
  }
}

// ============================================================================
// Ad Decision Engine
// ============================================================================

export class AdDecisionService {
  private adStore: AdStore;
  private screenService: ScreenManagementService;
  private areaService: AreaIntelligenceService;
  private guardrails: GuardrailConfig;

  constructor(
    screenService: ScreenManagementService,
    areaService: AreaIntelligenceService,
    guardrails?: Partial<GuardrailConfig>
  ) {
    this.adStore = new AdStore();
    this.screenService = screenService;
    this.areaService = areaService;
    this.guardrails = { ...DEFAULT_GUARDRAILS, ...guardrails };
  }

  // -------------------------------------------------------------------------
  // Campaign Management
  // -------------------------------------------------------------------------

  /**
   * Create a new campaign
   */
  createCampaign(campaign: Omit<DOOHCampaign, 'id' | 'created_at' | 'updated_at' | 'metrics'>): DOOHCampaign {
    return this.adStore.createCampaign(campaign);
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): DOOHCampaign | undefined {
    return this.adStore.get(campaignId);
  }

  /**
   * Get all campaigns
   */
  getAllCampaigns(): DOOHCampaign[] {
    return this.adStore.getAll();
  }

  /**
   * Get active campaigns
   */
  getActiveCampaigns(): DOOHCampaign[] {
    return this.adStore.getActive();
  }

  /**
   * Get campaigns for a merchant
   */
  getCampaignsByMerchant(merchantId: string): DOOHCampaign[] {
    return this.adStore.getByMerchant(merchantId);
  }

  /**
   * Update campaign status
   */
  updateCampaignStatus(campaignId: string, status: DOOHCampaign['status']): boolean {
    const campaign = this.adStore.get(campaignId);
    if (!campaign) return false;
    return !!this.adStore.update(campaignId, { status });
  }

  /**
   * Delete campaign
   */
  deleteCampaign(campaignId: string): boolean {
    return this.adStore.delete(campaignId);
  }

  // -------------------------------------------------------------------------
  // Ad Delivery
  // -------------------------------------------------------------------------

  /**
   * Get ads for a screen (main delivery function)
   */
  getAdsForScreen(request: DeliveryRequest): DeliveryResponse {
    const screen = this.screenService.getScreen(request.screen_id);
    if (!screen) {
      throw new Error(`Screen not found: ${request.screen_id}`);
    }

    // Get eligible campaigns for this screen
    const eligible = this.adStore.getForScreen(screen);

    // Filter and rank campaigns
    const ranked = this.rankCampaigns(eligible, screen, request.context);

    // Select slots
    const slots = this.selectSlots(ranked, request.available_slots);

    return {
      screen_id: request.screen_id,
      slots,
      generated_at: new Date(),
    };
  }

  /**
   * Make ad decision for a screen
   */
  decideAd(screenId: string, userId?: string): AdDecision | null {
    const screen = this.screenService.getScreen(screenId);
    if (!screen || screen.status !== 'active') {
      return null;
    }

    // Build context
    const context = this.buildDeliveryContext(screen);

    // Get eligible campaigns
    const eligible = this.adStore.getForScreen(screen);

    if (eligible.length === 0) {
      return this.getDefaultAdDecision(screenId);
    }

    // Rank campaigns
    const ranked = this.rankCampaigns(eligible, screen, context);

    if (ranked.length === 0) {
      return this.getDefaultAdDecision(screenId);
    }

    const best = ranked[0];
    const creative = best.campaign.creatives[0];

    return {
      screenId,
      adId: creative?.id || 'default',
      merchantId: best.campaign.merchant_id,
      type: 'area_based',
      score: best.score,
      reasons: best.reasons,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };
  }

  /**
   * Get default ad decision when no targeted ads available
   */
  private getDefaultAdDecision(screenId: string): AdDecision {
    return {
      screenId,
      adId: 'brand_default',
      merchantId: 'platform',
      type: 'brand',
      score: 0,
      reasons: ['No targeted ads available'],
      expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute
    };
  }

  // -------------------------------------------------------------------------
  // Campaign Ranking
  // -------------------------------------------------------------------------

  /**
   * Rank campaigns for a screen
   */
  private rankCampaigns(
    campaigns: DOOHCampaign[],
    screen: Screen,
    context: DeliveryContext
  ): RankedCampaign[] {
    return campaigns.map(campaign => {
      let score = 100;
      const reasons: string[] = [];

      // 1. Audience fit (40% weight)
      const audienceScore = this.calculateAudienceScore(campaign, screen.audience_profile);
      score *= (0.4 + audienceScore * 0.6);
      if (audienceScore > 0.8) {
        reasons.push(`High audience match (${Math.round(audienceScore * 100)}%)`);
      }

      // 2. Time targeting (20% weight)
      const timeScore = this.calculateTimeScore(campaign, context);
      score *= (0.8 + timeScore * 0.2);
      if (timeScore > 1) {
        reasons.push('Prime time targeting match');
      }

      // 3. Context signals (20% weight)
      const contextScore = this.calculateContextScore(campaign, context);
      score *= (0.9 + contextScore * 0.1);
      if (contextScore > 1) {
        reasons.push('Context signal match');
      }

      // 4. Budget urgency (20% weight)
      const urgency = (campaign.budget - campaign.spent) / campaign.budget;
      if (urgency > 0.8) {
        score *= 1.3;
        reasons.push('High budget remaining');
      }

      // 5. Area targeting bonus
      if (campaign.targeting.areas?.includes(screen.location.area)) {
        score *= 1.2;
        reasons.push('Area targeting match');
      }

      return {
        campaign,
        score,
        reasons,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate audience fit score
   */
  private calculateAudienceScore(
    campaign: DOOHCampaign,
    audienceProfile?: AudienceProfile
  ): number {
    if (!audienceProfile?.primary?.length || !campaign.targeting.audience_segments?.length) {
      return 1.0;
    }

    const targetSegments = new Set(campaign.targeting.audience_segments);
    let totalMatch = 0;
    let totalWeight = 0;

    for (const segment of audienceProfile.primary) {
      totalWeight += segment.percentage;
      if (targetSegments.has(segment.type)) {
        totalMatch += segment.percentage;
      }
    }

    return totalWeight > 0 ? totalMatch / totalWeight : 1.0;
  }

  /**
   * Calculate time targeting score
   */
  private calculateTimeScore(campaign: DOOHCampaign, context: DeliveryContext): number {
    const hour = new Date().getHours();

    if (!campaign.targeting.day_parts) return 1.0;

    // Morning: 6-12
    if (hour >= 6 && hour < 12 && campaign.targeting.day_parts.morning) {
      return 1.5;
    }

    // Afternoon: 12-17
    if (hour >= 12 && hour < 17 && campaign.targeting.day_parts.afternoon) {
      return 1.5;
    }

    // Evening: 17-22
    if (hour >= 17 && hour < 22 && campaign.targeting.day_parts.evening) {
      return 1.5;
    }

    // Night: 22-6
    if ((hour >= 22 || hour < 6) && campaign.targeting.day_parts.night) {
      return 1.3;
    }

    return 0.7; // Lower score if no match
  }

  /**
   * Calculate context signal score
   */
  private calculateContextScore(campaign: DOOHCampaign, context: DeliveryContext): number {
    let score = 1.0;

    // Weather-based (from ReZ Mind signals)
    if (context.weather === 'rainy') {
      // Indoor activities boost
      if (campaign.targeting.audience_segments?.includes('foodies')) {
        score *= 1.2;
      }
    }

    // Event-based
    if (context.nearby_events?.length) {
      score *= 1.1;
    }

    return score;
  }

  /**
   * Select delivery slots
   */
  private selectSlots(ranked: RankedCampaign[], availableSlots: number): DeliverySlot[] {
    const slots: DeliverySlot[] = [];
    let position = 0;

    for (let i = 0; i < Math.min(availableSlots, ranked.length); i++) {
      const item = ranked[i];
      const creative = item.campaign.creatives[0];

      if (!creative) continue;

      slots.push({
        position: position++,
        campaign_id: item.campaign.id,
        creative,
        duration: creative.duration,
        priority: Math.round(item.score),
        reason: item.reasons.join(', '),
      });
    }

    return slots;
  }

  /**
   * Build delivery context for a screen
   */
  private buildDeliveryContext(screen: Screen): DeliveryContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Get area context from area intelligence
    const areaContext = this.areaService.getAreaContext(screen.location.area);

    return {
      time: now.toISOString(),
      day_type: isWeekend ? 'weekend' : 'weekday',
      weather: areaContext?.demographics.income_level ? undefined : undefined,
      nearby_events: areaContext?.trending_products,
      audience: screen.audience_profile || {
        primary: [],
        peak_hours: [],
        avg_dwell_time: 300,
      },
    };
  }

  // -------------------------------------------------------------------------
  // ROI Calculation
  // -------------------------------------------------------------------------

  /**
   * Calculate ROI for a campaign
   */
  calculateROI(campaignId: string): ROIResult | null {
    const campaign = this.adStore.get(campaignId);
    if (!campaign) return null;

    const metrics = campaign.metrics;
    const roas = metrics.total_spent > 0 ? metrics.revenue / metrics.total_spent : 0;
    const cpv = metrics.visits > 0 ? metrics.total_spent / metrics.visits : metrics.total_spent;
    const cpp = metrics.purchases > 0 ? metrics.total_spent / metrics.purchases : metrics.total_spent;

    // Confidence based on data points
    const dataPoints = metrics.impressions;
    const confidence = Math.min(1, dataPoints / 200);

    return {
      roas: Math.round(roas * 100) / 100,
      cpp: Math.round(cpp * 100) / 100,
      cpv: Math.round(cpv * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      data_points: dataPoints,
      used_fallback: dataPoints < 10,
      breakdown: {
        scans: metrics.scans,
        expected_visits: metrics.visits,
        expected_purchases: metrics.purchases,
        expected_revenue: metrics.revenue,
        total_cost: metrics.total_spent,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Guardrails
  // -------------------------------------------------------------------------

  /**
   * Validate campaign against guardrails
   */
  validateCampaign(campaignId: string): GuardrailResult {
    const campaign = this.adStore.get(campaignId);
    if (!campaign) {
      return {
        passed: false,
        modifications: [],
        excluded_listings: [{ listing_id: campaignId, reason: 'Campaign not found', severity: 'critical' }],
        warnings: ['Campaign not found'],
      };
    }

    const warnings: string[] = [];
    const excluded: { listing_id: string; reason: string; severity: 'warning' | 'critical' }[] = [];

    // Check budget
    if (campaign.budget < this.guardrails.min_total_budget) {
      warnings.push(`Budget (${campaign.budget}) below minimum (${this.guardrails.min_total_budget})`);
    }

    // Check campaign duration
    const durationDays = Math.ceil(
      (new Date(campaign.end_date).getTime() - new Date(campaign.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (durationDays > this.guardrails.max_campaign_duration_days) {
      warnings.push(`Campaign duration (${durationDays} days) exceeds maximum`);
    }

    // Check ROI threshold
    const roi = this.calculateROI(campaignId);
    if (roi && roi.roas < this.guardrails.min_roas_threshold) {
      warnings.push(`ROAS (${roi.roas}x) below threshold (${this.guardrails.min_roas_threshold})`);
    }

    return {
      passed: excluded.length === 0,
      modifications: [],
      excluded_listings: excluded,
      warnings,
    };
  }

  // -------------------------------------------------------------------------
  // Budget Allocation
  // -------------------------------------------------------------------------

  /**
   * Allocate budget across campaigns
   */
  allocateBudget(campaignIds: string[], totalBudget: number): BudgetAllocation[] {
    const campaigns = campaignIds.map(id => this.adStore.get(id)).filter(Boolean) as DOOHCampaign[];
    if (campaigns.length === 0) return [];

    // Score campaigns
    const scored = campaigns.map(campaign => {
      const roi = this.calculateROI(campaign.id);
      const score = this.calculateCampaignScore(campaign, roi);
      return { campaign, score, roi };
    }).sort((a, b) => b.score - a.score);

    // Allocate proportionally
    const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
    const allocations: BudgetAllocation[] = [];

    let allocated = 0;
    for (const item of scored) {
      const percentage = totalScore > 0 ? item.score / totalScore : 1 / scored.length;
      const amount = Math.min(totalBudget * percentage, totalBudget - allocated);

      if (amount < this.guardrails.min_budget_per_listing) break;

      const warnings: AllocationWarning[] = [];
      if (item.roi && item.roi.confidence < 0.4) {
        warnings.push({
          type: 'low_confidence',
          message: 'Low data confidence',
          severity: 'warning',
        });
      }

      allocations.push({
        listing_id: item.campaign.id,
        listing_name: item.campaign.name,
        allocated_budget: Math.round(amount),
        percentage_of_total: Math.round(percentage * 10000) / 100,
        expected_visits: item.roi?.breakdown.expected_visits || 0,
        expected_purchases: item.roi?.breakdown.expected_purchases || 0,
        expected_roas: item.roi?.roas || 0,
        confidence: item.roi?.confidence || 0,
        warnings,
      });

      allocated += amount;
    }

    return allocations;
  }

  /**
   * Calculate campaign score
   */
  private calculateCampaignScore(campaign: DOOHCampaign, roi?: ROIResult | null): number {
    let score = 50;

    // ROAS component (50%)
    if (roi) {
      const roasScore = Math.min(roi.roas / 3, 1) * DEFAULT_SCORING_WEIGHTS.roas * 100;
      score = score * (1 - DEFAULT_SCORING_WEIGHTS.roas) + roasScore;
    }

    // Confidence component (20%)
    if (roi) {
      score += roi.confidence * DEFAULT_SCORING_WEIGHTS.confidence * 100;
    }

    // Volume potential (20%) - based on budget
    const volumeScore = (campaign.budget / 10000) * DEFAULT_SCORING_WEIGHTS.volume * 100;
    score += volumeScore;

    // Category match (10%)
    score += DEFAULT_SCORING_WEIGHTS.category_match * 100;

    return score;
  }
}

interface RankedCampaign {
  campaign: DOOHCampaign;
  score: number;
  reasons: string[];
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: AdDecisionService | null = null;

export function createAdDecisionService(
  screenService: ScreenManagementService,
  areaService: AreaIntelligenceService,
  guardrails?: Partial<GuardrailConfig>
): AdDecisionService {
  serviceInstance = new AdDecisionService(screenService, areaService, guardrails);
  return serviceInstance;
}

export function getAdDecisionService(): AdDecisionService | null {
  return serviceInstance;
}
