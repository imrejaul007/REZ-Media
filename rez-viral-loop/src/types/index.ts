/**
 * REZ Viral Loop - Types
 */

export type ViralTrigger = 'signup' | 'purchase' | 'share' | 'milestone';
export type RewardType = 'coins' | 'discount' | 'freebie' | 'credits';
export type SharePlatform = 'whatsapp' | 'instagram' | 'facebook' | 'twitter' | 'sms' | 'email' | 'link';

export interface ViralCampaign {
  id: string;
  name: string;
  merchantId: string;
  trigger: ViralTrigger;
  rewards: ViralReward[];
  conditions: ViralCondition[];
  status: 'active' | 'paused' | 'ended';
  startDate: Date;
  endDate?: Date;
  targetUsers: number;
  currentUsers: number;
  kFactor: number; // Viral coefficient
}

export interface ViralReward {
  id: string;
  type: RewardType;
  value: number; // Amount
  for: 'referrer' | 'referee' | 'both';
  maxUses?: number;
  expiryDays?: number;
}

export interface ViralCondition {
  id: string;
  metric: 'referrals' | 'purchases' | 'shares' | 'engagement';
  operator: 'gte' | 'lte' | 'eq';
  value: number;
  reward: ViralReward;
}

export interface ViralReferral {
  id: string;
  campaignId: string;
  referrerId: string;
  refereeId?: string;
  refereeEmail?: string;
  refereePhone?: string;
  status: 'pending' | 'converted' | 'expired';
  referralCode: string;
  shareLink: string;
  conversions: ReferralConversion[];
  createdAt: Date;
  convertedAt?: Date;
}

export interface ReferralConversion {
  id: string;
  referralId: string;
  type: 'signup' | 'purchase';
  value?: number;
  rewardEarned: number;
  createdAt: Date;
}

export interface ShareEvent {
  id: string;
  campaignId: string;
  userId: string;
  platform: SharePlatform;
  content: string;
  link: string;
  clicks: number;
  conversions: number;
  createdAt: Date;
}

export interface ViralAnalytics {
  campaignId: string;
  period: DateRange;
  totalShares: number;
  uniqueSharers: number;
  totalClicks: number;
  clickRate: number;
  conversions: number;
  conversionRate: number;
  kFactor: number;
  roi: number;
  topPlatforms: { platform: SharePlatform; count: number }[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ViralRewardLog {
  id: string;
  campaignId: string;
  userId: string;
  referralId: string;
  rewardType: RewardType;
  amount: number;
  status: 'pending' | 'credited' | 'paid';
  createdAt: Date;
}
