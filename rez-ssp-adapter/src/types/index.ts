import { z } from 'zod';

export type SSPProvider = 'google_adx' | 'pubmatic' | 'index_exchange';

export const SSPProviderSchema = z.enum(['google_adx', 'pubmatic', 'index_exchange']);

export const ConnectionConfigSchema = z.object({
  provider: SSPProviderSchema,
  enabled: z.boolean().default(true),
  apiKey: z.string(),
  apiSecret: z.string().optional(),
  publisherId: z.string().optional(),
  advertiserId: z.string().optional(),
  endpoint: z.string().url().optional(),
  config: z.record(z.unknown()).optional(),
});

export const InventorySyncSchema = z.object({
  inventoryId: z.string(),
  provider: SSPProviderSchema,
  syncedAt: z.date(),
  status: z.enum(['synced', 'pending', 'failed']),
  impressionsAvailable: z.number().int().nonnegative(),
  floorsApplied: z.number().optional(),
});

export const BidRequestSchema = z.object({
  requestId: z.string(),
  provider: SSPProviderSchema,
  timestamp: z.string(),
  impression: z.object({
    id: z.string(),
    floor: z.number(),
    currency: z.string().default('INR'),
    inventory: z.object({
      screenId: z.string(),
      location: z.string(),
      screenType: z.string(),
    }),
  }),
});

export const BidResponseSchema = z.object({
  requestId: z.string(),
  bid: z.object({
    price: z.number(),
    currency: z.string(),
    adId: z.string(),
    creativeUrl: z.string().optional(),
    duration: z.number().optional(),
  }).nullable(),
  timestamp: z.string(),
});

export const DealSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: SSPProviderSchema,
  advertiserId: z.string(),
  floorPrice: z.number(),
  status: z.enum(['active', 'paused', 'ended']),
  startDate: z.string(),
  endDate: z.string().optional(),
  targeting: z.object({
    locations: z.array(z.string()).optional(),
    screenTypes: z.array(z.string()).optional(),
    demographics: z.record(z.unknown()).optional(),
  }).optional(),
});

export interface IConnection {
  provider: SSPProvider;
  enabled: boolean;
  apiKey: string;
  apiSecret?: string;
  publisherId?: string;
  advertiserId?: string;
  endpoint?: string;
  config?: Record<string, unknown>;
  lastSyncAt?: Date;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
}

export interface IInventorySync {
  inventoryId: string;
  provider: SSPProvider;
  syncedAt: Date;
  status: 'synced' | 'pending' | 'failed';
  impressionsAvailable: number;
  floorsApplied?: number;
  errorMessage?: string;
}

export interface IBidRequest {
  requestId: string;
  provider: SSPProvider;
  timestamp: Date;
  impression: {
    id: string;
    floor: number;
    currency: string;
    inventory: {
      screenId: string;
      location: string;
      screenType: string;
    };
  };
}

export interface IBidResponse {
  requestId: string;
  bid: {
    price: number;
    currency: string;
    adId: string;
    creativeUrl?: string;
    duration?: number;
  } | null;
  timestamp: Date;
  won: boolean;
  reason?: string;
}

export interface IDeal {
  id: string;
  name: string;
  provider: SSPProvider;
  advertiserId: string;
  floorPrice: number;
  status: 'active' | 'paused' | 'ended';
  startDate: Date;
  endDate?: Date;
  targeting?: {
    locations?: string[];
    screenTypes?: string[];
    demographics?: Record<string, unknown>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnalytics {
  provider: SSPProvider;
  date: Date;
  requests: number;
  bids: number;
  wins: number;
  revenue: number;
  impressions: number;
  fillRate: number;
  avgBidPrice: number;
  avgWinPrice: number;
}
