/**
 * REZ Intelligence Attribution Integration for AdBazaar
 *
 * Tracks ad conversions and attributes them to the right channels
 * using REZ Intelligence's attribution engine.
 */

import axios from 'axios';

const INTELLIGENCE_URL = process.env.REZ_INTELLIGENCE_URL || 'http://localhost:4018';

// Types
interface AttributionEvent {
  userId: string;
  event: 'impression' | 'click' | 'conversion';
  channel: string;
  campaignId?: string;
  adId?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

interface AttributionResult {
  userId: string;
  conversionId: string;
  attribution: {
    channel: string;
    weight: number;
    touchpoints: number;
  }[];
  totalValue: number;
}

interface CampaignMetrics {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  roas: number;
}

class AttributionIntegration {
  /**
   * Track an attribution event
   */
  async track(event: AttributionEvent): Promise<void> {
    try {
      await axios.post(
        `${INTELLIGENCE_URL}/api/attribution/track`,
        {
          ...event,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
    } catch (error) {
      console.error('Attribution tracking failed:', error);
    }
  }

  /**
   * Get attribution for a conversion
   */
  async getAttribution(userId: string, conversionId: string): Promise<AttributionResult> {
    try {
      const response = await axios.get(
        `${INTELLIGENCE_URL}/api/attribution?userId=${userId}&conversionId=${conversionId}`,
        {
          headers: {
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get attribution failed:', error);
      return {
        userId,
        conversionId,
        attribution: [],
        totalValue: 0,
      };
    }
  }

  /**
   * Track impression
   */
  async trackImpression(
    userId: string,
    adId: string,
    campaignId: string,
    channel: string
  ): Promise<void> {
    await this.track({
      userId,
      event: 'impression',
      channel,
      adId,
      campaignId,
    });
  }

  /**
   * Track click
   */
  async trackClick(
    userId: string,
    adId: string,
    campaignId: string,
    channel: string
  ): Promise<void> {
    await this.track({
      userId,
      event: 'click',
      channel,
      adId,
      campaignId,
    });
  }

  /**
   * Track conversion
   */
  async trackConversion(
    userId: string,
    conversionId: string,
    value: number,
    channels: string[],
    campaignIds: string[]
  ): Promise<AttributionResult> {
    // Track conversion event
    await this.track({
      userId,
      event: 'conversion',
      channel: channels.join(','),
      value,
      metadata: { campaignIds },
    });

    // Get attribution result
    return this.getAttribution(userId, conversionId);
  }

  /**
   * Get predictive bid optimization
   */
  async optimizeBid(userId: string, baseBid: number): Promise<number> {
    try {
      const response = await axios.post(
        `${INTELLIGENCE_URL}/api/attribution/optimize-bid`,
        {
          userId,
          baseBid,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return response.data.optimizedBid;
    } catch (error) {
      console.error('Bid optimization failed:', error);
      return baseBid;
    }
  }

  /**
   * Get campaign performance metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    try {
      const response = await axios.get(
        `${INTELLIGENCE_URL}/api/attribution/campaign/${campaignId}/metrics`,
        {
          headers: {
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Get campaign metrics failed:', error);
      return {
        campaignId,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0,
        roas: 0,
      };
    }
  }

  /**
   * Get lookalike audience for targeting
   */
  async getLookalikeAudience(convertingUsers: string[]): Promise<string[]> {
    try {
      const response = await axios.post(
        `${INTELLIGENCE_URL}/api/attribution/lookalike`,
        {
          seedUsers: convertingUsers,
          audienceSize: 10000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '',
          },
        }
      );
      return response.data.audience;
    } catch (error) {
      console.error('Get lookalike audience failed:', error);
      return [];
    }
  }
}

export const attributionEngine = new AttributionIntegration();
export default attributionEngine;
