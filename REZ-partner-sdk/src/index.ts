/**
 * REZ Partner SDK - Client SDK for partners
 * Integrate ad capabilities into partner apps
 */

import axios, { AxiosInstance } from 'axios';

export interface PartnerConfig {
  partnerId: string;
  apiKey: string;
  apiUrl?: string;
}

export interface AdRequest {
  placement: string;
  userId: string;
  context?: Record<string, unknown>;
}

export interface AdResponse {
  adId: string;
  creativeUrl: string;
  clickUrl: string;
  type: 'banner' | 'video' | 'native';
}

export interface ImpressionEvent {
  adId: string;
  userId: string;
  timestamp: Date;
}

export class REZPartnerSDK {
  private client: AxiosInstance;
  private partnerId: string;

  constructor(config: PartnerConfig) {
    this.partnerId = config.partnerId;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://api.rez.money',
      timeout: 10000,
      headers: {
        'X-Partner-Id': config.partnerId,
        'X-API-Key': config.apiKey,
      },
    });
  }

  /**
   * Request an ad for user
   */
  async getAd(request: AdRequest): Promise<AdResponse | null> {
    try {
      const response = await this.client.post('/api/partners/ad/request', request);
      return response.data.ad;
    } catch (error) {
      console.error('Failed to get ad:', error);
      return null;
    }
  }

  /**
   * Track impression
   */
  async trackImpression(event: ImpressionEvent): Promise<void> {
    await this.client.post('/api/partners/events/impression', {
      ...event,
      partnerId: this.partnerId,
      timestamp: new Date(),
    });
  }

  /**
   * Track click
   */
  async trackClick(adId: string, userId: string): Promise<void> {
    await this.client.post('/api/partners/events/click', {
      adId,
      userId,
      partnerId: this.partnerId,
      timestamp: new Date(),
    });
  }
}

export default REZPartnerSDK;
