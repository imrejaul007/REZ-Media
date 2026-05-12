/**
 * REZ AI Campaign Builder - Types
 */

export interface CampaignGoal {
  text: string;
  merchantType: string;
  location: string;
  budget: number;
  targetDate?: Date;
}

export interface GeneratedCampaign {
  id: string;
  name: string;
  description: string;
  types: AdType[];
  targeting: TargetingConfig;
  budget: BudgetAllocation;
  channels: ChannelConfig[];
  creative: CreativeContent;
  estimated: Estimation;
  aiReasoning: string[];
  createdAt: Date;
}

export type AdType = 'in-app' | 'dooh' | 'qr' | 'broadcast' | 'influencer' | 'offline';

export interface TargetingConfig {
  location: {
    city: string;
    area?: string;
    radius?: number;
  };
  audience: {
    segment: string;
    income: 'low' | 'medium' | 'high';
    ageGroup?: string;
  };
  timing: {
    preferredHours: number[];
    daysOfWeek: number[];
  };
}

export interface BudgetAllocation {
  total: number;
  distribution: {
    type: AdType;
    amount: number;
    percentage: number;
  }[];
}

export interface ChannelConfig {
  type: AdType;
  channels: string[];
  budget: number;
  bid: number;
  targeting: any;
}

export interface CreativeContent {
  headline: string;
  body: string;
  cta: string;
  imagePrompt?: string;
}

export interface Estimation {
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
}

export interface CampaignRequest {
  goal: string;
  merchantType?: string;
  location?: string;
  budget?: number;
  targetAudience?: string;
  preferChannels?: AdType[];
}

export interface CreativeRequest {
  goal: string;
  merchantType: string;
  product?: string;
}
