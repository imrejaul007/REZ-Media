/**
 * AI Campaign Generator Service
 * Generates campaigns from natural language goals
 */

import { v4 as uuid } from 'uuid';
import type {
  CampaignGoal,
  GeneratedCampaign,
  AdType,
  TargetingConfig,
  BudgetAllocation,
  CreativeContent,
  Estimation,
  ChannelConfig
} from '../types';

export class AICampaignGenerator {

  /**
   * Generate a complete campaign from a goal
   */
  async generateCampaign(
    goal: string,
    options: {
      merchantType?: string;
      location?: string;
      budget?: number;
      preferChannels?: AdType[];
    } = {}
  ): Promise<GeneratedCampaign> {

    // Parse the goal
    const parsedGoal = this.parseGoal(goal, options);

    // Generate campaign name
    const name = this.generateCampaignName(parsedGoal);

    // Select channels
    const channels = this.selectChannels(parsedGoal, options.preferChannels);

    // Allocate budget
    const budget = this.allocateBudget(parsedGoal.budget || 10000, channels);

    // Build targeting
    const targeting = this.buildTargeting(parsedGoal);

    // Generate creative
    const creative = await this.generateCreative(goal, options.merchantType || 'retail');

    // Estimate results
    const estimated = this.estimateResults(parsedGoal.budget || 10000, channels);

    return {
      id: uuid(),
      name,
      description: `AI-generated campaign for: ${goal}`,
      types: channels.map(c => c.type),
      targeting,
      budget,
      channels,
      creative,
      estimated,
      aiReasoning: this.generateReasoning(parsedGoal, channels),
      createdAt: new Date(),
    };
  }

  /**
   * Parse goal text into structured data
   */
  private parseGoal(goal: string, options: any): CampaignGoal {
    const lowerGoal = goal.toLowerCase();

    // Detect intent
    let merchantType = options.merchantType || this.detectMerchantType(lowerGoal);
    let location = options.location || this.detectLocation(lowerGoal) || 'All India';
    let budget = options.budget || this.suggestBudget(lowerGoal);

    return {
      text: goal,
      merchantType,
      location,
      budget,
    };
  }

  /**
   * Detect merchant type from goal
   */
  private detectMerchantType(goal: string): string {
    if (goal.includes('restaurant') || goal.includes('food') || goal.includes('lunch') || goal.includes('dinner')) {
      return 'restaurant';
    }
    if (goal.includes('hotel') || goal.includes('stay') || goal.includes('booking')) {
      return 'hotel';
    }
    if (goal.includes('fitness') || goal.includes('gym') || goal.includes('workout')) {
      return 'fitness';
    }
    if (goal.includes('retail') || goal.includes('store') || goal.includes('shop')) {
      return 'retail';
    }
    return 'general';
  }

  /**
   * Detect location from goal
   */
  private detectLocation(goal: string): string | null {
    const locations = ['mumbai', 'delhi', 'bangalore', 'hyderabad', 'chennai', 'pune', 'ahmedabad'];
    for (const loc of locations) {
      if (goal.includes(loc)) return loc;
    }
    return null;
  }

  /**
   * Suggest budget based on goal
   */
  private suggestBudget(goal: string): number {
    const lowerGoal = goal.toLowerCase();
    if (lowerGoal.includes('more customers') || lowerGoal.includes('increase sales')) {
      return 25000;
    }
    if (lowerGoal.includes('lunch') || lowerGoal.includes('breakfast')) {
      return 10000;
    }
    if (lowerGoal.includes('weekend')) {
      return 15000;
    }
    return 10000;
  }

  /**
   * Generate campaign name
   */
  private generateCampaignName(goal: CampaignGoal): string {
    const prefixes: Record<string, string[]> = {
      restaurant: ['Taste of', 'Foodie', 'Crave', 'Flavor'],
      hotel: ['Stay', 'Luxury', 'Escape', 'Getaway'],
      fitness: ['Fit', 'Transform', 'Power', 'Flex'],
      retail: ['Shop', 'Deal', 'Save', 'Discover'],
      general: ['Impact', 'Reach', 'Growth', 'Engage'],
    };

    const prefixesList = prefixes[goal.merchantType] || prefixes.general;
    const prefix = prefixesList[Math.floor(Math.random() * prefixesList.length)];
    const timeLabel = goal.merchantType === 'restaurant' ? 'Rush' : 'Boost';

    return `${prefix} ${timeLabel} ${new Date().getFullYear()}`;
  }

  /**
   * Select optimal channels based on goal
   */
  private selectChannels(goal: CampaignGoal, prefer?: AdType[]): ChannelConfig[] {
    const channels: ChannelConfig[] = [];

    // Default channel recommendations by merchant type
    const recommendations: Record<string, { type: AdType; channels: string[]; weight: number }[]> = {
      restaurant: [
        { type: 'broadcast', channels: ['whatsapp', 'sms'], weight: 35 },
        { type: 'dooh', channels: ['restaurant_tv'], weight: 25 },
        { type: 'qr', channels: ['table_tent'], weight: 20 },
        { type: 'in-app', channels: ['feed', 'search'], weight: 20 },
      ],
      hotel: [
        { type: 'in-app', channels: ['banner', 'feed'], weight: 40 },
        { type: 'broadcast', channels: ['email', 'whatsapp'], weight: 30 },
        { type: 'dooh', channels: ['transit', 'lobby'], weight: 30 },
      ],
      retail: [
        { type: 'in-app', channels: ['feed', 'search'], weight: 40 },
        { type: 'broadcast', channels: ['push', 'sms'], weight: 30 },
        { type: 'offline', channels: ['standees'], weight: 30 },
      ],
      fitness: [
        { type: 'broadcast', channels: ['push', 'whatsapp'], weight: 35 },
        { type: 'in-app', channels: ['feed'], weight: 35 },
        { type: 'dooh', channels: ['gym_screen'], weight: 30 },
      ],
      general: [
        { type: 'broadcast', channels: ['whatsapp', 'email'], weight: 30 },
        { type: 'in-app', channels: ['feed', 'banner'], weight: 40 },
        { type: 'qr', channels: ['poster'], weight: 30 },
      ],
    };

    const recs = recommendations[goal.merchantType] || recommendations.general;

    for (const rec of recs) {
      channels.push({
        type: rec.type,
        channels: rec.channels,
        budget: 0, // Will be set by budget allocation
        bid: this.getDefaultBid(rec.type),
        targeting: {},
      });
    }

    return channels;
  }

  /**
   * Get default bid amount by type
   */
  private getDefaultBid(type: AdType): number {
    const bids: Record<AdType, number> = {
      'in-app': 5,
      'dooh': 100,
      'qr': 2,
      'broadcast': 1,
      'influencer': 5000,
      'offline': 50,
    };
    return bids[type] || 5;
  }

  /**
   * Allocate budget across channels
   */
  private allocateBudget(totalBudget: number, channels: ChannelConfig[]): BudgetAllocation {
    const distribution = channels.map((channel, index) => {
      // First channel gets more, decreasing
      const percentage = Math.max(10, 50 - (index * 10));
      const amount = Math.round(totalBudget * (percentage / 100));
      channel.budget = amount;
      return {
        type: channel.type,
        amount,
        percentage,
      };
    });

    return { total: totalBudget, distribution };
  }

  /**
   * Build targeting configuration
   */
  private buildTargeting(goal: CampaignGoal): TargetingConfig {
    return {
      location: {
        city: goal.location,
      },
      audience: {
        segment: 'all',
        income: 'medium',
      },
      timing: {
        preferredHours: this.getPreferredHours(goal),
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
      },
    };
  }

  /**
   * Get preferred hours based on merchant type
   */
  private getPreferredHours(goal: CampaignGoal): number[] {
    if (goal.merchantType === 'restaurant') {
      return [11, 12, 13, 18, 19, 20]; // Lunch & dinner rush
    }
    if (goal.merchantType === 'hotel') {
      return [9, 10, 14, 15, 20, 21]; // Planning hours
    }
    return [10, 11, 14, 15, 18, 19, 20]; // General business hours
  }

  /**
   * Generate creative content
   */
  private async generateCreative(goal: string, merchantType: string): Promise<CreativeContent> {
    // AI-generated creative
    const creatives: Record<string, { headline: string; body: string; cta: string }> = {
      restaurant: {
        headline: 'Taste That Speaks!',
        body: 'Experience flavors that keep you coming back. Order now and get 15% off your first order!',
        cta: 'Order Now',
      },
      hotel: {
        headline: 'Your Perfect Stay Awaits',
        body: 'Book directly and save up to 20%. Early check-in available. Free cancellation.',
        cta: 'Book Now',
      },
      fitness: {
        headline: 'Transform Your Fitness Journey',
        body: 'Join today and get 1 month FREE. Expert trainers, modern equipment.',
        cta: 'Start Free Trial',
      },
      retail: {
        headline: 'Discover Amazing Deals',
        body: 'New arrivals just dropped. Members get extra 10% off on everything.',
        cta: 'Shop Now',
      },
      general: {
        headline: 'Something Special Just for You',
        body: 'Check out our latest offerings. Quality you can trust, prices you\'ll love.',
        cta: 'Learn More',
      },
    };

    return creatives[merchantType] || creatives.general;
  }

  /**
   * Estimate campaign results
   */
  private estimateResults(budget: number, channels: ChannelConfig[]): Estimation {
    const avgCPM = 100;
    const avgCTR = 0.02; // 2%
    const avgConversionRate = 0.05; // 5%

    const impressions = (budget / avgCPM) * 1000;
    const clicks = impressions * avgCTR;
    const conversions = clicks * avgConversionRate;

    return {
      reach: Math.round(impressions * 0.7),
      impressions: Math.round(impressions),
      clicks: Math.round(clicks),
      conversions: Math.round(conversions),
      cpm: avgCPM,
      cpc: budget / clicks,
    };
  }

  /**
   * Generate AI reasoning text
   */
  private generateReasoning(goal: CampaignGoal, channels: ChannelConfig[]): string[] {
    const reasons: string[] = [];

    reasons.push(`Selected ${channels.length} channels based on ${goal.merchantType} industry patterns`);

    if (goal.merchantType === 'restaurant') {
      reasons.push('WhatsApp and SMS recommended for lunch/dinner rush timing');
      reasons.push('QR codes boost table-side engagement');
    }

    if (goal.merchantType === 'hotel') {
      reasons.push('Email recommended for advance booking consideration');
      reasons.push('In-app ads reach travelers planning trips');
    }

    reasons.push(`Budget allocated with ${channels[0]?.type || 'broadcast'} getting priority`);
    reasons.push('Targeting office areas for weekday lunch traffic');

    return reasons;
  }
}

export const aiGenerator = new AICampaignGenerator();
