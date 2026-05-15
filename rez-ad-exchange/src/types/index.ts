/**
 * REZ Ad Exchange - Types
 */

export interface Publisher {
  _id: string;
  publisherId: string;
  name: string;
  domain: string;
  type: 'website' | 'app' | 'dooh';
  categories: string[];
  traffic: {
    monthlyPageviews: number;
    monthlyVisitors: number;
    avgSessionDuration: number;
  };
  inventory: Inventory[];
  sspAccounts: SSPAccount[];
  status: 'pending' | 'verified' | 'suspended';
  createdAt: Date;
}

export interface SSPAccount {
  sspId: string;
  name: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  floors: number;
}

export interface Inventory {
  inventoryId: string;
  placementId: string;
  name: string;
  type: 'banner' | 'video' | 'native' | 'interstitial';
  sizes: string[];
  positions: string[];
  traffic: {
    dailyImpressions: number;
    fillRate: number;
    avgCPM: number;
  };
  enabled: boolean;
}

export interface Advertiser {
  _id: string;
  advertiserId: string;
  name: string;
  company: string;
  website: string;
  industry: string;
  budgets: Budget[];
  dspAccounts: DSPAccount[];
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
}

export interface Budget {
  budgetId: string;
  name: string;
  amount: number;
  spent: number;
  startDate: Date;
  endDate?: Date;
  pacing: 'accelerated' | 'standard';
  status: 'active' | 'paused' | 'exhausted';
}

export interface DSPAccount {
  dspId: string;
  name: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
}

export interface Campaign {
  _id: string;
  campaignId: string;
  advertiserId: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  objective: 'awareness' | 'traffic' | 'conversion' | 'revenue';
  budget: {
    total: number;
    spent: number;
    daily?: number;
  };
  bidding: {
    strategy: 'cpm' | 'cpc' | 'cpa' | 'fixed';
    maxBid: number;
    targetCpa?: number;
    targetRoas?: number;
  };
  targeting: Targeting;
  creatives: Creative[];
  metrics: CampaignMetrics;
  createdAt: Date;
}

export interface Targeting {
  age?: { min: number; max: number };
  gender?: string[];
  locations?: string[];
  devices?: ('mobile' | 'desktop' | 'tablet')[];
  inventoryTypes?: ('banner' | 'video' | 'native' | 'interstitial')[];
  publishers?: string[];
  categories?: string[];
  viewability?: {
    min: number;
    max?: number;
  };
  brandSafety?: {
    iabCategories: string[];
    excludedCategories: string[];
  };
}

export interface Creative {
  creativeId: string;
  name: string;
  type: 'banner' | 'video' | 'native';
  format: string;
  assets: {
    url: string;
    width?: number;
    height?: number;
    mimeType: string;
  };
  clickUrl: string;
  trackingUrls: {
    impression: string;
    click: string;
  };
  status: 'pending' | 'approved' | 'rejected';
}

export interface CampaignMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cvr: number;
  cpm: number;
  cpc: number;
  cpa: number;
  viewability: {
    measurable: number;
    visible: number;
    avgViewability: number;
  };
}

export interface BidRequest {
  requestId: string;
  timestamp: Date;
  publisher: {
    publisherId: string;
    name: string;
    domain: string;
  };
  inventory: {
    inventoryId: string;
    placementId: string;
    type: string;
    size: string;
    position: string;
  };
  user: {
    ip: string;
    userAgent: string;
    geo?: {
      country: string;
      region?: string;
      city?: string;
    };
    segments?: string[];
  };
  viewability: {
    measurable: boolean;
    visible: boolean;
  };
  floorPrice: number;
}

export interface BidResponse {
  requestId: string;
  bids: Bid[];
  timestamp: Date;
}

export interface Bid {
  campaignId: string;
  creativeId: string;
  cpm: number;
  currency: string;
  ad: AdMarkup;
  macros?: Record<string, string>;
}

export interface AdMarkup {
  type: 'banner' | 'video' | 'native';
  content: string;
  width?: number;
  height?: number;
  mimeType: string;
  trackingUrls?: {
    impression?: string[];
    click?: string[];
    viewable?: string[];
  };
}

export interface Deal {
  dealId: string;
  name: string;
  type: 'preferred' | 'programmatic' | 'private';
  publisherId: string;
  advertiserId?: string;
  inventoryIds: string[];
  floorPrice: number;
  budget?: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'expired';
}

export interface Auction {
  auctionId: string;
  requestId: string;
  inventoryId: string;
  bids: {
    dspId: string;
    campaignId: string;
    cpm: number;
  }[];
  winner?: {
    dspId: string;
    campaignId: string;
    cpm: number;
  };
  secondPrice?: number;
  timestamp: Date;
}

export interface ExchangeMetrics {
  totalImpressions: number;
  totalRevenue: number;
  totalSpend: number;
  avgCPM: number;
  avgFillRate: number;
  topPublishers: { publisherId: string; name: string; revenue: number }[];
  topAdvertisers: { advertiserId: string; name: string; spend: number }[];
}
