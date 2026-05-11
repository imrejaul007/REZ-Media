/**
 * Brand Dashboard - Types and Interfaces
 * Sponsored Marketing Platform for ReZ
 */

// =============================================================================
// Core Dashboard Types
// =============================================================================

export interface BrandDashboard {
  merchantId: string;
  overview: DashboardOverview;
  campaigns: SponsoredCampaign[];
  analytics: Analytics;
  recommendations: AIRecommendation[];
  lastUpdated: Date;
}

export interface DashboardOverview {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  roi: number;
  avgCPC: number;
  avgCTR: number;
  period: DateRange;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// =============================================================================
// Campaign Types
// =============================================================================

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft' | 'pending_review';
export type CampaignType = 'search' | 'feed' | 'qr' | 'location';
export type BiddingStrategy = 'auto' | 'manual' | 'target_roas' | 'target_cpa';
export type PacingStrategy = 'frontloaded' | 'evenspeed' | 'accelerated';
export type OfferType = 'discount' | 'coins' | 'freebie' | 'bogo' | 'percentage';

export interface SponsoredCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  type: CampaignType;
  budget: Budget;
  bidding: Bidding;
  targeting: Targeting;
  performance: Performance;
  pacing: PacingStrategy;
  offers: Offer[];
  schedule: CampaignSchedule;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  total: number;
  spent: number;
  remaining: number;
  dailyLimit?: number;
  currency: string;
}

export interface Bidding {
  strategy: BiddingStrategy;
  maxCPC: number;
  targetCPA?: number;
  targetROAS?: number;
  bidMultiplier?: number;
}

export interface Targeting {
  categories: string[];
  locations: string[];
  demographics: TargetingDemographics;
  intent: string[];
  customAudiences?: string[];
  lookalikeAudiences?: string[];
  retargeting?: RetargetingConfig;
}

export interface TargetingDemographics {
  ageRanges: string[];
  genders: ('male' | 'female' | 'all')[];
  incomeLevels?: ('low' | 'medium' | 'high')[];
}

export interface RetargetingConfig {
  enabled: boolean;
  lookbackDays: number;
  minimumEngagements: number;
  engagementTypes: ('view' | 'click' | 'purchase' | 'cart')[];
}

export interface Performance {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  roas: number;
  costPerConversion: number;
  qualityScore?: number;
  trend: PerformanceTrend;
}

export interface PerformanceTrend {
  impressionsChange: number;
  clicksChange: number;
  conversionsChange: number;
  roasChange: number;
}

export interface CampaignSchedule {
  startDate: Date;
  endDate?: Date;
  timezone: string;
  daysOfWeek?: number[];
  hoursOfDay?: { start: number; end: number };
}

// =============================================================================
// Offer Types
// =============================================================================

export interface Offer {
  id: string;
  type: OfferType;
  value: number;
  minPurchaseAmount?: number;
  maxDiscountAmount?: number;
  code?: string;
  description: string;
  terms?: string;
  usageLimit?: number;
  usedCount: number;
  validFrom: Date;
  validUntil: Date;
}

// =============================================================================
// Analytics Types
// =============================================================================

export interface Analytics {
  realTime: RealTimeMetrics;
  historical: HistoricalData[];
  funnel: FunnelMetrics;
  attribution: AttributionData[];
  trends: TrendAnalysis;
}

export interface RealTimeMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  timestamp: Date;
}

export interface HistoricalData {
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

export interface FunnelMetrics {
  impressions: number;
  views: number;
  clicks: number;
  addToCart: number;
  checkout: number;
  purchase: number;
  dropoffRates: Record<string, number>;
}

export interface AttributionData {
  channel: string;
  touchpoints: number;
  conversions: number;
  revenue: number;
  attributionWeight: number;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  forecast: number;
  confidence: number;
  seasonality?: SeasonalityData;
}

export interface SeasonalityData {
  dayOfWeek: Record<number, number>;
  hourOfDay: Record<number, number>;
  monthlyTrend: number[];
}

// =============================================================================
// AI Recommendation Types
// =============================================================================

export type RecommendationType =
  | 'budget_increase'
  | 'budget_decrease'
  | 'new_campaign'
  | 'bid_adjustment'
  | 'targeting_expand'
  | 'targeting_narrow'
  | 'creative_refresh'
  | 'timing_optimization'
  | 'audience_expansion'
  | 'seasonal_campaign';

export interface AIRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  potential: number;
  action: string;
  confidence: number;
  category: 'budget' | 'targeting' | 'creative' | 'timing' | 'strategy';
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: ImpactEstimate;
  implementation?: ImplementationGuide;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ImpactEstimate {
  impressionsChange: number;
  clicksChange: number;
  conversionsChange: number;
  revenueChange: number;
  costChange: number;
  paybackPeriod?: number;
}

export interface ImplementationGuide {
  steps: string[];
  estimatedTime: string;
  prerequisites?: string[];
  risks?: string[];
  rollbackPlan?: string;
}

// =============================================================================
// Campaign Creation Flow Types
// =============================================================================

export interface CampaignCreationFlow {
  currentStep: number;
  totalSteps: number;
  campaignType: CampaignType | null;
  basicInfo: BasicCampaignInfo;
  targeting: TargetingConfig;
  budgetAndBidding: BudgetAndBiddingConfig;
  offers: OfferConfig;
  review: ReviewData;
}

export interface BasicCampaignInfo {
  name: string;
  objective: 'awareness' | 'consideration' | 'conversion';
  startDate: Date;
  endDate?: Date;
  description?: string;
}

export interface TargetingConfig {
  selectedType: CampaignType;
  categories: string[];
  locations: string[];
  demographics: TargetingDemographics;
  intentSignals: string[];
  customAudiences: string[];
  excludeAudiences?: string[];
}

export interface BudgetAndBiddingConfig {
  totalBudget: number;
  budgetType: 'daily' | 'lifetime';
  biddingStrategy: BiddingStrategy;
  maxCPC: number;
  targetCPA?: number;
  targetROAS?: number;
  pacing: PacingStrategy;
}

export interface OfferConfig {
  hasOffer: boolean;
  offers: Partial<Offer>[];
}

export interface ReviewData {
  summary: Record<string, unknown>;
  warnings: string[];
  errors: string[];
  estimatedReach: number;
  estimatedCost: number;
}

// =============================================================================
// Dashboard API Types
// =============================================================================

export interface DashboardFilters {
  dateRange: DateRange;
  campaignTypes?: CampaignType[];
  campaignStatuses?: CampaignStatus[];
  merchantId?: string;
}

export interface DashboardSortConfig {
  field: keyof SponsoredCampaign | 'performance.roas' | 'performance.ctr';
  direction: 'asc' | 'desc';
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total?: number;
}

// =============================================================================
// Helper Types
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface DashboardResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface CampaignActionResponse {
  campaignId: string;
  action: string;
  success: boolean;
  newStatus?: CampaignStatus;
  message?: string;
}

// =============================================================================
// Utility Type Guards
// =============================================================================

export function isActiveCampaign(campaign: SponsoredCampaign): boolean {
  return campaign.status === 'active';
}

export function isCompletedCampaign(campaign: SponsoredCampaign): boolean {
  return campaign.status === 'completed';
}

export function hasBudgetRemaining(campaign: SponsoredCampaign): boolean {
  return campaign.budget.remaining > 0;
}

export function isHighPerforming(campaign: SponsoredCampaign, minROAS = 3): boolean {
  return campaign.performance.roas >= minROAS;
}

export function needsOptimization(campaign: SponsoredCampaign): boolean {
  const ctr = campaign.performance.ctr;
  const cpc = campaign.bidding.maxCPC;
  const spend = campaign.budget.spent;

  return (
    (ctr < 0.01 && spend > 100) ||
    (cpc > 5 && campaign.performance.conversions < 10) ||
    campaign.status === 'paused'
  );
}

// =============================================================================
// Computed Property Helpers
// =============================================================================

export function calculateCTR(impressions: number, clicks: number): number {
  if (impressions === 0) return 0;
  return clicks / impressions;
}

export function calculateCPC(spend: number, clicks: number): number {
  if (clicks === 0) return 0;
  return spend / clicks;
}

export function calculateROAS(revenue: number, spend: number): number {
  if (spend === 0) return 0;
  return revenue / spend;
}

export function calculateConversionRate(clicks: number, conversions: number): number {
  if (clicks === 0) return 0;
  return conversions / clicks;
}

export function calculatePacingProgress(
  daysElapsed: number,
  totalDays: number,
  budgetSpent: number,
  totalBudget: number
): { onTrack: boolean; projectedOverspend: number; projectedUnderspend: number } {
  const expectedSpend = totalBudget * (daysElapsed / totalDays);
  const spendRatio = budgetSpent / totalBudget;
  const timeRatio = daysElapsed / totalDays;

  const onTrack = Math.abs(spendRatio - timeRatio) < 0.15;
  const projectedOverspend = spendRatio > timeRatio ? (spendRatio - timeRatio) * 100 : 0;
  const projectedUnderspend = spendRatio < timeRatio ? (timeRatio - spendRatio) * 100 : 0;

  return { onTrack, projectedOverspend, projectedUnderspend };
}
