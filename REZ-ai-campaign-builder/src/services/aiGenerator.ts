/**
 * AI Campaign Generator Service
 * Uses OpenAI GPT-4 for campaign generation with simulated fallback
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

// OpenAI integration
let openai: any = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  if (!openai) {
    // Dynamic import to avoid errors when package not installed
    try {
      const { OpenAI } = require('openai');
      openai = new OpenAI({ apiKey });
    } catch (e) {
      console.warn('OpenAI package not installed. Run: npm install openai');
      return null;
    }
  }
  return openai;
}

function isOpenAIEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

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

    // Parse the goal using AI or fallback
    const parsedGoal = await this.parseGoal(goal, options);

    // Generate campaign name using AI or fallback
    const name = await this.generateCampaignName(parsedGoal);

    // Select channels using AI or fallback
    const channels = await this.selectChannels(parsedGoal, options.preferChannels);

    // Allocate budget
    const budget = this.allocateBudget(parsedGoal.budget || 10000, channels);

    // Build targeting
    const targeting = this.buildTargeting(parsedGoal);

    // Generate creative using AI or fallback
    const creative = await this.generateCreative(goal, parsedGoal.merchantType);

    // Estimate results
    const estimated = this.estimateResults(parsedGoal.budget || 10000, channels);

    // Generate reasoning using AI or fallback
    const aiReasoning = await this.generateReasoning(parsedGoal, channels);

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
      aiReasoning,
      createdAt: new Date(),
    };
  }

  /**
   * Parse goal text into structured data using OpenAI
   */
  private async parseGoal(goal: string, options: any): Promise<CampaignGoal> {
    const client = getOpenAIClient();

    if (client && isOpenAIEnabled()) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a campaign analyst. Parse the merchant's goal into structured data.
Return JSON with exactly these fields:
- merchantType: "restaurant" | "hotel" | "fitness" | "retail" | "general"
- location: city name or "All India"
- budget: number in INR (10000-100000)
- inferredIntent: brief description of what they want to achieve

Examples:
"Get more lunch customers" -> {"merchantType": "restaurant", "location": "All India", "budget": 15000, "inferredIntent": "increase lunch-time traffic"}
"Promote my boutique in Pune" -> {"merchantType": "retail", "location": "Pune", "budget": 20000, "inferredIntent": "promote retail store"}`
            },
            {
              role: 'user',
              content: goal
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        return {
          text: goal,
          merchantType: parsed.merchantType || options.merchantType || this.detectMerchantType(goal.toLowerCase()),
          location: parsed.location || options.location || this.detectLocation(goal.toLowerCase()) || 'All India',
          budget: parsed.budget || options.budget || this.suggestBudget(goal.toLowerCase()),
        };
      } catch (error) {
        console.error('OpenAI parseGoal error, using fallback:', error);
      }
    }

    // Fallback to rule-based parsing
    const lowerGoal = goal.toLowerCase();
    return {
      text: goal,
      merchantType: options.merchantType || this.detectMerchantType(lowerGoal),
      location: options.location || this.detectLocation(lowerGoal) || 'All India',
      budget: options.budget || this.suggestBudget(lowerGoal),
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
    if (goal.includes('more customers') || goal.includes('increase sales')) {
      return 25000;
    }
    if (goal.includes('lunch') || goal.includes('breakfast')) {
      return 10000;
    }
    if (goal.includes('weekend')) {
      return 15000;
    }
    return 10000;
  }

  /**
   * Generate campaign name using OpenAI
   */
  private async generateCampaignName(goal: CampaignGoal): Promise<string> {
    const client = getOpenAIClient();

    if (client && isOpenAIEnabled()) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Generate a catchy, memorable campaign name for a ${goal.merchantType} business campaign.
Requirements:
- Max 5 words
- No more than 30 characters total
- Include the year ${new Date().getFullYear()}
- Make it sound exciting and actionable
- Examples: "Weekend Feast 2026", "Stay & Save 2026", "Fit January 2026"

Return ONLY the campaign name, nothing else.`
            },
            {
              role: 'user',
              content: `Create a campaign name for a ${goal.merchantType} business targeting ${goal.location}`
            }
          ],
          temperature: 0.7,
          max_tokens: 20,
        });

        const name = response.choices[0].message.content.trim();
        if (name && name.length <= 40) {
          return name;
        }
      } catch (error) {
        console.error('OpenAI generateCampaignName error, using fallback:', error);
      }
    }

    // Fallback to rule-based name generation
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
   * Select optimal channels based on goal using OpenAI
   */
  private async selectChannels(goal: CampaignGoal, prefer?: AdType[]): Promise<ChannelConfig[]> {
    const client = getOpenAIClient();

    if (client && isOpenAIEnabled()) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Recommend the best advertising channels for a ${goal.merchantType} business campaign.
Return JSON with a "channels" array. Each channel should have:
- type: one of "in-app" | "dooh" | "qr" | "broadcast" | "influencer" | "offline"
- channels: array of specific channel names (e.g., ["whatsapp", "sms"])
- reason: brief explanation of why this channel

Available channel types:
- broadcast: whatsapp, sms, email, push notification, voice
- in-app: feed, search, banner, interstitial
- dooh: restaurant_tv, transit, lobby, gym_screen, billboard
- qr: table_tent, poster, window
- influencer: instagram, youtube, tiktok
- offline: standees, flyers, print

Return 3-4 channels that make sense for the business type.
Return ONLY valid JSON in this format: {"channels": [...]}`
            },
            {
              role: 'user',
              content: `${goal.merchantType} business in ${goal.location}, budget ${goal.budget}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        if (parsed.channels && Array.isArray(parsed.channels)) {
          return parsed.channels.map((ch: any) => ({
            type: ch.type,
            channels: ch.channels,
            budget: 0,
            bid: this.getDefaultBid(ch.type),
            targeting: {},
          }));
        }
      } catch (error) {
        console.error('OpenAI selectChannels error, using fallback:', error);
      }
    }

    // Fallback to rule-based channel selection
    return this.selectChannelsFallback(goal, prefer);
  }

  /**
   * Fallback channel selection logic
   */
  private selectChannelsFallback(goal: CampaignGoal, prefer?: AdType[]): ChannelConfig[] {
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

    return recs.map(rec => ({
      type: rec.type,
      channels: rec.channels,
      budget: 0,
      bid: this.getDefaultBid(rec.type),
      targeting: {},
    }));
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
      return [11, 12, 13, 18, 19, 20];
    }
    if (goal.merchantType === 'hotel') {
      return [9, 10, 14, 15, 20, 21];
    }
    return [10, 11, 14, 15, 18, 19, 20];
  }

  /**
   * Generate creative content using OpenAI
   */
  private async generateCreative(goal: string, merchantType: string): Promise<CreativeContent> {
    const client = getOpenAIClient();

    if (client && isOpenAIEnabled()) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Generate compelling ad creative for a ${merchantType} business.
Return JSON with exactly these fields:
- headline: catchy headline (max 10 words)
- body: persuasive ad copy (2-3 sentences, highlight value proposition and urgency)
- cta: clear call-to-action (2-4 words, action-oriented)
- imagePrompt: description for AI image generation

Make it sound natural, exciting, and specific to the business type.
Use conversational Hindi-English (Hinglish) for restaurant/fitness/retail or formal English for hotel.`
            },
            {
              role: 'user',
              content: goal
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        return {
          headline: parsed.headline || '',
          body: parsed.body || '',
          cta: parsed.cta || 'Learn More',
          imagePrompt: parsed.imagePrompt || '',
        };
      } catch (error) {
        console.error('OpenAI generateCreative error, using fallback:', error);
      }
    }

    // Fallback to predefined creatives
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
    const avgCTR = 0.02;
    const avgConversionRate = 0.05;

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
   * Generate AI reasoning text using OpenAI
   */
  private async generateReasoning(goal: CampaignGoal, channels: ChannelConfig[]): Promise<string[]> {
    const client = getOpenAIClient();

    if (client && isOpenAIEnabled()) {
      try {
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `Explain why these channels and settings were chosen for a ${goal.merchantType} campaign.
Return JSON with a "reasoning" array of 3-4 short, conversational explanations (1 sentence each).
Focus on: channel selection rationale, targeting logic, budget allocation reasoning.
Make it sound like you're giving marketing advice.`
            },
            {
              role: 'user',
              content: `Channels: ${channels.map(c => c.type).join(', ')}
Merchant: ${goal.merchantType} in ${goal.location}
Budget: ${goal.budget}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.5,
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        if (parsed.reasoning && Array.isArray(parsed.reasoning)) {
          return parsed.reasoning.slice(0, 4);
        }
      } catch (error) {
        console.error('OpenAI generateReasoning error, using fallback:', error);
      }
    }

    // Fallback to rule-based reasoning
    return this.generateReasoningFallback(goal, channels);
  }

  /**
   * Fallback reasoning generation
   */
  private generateReasoningFallback(goal: CampaignGoal, channels: ChannelConfig[]): string[] {
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
