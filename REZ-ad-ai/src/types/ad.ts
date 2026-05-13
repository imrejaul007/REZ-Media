/**
 * REZ Ad AI - Type Definitions
 */

import { z } from 'zod';

// ============================================================================
// Banner Types
// ============================================================================

export interface BannerAssets {
  headline?: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  imageUrl?: string;
  backgroundColor?: string;
  textColor?: string;
}

export interface BannerDimensions {
  width: number;
  height: number;
}

export type BannerFormat = 'leaderboard' | 'medium_rectangle' | 'large_rectangle' | 'mobile_banner' | 'square' | 'skyscraper';

export interface GenerateBannerOptions {
  format: BannerFormat;
  dimensions?: BannerDimensions;
  brandName: string;
  productName?: string;
  category?: string;
  targetAudience?: TargetAudience;
  colorScheme?: ColorScheme;
  tone?: AdTone;
}

export interface GenerateBannerResponse {
  success: boolean;
  banner?: BannerAssets;
  variations?: BannerAssets[];
  format: BannerFormat;
  generatedAt: Date;
  metadata?: {
    confidence?: number;
    suggestedPlacements?: string[];
  };
}

// ============================================================================
// Copy Types
// ============================================================================

export interface AdCopy {
  headline: string;
  body?: string;
  tagline?: string;
  keywords?: string[];
}

export type CopyStyle = 'informative' | 'persuasive' | 'emotional' | 'humorous' | 'formal' | 'casual';
export type CopyLength = 'short' | 'medium' | 'long';

export interface GenerateCopyOptions {
  brandName: string;
  productName?: string;
  category?: string;
  style?: CopyStyle;
  length?: CopyLength;
  includeTagline?: boolean;
  keywords?: string[];
  targetAudience?: TargetAudience;
  platform?: AdPlatform;
}

export interface GenerateCopyResponse {
  success: boolean;
  copies?: AdCopy[];
  headline?: string;
  body?: string;
  tagline?: string;
  generatedAt: Date;
}

// ============================================================================
// CTA Types
// ============================================================================

export type CTAType = 'shop_now' | 'learn_more' | 'sign_up' | 'download' | 'book_now' | 'get_quote' | 'contact_us' | 'custom';
export type CTAStyle = 'primary' | 'secondary' | 'minimal';

export interface CTAConfig {
  type: CTAType;
  customText?: string;
  style?: CTAStyle;
  includeArrow?: boolean;
}

export interface GenerateCTAResponse {
  success: boolean;
  cta?: {
    text: string;
    type: CTAType;
    style: CTAStyle;
    url?: string;
  };
  alternatives?: Array<{
    text: string;
    type: CTAType;
    style: CTAStyle;
  }>;
  generatedAt: Date;
}

// ============================================================================
// Variation Types
// ============================================================================

export interface AdVariation {
  id: string;
  name: string;
  assets: BannerAssets;
  copy: AdCopy;
  cta: CTAConfig;
  status: 'draft' | 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  performance?: VariationPerformance;
}

export interface VariationPerformance {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  spend: number;
}

export interface GenerateVariationsOptions {
  baseAssets: Partial<BannerAssets>;
  count?: number;
  testType?: 'headline' | 'cta' | 'image' | 'full';
  brandName: string;
}

export interface GenerateVariationsResponse {
  success: boolean;
  variations?: AdVariation[];
  generatedAt: Date;
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface BidStrategy {
  type: 'manual' | 'auto' | 'target_cpa' | 'target_roas';
  value?: number;
  floor?: number;
  ceiling?: number;
}

export interface OptimizeBidOptions {
  campaignId: string;
  adGroupId?: string;
  currentBid: number;
  targetCpc?: number;
  targetCpa?: number;
  targetRoas?: number;
  currentMetrics: CampaignMetrics;
}

export interface OptimizeBidResponse {
  success: boolean;
  recommendedBid?: number;
  strategy?: BidStrategy;
  confidence?: number;
  factors?: string[];
  estimatedImpact?: {
    impressions?: number;
    clicks?: number;
    cost?: number;
  };
}

export interface TargetingParams {
  demographics?: {
    ageRange?: [number, number];
    gender?: ('male' | 'female' | 'non_binary' | 'all')[];
    incomeLevel?: ('low' | 'middle' | 'high' | 'all')[];
  };
  interests?: string[];
  behaviors?: string[];
  placements?: string[];
  devices?: ('mobile' | 'desktop' | 'tablet' | 'all')[];
  geoTargeting?: {
    countries?: string[];
    regions?: string[];
    cities?: string[];
    radius?: number;
    center?: { lat: number; lng: number };
  };
}

export interface OptimizeTargetingOptions {
  campaignId: string;
  currentTargeting: TargetingParams;
  performanceData: PerformanceSnapshot[];
}

export interface OptimizeTargetingResponse {
  success: boolean;
  recommendations?: TargetingAdjustment[];
  segments?: {
    segment: string;
    performance: number;
    recommendation: 'expand' | 'narrow' | 'maintain';
  }[];
  estimatedReach?: number;
  estimatedCpm?: number;
}

export interface TargetingAdjustment {
  type: 'add' | 'remove' | 'modify';
  dimension: keyof TargetingParams;
  value: string | string[];
  reason: string;
  expectedImpact?: number;
}

export interface SuggestImprovementsOptions {
  campaignId: string;
  performanceData: PerformanceSnapshot[];
  budget?: number;
}

export interface SuggestImprovementsResponse {
  success: boolean;
  improvements?: Improvement[];
  priorityOrder?: string[];
  estimatedUplift?: number;
}

export interface Improvement {
  id: string;
  category: 'creative' | 'targeting' | 'bidding' | 'budget' | 'placement';
  title: string;
  description: string;
  expectedImpact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  implementation?: string;
}

// ============================================================================
// Creative Analysis Types
// ============================================================================

export interface PerformanceSnapshot {
  adId: string;
  adSetId?: string;
  campaignId: string;
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue?: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpm: number;
  roas?: number;
}

export interface CreativeAnalysisOptions {
  adId?: string;
  campaignId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  includeBenchmarks?: boolean;
}

export interface AnalyzePerformanceResponse {
  success: boolean;
  analysis?: {
    overall: PerformanceSnapshot;
    trends: {
      impressions: TrendData;
      clicks: TrendData;
      conversions: TrendData;
      ctr: TrendData;
      roas: TrendData;
    };
    benchmarks?: {
      industry: BenchmarkData;
      topPerformers: BenchmarkData;
    };
    issues?: PerformanceIssue[];
    strengths?: string[];
  };
  insights?: string[];
  recommendations?: string[];
}

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  prediction?: number;
}

export interface BenchmarkData {
  ctr?: number;
  cvr?: number;
  cpc?: number;
  cpm?: number;
  roas?: number;
}

export interface PerformanceIssue {
  type: 'low_ctr' | 'high_cpc' | 'low_conversion' | 'low_roas' | 'fatigue' | 'budget_exhaustion';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestedAction?: string;
}

export interface SuggestCreativeOptions {
  campaignId: string;
  objective: 'awareness' | 'consideration' | 'conversion';
  targetAudience?: TargetAudience;
  competitorAds?: string[];
  topPerformingElements?: string[];
}

export interface SuggestCreativeResponse {
  success: boolean;
  suggestions?: CreativeSuggestion[];
  colorPalette?: string[];
  messagingThemes?: string[];
  visualStyles?: string[];
}

export interface CreativeSuggestion {
  type: 'headline' | 'image' | 'video' | 'copy' | 'cta';
  suggestion: string;
  rationale: string;
  examples?: string[];
}

// ============================================================================
// Shared Types
// ============================================================================

export interface TargetAudience {
  ageRange?: [number, number];
  gender?: string[];
  interests?: string[];
  behaviors?: string[];
  locations?: string[];
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent?: string;
}

export type AdTone = 'professional' | 'friendly' | 'urgent' | 'luxury' | 'playful' | 'serious';

export type AdPlatform = 'google' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'all';

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpm: number;
  roas: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const GenerateBannerSchema = z.object({
  format: z.enum(['leaderboard', 'medium_rectangle', 'large_rectangle', 'mobile_banner', 'square', 'skyscraper']),
  brandName: z.string().min(1),
  productName: z.string().optional(),
  category: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'urgent', 'luxury', 'playful', 'serious']).optional(),
});

export const GenerateCopySchema = z.object({
  brandName: z.string().min(1),
  productName: z.string().optional(),
  category: z.string().optional(),
  style: z.enum(['informative', 'persuasive', 'emotional', 'humorous', 'formal', 'casual']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  keywords: z.array(z.string()).optional(),
  platform: z.enum(['google', 'facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'all']).optional(),
});

export const OptimizeBidSchema = z.object({
  campaignId: z.string().min(1),
  currentBid: z.number().positive(),
  targetCpc: z.number().positive().optional(),
  targetCpa: z.number().positive().optional(),
  targetRoas: z.number().positive().optional(),
});

export const AnalyzeCreativeSchema = z.object({
  adId: z.string().optional(),
  campaignId: z.string().min(1),
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }).optional(),
});

export type GenerateBannerInput = z.infer<typeof GenerateBannerSchema>;
export type GenerateCopyInput = z.infer<typeof GenerateCopySchema>;
export type OptimizeBidInput = z.infer<typeof OptimizeBidSchema>;
export type AnalyzeCreativeInput = z.infer<typeof AnalyzeCreativeSchema>;
