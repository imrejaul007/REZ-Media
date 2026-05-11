/**
 * DOOH ATTRIBUTION TRACKER
 * Phase 5: Digital Out of Home attribution - Screen → QR Scan → Visit → Purchase
 * Tracks DOOH screen impressions, QR code scans, and attributes conversions
 */

import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// CONSTANTS
// ============================================

const REDIS_PREFIX = 'dooh:';
const DEFAULT_ATTRIBUTION_WINDOW_HOURS = 24;
const TTL_SECONDS = DEFAULT_ATTRIBUTION_WINDOW_HOURS * 60 * 60;

// DOOH Attribution event weights
export const DOOH_ATTRIBUTION_WEIGHTS: Record<DOOHEventType, number> = {
  impression: 0.10,
  qrScan: 0.30,
  visit: 0.25,
  purchase: 0.35
};

// ============================================
// INTERFACES
// ============================================

// Main DOOH Attribution interface
export interface DOOHAttribution {
  screenId: string;
  campaignId: string;
  impressionTime: Date;
  scanTime?: Date;
  visitTime?: Date;
  purchaseTime?: Date;
  attributionWeight: number;
}

// Event types for DOOH funnel
export type DOOHEventType = 'impression' | 'qrScan' | 'visit' | 'purchase';

// DOOH Screen information
export interface DOOHScreen {
  screenId: string;
  location: DOOHLocation;
  network: string;
  dimensions: { width: number; height: number };
  orientation: 'landscape' | 'portrait';
  isActive: boolean;
}

// Geographic location of DOOH screen
export interface DOOHLocation {
  latitude: number;
  longitude: number;
  address?: string;
  zone?: string;
  venueType: 'mall' | 'airport' | 'transit' | 'street' | 'gym' | 'restaurant' | 'retail' | 'other';
}

// Impression event data
export interface ImpressionEvent {
  screenId: string;
  campaignId: string;
  timestamp: Date;
  durationViewed: number; // in seconds
  audienceCount: number; // anonymous count
  location?: DOOHLocation;
  creativeId?: string;
  metadata?: Record<string, any>;
}

// QR Scan event data
export interface QRScanEvent {
  screenId: string;
  campaignId: string;
  qrCode: string;
  userId?: string; // anonymous until linked
  scanTime: Date;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
    isMobile: boolean;
  };
  location?: DOOHLocation;
  metadata?: Record<string, any>;
}

// Visit event data
export interface VisitEvent {
  screenId: string;
  campaignId: string;
  userId: string;
  visitTime: Date;
  source: 'qr_scan' | 'deeplink' | 'manual';
  sessionId?: string;
  metadata?: Record<string, any>;
}

// Purchase event data
export interface PurchaseEvent {
  screenId: string;
  campaignId: string;
  userId: string;
  purchaseTime: Date;
  purchaseValue: number;
  orderId: string;
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  metadata?: Record<string, any>;
}

// Campaign configuration for DOOH
export interface DOOHCampaignConfig {
  campaignId: string;
  screenIds: string[];
  attributionWindowHours: number;
  startDate: Date;
  endDate: Date;
  qrBaseUrl: string;
  customWeights?: Partial<Record<DOOHEventType, number>>;
  isActive: boolean;
}

// Attribution query filters
export interface DOOHAttributionQuery {
  screenId?: string;
  campaignId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  eventType?: DOOHEventType;
}

// Attribution result
export interface DOOHAttributionResult {
  screenId: string;
  campaignId: string;
  userId: string;
  creditedEvents: DOOHEventType[];
  attributionWeight: number;
  conversionValue: number;
  attributedValue: number;
  impressionToScanTime?: number; // ms
  scanToPurchaseTime?: number; // ms
  window: string;
  model: DOOHAttributionModel;
}

// Attribution summary for a screen
export interface DOOHScreenSummary {
  screenId: string;
  campaignId?: string;
  totalImpressions: number;
  uniqueScans: number;
  uniqueVisits: number;
  uniquePurchases: number;
  totalConversionValue: number;
  attributedValue: number;
  avgViewDuration: number;
  avgImpressionToScanTime: number;
  conversionRate: {
    impressionToScan: number;
    scanToVisit: number;
    visitToPurchase: number;
    overall: number;
  };
}

// Campaign attribution summary
export interface DOOHCampaignSummary {
  campaignId: string;
  totalScreens: number;
  totalImpressions: number;
  uniqueScans: number;
  uniqueUsers: number;
  totalPurchaseValue: number;
  attributedValue: number;
  eventBreakdown: Record<DOOHEventType, number>;
  screenBreakdown: DOOHScreenSummary[];
  conversionFunnel: {
    impressions: number;
    scans: number;
    visits: number;
    purchases: number;
    rates: {
      scanRate: number;
      visitRate: number;
      purchaseRate: number;
    };
  };
}

// Attribution model types
export type DOOHAttributionModel = 'first-touch' | 'last-touch' | 'linear' | 'time-decay' | 'position-based';

// QR Code mapping
export interface QRCodeMapping {
  qrCode: string;
  screenId: string;
  campaignId: string;
  createdAt: Date;
  isActive: boolean;
  clickCount: number;
  lastClickedAt?: Date;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate Redis key for DOOH impressions
 */
function impressionKey(screenId: string, campaignId: string, timestamp: number): string {
  return `${REDIS_PREFIX}impression:${screenId}:${campaignId}:${timestamp}`;
}

/**
 * Generate Redis key for QR scan events
 */
function scanKey(screenId: string, campaignId: string, scanId: string): string {
  return `${REDIS_PREFIX}scan:${screenId}:${campaignId}:${scanId}`;
}

/**
 * Generate Redis key for user DOOH journeys
 */
function journeyKey(userId: string, screenId: string, campaignId: string): string {
  return `${REDIS_PREFIX}journey:${userId}:${screenId}:${campaignId}`;
}

/**
 * Generate Redis key for screen attribution data
 */
function screenKey(screenId: string, campaignId: string): string {
  return `${REDIS_PREFIX}screen:${screenId}:campaign:${campaignId}`;
}

/**
 * Generate Redis key for campaign attribution data
 */
function campaignDoohKey(campaignId: string): string {
  return `${REDIS_PREFIX}campaign:${campaignId}`;
}

/**
 * Generate Redis key for QR code mapping
 */
function qrMappingKey(qrCode: string): string {
  return `${REDIS_PREFIX}qrmap:${qrCode}`;
}

/**
 * Generate Redis key for QR to screen lookup
 */
function qrToScreenKey(qrCode: string): string {
  return `${REDIS_PREFIX}qr:${qrCode}:screen`;
}

/**
 * Get effective weights (custom + defaults)
 */
function getEffectiveWeights(
  customWeights?: Partial<Record<DOOHEventType, number>>
): Record<DOOHEventType, number> {
  return {
    ...DOOH_ATTRIBUTION_WEIGHTS,
    ...customWeights
  };
}

/**
 * Calculate time between two events in milliseconds
 */
function timeDifference(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}

/**
 * Check if an event is within the attribution window
 */
function isWithinWindow(eventTime: Date, impressionTime: Date, windowHours: number): boolean {
  const windowMs = windowHours * 60 * 60 * 1000;
  return timeDifference(impressionTime, eventTime) <= windowMs;
}

/**
 * Calculate time decay factor for position-based attribution
 */
function calculateTimeDecayFactor(
  eventTimestamp: Date,
  conversionTimestamp: Date,
  windowHours: number
): number {
  const windowMs = windowHours * 60 * 60 * 1000;
  const timeDiff = conversionTimestamp.getTime() - eventTimestamp.getTime();
  const decayRate = Math.log(2) / windowMs; // Half-life decay
  return Math.exp(-decayRate * timeDiff);
}

// ============================================
// DOOH ATTRIBUTION TRACKER CLASS
// ============================================

export class DOOHAttributionTracker {

  /**
   * Register a DOOH screen
   */
  async registerScreen(screen: DOOHScreen): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `${REDIS_PREFIX}screen:${screen.screenId}`;
      const screenData = {
        ...screen,
        registeredAt: new Date().toISOString()
      };
      await redis.set(key, JSON.stringify(screenData));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get DOOH screen information
   */
  async getScreen(screenId: string): Promise<DOOHScreen | null> {
    const key = `${REDIS_PREFIX}screen:${screenId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Create QR code mapping for a DOOH campaign
   */
  async createQRMapping(
    screenId: string,
    campaignId: string,
    customQrCode?: string
  ): Promise<QRCodeMapping> {
    const qrCode = customQrCode || `DOOH_${screenId}_${campaignId}_${Date.now()}`;
    const key = qrMappingKey(qrCode);
    const toScreenKey = qrToScreenKey(qrCode);

    const mapping: QRCodeMapping = {
      qrCode,
      screenId,
      campaignId,
      createdAt: new Date(),
      isActive: true,
      clickCount: 0
    };

    // Store mapping
    await redis.set(key, JSON.stringify(mapping));
    // Store reverse lookup (QR -> screen)
    await redis.set(toScreenKey, JSON.stringify({ screenId, campaignId }));

    return mapping;
  }

  /**
   * Get QR code mapping
   */
  async getQRMapping(qrCode: string): Promise<QRCodeMapping | null> {
    const key = qrMappingKey(qrCode);
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get screen attribution from QR code
   */
  async getScreenFromQR(qrCode: string): Promise<{ screenId: string; campaignId: string } | null> {
    const key = qrToScreenKey(qrCode);
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Track an impression event (screen shown)
   */
  async trackImpression(event: ImpressionEvent): Promise<{
    success: boolean;
    impressionId: string;
    error?: string;
  }> {
    try {
      const impressionId = `${event.screenId}:${event.campaignId}:${Date.now()}`;
      const key = impressionKey(event.screenId, event.campaignId, Date.now());
      const screenListKey = `${REDIS_PREFIX}screen:${event.screenId}:campaign:${event.campaignId}:impressions`;

      const eventData = {
        id: impressionId,
        ...event,
        timestamp: event.timestamp.toISOString()
      };

      // Store impression
      await redis.setex(key, TTL_SECONDS, JSON.stringify(eventData));

      // Add to sorted set for time-based queries
      await redis.zadd(screenListKey, event.timestamp.getTime(), impressionId);
      await redis.expire(screenListKey, TTL_SECONDS);

      // Update screen stats
      await this.updateScreenStats(event.screenId, event.campaignId, 'impression', {
        durationViewed: event.durationViewed,
        audienceCount: event.audienceCount
      });

      return { success: true, impressionId };
    } catch (error) {
      return {
        success: false,
        impressionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track a QR scan event
   */
  async trackQRScan(event: QRScanEvent): Promise<{
    success: boolean;
    scanId: string;
    attributedImpression?: DOOHAttribution;
    error?: string;
  }> {
    try {
      const scanId = `${event.screenId}:${event.campaignId}:${Date.now()}`;
      const key = scanKey(event.screenId, event.campaignId, scanId);

      const eventData = {
        id: scanId,
        ...event,
        scanTime: event.scanTime.toISOString()
      };

      // Store scan event
      await redis.setex(key, TTL_SECONDS, JSON.stringify(eventData));

      // Update QR mapping click count
      if (event.qrCode) {
        const qrMapping = await this.getQRMapping(event.qrCode);
        if (qrMapping) {
          qrMapping.clickCount++;
          qrMapping.lastClickedAt = event.scanTime;
          await redis.set(qrMappingKey(event.qrCode), JSON.stringify(qrMapping));
        }
      }

      // Find attributed impression
      const attribution = await this.findAttributedImpression(
        event.screenId,
        event.campaignId,
        event.scanTime
      );

      // If user is identified, update journey
      if (event.userId) {
        await this.updateUserJourney(event.userId, event.screenId, event.campaignId, 'qrScan', event.scanTime);
      }

      // Update screen stats
      await this.updateScreenStats(event.screenId, event.campaignId, 'qrScan');

      return { success: true, scanId, attributedImpression: attribution };
    } catch (error) {
      return {
        success: false,
        scanId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track a visit event (user visited after seeing DOOH)
   */
  async trackVisit(event: VisitEvent): Promise<{
    success: boolean;
    visitId: string;
    attribution?: DOOHAttributionResult;
    error?: string;
  }> {
    try {
      const visitId = `${event.screenId}:${event.campaignId}:${Date.now()}`;
      const key = `${REDIS_PREFIX}visit:${event.screenId}:${event.campaignId}:${visitId}`;

      const eventData = {
        id: visitId,
        ...event,
        visitTime: event.visitTime.toISOString()
      };

      await redis.setex(key, TTL_SECONDS, JSON.stringify(eventData));

      // Update user journey
      await this.updateUserJourney(event.userId, event.screenId, event.campaignId, 'visit', event.visitTime);

      // Update screen stats
      await this.updateScreenStats(event.screenId, event.campaignId, 'visit');

      // Calculate partial attribution
      const attribution = await this.calculateAttribution(
        event.userId,
        event.screenId,
        event.campaignId,
        0,
        'last-touch'
      );

      return { success: true, visitId, attribution: attribution[0] };
    } catch (error) {
      return {
        success: false,
        visitId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track a purchase event and calculate full attribution
   */
  async trackPurchase(event: PurchaseEvent): Promise<{
    success: boolean;
    purchaseId: string;
    attribution: DOOHAttributionResult[];
    error?: string;
  }> {
    try {
      const purchaseId = `${event.screenId}:${event.campaignId}:${Date.now()}`;
      const key = `${REDIS_PREFIX}purchase:${event.screenId}:${event.campaignId}:${purchaseId}`;

      const eventData = {
        id: purchaseId,
        ...event,
        purchaseTime: event.purchaseTime.toISOString()
      };

      await redis.setex(key, TTL_SECONDS, JSON.stringify(eventData));

      // Update user journey
      await this.updateUserJourney(event.userId, event.screenId, event.campaignId, 'purchase', event.purchaseTime);

      // Update screen stats
      await this.updateScreenStats(event.screenId, event.campaignId, 'purchase', {
        purchaseValue: event.purchaseValue
      });

      // Calculate full attribution
      const attribution = await this.calculateAttribution(
        event.userId,
        event.screenId,
        event.campaignId,
        event.purchaseValue,
        'time-decay'
      );

      return { success: true, purchaseId, attribution };
    } catch (error) {
      return {
        success: false,
        purchaseId: '',
        attribution: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate attribution for a user journey
   */
  async calculateAttribution(
    userId: string,
    screenId: string,
    campaignId: string,
    conversionValue: number,
    model: DOOHAttributionModel = 'time-decay'
  ): Promise<DOOHAttributionResult[]> {
    const journey = await this.getUserJourney(userId, screenId, campaignId);
    const windowHours = await this.getCampaignWindowHours(campaignId);
    const weights = await this.getCampaignWeights(campaignId);

    if (!journey || !journey.impressionTime) {
      return [{
        screenId,
        campaignId,
        userId,
        creditedEvents: [],
        attributionWeight: 0,
        conversionValue,
        attributedValue: 0,
        window: `${windowHours}-hour`,
        model
      }];
    }

    const conversionTime = journey.purchaseTime || journey.visitTime || new Date();
    const creditedEvents: DOOHEventType[] = [];
    let totalWeight = 0;
    let impressionToScanTime: number | undefined;
    let scanToPurchaseTime: number | undefined;

    switch (model) {
      case 'first-touch':
        return this.calculateFirstTouchAttribution(journey, conversionValue, weights, windowHours, userId, model);
      case 'last-touch':
        return this.calculateLastTouchAttribution(journey, conversionValue, weights, windowHours, userId, model);
      case 'linear':
        return this.calculateLinearAttribution(journey, conversionValue, weights, windowHours, userId, model);
      case 'time-decay':
        return this.calculateTimeDecayAttribution(journey, conversionValue, weights, windowHours, userId, model);
      case 'position-based':
        return this.calculatePositionBasedAttribution(journey, conversionValue, weights, windowHours, userId, model);
      default:
        return this.calculateLastTouchAttribution(journey, conversionValue, weights, windowHours, userId, model);
    }
  }

  /**
   * First Touch Attribution - credit goes to impression
   */
  private calculateFirstTouchAttribution(
    journey: DOOHAttribution,
    conversionValue: number,
    weights: Record<DOOHEventType, number>,
    windowHours: number,
    userId: string,
    model: DOOHAttributionModel
  ): DOOHAttributionResult[] {
    const weight = weights.impression;
    return [{
      screenId: journey.screenId,
      campaignId: journey.campaignId,
      userId,
      creditedEvents: ['impression'],
      attributionWeight: weight,
      conversionValue,
      attributedValue: conversionValue * weight,
      impressionToScanTime: journey.scanTime ? timeDifference(journey.impressionTime, journey.scanTime) : undefined,
      window: `${windowHours}-hour`,
      model
    }];
  }

  /**
   * Last Touch Attribution - credit goes to most recent event
   */
  private calculateLastTouchAttribution(
    journey: DOOHAttribution,
    conversionValue: number,
    weights: Record<DOOHEventType, number>,
    windowHours: number,
    userId: string,
    model: DOOHAttributionModel
  ): DOOHAttributionResult[] {
    let lastEvent: DOOHEventType = 'purchase';
    let lastTime = journey.purchaseTime;

    if (!lastTime || !journey.purchaseTime) {
      lastEvent = 'visit';
      lastTime = journey.visitTime;
    }
    if (!lastTime || !journey.visitTime) {
      lastEvent = 'qrScan';
      lastTime = journey.scanTime;
    }
    if (!lastTime) {
      lastEvent = 'impression';
      lastTime = journey.impressionTime;
    }

    const weight = weights[lastEvent];
    return [{
      screenId: journey.screenId,
      campaignId: journey.campaignId,
      userId,
      creditedEvents: [lastEvent],
      attributionWeight: weight,
      conversionValue,
      attributedValue: conversionValue * weight,
      impressionToScanTime: journey.scanTime ? timeDifference(journey.impressionTime, journey.scanTime) : undefined,
      scanToPurchaseTime: journey.purchaseTime ? timeDifference(journey.scanTime || journey.impressionTime, journey.purchaseTime) : undefined,
      window: `${windowHours}-hour`,
      model
    }];
  }

  /**
   * Linear Attribution - split credit among all touchpoints
   */
  private calculateLinearAttribution(
    journey: DOOHAttribution,
    conversionValue: number,
    weights: Record<DOOHEventType, number>,
    windowHours: number,
    userId: string,
    model: DOOHAttributionModel
  ): DOOHAttributionResult[] {
    const creditedEvents: DOOHEventType[] = [];
    let totalWeight = 0;

    if (journey.impressionTime) {
      creditedEvents.push('impression');
      totalWeight += weights.impression;
    }
    if (journey.scanTime) {
      creditedEvents.push('qrScan');
      totalWeight += weights.qrScan;
    }
    if (journey.visitTime) {
      creditedEvents.push('visit');
      totalWeight += weights.visit;
    }
    if (journey.purchaseTime) {
      creditedEvents.push('purchase');
      totalWeight += weights.purchase;
    }

    const normalizedWeight = creditedEvents.length > 0 ? totalWeight / creditedEvents.length : 0;

    return [{
      screenId: journey.screenId,
      campaignId: journey.campaignId,
      userId,
      creditedEvents,
      attributionWeight: normalizedWeight,
      conversionValue,
      attributedValue: conversionValue * normalizedWeight,
      impressionToScanTime: journey.scanTime ? timeDifference(journey.impressionTime, journey.scanTime) : undefined,
      scanToPurchaseTime: journey.purchaseTime ? timeDifference(journey.scanTime || journey.impressionTime, journey.purchaseTime) : undefined,
      window: `${windowHours}-hour`,
      model
    }];
  }

  /**
   * Time Decay Attribution - recent events get more credit
   */
  private calculateTimeDecayAttribution(
    journey: DOOHAttribution,
    conversionValue: number,
    weights: Record<DOOHEventType, number>,
    windowHours: number,
    userId: string,
    model: DOOHAttributionModel
  ): DOOHAttributionResult[] {
    const conversionTime = journey.purchaseTime || journey.visitTime || new Date();
    const creditedEvents: DOOHEventType[] = [];
    let totalDecayWeight = 0;

    // Impression weight with decay
    if (journey.impressionTime) {
      const decay = calculateTimeDecayFactor(journey.impressionTime, conversionTime, windowHours);
      totalDecayWeight += weights.impression * decay;
      creditedEvents.push('impression');
    }

    // Scan weight with decay
    if (journey.scanTime) {
      const decay = calculateTimeDecayFactor(journey.scanTime, conversionTime, windowHours);
      totalDecayWeight += weights.qrScan * decay;
      creditedEvents.push('qrScan');
    }

    // Visit weight with decay
    if (journey.visitTime) {
      const decay = calculateTimeDecayFactor(journey.visitTime, conversionTime, windowHours);
      totalDecayWeight += weights.visit * decay;
      creditedEvents.push('visit');
    }

    // Purchase weight (no decay - it's the conversion)
    if (journey.purchaseTime) {
      totalDecayWeight += weights.purchase;
      creditedEvents.push('purchase');
    }

    return [{
      screenId: journey.screenId,
      campaignId: journey.campaignId,
      userId,
      creditedEvents,
      attributionWeight: totalDecayWeight,
      conversionValue,
      attributedValue: conversionValue * totalDecayWeight,
      impressionToScanTime: journey.scanTime ? timeDifference(journey.impressionTime, journey.scanTime) : undefined,
      scanToPurchaseTime: journey.purchaseTime ? timeDifference(journey.scanTime || journey.impressionTime, journey.purchaseTime) : undefined,
      window: `${windowHours}-hour`,
      model
    }];
  }

  /**
   * Position-Based Attribution - more weight to first and last touchpoints
   */
  private calculatePositionBasedAttribution(
    journey: DOOHAttribution,
    conversionValue: number,
    weights: Record<DOOHEventType, number>,
    windowHours: number,
    userId: string,
    model: DOOHAttributionModel
  ): DOOHAttributionResult[] {
    const creditedEvents: DOOHEventType[] = [];
    let totalWeight = 0;

    // First touch (impression) gets 40%
    if (journey.impressionTime) {
      creditedEvents.push('impression');
      totalWeight += weights.impression * 0.4;
    }

    // Middle touchpoints (scan and visit) get 20% each
    if (journey.scanTime) {
      creditedEvents.push('qrScan');
      totalWeight += weights.qrScan * 0.2;
    }
    if (journey.visitTime) {
      creditedEvents.push('visit');
      totalWeight += weights.visit * 0.2;
    }

    // Last touch (purchase) gets 40%
    if (journey.purchaseTime) {
      creditedEvents.push('purchase');
      totalWeight += weights.purchase * 0.4;
    }

    return [{
      screenId: journey.screenId,
      campaignId: journey.campaignId,
      userId,
      creditedEvents,
      attributionWeight: totalWeight,
      conversionValue,
      attributedValue: conversionValue * totalWeight,
      impressionToScanTime: journey.scanTime ? timeDifference(journey.impressionTime, journey.scanTime) : undefined,
      scanToPurchaseTime: journey.purchaseTime ? timeDifference(journey.scanTime || journey.impressionTime, journey.purchaseTime) : undefined,
      window: `${windowHours}-hour`,
      model
    }];
  }

  /**
   * Find attributed impression for a QR scan
   */
  private async findAttributedImpression(
    screenId: string,
    campaignId: string,
    scanTime: Date
  ): Promise<DOOHAttribution | undefined> {
    const windowHours = await this.getCampaignWindowHours(campaignId);
    const cutoffTime = scanTime.getTime() - (windowHours * 60 * 60 * 1000);

    const key = `${REDIS_PREFIX}screen:${screenId}:campaign:${campaignId}:impressions`;
    const impressionIds = await redis.zrangebyscore(key, cutoffTime, scanTime.getTime());

    if (impressionIds.length > 0) {
      // Get the most recent impression before scan
      const mostRecent = impressionIds[impressionIds.length - 1];
      const [, , timestamp] = mostRecent.split(':');
      const impressionData = await redis.get(impressionKey(screenId, campaignId, parseInt(timestamp)));

      if (impressionData) {
        const parsed = JSON.parse(impressionData);
        return {
          screenId,
          campaignId,
          impressionTime: new Date(parsed.timestamp),
          scanTime,
          attributionWeight: DOOH_ATTRIBUTION_WEIGHTS.qrScan
        };
      }
    }

    return undefined;
  }

  /**
   * Get user journey for DOOH attribution
   */
  async getUserJourney(
    userId: string,
    screenId: string,
    campaignId: string
  ): Promise<DOOHAttribution | null> {
    const key = journeyKey(userId, screenId, campaignId);
    const data = await redis.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      screenId: parsed.screenId,
      campaignId: parsed.campaignId,
      impressionTime: parsed.impressionTime ? new Date(parsed.impressionTime) : undefined,
      scanTime: parsed.scanTime ? new Date(parsed.scanTime) : undefined,
      visitTime: parsed.visitTime ? new Date(parsed.visitTime) : undefined,
      purchaseTime: parsed.purchaseTime ? new Date(parsed.purchaseTime) : undefined,
      attributionWeight: parsed.attributionWeight || 0
    };
  }

  /**
   * Update user journey through the DOOH funnel
   */
  private async updateUserJourney(
    userId: string,
    screenId: string,
    campaignId: string,
    eventType: DOOHEventType,
    eventTime: Date
  ): Promise<void> {
    const key = journeyKey(userId, screenId, campaignId);
    const existing = await redis.get(key);
    const journey: Record<string, any> = existing ? JSON.parse(existing) : {};

    journey.screenId = screenId;
    journey.campaignId = campaignId;
    journey.userId = userId;

    // Update based on event type
    switch (eventType) {
      case 'impression':
        journey.impressionTime = eventTime.toISOString();
        break;
      case 'qrScan':
        journey.scanTime = eventTime.toISOString();
        break;
      case 'visit':
        journey.visitTime = eventTime.toISOString();
        break;
      case 'purchase':
        journey.purchaseTime = eventTime.toISOString();
        break;
    }

    // Recalculate attribution weight
    journey.attributionWeight = this.calculateJourneyWeight(journey);

    await redis.setex(key, TTL_SECONDS, JSON.stringify(journey));

    // Add to user journey index
    await redis.zadd(`${REDIS_PREFIX}user:${userId}:dooh:journeys`, eventTime.getTime(), `${screenId}:${campaignId}`);
  }

  /**
   * Calculate weight for a complete journey
   */
  private calculateJourneyWeight(journey: Record<string, any>): number {
    let weight = 0;
    const weights = DOOH_ATTRIBUTION_WEIGHTS;

    if (journey.impressionTime) weight += weights.impression;
    if (journey.scanTime) weight += weights.qrScan;
    if (journey.visitTime) weight += weights.visit;
    if (journey.purchaseTime) weight += weights.purchase;

    return weight;
  }

  /**
   * Get screen attribution summary
   */
  async getScreenSummary(
    screenId: string,
    campaignId?: string
  ): Promise<DOOHScreenSummary[]> {
    const summaries: DOOHScreenSummary[] = [];

    if (campaignId) {
      const summary = await this.calculateScreenSummary(screenId, campaignId);
      summaries.push(summary);
    } else {
      // Get all campaigns for this screen
      const key = `${REDIS_PREFIX}screen:${screenId}:campaigns`;
      const campaigns = await redis.smembers(key);

      for (const campId of campaigns) {
        const summary = await this.calculateScreenSummary(screenId, campId);
        summaries.push(summary);
      }
    }

    return summaries;
  }

  /**
   * Calculate screen summary for a campaign
   */
  private async calculateScreenSummary(screenId: string, campaignId: string): Promise<DOOHScreenSummary> {
    const key = screenKey(screenId, campaignId);
    const data = await redis.hgetall(key);

    const impressions = parseInt(data.impressions || '0');
    const scans = parseInt(data.scans || '0');
    const visits = parseInt(data.visits || '0');
    const purchases = parseInt(data.purchases || '0');
    const totalDuration = parseFloat(data.totalDuration || '0');
    const totalAudience = parseInt(data.totalAudience || '0');
    const totalPurchaseValue = parseFloat(data.totalPurchaseValue || '0');
    const totalScanTime = parseFloat(data.totalScanTime || '0');

    return {
      screenId,
      campaignId,
      totalImpressions: impressions,
      uniqueScans: scans,
      uniqueVisits: visits,
      uniquePurchases: purchases,
      totalConversionValue: totalPurchaseValue,
      attributedValue: totalPurchaseValue * DOOH_ATTRIBUTION_WEIGHTS.purchase,
      avgViewDuration: impressions > 0 ? totalDuration / impressions : 0,
      avgImpressionToScanTime: scans > 0 ? totalScanTime / scans : 0,
      conversionRate: {
        impressionToScan: impressions > 0 ? (scans / impressions) * 100 : 0,
        scanToVisit: scans > 0 ? (visits / scans) * 100 : 0,
        visitToPurchase: visits > 0 ? (purchases / visits) * 100 : 0,
        overall: impressions > 0 ? (purchases / impressions) * 100 : 0
      }
    };
  }

  /**
   * Get campaign attribution summary
   */
  async getCampaignSummary(campaignId: string): Promise<DOOHCampaignSummary> {
    const key = campaignDoohKey(campaignId);
    const data = await redis.hgetall(key);

    const screenBreakdown = await this.getCampaignScreens(campaignId);
    const screenSummaries = await Promise.all(
      screenBreakdown.map(screenId => this.calculateScreenSummary(screenId, campaignId))
    );

    const totalImpressions = screenSummaries.reduce((sum, s) => sum + s.totalImpressions, 0);
    const totalScans = screenSummaries.reduce((sum, s) => sum + s.uniqueScans, 0);
    const totalVisits = screenSummaries.reduce((sum, s) => sum + s.uniqueVisits, 0);
    const totalPurchases = screenSummaries.reduce((sum, s) => sum + s.uniquePurchases, 0);
    const totalPurchaseValue = screenSummaries.reduce((sum, s) => sum + s.totalConversionValue, 0);
    const uniqueUsers = parseInt(data.uniqueUsers || '0');

    return {
      campaignId,
      totalScreens: screenBreakdown.length,
      totalImpressions,
      uniqueScans: totalScans,
      uniqueUsers,
      totalPurchaseValue,
      attributedValue: totalPurchaseValue * DOOH_ATTRIBUTION_WEIGHTS.purchase,
      eventBreakdown: {
        impression: totalImpressions,
        qrScan: totalScans,
        visit: totalVisits,
        purchase: totalPurchases
      },
      screenBreakdown: screenSummaries,
      conversionFunnel: {
        impressions: totalImpressions,
        scans: totalScans,
        visits: totalVisits,
        purchases: totalPurchases,
        rates: {
          scanRate: totalImpressions > 0 ? (totalScans / totalImpressions) * 100 : 0,
          visitRate: totalScans > 0 ? (totalVisits / totalScans) * 100 : 0,
          purchaseRate: totalVisits > 0 ? (totalPurchases / totalVisits) * 100 : 0
        }
      }
    };
  }

  /**
   * Get all screens for a campaign
   */
  private async getCampaignScreens(campaignId: string): Promise<string[]> {
    const key = `${REDIS_PREFIX}campaign:${campaignId}:screens`;
    const screens = await redis.smembers(key);
    return Array.from(screens);
  }

  /**
   * Get campaign attribution window hours
   */
  private async getCampaignWindowHours(campaignId: string): Promise<number> {
    const key = `${REDIS_PREFIX}campaign:${campaignId}:config`;
    const config = await redis.get(key);
    if (config) {
      const parsed = JSON.parse(config);
      return parsed.attributionWindowHours || DEFAULT_ATTRIBUTION_WINDOW_HOURS;
    }
    return DEFAULT_ATTRIBUTION_WINDOW_HOURS;
  }

  /**
   * Get campaign attribution weights
   */
  private async getCampaignWeights(campaignId: string): Promise<Record<DOOHEventType, number>> {
    const key = `${REDIS_PREFIX}campaign:${campaignId}:config`;
    const config = await redis.get(key);
    if (config) {
      const parsed = JSON.parse(config);
      return getEffectiveWeights(parsed.customWeights);
    }
    return DOOH_ATTRIBUTION_WEIGHTS;
  }

  /**
   * Configure DOOH campaign settings
   */
  async configureCampaign(config: DOOHCampaignConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `${REDIS_PREFIX}campaign:${config.campaignId}:config`;
      await redis.set(key, JSON.stringify(config));

      // Add screens to campaign
      const screensKey = `${REDIS_PREFIX}campaign:${config.campaignId}:screens`;
      for (const screenId of config.screenIds) {
        await redis.sadd(screensKey, screenId);
        // Also track campaign on screen
        const screenCampaignsKey = `${REDIS_PREFIX}screen:${screenId}:campaigns`;
        await redis.sadd(screenCampaignsKey, config.campaignId);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update screen statistics
   */
  private async updateScreenStats(
    screenId: string,
    campaignId: string,
    eventType: DOOHEventType,
    additionalData?: Record<string, any>
  ): Promise<void> {
    const key = screenKey(screenId, campaignId);

    // Increment event count
    await redis.hincrby(key, eventType === 'qrScan' ? 'scans' : `${eventType}s`, 1);

    // Track unique users if available
    if (additionalData?.userId) {
      await redis.sadd(`${key}:users`, additionalData.userId);
      await redis.expire(`${key}:users`, TTL_SECONDS);
    }

    // Track additional metrics
    if (eventType === 'impression' && additionalData) {
      if (additionalData.durationViewed) {
        await redis.hincrbyfloat(key, 'totalDuration', additionalData.durationViewed);
      }
      if (additionalData.audienceCount) {
        await redis.hincrbyfloat(key, 'totalAudience', additionalData.audienceCount);
      }
    }

    if (eventType === 'qrScan' && additionalData?.impressionToScanTime) {
      await redis.hincrbyfloat(key, 'totalScanTime', additionalData.impressionToScanTime);
    }

    if (eventType === 'purchase' && additionalData?.purchaseValue) {
      await redis.hincrbyfloat(key, 'totalPurchaseValue', additionalData.purchaseValue);
    }

    await redis.expire(key, TTL_SECONDS);

    // Update campaign stats
    const campaignKey = campaignDoohKey(campaignId);
    await redis.hincrby(campaignKey, 'totalEvents', 1);
    await redis.expire(campaignKey, TTL_SECONDS);
  }

  /**
   * Query attribution data with filters
   */
  async queryAttribution(query: DOOHAttributionQuery): Promise<DOOHAttribution[]> {
    const results: DOOHAttribution[] = [];

    if (query.screenId && query.campaignId) {
      // Get specific journey
      const journey = await this.getUserJourney(
        query.userId || '',
        query.screenId,
        query.campaignId
      );
      if (journey) results.push(journey);
    } else if (query.campaignId) {
      // Get all journeys for campaign
      const journeys = await this.getCampaignJourneys(query.campaignId);
      results.push(...journeys);
    } else if (query.screenId) {
      // Get all journeys for screen
      const journeys = await this.getScreenJourneys(query.screenId);
      results.push(...journeys);
    }

    return results;
  }

  /**
   * Get all journeys for a campaign
   */
  private async getCampaignJourneys(campaignId: string): Promise<DOOHAttribution[]> {
    const journeys: DOOHAttribution[] = [];
    const pattern = `${REDIS_PREFIX}journey:*:${campaignId}`;
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          journeys.push({
            screenId: parsed.screenId,
            campaignId: parsed.campaignId,
            impressionTime: parsed.impressionTime ? new Date(parsed.impressionTime) : undefined,
            scanTime: parsed.scanTime ? new Date(parsed.scanTime) : undefined,
            visitTime: parsed.visitTime ? new Date(parsed.visitTime) : undefined,
            purchaseTime: parsed.purchaseTime ? new Date(parsed.purchaseTime) : undefined,
            attributionWeight: parsed.attributionWeight || 0
          });
        }
      }
    } while (cursor !== '0');

    return journeys;
  }

  /**
   * Get all journeys for a screen
   */
  private async getScreenJourneys(screenId: string): Promise<DOOHAttribution[]> {
    const journeys: DOOHAttribution[] = [];
    const pattern = `${REDIS_PREFIX}journey:*:${screenId}:*`;
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          journeys.push({
            screenId: parsed.screenId,
            campaignId: parsed.campaignId,
            impressionTime: parsed.impressionTime ? new Date(parsed.impressionTime) : undefined,
            scanTime: parsed.scanTime ? new Date(parsed.scanTime) : undefined,
            visitTime: parsed.visitTime ? new Date(parsed.visitTime) : undefined,
            purchaseTime: parsed.purchaseTime ? new Date(parsed.purchaseTime) : undefined,
            attributionWeight: parsed.attributionWeight || 0
          });
        }
      }
    } while (cursor !== '0');

    return journeys;
  }

  /**
   * Clear expired data (cleanup job)
   */
  async clearExpiredData(): Promise<{ cleared: number }> {
    let cleared = 0;
    const patterns = [
      `${REDIS_PREFIX}impression:*`,
      `${REDIS_PREFIX}scan:*`,
      `${REDIS_PREFIX}visit:*`,
      `${REDIS_PREFIX}purchase:*`
    ];

    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;

        for (const key of keys) {
          const ttl = await redis.ttl(key);
          if (ttl <= 0) {
            await redis.del(key);
            cleared++;
          }
        }
      } while (cursor !== '0');
    }

    return { cleared };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const doohAttributionTracker = new DOOHAttributionTracker();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick track impression
 */
export async function trackDOOHImpression(
  screenId: string,
  campaignId: string,
  durationViewed: number,
  audienceCount: number,
  metadata?: Record<string, any>
): Promise<{ success: boolean; impressionId?: string; error?: string }> {
  return doohAttributionTracker.trackImpression({
    screenId,
    campaignId,
    timestamp: new Date(),
    durationViewed,
    audienceCount,
    metadata
  });
}

/**
 * Quick track QR scan
 */
export async function trackDOOHQRScan(
  screenId: string,
  campaignId: string,
  qrCode: string,
  userId?: string,
  deviceInfo?: { userAgent?: string; ip?: string; isMobile: boolean }
): Promise<{ success: boolean; scanId?: string; attributedImpression?: DOOHAttribution; error?: string }> {
  return doohAttributionTracker.trackQRScan({
    screenId,
    campaignId,
    qrCode,
    userId,
    scanTime: new Date(),
    deviceInfo
  });
}

/**
 * Quick track visit from DOOH
 */
export async function trackDOOHVisit(
  screenId: string,
  campaignId: string,
  userId: string,
  source: 'qr_scan' | 'deeplink' | 'manual' = 'qr_scan'
): Promise<{ success: boolean; visitId?: string; attribution?: DOOHAttributionResult; error?: string }> {
  return doohAttributionTracker.trackVisit({
    screenId,
    campaignId,
    userId,
    visitTime: new Date(),
    source
  });
}

/**
 * Quick track purchase from DOOH
 */
export async function trackDOOHPurchase(
  screenId: string,
  campaignId: string,
  userId: string,
  purchaseValue: number,
  orderId: string
): Promise<{ success: boolean; purchaseId?: string; attribution?: DOOHAttributionResult[]; error?: string }> {
  return doohAttributionTracker.trackPurchase({
    screenId,
    campaignId,
    userId,
    purchaseTime: new Date(),
    purchaseValue,
    orderId
  });
}

/**
 * Get DOOH attribution summary for a user
 */
export async function getDOOHUserAttribution(
  userId: string,
  screenId: string,
  campaignId: string
): Promise<DOOHAttribution | null> {
  return doohAttributionTracker.getUserJourney(userId, screenId, campaignId);
}

/**
 * Get screen attribution summary
 */
export async function getDOOHScreenSummary(
  screenId: string,
  campaignId?: string
): Promise<DOOHScreenSummary[]> {
  return doohAttributionTracker.getScreenSummary(screenId, campaignId);
}

/**
 * Get campaign attribution summary
 */
export async function getDOOHCampaignSummary(campaignId: string): Promise<DOOHCampaignSummary> {
  return doohAttributionTracker.getCampaignSummary(campaignId);
}

/**
 * Create QR code for DOOH screen
 */
export async function createDOOHQRCode(
  screenId: string,
  campaignId: string
): Promise<QRCodeMapping> {
  return doohAttributionTracker.createQRMapping(screenId, campaignId);
}

/**
 * Resolve QR code to screen attribution
 */
export async function resolveDOOHQRCode(
  qrCode: string
): Promise<{ screenId: string; campaignId: string } | null> {
  return doohAttributionTracker.getScreenFromQR(qrCode);
}

/**
 * Configure DOOH campaign
 */
export async function configureDOOHCampaign(config: DOOHCampaignConfig): Promise<{ success: boolean; error?: string }> {
  return doohAttributionTracker.configureCampaign(config);
}

/**
 * Calculate attribution for a DOOH conversion
 */
export async function attributeDOOHConversion(
  userId: string,
  screenId: string,
  campaignId: string,
  purchaseValue: number,
  model: DOOHAttributionModel = 'time-decay'
): Promise<DOOHAttributionResult[]> {
  return doohAttributionTracker.calculateAttribution(userId, screenId, campaignId, purchaseValue, model);
}
