import { z } from 'zod';

export type Exchange = 'google_adx' | 'amazon_tam';

export const ExchangeSchema = z.enum(['google_adx', 'amazon_tam']);

export const TargetingSchema = z.object({
  geo: z.array(z.string()).optional(),
  screenTypes: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  demographics: z.record(z.unknown()).optional(),
  screenIds: z.array(z.string()).optional(),
});

export const BidRequestSchema = z.object({
  exchange: ExchangeSchema,
  requestId: z.string(),
  timestamp: z.string(),
  impression: z.object({
    id: z.string(),
    floor: z.number(),
    currency: z.string().default('INR'),
    inventory: z.object({
      screenId: z.string(),
      screenType: z.string(),
      location: z.string(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string(),
    }),
    creative: z.object({
      width: z.number(),
      height: z.number(),
      mimeTypes: z.array(z.string()),
    }).optional(),
  }),
  campaign: z.object({
    id: z.string(),
    targeting: TargetingSchema.optional(),
    maxBid: z.number().optional(),
  }),
});

export const BidResponseSchema = z.object({
  requestId: z.string(),
  exchange: ExchangeSchema,
  bid: z.object({
    price: z.number(),
    currency: z.string(),
    adId: z.string(),
    creativeUrl: z.string(),
    duration: z.number().optional(),
  }).nullable(),
  timestamp: z.string(),
});

export const CampaignSchema = z.object({
  name: z.string(),
  exchange: ExchangeSchema.optional(),
  budget: z.number().positive(),
  dailyLimit: z.number().positive().optional(),
  bidStrategy: z.enum(['fixed', 'dynamic', 'optimized']).default('dynamic'),
  maxBidPrice: z.number().positive().optional(),
  targeting: TargetingSchema.optional(),
  status: z.enum(['active', 'paused', 'ended']).default('active'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export interface ICampaign {
  name: string;
  exchange?: Exchange;
  budget: number;
  dailyLimit?: number;
  bidStrategy: 'fixed' | 'dynamic' | 'optimized';
  maxBidPrice?: number;
  targeting?: {
    geo?: string[];
    screenTypes?: string[];
    locations?: string[];
    demographics?: Record<string, unknown>;
    screenIds?: string[];
  };
  status: 'active' | 'paused' | 'ended';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBidRequest {
  exchange: Exchange;
  requestId: string;
  timestamp: Date;
  impression: {
    id: string;
    floor: number;
    currency: string;
    inventory: {
      screenId: string;
      screenType: string;
      location: string;
      city?: string;
      state?: string;
      country: string;
    };
    creative?: {
      width: number;
      height: number;
      mimeTypes: string[];
    };
  };
  campaign: {
    id: string;
    targeting?: {
      geo?: string[];
      screenTypes?: string[];
      locations?: string[];
      demographics?: Record<string, unknown>;
      screenIds?: string[];
    };
    maxBid?: number;
  };
}

export interface IBidResponse {
  requestId: string;
  exchange: Exchange;
  bid: {
    price: number;
    currency: string;
    adId: string;
    creativeUrl: string;
    duration?: number;
  } | null;
  timestamp: Date;
  won: boolean;
  reason?: string;
}

export interface IBudgetTracker {
  campaignId: string;
  date: Date;
  totalSpent: number;
  totalImpressions: number;
  totalBids: number;
  totalWins: number;
  avgBidPrice: number;
  avgWinPrice: number;
}

export interface ICreative {
  id: string;
  campaignId: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  status: 'active' | 'paused' | 'ended';
  createdAt: Date;
}
