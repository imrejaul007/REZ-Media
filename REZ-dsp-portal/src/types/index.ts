/**
 * REZ DSP Portal - Types
 */

export interface DSPAdvertiser {
  id: string;
  name: string;
  email: string;
  company: string;
  website?: string;
  status: 'pending' | 'active' | 'suspended';
  balance: number;
  spent: number;
  createdAt: Date;
}

export interface DSPCampaign {
  id: string;
  advertiserId: string;
  name: string;
  objective: 'awareness' | 'traffic' | 'conversion' | 'lead';
  status: 'draft' | 'active' | 'paused' | 'completed';
  budget: {
    daily?: number;
    total: number;
    spent: number;
  };
  bidding: {
    strategy: 'auto' | 'manual' | 'target_cpa' | 'target_roas';
    maxBid?: number;
    targetCpa?: number;
    targetRoas?: number;
  };
  targeting: DSPargeting;
  creatives: DSpotCreative[];
  metrics: DSPMetrics;
  createdAt: Date;
}

export interface DSPargeting {
  age?: { min: number; max: number };
  gender?: string[];
  locations?: string[];
  interests?: string[];
  behaviors?: string[];
  audiences?: string[]; // Audience segments
  devices?: ('mobile' | 'desktop' | 'tablet')[];
  placements?: string[];
}

export interface DSpotCreative {
  id: string;
  name: string;
  type: 'banner' | 'video' | 'native' | 'playable';
  format: '300x250' | '300x600' | '320x50' | '728x90' | '1920x1080';
  url: string;
  clickUrl: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface DSPMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  spend: number;
  cpm: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface DSPReport {
  campaignId: string;
  date: Date;
  metrics: DSPMetrics;
  hourlyBreakdown?: DSPHourlyMetrics[];
  placementBreakdown?: DSPPlacementMetrics[];
}

export interface DSPHourlyMetrics {
  hour: number;
  impressions: number;
  clicks: number;
  spend: number;
}

export interface DSPPlacementMetrics {
  placement: string;
  impressions: number;
  ctr: number;
  conversions: number;
  cpm: number;
}
