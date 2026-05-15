/**
 * REZ Audience Marketplace - Types
 */

export type SegmentSource = 'first_party' | 'second_party' | 'third_party';
export type SegmentType = 'behavioral' | 'demographic' | 'intent' | 'lookalike';
export type PricingModel = 'cpm' | 'flat_fee' | 'hybrid';

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerType: 'brand' | 'publisher' | 'data_provider';
  source: SegmentSource;
  type: SegmentType;
  size: number; // Number of users
  demographics?: DemographicData;
  behaviors?: string[];
  interests?: string[];
  intents?: string[];
  matchRate?: number; // % match with advertiser audience
  pricing: SegmentPricing;
  status: 'active' | 'paused' | 'sold_out';
  createdAt: Date;
  updatedAt: Date;
}

export interface DemographicData {
  age?: { min: number; max: number };
  gender?: string[];
  location?: string[];
  income?: 'low' | 'medium' | 'high';
  household?: 'single' | 'family' | 'couple';
}

export interface SegmentPricing {
  model: PricingModel;
  cpm?: number;
  flatFee?: number;
  minCommitment?: number;
}

export interface SegmentListing {
  id: string;
  segment: AudienceSegment;
  listingType: 'sell' | 'rent';
  availableQuantity: number;
  soldQuantity: number;
  revenue: number;
  avgMatchRate: number;
  ratings: number;
}

export interface SegmentPurchase {
  id: string;
  segmentId: string;
  advertiserId: string;
  quantity: number;
  price: number;
  totalAmount: number;
  status: 'pending' | 'active' | 'completed' | 'refunded';
  deliveryStart: Date;
  deliveryEnd: Date;
  delivered?: number;
}

export interface SegmentMatch {
  segmentId: string;
  advertiserAudience: string[];
  matched: number;
  matchRate: number;
  topMatches: { userId: string; score: number }[];
}

export interface AudienceInsights {
  segmentId: string;
  overlapWithSegments: { segmentId: string; overlapPercent: number }[];
  reachability: number;
  uniqueness: number;
  qualityScore: number;
}
