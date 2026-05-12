import { z } from 'zod';

// Enums
export enum BidStrategy {
  CPC = 'cpc',   // Cost Per Click
  CPM = 'cpm',   // Cost Per Mille (per 1000 impressions)
}

export enum CampaignStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum AdStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PAUSED = 'paused',
}

export enum PlacementType {
  BANNER = 'banner',
  INTERSTITIAL = 'interstitial',
  NATIVE = 'native',
  VIDEO = 'video',
  REWARDED = 'rewarded',
}

export enum EventType {
  IMPRESSION = 'impression',
  CLICK = 'click',
  CONVERSION = 'conversion',
  VIEW = 'view',
}

// Zod Schemas
export const GeoTargetingSchema = z.object({
  countries: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  cities: z.array(z.string()).optional(),
  postalCodes: z.array(z.string()).optional(),
  radius: z.object({
    lat: z.number(),
    lng: z.number(),
    radiusKm: z.number(),
  }).optional(),
});

export const DeviceTargetingSchema = z.object({
  devices: z.array(z.enum(['desktop', 'mobile', 'tablet'])).optional(),
  operatingSystems: z.array(z.enum(['ios', 'android', 'windows', 'macos', 'linux'])).optional(),
  browsers: z.array(z.string()).optional(),
});

export const ScheduleSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
  timeSlots: z.array(z.object({
    dayOfWeek: z.array(z.number().min(0).max(6)),
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
  })).optional(),
});

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  advertiserId: z.string().min(1),
  objective: z.enum(['awareness', 'traffic', 'engagement', 'conversions']),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.DRAFT),
  budget: z.object({
    daily: z.number().min(0).optional(),
    total: z.number().min(0),
    currency: z.string().default('USD'),
  }),
  bidStrategy: z.object({
    type: z.nativeEnum(BidStrategy),
    amount: z.number().min(0.01),
    maxBid: z.number().min(0.01).optional(),
  }),
  targeting: z.object({
    geo: GeoTargetingSchema.optional(),
    devices: DeviceTargetingSchema.optional(),
    schedule: ScheduleSchema.optional(),
    ageGroups: z.array(z.enum(['18-24', '25-34', '35-44', '45-54', '55+'])).optional(),
    interests: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }).optional(),
  adIds: z.array(z.string()).optional(),
});

export const CreateAdSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1).max(255),
  type: z.enum(['text', 'image', 'video', 'carousel']),
  creative: z.object({
    headline: z.string().max(255).optional(),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    callToAction: z.enum(['learn_more', 'shop_now', 'sign_up', 'download', 'book_now', 'contact']).optional(),
    destinationUrl: z.string().url().optional(),
    ctaText: z.string().max(30).optional(),
  }),
  status: z.nativeEnum(AdStatus).default(AdStatus.DRAFT),
});

export const CreatePlacementSchema = z.object({
  name: z.string().min(1).max(255),
  siteId: z.string().min(1),
  type: z.nativeEnum(PlacementType),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }),
  position: z.enum(['above_fold', 'below_fold', 'sidebar', 'footer', 'header']),
  floorPrice: z.number().min(0).default(0.01),
  allowedCategories: z.array(z.string()).optional(),
  blockedCategories: z.array(z.string()).optional(),
  status: z.enum(['active', 'paused', 'inactive']).default('active'),
});

export const ServeAdRequestSchema = z.object({
  placementId: z.string().min(1),
  userId: z.string().optional(),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  pageUrl: z.string().optional(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const TrackEventSchema = z.object({
  eventType: z.nativeEnum(EventType),
  adId: z.string().min(1),
  placementId: z.string().min(1),
  campaignId: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  clickId: z.string().optional(),
  conversionValue: z.number().optional(),
  conversionCurrency: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Interfaces
export interface Campaign {
  _id?: string;
  campaignId: string;
  advertiserId: string;
  name: string;
  objective: 'awareness' | 'traffic' | 'engagement' | 'conversions';
  status: CampaignStatus;
  budget: {
    daily: number;
    total: number;
    spent: number;
    currency: string;
  };
  bidStrategy: {
    type: BidStrategy;
    amount: number;
    maxBid?: number;
  };
  targeting?: {
    geo?: z.infer<typeof GeoTargetingSchema>;
    devices?: z.infer<typeof DeviceTargetingSchema>;
    schedule?: z.infer<typeof ScheduleSchema>;
    ageGroups?: string[];
    interests?: string[];
    keywords?: string[];
  };
  adIds: string[];
  statistics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Ad {
  _id?: string;
  adId: string;
  campaignId: string;
  advertiserId: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'carousel';
  creative: {
    headline?: string;
    description?: string;
    imageUrl?: string;
    videoUrl?: string;
    callToAction?: string;
    destinationUrl?: string;
    ctaText?: string;
  };
  status: AdStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Placement {
  _id?: string;
  placementId: string;
  siteId: string;
  name: string;
  type: PlacementType;
  dimensions: {
    width: number;
    height: number;
  };
  position: 'above_fold' | 'below_fold' | 'sidebar' | 'footer' | 'header';
  floorPrice: number;
  floorPriceHistory: Array<{ price: number; timestamp: Date }>;
  allowedCategories?: string[];
  blockedCategories?: string[];
  status: 'active' | 'paused' | 'inactive';
  stats: {
    impressions: number;
    clicks: number;
    revenue: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BidRequest {
  placementId: string;
  adIds: string[];
  minBid: number;
  targeting: {
    country?: string;
    region?: string;
    city?: string;
    device?: string;
    keywords?: string[];
    userId?: string;
    sessionId?: string;
    pageUrl?: string;
    latitude?: number;
    longitude?: number;
  };
  timestamp: Date;
}

export interface BidResult {
  adId: string;
  campaignId: string;
  bidAmount: number;
  bidType: BidStrategy;
  score: number;
  reason?: string;
}

export interface AdDecision {
  adId: string;
  campaignId: string;
  ad: Ad;
  bid: BidResult;
  creative: Ad['creative'];
  impressionUrl: string;
  clickUrl: string;
  viewUrl: string;
}

export interface FraudCheckResult {
  isFraudulent: boolean;
  score: number;
  reasons: string[];
  recommendedAction: 'allow' | 'flag' | 'block';
}

export interface PricingData {
  basePrice: number;
  dynamicFactors: {
    competition: number;
    timeOfDay: number;
    dayOfWeek: number;
    device: number;
    geo: number;
    seasonality: number;
  };
  finalPrice: number;
}
