/**
 * REZ Anniversary Rewards Service
 *
 * Handles:
 * - Anniversary date detection
 * - Milestone rewards (1yr, 2yr, 3yr+)
 * - Tenure-based offers
 * - Analytics tracking
 */

import { v4 as uuidv4 } from 'uuid';

// Types
export interface AnniversaryConfig {
  merchantId: string;
  enabled: boolean;
  milestones: MilestoneReward[];
  channels: NotificationChannel[];
  notificationTiming: 'anniversary_day' | 'day_before' | 'week_before' | 'custom';
  customDaysBefore?: number;
  offerCode?: string;
}

export interface MilestoneReward {
  years: number;
  name: string;
  reward: {
    type: 'percentage' | 'fixed' | 'points' | 'freebie';
    value: number;
    minOrder?: number;
    maxDiscount?: number;
    pointsValue?: number;
    freebieDescription?: string;
  };
  message: string;
  priority: 'standard' | 'premium' | 'vip';
}

export interface UserTenure {
  userId: string;
  merchantId: string;
  registrationDate: Date;
  yearsCompleted: number;
  currentMilestone: number;
  nextMilestone: number;
  nextAnniversaryDate: Date;
  rewards: AwardedReward[];
}

export interface AwardedReward {
  id: string;
  milestone: number;
  awardedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'claimed' | 'expired';
  offerCode?: string;
}

export interface AnniversaryOffer {
  offerId: string;
  userId: string;
  milestone: number;
  reward: MilestoneReward;
  validFrom: Date;
  validUntil: Date;
  status: 'available' | 'claimed' | 'expired';
}

export interface AnniversaryAnalytics {
  merchantId: string;
  period: string;
  totalUsers: number;
  eligibleForAnniversary: number;
  rewardsSent: number;
  rewardsClaimed: number;
  redemptionRate: number;
  revenue: number;
  topMilestones: MilestoneBreakdown[];
  channelBreakdown: ChannelBreakdown[];
  trend: TrendData[];
}

export interface MilestoneBreakdown {
  milestone: number;
  usersEligible: number;
  rewardsSent: number;
  rewardsClaimed: number;
  revenue: number;
}

export interface ChannelBreakdown {
  channel: NotificationChannel;
  sent: number;
  opened: number;
  clicked: number;
  converted: number;
}

export interface TrendData {
  date: string;
  sent: number;
  claimed: number;
  revenue: number;
}

export type NotificationChannel = 'email' | 'whatsapp' | 'sms' | 'push' | 'in_app';

// Default milestone configuration
const DEFAULT_MILESTONES: MilestoneReward[] = [
  {
    years: 1,
    name: 'First Anniversary',
    reward: {
      type: 'percentage',
      value: 15,
      minOrder: 500,
      maxDiscount: 300,
    },
    message: 'Happy 1st Anniversary! Enjoy 15% off on your special day.',
    priority: 'standard',
  },
  {
    years: 2,
    name: 'Second Anniversary',
    reward: {
      type: 'percentage',
      value: 20,
      minOrder: 750,
      maxDiscount: 500,
    },
    message: 'Celebrating 2 years with us! Get 20% off your order.',
    priority: 'standard',
  },
  {
    years: 3,
    name: 'Third Anniversary',
    reward: {
      type: 'percentage',
      value: 25,
      minOrder: 1000,
      maxDiscount: 750,
    },
    message: '3 years of loyalty! Enjoy 25% off as a token of our appreciation.',
    priority: 'premium',
  },
  {
    years: 5,
    name: 'Platinum Anniversary',
    reward: {
      type: 'fixed',
      value: 500,
      minOrder: 1000,
    },
    message: '5 years of excellence! Here\'s Rs. 500 off on your order.',
    priority: 'vip',
  },
  {
    years: 10,
    name: 'Diamond Anniversary',
    reward: {
      type: 'points',
      value: 5000,
      pointsValue: 500,
    },
    message: 'A decade of trust! Earn 5000 bonus loyalty points.',
    priority: 'vip',
  },
];

export class AnniversaryService {
  private configs: Map<string, AnniversaryConfig> = new Map();
  private userTenures: Map<string, UserTenure> = new Map();
  private analyticsCache: Map<string, AnniversaryAnalytics> = new Map();

  constructor() {
    // Initialize with default config for demo
  }

  /**
   * Get anniversary configuration for a merchant
   */
  async getConfig(merchantId: string): Promise<AnniversaryConfig> {
    if (!this.configs.has(merchantId)) {
      this.configs.set(merchantId, {
        merchantId,
        enabled: true,
        milestones: DEFAULT_MILESTONES,
        channels: ['email', 'whatsapp'],
        notificationTiming: 'anniversary_day',
      });
    }
    return this.configs.get(merchantId)!;
  }

  /**
   * Update anniversary configuration
   */
  async updateConfig(merchantId: string, config: Partial<AnniversaryConfig>): Promise<AnniversaryConfig> {
    const existing = await this.getConfig(merchantId);
    const updated = { ...existing, ...config };
    this.configs.set(merchantId, updated);
    return updated;
  }

  /**
   * Get user's tenure information
   */
  async getUserTenure(userId: string, merchantId: string): Promise<UserTenure | null> {
    const key = `${merchantId}:${userId}`;
    return this.userTenures.get(key) || null;
  }

  /**
   * Calculate tenure for a user
   */
  async calculateTenure(userId: string, merchantId: string, registrationDate: Date): Promise<UserTenure> {
    const now = new Date();
    const yearsDiff = this.getYearsDifference(registrationDate, now);
    const yearsCompleted = Math.floor(yearsDiff);
    const currentMilestone = this.getCurrentMilestone(yearsCompleted);
    const nextMilestone = currentMilestone + this.getNextMilestoneIncrement(currentMilestone);
    const nextAnniversaryDate = this.getNextAnniversaryDate(registrationDate, yearsCompleted + nextMilestone);

    const key = `${merchantId}:${userId}`;
    const existing = this.userTenures.get(key);

    const tenure: UserTenure = {
      userId,
      merchantId,
      registrationDate,
      yearsCompleted,
      currentMilestone,
      nextMilestone: yearsCompleted + nextMilestone,
      nextAnniversaryDate,
      rewards: existing?.rewards || [],
    };

    this.userTenures.set(key, tenure);
    return tenure;
  }

  /**
   * Check if user is eligible for anniversary reward
   */
  async checkEligibility(userId: string, merchantId: string): Promise<{
    eligible: boolean;
    milestone?: number;
    reward?: MilestoneReward;
    nextAnniversary?: Date;
    daysUntil?: number;
  }> {
    const tenure = await this.getUserTenure(userId, merchantId);
    if (!tenure) {
      return { eligible: false };
    }

    const config = await this.getConfig(merchantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextAnniversary = new Date(tenure.registrationDate);
    const currentYear = today.getFullYear();
    nextAnniversary.setFullYear(currentYear);

    if (nextAnniversary < today) {
      nextAnniversary.setFullYear(currentYear + 1);
    }

    const daysUntil = this.getDaysDifference(today, nextAnniversary);
    const yearsOnNextAnniversary = this.getYearsDifference(tenure.registrationDate, nextAnniversary);

    // Check if anniversary is within notification window
    const isEligible = this.isWithinNotificationWindow(daysUntil, config.notificationTiming, config.customDaysBefore);

    if (!isEligible) {
      return {
        eligible: false,
        nextAnniversary,
        daysUntil,
      };
    }

    // Find matching milestone reward
    const milestone = Math.floor(yearsOnNextAnniversary);
    const reward = config.milestones.find(m => m.years === milestone);

    // Check if already claimed
    const alreadyClaimed = tenure.rewards.some(
      r => r.milestone === milestone && r.status === 'claimed'
    );

    return {
      eligible: !alreadyClaimed,
      milestone,
      reward,
      nextAnniversary,
      daysUntil,
    };
  }

  /**
   * Generate anniversary reward offer
   */
  async generateRewardOffer(userId: string, merchantId: string): Promise<AnniversaryOffer | null> {
    const eligibility = await this.checkEligibility(userId, merchantId);

    if (!eligibility.eligible || !eligibility.reward || !eligibility.milestone) {
      return null;
    }

    const offerId = uuidv4();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // 7 days validity

    return {
      offerId,
      userId,
      milestone: eligibility.milestone,
      reward: eligibility.reward,
      validFrom: new Date(),
      validUntil,
      status: 'available',
    };
  }

  /**
   * Claim anniversary reward
   */
  async claimReward(userId: string, merchantId: string, offerId: string): Promise<{
    success: boolean;
    message: string;
    offerCode?: string;
  }> {
    const key = `${merchantId}:${userId}`;
    const tenure = this.userTenures.get(key);

    if (!tenure) {
      return { success: false, message: 'User tenure not found' };
    }

    const config = await this.getConfig(merchantId);
    const milestone = config.milestones[0].years; // Default to first milestone for demo
    const offerCode = `ANNIV${Date.now()}`;

    const reward: AwardedReward = {
      id: offerId || uuidv4(),
      milestone,
      awardedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'claimed',
      offerCode,
    };

    tenure.rewards.push(reward);

    return {
      success: true,
      message: `Congratulations! Your ${milestone}-year anniversary reward has been claimed.`,
      offerCode,
    };
  }

  /**
   * Get available offers for a user
   */
  async getAvailableOffers(userId: string, merchantId: string): Promise<AnniversaryOffer[]> {
    const tenure = await this.getUserTenure(userId, merchantId);
    if (!tenure) return [];

    const config = await this.getConfig(merchantId);
    const offers: AnniversaryOffer[] = [];

    for (const milestone of config.milestones) {
      const claimed = tenure.rewards.some(
        r => r.milestone === milestone.years && r.status === 'claimed'
      );

      if (!claimed) {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + 7);

        offers.push({
          offerId: uuidv4(),
          userId,
          milestone: milestone.years,
          reward: milestone,
          validFrom: new Date(),
          validUntil,
          status: 'available',
        });
      }
    }

    return offers;
  }

  /**
   * Get anniversary analytics for a merchant
   */
  async getAnalytics(merchantId: string, period: string = '30d'): Promise<AnniversaryAnalytics> {
    const cacheKey = `${merchantId}:${period}`;
    if (this.analyticsCache.has(cacheKey)) {
      return this.analyticsCache.get(cacheKey)!;
    }

    // Demo analytics
    const analytics: AnniversaryAnalytics = {
      merchantId,
      period,
      totalUsers: 15000,
      eligibleForAnniversary: 342,
      rewardsSent: 320,
      rewardsClaimed: 198,
      redemptionRate: 61.9,
      revenue: 156000,
      topMilestones: [
        { milestone: 1, usersEligible: 180, rewardsSent: 175, rewardsClaimed: 110, revenue: 85000 },
        { milestone: 2, usersEligible: 95, rewardsSent: 88, rewardsClaimed: 55, revenue: 42000 },
        { milestone: 3, usersEligible: 45, rewardsSent: 40, rewardsClaimed: 25, revenue: 22000 },
        { milestone: 5, usersEligible: 18, rewardsSent: 15, rewardsClaimed: 8, revenue: 7000 },
      ],
      channelBreakdown: [
        { channel: 'whatsapp', sent: 200, opened: 180, clicked: 150, converted: 120 },
        { channel: 'email', sent: 100, opened: 70, clicked: 45, converted: 35 },
        { channel: 'sms', sent: 20, opened: 15, clicked: 10, converted: 8 },
      ],
      trend: [
        { date: '2026-05-01', sent: 12, claimed: 8, revenue: 6000 },
        { date: '2026-05-02', sent: 15, claimed: 10, revenue: 7500 },
        { date: '2026-05-03', sent: 8, claimed: 5, revenue: 4000 },
        { date: '2026-05-04', sent: 18, claimed: 12, revenue: 9000 },
        { date: '2026-05-05', sent: 10, claimed: 7, revenue: 5500 },
      ],
    };

    this.analyticsCache.set(cacheKey, analytics);
    return analytics;
  }

  /**
   * Trigger batch anniversary check (for cron job)
   */
  async triggerBatchCheck(merchantId?: string): Promise<{
    triggered: boolean;
    usersChecked: number;
    rewardsGenerated: number;
  }> {
    console.log(`Anniversary batch check triggered${merchantId ? ` for merchant: ${merchantId}` : ''}`);

    // In production, this would query the database and process users
    return {
      triggered: true,
      usersChecked: 100,
      rewardsGenerated: 15,
    };
  }

  /**
   * Get milestone configuration
   */
  async getMilestones(merchantId: string): Promise<MilestoneReward[]> {
    const config = await this.getConfig(merchantId);
    return config.milestones;
  }

  /**
   * Update milestone configuration
   */
  async updateMilestones(merchantId: string, milestones: MilestoneReward[]): Promise<MilestoneReward[]> {
    const config = await this.getConfig(merchantId);
    config.milestones = milestones.sort((a, b) => a.years - b.years);
    this.configs.set(merchantId, config);
    return config.milestones;
  }

  // Helper methods

  private getYearsDifference(startDate: Date, endDate: Date): number {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 365.25;
  }

  private getDaysDifference(startDate: Date, endDate: Date): number {
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getCurrentMilestone(yearsCompleted: number): number {
    const milestones = [1, 2, 3, 5, 10];
    let current = 0;
    for (const milestone of milestones) {
      if (yearsCompleted >= milestone) {
        current = milestone;
      }
    }
    return current;
  }

  private getNextMilestoneIncrement(current: number): number {
    const milestones = [1, 2, 3, 5, 10];
    for (const milestone of milestones) {
      if (milestone > current) {
        return milestone - current;
      }
    }
    return 1; // Default annual
  }

  private getNextAnniversaryDate(registrationDate: Date, yearsFromRegistration: number): Date {
    const next = new Date(registrationDate);
    next.setFullYear(next.getFullYear() + yearsFromRegistration);
    return next;
  }

  private isWithinNotificationWindow(
    daysUntil: number,
    timing: string,
    customDays?: number
  ): boolean {
    switch (timing) {
      case 'anniversary_day':
        return daysUntil === 0;
      case 'day_before':
        return daysUntil === 1;
      case 'week_before':
        return daysUntil === 7;
      case 'custom':
        return daysUntil === (customDays || 3);
      default:
        return daysUntil === 0;
    }
  }
}

export const anniversaryService = new AnniversaryService();
