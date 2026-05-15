/**
 * REZ OEM SDK - Main Client
 * SDK for device manufacturers and telco partnerships
 */

import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';
import {
  OEMConfig,
  DeviceInfo,
  UserProfile,
  AdOffer,
  ImpressionEvent,
  ClickEvent,
  ConversionEvent,
  CarrierBillingRequest,
  CarrierBillingResponse,
  TelcoConsentRequest,
  TelcoConsentResponse,
  OEMMetrics,
  CampaignTargeting,
  OEMPlacement,
} from './types';

// Validation schemas
const DeviceInfoSchema = z.object({
  deviceId: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  os: z.enum(['android', 'ios', 'windows', 'other']),
  osVersion: z.string().min(1),
  carrier: z.string().optional(),
});

const UserProfileSchema = z.object({
  userId: z.string().min(1),
  oemUserId: z.string().optional(),
  carrier: z.string().optional(),
  deviceId: z.string().min(1),
  segments: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  consentGiven: z.boolean(),
  consentTimestamp: z.date().optional(),
});

export class OEMSdkClient {
  private client: AxiosInstance;
  private config: OEMConfig;
  private deviceInfo?: DeviceInfo;

  constructor(config: OEMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Id': config.partnerId,
        'X-Partner-Secret': config.partnerSecret,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          throw new Error('Invalid partner credentials');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded');
        }
        throw error;
      }
    );
  }

  /**
   * Set device information for this session
   */
  setDeviceInfo(info: DeviceInfo): void {
    DeviceInfoSchema.parse(info);
    this.deviceInfo = info;
  }

  /**
   * Register a new device
   */
  async registerDevice(device: DeviceInfo): Promise<{ deviceId: string; sessionToken: string }> {
    DeviceInfoSchema.parse(device);

    const response = await this.client.post('/api/v1/devices/register', {
      ...device,
      partnerId: this.config.partnerId,
    });

    return response.data;
  }

  /**
   * Create or update user profile
   */
  async syncUserProfile(profile: UserProfile): Promise<UserProfile> {
    UserProfileSchema.parse(profile);

    const response = await this.client.post('/api/v1/users/sync', {
      ...profile,
      deviceId: this.deviceInfo?.deviceId || profile.deviceId,
    });

    return response.data;
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const response = await this.client.get(`/api/v1/users/${userId}`);
    return response.data;
  }

  /**
   * Request an ad offer for a placement
   */
  async requestAd(placement: string, targeting?: CampaignTargeting): Promise<AdOffer | null> {
    if (!this.deviceInfo) {
      throw new Error('Device info not set. Call setDeviceInfo() first.');
    }

    const response = await this.client.post('/api/v1/ads/request', {
      placement,
      device: this.deviceInfo,
      targeting: targeting || {},
      partnerId: this.config.partnerId,
    });

    return response.data.offer || null;
  }

  /**
   * Track an impression event
   */
  async trackImpression(event: ImpressionEvent): Promise<void> {
    if (!this.deviceInfo) {
      throw new Error('Device info not set');
    }

    await this.client.post('/api/v1/events/impression', {
      ...event,
      deviceId: this.deviceInfo.deviceId,
      timestamp: event.timestamp || new Date(),
    });
  }

  /**
   * Track a click event
   */
  async trackClick(event: ClickEvent): Promise<{ redirectUrl: string }> {
    if (!this.deviceInfo) {
      throw new Error('Device info not set');
    }

    const response = await this.client.post('/api/v1/events/click', {
      ...event,
      deviceId: this.deviceInfo.deviceId,
    });

    return response.data;
  }

  /**
   * Track a conversion event
   */
  async trackConversion(event: ConversionEvent): Promise<void> {
    await this.client.post('/api/v1/events/conversion', {
      ...event,
      timestamp: event.timestamp || new Date(),
    });
  }

  /**
   * Initiate carrier billing
   */
  async initiateCarrierBilling(request: CarrierBillingRequest): Promise<CarrierBillingResponse> {
    if (!this.deviceInfo) {
      throw new Error('Device info not set');
    }

    const response = await this.client.post('/api/v1/billing/carrier', {
      ...request,
      deviceId: this.deviceInfo.deviceId,
      carrier: this.deviceInfo.carrier,
    });

    return response.data;
  }

  /**
   * Record user consent for data processing
   */
  async recordConsent(request: TelcoConsentRequest): Promise<TelcoConsentResponse> {
    const response = await this.client.post('/api/v1/consent/record', request);
    return response.data;
  }

  /**
   * Check consent status
   */
  async checkConsent(msisdn: string): Promise<TelcoConsentResponse | null> {
    const response = await this.client.get(`/api/v1/consent/${msisdn}`);
    return response.data;
  }

  /**
   * Get campaign metrics
   */
  async getMetrics(startDate: Date, endDate: Date): Promise<OEMMetrics> {
    const response = await this.client.get('/api/v1/metrics', {
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        partnerId: this.config.partnerId,
      },
    });

    return response.data;
  }

  /**
   * Get available placements for this OEM
   */
  async getPlacements(): Promise<OEMPlacement[]> {
    const response = await this.client.get('/api/v1/placements', {
      params: { partnerId: this.config.partnerId },
    });

    return response.data.placements || [];
  }

  /**
   * Update placement settings
   */
  async updatePlacement(placementId: string, updates: Partial<OEMPlacement>): Promise<OEMPlacement> {
    const response = await this.client.patch(`/api/v1/placements/${placementId}`, updates);
    return response.data;
  }

  /**
   * Get campaign targeting options
   */
  async getTargetingOptions(): Promise<{
    carriers: string[];
    manufacturers: string[];
    segments: string[];
  }> {
    const response = await this.client.get('/api/v1/targeting/options');
    return response.data;
  }
}

/**
 * Factory function to create OEM SDK client
 */
export function createOEMClient(config: OEMConfig): OEMSdkClient {
  return new OEMSdkClient(config);
}

// Export types
export * from './types';

export default OEMSdkClient;
