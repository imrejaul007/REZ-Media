/**
 * Google Enhanced Conversions Service
 *
 * Sends enhanced conversion data to Google Ads for improved attribution.
 *
 * Features:
 * - Conversions API (CAPI) integration
 * - User identity signals (hashed email, phone, address)
 * - Conversion labeling
 * - Batch processing
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface GoogleEnhancedConfig {
  customerId: string;
  developerToken: string;
  accessToken: string;
  refreshToken?: string;
  testMode?: boolean;
}

export interface EnhancedConversion {
  conversionAction: string;
  gclid?: string;
  gclidSource?: string;
  orderId?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  restartConversions?: boolean;
  time?: string;
  userIdentity: UserIdentity;
}

export interface UserIdentity {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  streetAddress?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface ConversionResponse {
  results: Array<{
    conversion_action_id?: string;
    gclid?: string;
    orderId?: string;
  }>;
  partial_failure_error?: {
    code: number;
    message: string;
    details: Array<any>;
  };
}

// ─── Hash Utilities ────────────────────────────────────────────────────────────

/**
 * Hash email for Google
 */
export function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Normalize and hash phone for Google
 */
export function hashPhone(phone: string): string {
  const normalized = phone.replace(/\D/g, '');
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');
}

/**
 * Normalize name for Google
 */
export function hashName(name: string): string {
  return crypto
    .createHash('sha256')
    .update(name.toLowerCase().trim())
    .digest('hex');
}

// ─── Google Enhanced Conversions Service ───────────────────────────────────────

export class GoogleEnhancedConversions {
  private client: AxiosInstance;
  private customerId: string;
  private developerToken: string;
  private testMode: boolean;
  private conversionQueue: EnhancedConversion[] = [];
  private batchSize = 1000;
  private requestInterval = 1000 / 10; // 10 requests per second max

  constructor(config: GoogleEnhancedConfig) {
    this.customerId = config.customerId.replace(/-/g, '');
    this.developerToken = config.developerToken;
    this.testMode = config.testMode ?? false;

    this.client = axios.create({
      baseURL: 'https://googleads.googleapis.com/v18',
      timeout: 30000,
    });
  }

  /**
   * Send a single enhanced conversion
   */
  async sendEnhancedConversion(
    conversion: Omit<EnhancedConversion, 'userIdentity'>,
    userIdentity: UserIdentity
  ): Promise<ConversionResponse> {
    const payload = this.buildPayload([{
      ...conversion,
      userIdentity: this.normalizeIdentity(userIdentity),
    }]);

    return this.send(payload);
  }

  /**
   * Send batch of enhanced conversions
   */
  async sendBatch(conversions: EnhancedConversion[]): Promise<ConversionResponse> {
    const normalized = conversions.map(c => ({
      ...c,
      userIdentity: this.normalizeIdentity(c.userIdentity),
    }));

    const payload = this.buildPayload(normalized);
    return this.send(payload);
  }

  /**
   * Queue conversion for batch sending
   */
  queueConversion(conversion: EnhancedConversion): void {
    this.conversionQueue.push(conversion);

    if (this.conversionQueue.length >= this.batchSize) {
      this.flushQueue();
    }
  }

  /**
   * Flush queued conversions
   */
  async flushQueue(): Promise<ConversionResponse | null> {
    if (this.conversionQueue.length === 0) {
      return null;
    }

    const conversions = [...this.conversionQueue];
    this.conversionQueue = [];

    return this.sendBatch(conversions);
  }

  /**
   * Build payload for Google Ads API
   */
  private buildPayload(conversions: EnhancedConversion[]): Record<string, any> {
    const partialFailure = !this.testMode;

    return {
      conversionAdjustments: conversions.map(c => ({
        adjustmentType: 'WEBPAGE',
        gclidDateTimePair: c.gclid ? {
          gclid: c.gclid,
          conversionDateTime: c.time || new Date().toISOString(),
        } : undefined,
        orderId: c.orderId,
        adjustmentUserIdentity: c.userIdentity.email || c.userIdentity.phone ? {
          userIdentifiers: this.buildUserIdentifiers(c.userIdentity),
        } : undefined,
        conversionAction: `customers/${this.customerId}/conversionActions/${c.conversionAction}`,
        gclid: c.gclid,
        gclidSource: c.gclidSource,
        restatementValue: c.value ? {
          adjustedValue: c.value,
          currencyCode: c.currency || 'INR',
        } : undefined,
        quantity: c.quantity?.toString(),
      })),
      partialFailure,
    };
  }

  /**
   * Build user identifiers array
   */
  private buildUserIdentifiers(identity: UserIdentity): any[] {
    const identifiers = [];

    if (identity.email) {
      identifiers.push({
        hashedEmail: hashEmail(identity.email),
      });
    }

    if (identity.phone) {
      identifiers.push({
        hashedPhoneNumber: hashPhone(identity.phone),
      });
    }

    if (identity.firstName || identity.lastName) {
      identifiers.push({
        hashedFirstName: identity.firstName ? hashName(identity.firstName) : undefined,
        hashedLastName: identity.lastName ? hashName(identity.lastName) : undefined,
        city: identity.city,
        state: identity.region,
        postalCode: identity.postalCode,
        countryCode: identity.country,
      });
    }

    return identifiers;
  }

  /**
   * Normalize user identity (hash PII)
   */
  private normalizeIdentity(identity: UserIdentity): UserIdentity {
    return {
      email: identity.email,
      phone: identity.phone,
      firstName: identity.firstName,
      lastName: identity.lastName,
      streetAddress: identity.streetAddress,
      city: identity.city,
      region: identity.region,
      postalCode: identity.postalCode,
      country: identity.country,
    };
  }

  /**
   * Send to Google Ads API
   */
  private async send(payload: Record<string, any>): Promise<ConversionResponse> {
    try {
      // For Enhanced Conversions, we use the conversion upload API
      // In production, you would use OAuth2 for authentication

      const response = await this.client.post(
        `/customers/${this.customerId}:uploadConversionAdjustments`,
        payload,
        {
          headers: {
            'developer-token': this.developerToken,
            'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'login-customer-id': this.customerId,
          },
        }
      );

      logger.info('[Google Enhanced] Conversions sent', {
        count: payload.conversionAdjustments?.length || 0,
      });

      return response.data;
    } catch (error: any) {
      logger.error('[Google Enhanced] Failed to send', {
        error: error.message,
        details: error.response?.data,
      });

      return {
        results: [],
        partial_failure_error: {
          code: error.response?.status || 500,
          message: error.message,
          details: [error.response?.data],
        },
      };
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(
        `/customers/${this.customerId}/conversionActions`,
        {
          headers: {
            'developer-token': this.developerToken,
            'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
          },
          params: { pageSize: 1 },
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ─── Event Builder ──────────────────────────────────────────────────────────────

export interface ConversionEvent {
  eventName: string;
  orderId?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  gclid?: string;
  gclidSource?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
  conversionAction?: string;
  timestamp?: string;
}

/**
 * Map event to Google Enhanced Conversion
 */
export function buildEnhancedConversion(
  event: ConversionEvent,
  defaultConversionAction: string
): EnhancedConversion {
  return {
    conversionAction: event.conversionAction || defaultConversionAction,
    orderId: event.orderId,
    value: event.value,
    currency: event.currency || 'INR',
    quantity: event.quantity,
    gclid: event.gclid,
    gclidSource: event.gclidSource,
    time: event.timestamp || new Date().toISOString(),
    userIdentity: {
      email: event.email,
      phone: event.phone,
      firstName: event.firstName,
      lastName: event.lastName,
      streetAddress: event.address?.street,
      city: event.address?.city,
      region: event.address?.region,
      postalCode: event.address?.postalCode,
      country: event.address?.country,
    },
  };
}

export default new GoogleEnhancedConversions({
  customerId: process.env.GOOGLE_CUSTOMER_ID || '',
  developerToken: process.env.GOOGLE_DEVELOPER_TOKEN || '',
  accessToken: process.env.GOOGLE_ACCESS_TOKEN || '',
  testMode: process.env.NODE_ENV !== 'production',
});
