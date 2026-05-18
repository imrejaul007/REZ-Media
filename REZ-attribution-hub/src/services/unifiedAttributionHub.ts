/**
 * REZ Unified Attribution Hub
 *
 * Central orchestrator that wires together all attribution services:
 * - Event collection
 * - Identity resolution
 * - Platform integrations (Meta, Google, TikTok)
 * - Attribution engine
 * - LTV analysis
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';

// ─── Service URLs ──────────────────────────────────────────────────────────────

const SERVICES = {
  attribution: process.env.ATTRIBUTION_SERVICE_URL || 'http://localhost:3000',
  metaCAPI: process.env.META_CAPI_URL || 'http://localhost:4080',
  googleEnhanced: process.env.GOOGLE_ENHANCED_URL || 'http://localhost:4085',
  tiktokEvents: process.env.TIKTOK_EVENTS_URL || 'http://localhost:4086',
  identityGraph: process.env.IDENTITY_GRAPH_URL || 'http://localhost:4065',
  crossDevice: process.env.CROSS_DEVICE_URL || 'http://localhost:4068',
  ltvAttribution: process.env.LTV_ATTRIBUTION_URL || 'http://localhost:4090',
  shopifyConnector: process.env.SHOPIFY_CONNECTOR_URL || 'http://localhost:4050',
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface UnifiedEvent {
  // Event data
  eventName: string;
  eventId: string;
  timestamp: Date;

  // User data
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  deviceId?: string;
  sessionId: string;
  fingerprint?: string;
  ip?: string;
  userAgent?: string;

  // Context
  url?: string;
  merchantId: string;
  storeId?: string;

  // E-commerce data
  value?: number;
  currency?: string;
  contentIds?: string[];
  contents?: Array<{ id: string; quantity: number; price?: number }>;
  orderId?: string;
  cartId?: string;
  searchString?: string;

  // Attribution data
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbc?: string;
  fbp?: string;
  ttp?: string;
}

export interface AttributionResult {
  eventId: string;
  customerId?: string;
  touchpointId: string;
  attributedChannel: string;
  attributedCampaign?: string;
  confidence: number;
  model: 'first_touch' | 'last_touch' | 'linear';
}

export interface PlatformResults {
  meta: { success: boolean; error?: string };
  google: { success: boolean; error?: string };
  tiktok: { success: boolean; error?: string };
}

// ─── Unified Attribution Hub ─────────────────────────────────────────────────────

export class UnifiedAttributionHub {
  private initialized = false;

  /**
   * Initialize the hub
   */
  async initialize(): Promise<void> {
    logger.info('[Hub] Initializing Unified Attribution Hub');
    logger.info('[Hub] Service URLs:', SERVICES);
    this.initialized = true;
  }

  /**
   * Process a unified event through all attribution services
   */
  async processEvent(event: UnifiedEvent): Promise<{
    attribution: AttributionResult;
    platformResults: PlatformResults;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    logger.info('[Hub] Processing event', {
      eventName: event.eventName,
      merchantId: event.merchantId,
    });

    // Step 1: Resolve identity (async)
    const identityPromise = this.resolveIdentity(event);

    // Step 2: Track in attribution engine (async)
    const attributionPromise = this.trackToAttribution(event);

    // Step 3: Send to platforms (async)
    const platformPromise = this.sendToPlatforms(event);

    // Wait for all to complete
    const [identity, attribution, platformResults] = await Promise.all([
      identityPromise,
      attributionPromise,
      platformPromise,
    ]);

    return {
      attribution: { ...attribution, customerId: identity.customerId },
      platformResults,
    };
  }

  /**
   * Resolve user identity
   */
  private async resolveIdentity(event: UnifiedEvent): Promise<{ customerId?: string }> {
    try {
      const response = await axios.post(`${SERVICES.identityGraph}/api/resolve`, {
        email: event.email,
        phone: event.phone,
        deviceId: event.deviceId,
        sessionId: event.sessionId,
        merchantId: event.merchantId,
      }, { timeout: 5000 });

      return { customerId: response.data.customerId };
    } catch (error) {
      logger.warn('[Hub] Identity resolution failed', { error });
      return {};
    }
  }

  /**
   * Track event in attribution engine
   */
  private async trackToAttribution(event: UnifiedEvent): Promise<AttributionResult> {
    try {
      // Map to touchpoint
      const channel = this.mapUtmToChannel(event);

      const response = await axios.post(`${SERVICES.attribution}/api/track/touchpoint`, {
        userId: event.email || event.phone || event.deviceId || 'anonymous',
        sessionId: event.sessionId,
        type: this.mapEventToTouchpointType(event.eventName),
        channel,
        campaignId: event.utmCampaign,
        merchantId: event.merchantId,
        storeId: event.storeId,
        ipAddress: event.ip,
        userAgent: event.userAgent,
        metadata: {
          utm: {
            source: event.utmSource,
            medium: event.utmMedium,
            campaign: event.utmCampaign,
            term: event.utmTerm,
            content: event.utmContent,
          },
          gclid: event.gclid,
          fbc: event.fbc,
          fbp: event.fbp,
        },
      }, { timeout: 5000 });

      return {
        eventId: event.eventId,
        touchpointId: response.data.touchpointId,
        attributedChannel: channel,
        attributedCampaign: event.utmCampaign,
        confidence: 1.0,
        model: 'first_touch',
      };
    } catch (error) {
      logger.warn('[Hub] Attribution tracking failed', { error });
      return {
        eventId: event.eventId,
        touchpointId: `fallback_${Date.now()}`,
        attributedChannel: 'direct',
        confidence: 0.5,
        model: 'last_touch',
      };
    }
  }

  /**
   * Send event to all ad platforms
   */
  private async sendToPlatforms(event: UnifiedEvent): Promise<PlatformResults> {
    const results: PlatformResults = {
      meta: { success: false },
      google: { success: false },
      tiktok: { success: false },
    };

    // Only send conversion events to platforms
    const isConversion = ['Purchase', 'CompleteRegistration', 'Lead'].includes(event.eventName);

    if (!isConversion) {
      return results;
    }

    // Send to Meta CAPI
    try {
      await axios.post(`${SERVICES.metaCAPI}/api/events`, {
        eventName: event.eventName,
        eventId: event.eventId,
        email: event.email,
        phone: event.phone,
        firstName: event.firstName,
        lastName: event.lastName,
        value: event.value,
        currency: event.currency,
        contentIds: event.contentIds,
        contents: event.contents,
        orderId: event.orderId,
        url: event.url,
        ip: event.ip,
        userAgent: event.userAgent,
        fbc: event.fbc,
        fbp: event.fbp,
      }, { timeout: 5000 });
      results.meta.success = true;
    } catch (error) {
      results.meta.error = (error as Error).message;
    }

    // Send to Google Enhanced Conversions
    if (event.gclid || event.email || event.phone) {
      try {
        await axios.post(`${SERVICES.googleEnhanced}/api/conversions`, {
          eventName: event.eventName,
          orderId: event.orderId,
          value: event.value,
          currency: event.currency,
          gclid: event.gclid,
          userIdentity: {
            email: event.email,
            phone: event.phone,
            firstName: event.firstName,
            lastName: event.lastName,
          },
        }, { timeout: 5000 });
        results.google.success = true;
      } catch (error) {
        results.google.error = (error as Error).message;
      }
    }

    // Send to TikTok
    try {
      await axios.post(`${SERVICES.tiktokEvents}/api/events`, {
        eventName: event.eventName,
        eventId: event.eventId,
        email: event.email,
        phone: event.phone,
        ttp: event.ttp,
        value: event.value,
        currency: event.currency,
        contentIds: event.contentIds,
        contents: event.contents,
        orderId: event.orderId,
        userAgent: event.userAgent,
        clientIp: event.ip,
      }, { timeout: 5000 });
      results.tiktok.success = true;
    } catch (error) {
      results.tiktok.error = (error as Error).message;
    }

    return results;
  }

  /**
   * Map UTM parameters to channel
   */
  private mapUtmToChannel(event: UnifiedEvent): string {
    if (event.utmSource) {
      const source = event.utmSource.toLowerCase();
      if (source.includes('facebook') || source.includes('meta') || source.includes('instagram')) {
        return 'meta';
      }
      if (source.includes('google')) {
        return 'google';
      }
      if (source.includes('tiktok')) {
        return 'tiktok';
      }
      if (source.includes('twitter') || source.includes('x.')) {
        return 'twitter';
      }
      if (source.includes('linkedin')) {
        return 'linkedin';
      }
      if (source.includes('email') || event.utmMedium?.toLowerCase().includes('email')) {
        return 'email';
      }
    }

    if (event.utmMedium) {
      const medium = event.utmMedium.toLowerCase();
      if (medium.includes('cpc') || medium.includes('paid')) {
        return 'paid_search';
      }
      if (medium.includes('social')) {
        return 'social';
      }
      if (medium.includes('display')) {
        return 'display';
      }
      if (medium.includes('referral')) {
        return 'referral';
      }
    }

    return 'direct';
  }

  /**
   * Map event name to touchpoint type
   */
  private mapEventToTouchpointType(eventName: string): string {
    const mapping: Record<string, string> = {
      'PageView': 'website_visit',
      'ViewContent': 'website_visit',
      'Search': 'search',
      'AddToCart': 'ad_view',
      'InitiateCheckout': 'ad_view',
      'Purchase': 'ad_view',
      'Lead': 'ad_view',
      'CompleteRegistration': 'ad_view',
    };

    return mapping[eventName] || 'ad_view';
  }

  /**
   * Get attribution report for a customer
   */
  async getCustomerAttribution(customerId: string, model = 'linear'): Promise<any> {
    try {
      const response = await axios.get(`${SERVICES.ltvAttribution}/api/customers/${customerId}/ltv`, {
        params: { model },
      });
      return response.data;
    } catch (error) {
      logger.warn('[Hub] Failed to get customer attribution', { customerId });
      return null;
    }
  }

  /**
   * Get channel performance report
   */
  async getChannelReport(merchantId: string): Promise<any> {
    try {
      const response = await axios.get(`${SERVICES.attribution}/api/reports/channel-attribution`, {
        params: { merchantId },
      });
      return response.data;
    } catch (error) {
      logger.warn('[Hub] Failed to get channel report');
      return null;
    }
  }

  /**
   * Health check all services
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const services = Object.entries(SERVICES);
    const results: Record<string, boolean> = {};

    await Promise.all(
      services.map(async ([name, url]) => {
        try {
          await axios.get(`${url}/health`, { timeout: 3000 });
          results[name] = true;
        } catch {
          results[name] = false;
        }
      })
    );

    return results;
  }
}

export const unifiedAttributionHub = new UnifiedAttributionHub();
export default unifiedAttributionHub;
