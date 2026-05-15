/**
 * AdBazaar - Attribution Integration
 * Connects to REZ-dooh-attribution for tracking
 */

import axios from 'axios';

// Configuration
const ATTRIBUTION_URL = process.env.ATTRIBUTION_URL || 'http://localhost:4081';

interface Touchpoint {
  touchpointId: string;
  screenId: string;
  screenType: string;
  campaignId: string;
  userId?: string;
  event: string;
  timestamp: Date;
}

interface AttributionResult {
  conversionId: string;
  attribution: {
    model: string;
    credits: { screenId: string; credit: number }[];
    totalDOOHCredit: number;
  }[];
}

class AttributionClient {
  private baseURL: string;

  constructor() {
    this.baseURL = ATTRIBUTION_URL;
  }

  /**
   * Record impression
   */
  async recordImpression(data: {
    screenId: string;
    screenType: string;
    campaignId: string;
    userId?: string;
    deviceId?: string;
  }): Promise<{ touchpointId: string } | null> {
    try {
      const response = await axios.post(`${this.baseURL}/api/touchpoints`, {
        ...data,
        event: 'impression',
        timestamp: new Date(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to record impression:', error);
      return null;
    }
  }

  /**
   * Record conversion
   */
  async recordConversion(data: {
    userId: string;
    deviceId?: string;
    event: string;
    value?: number;
  }): Promise<AttributionResult | null> {
    try {
      const response = await axios.post(`${this.baseURL}/api/conversions`, {
        ...data,
        timestamp: new Date(),
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to record conversion:', error);
      return null;
    }
  }

  /**
   * Get attribution models
   */
  async getAttributionModels(): Promise<{
    models: { id: string; name: string; description: string }[];
  } | null> {
    try {
      const response = await axios.get(`${this.baseURL}/api/attribution/models`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get attribution models:', error);
      return null;
    }
  }

  /**
   * Get screen metrics
   */
  async getScreenMetrics(screenId: string): Promise<{
    impressions: number;
    conversions: number;
    roas: number;
  } | null> {
    try {
      const response = await axios.get(`${this.baseURL}/api/metrics/screen/${screenId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get screen metrics:', error);
      return null;
    }
  }
}

export const attributionClient = new AttributionClient();
export default attributionClient;
