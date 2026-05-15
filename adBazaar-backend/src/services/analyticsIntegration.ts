/**
 * AdBazaar - Analytics Integration
 * Integrates with RABTUL analytics service
 */

import axios from 'axios';

// Configuration
const ANALYTICS_URL = process.env.ANALYTICS_URL || 'http://localhost:4006';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

interface AnalyticsEvent {
  event: string;
  userId?: string;
  screenId?: string;
  campaignId?: string;
  data: Record<string, unknown>;
  timestamp?: Date;
}

interface DashboardMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  roas: number;
  ctr: number;
  cpm: number;
}

class AnalyticsClient {
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = ANALYTICS_URL;
    this.token = INTERNAL_TOKEN;
  }

  private async post(endpoint: string, data: unknown): Promise<void> {
    try {
      await axios.post(`${this.baseURL}${endpoint}`, data, {
        headers: {
          'X-Internal-Token': this.token,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
    } catch (error) {
      console.error(`Analytics [${endpoint}]:`, error);
    }
  }

  /**
   * Track screen impression
   */
  async trackImpression(screenId: string, campaignId: string, data: {
    userId?: string;
    duration?: number;
  }): Promise<void> {
    await this.post('/api/events', {
      event: 'screen_impression',
      screenId,
      campaignId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Track campaign conversion
   */
  async trackConversion(campaignId: string, data: {
    userId: string;
    value: number;
    type: string;
  }): Promise<void> {
    await this.post('/api/events', {
      event: 'campaign_conversion',
      campaignId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Get owner dashboard metrics
   */
  async getOwnerMetrics(ownerId: string): Promise<DashboardMetrics | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/dashboard/owner/${ownerId}`,
        {
          headers: { 'X-Internal-Token': this.token },
          timeout: 5000,
        }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Get advertiser dashboard metrics
   */
  async getAdvertiserMetrics(advertiserId: string): Promise<DashboardMetrics | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/dashboard/advertiser/${advertiserId}`,
        {
          headers: { 'X-Internal-Token': this.token },
          timeout: 5000,
        }
      );
      return response.data;
    } catch {
      return null;
    }
  }
}

export const analyticsClient = new AnalyticsClient();
export default analyticsClient;
