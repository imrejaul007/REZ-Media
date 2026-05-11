/**
 * DOOH QR CODE INTEGRATION
 * Phase 5: Dynamic QR generation for Digital Out-of-Home screens
 * Track scans from screens with impression → scan attribution
 */

import Redis from 'ioredis';
import { createHash, randomBytes } from 'crypto';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// CONSTANTS
// ============================================

const REDIS_PREFIX = 'dooh:qr:';
const SHORT_URL_PREFIX = process.env.SHORT_URL_PREFIX || 'https://rez.app/';
const QR_CODE_SIZE = 300; // Default QR code size in pixels
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days TTL for QR data

// QR template configurations
export interface QRTemplateConfig {
  name: QRType;
  size: number;
  margin: number;
  backgroundColor: string;
  foregroundColor: string;
  position: string;
  overlay: boolean;
}

export const QR_TEMPLATES: Record<QRType, QRTemplateConfig> = {
  full: {
    name: 'full',
    size: 300,
    margin: 10,
    backgroundColor: '#FFFFFF',
    foregroundColor: '#000000',
    position: 'center',
    overlay: false
  },
  corner: {
    name: 'corner',
    size: 100,
    margin: 20,
    backgroundColor: 'transparent',
    foregroundColor: '#FFFFFF',
    position: 'bottom-right',
    overlay: true
  },
  inline: {
    name: 'inline',
    size: 200,
    margin: 15,
    backgroundColor: '#FFFFFF',
    foregroundColor: '#1a1a2e',
    position: 'center',
    overlay: false
  }
};

// ============================================
// INTERFACES
// ============================================

export type QRType = 'full' | 'corner' | 'inline';
export type QRStatus = 'active' | 'paused' | 'expired' | 'deleted';

export interface DOOHQR {
  id: string;
  screenId: string;
  campaignId: string;
  url: string;
  shortCode: string;
  type: QRType;
  dynamic: boolean;
  impressions: number;
  scans: number;
  scanRate: number;
  createdAt: Date;
  expiresAt: Date;
  status: QRStatus;
  metadata?: QRMMetadata;
}

export interface QRMMetadata {
  location?: {
    lat: number;
    lng: number;
    address?: string;
    venue?: string;
  };
  timeContext?: {
    dayPart: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: number;
  };
  content?: {
    template: string;
    headline?: string;
    cta?: string;
  };
  targetAudience?: string[];
}

export interface QRGenerationRequest {
  screenId: string;
  campaignId: string;
  type: QRType;
  dynamic: boolean;
  landingUrl: string;
  expiresAt?: Date;
  metadata?: QRMMetadata;
}

export interface QRCodePayload {
  qr: DOOHQR;
  qrCodeDataUrl: string;
  qrCodeSvg?: string;
  shortUrl: string;
}

export interface ScanEvent {
  id: string;
  qrId: string;
  screenId: string;
  campaignId: string;
  userId?: string;
  timestamp: Date;
  userAgent?: string;
  ipHash?: string;
  location?: {
    lat: number;
    lng: number;
  };
  referrer?: string;
  metadata?: Record<string, any>;
}

export interface ScreenPerformance {
  screenId: string;
  totalQRCodes: number;
  activeQRCodes: number;
  totalImpressions: number;
  totalScans: number;
  overallScanRate: number;
  avgScanRate: number;
  peakScanHour: number;
  performanceTrend: 'improving' | 'stable' | 'declining';
  qrBreakdown: QRPerformance[];
}

export interface QRPerformance {
  qrId: string;
  type: QRType;
  impressions: number;
  scans: number;
  scanRate: number;
  createdAt: Date;
  lastScanAt: Date | null;
}

export interface ImpressionEvent {
  screenId: string;
  qrId: string;
  timestamp: Date;
  count: number;
  metadata?: Record<string, any>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique QR ID
 */
function generateQRId(): string {
  return `qr_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

/**
 * Generate short code for URL
 */
function generateShortCode(screenId: string, campaignId: string): string {
  const input = `${screenId}:${campaignId}:${Date.now()}:${randomBytes(4).toString('hex')}`;
  const hash = createHash('sha256').update(input).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Generate Redis key for QR data
 */
function qrKey(qrId: string): string {
  return `${REDIS_PREFIX}data:${qrId}`;
}

/**
 * Generate Redis key for screen QR list
 */
function screenQRsKey(screenId: string): string {
  return `${REDIS_PREFIX}screen:${screenId}:qrs`;
}

/**
 * Generate Redis key for campaign QR list
 */
function campaignQRsKey(campaignId: string): string {
  return `${REDIS_PREFIX}campaign:${campaignId}:qrs`;
}

/**
 * Generate Redis key for scan events
 */
function scanEventsKey(qrId: string): string {
  return `${REDIS_PREFIX}scans:${qrId}:events`;
}

/**
 * Generate Redis key for impression tracking
 */
function impressionsKey(qrId: string): string {
  return `${REDIS_PREFIX}impressions:${qrId}`;
}

/**
 * Generate Redis key for screen analytics
 */
function screenAnalyticsKey(screenId: string): string {
  return `${REDIS_PREFIX}analytics:screen:${screenId}`;
}

/**
 * Calculate scan rate
 */
function calculateScanRate(impressions: number, scans: number): number {
  if (impressions === 0) return 0;
  return Math.round((scans / impressions) * 10000) / 100; // Percentage with 2 decimals
}

/**
 * Determine time context for dynamic QR content
 */
function getTimeContext(date: Date = new Date()): { dayPart: string; dayOfWeek: number } {
  const hour = date.getHours();
  let dayPart: 'morning' | 'afternoon' | 'evening' | 'night';

  if (hour >= 5 && hour < 12) dayPart = 'morning';
  else if (hour >= 12 && hour < 17) dayPart = 'afternoon';
  else if (hour >= 17 && hour < 22) dayPart = 'evening';
  else dayPart = 'night';

  return {
    dayPart,
    dayOfWeek: date.getDay()
  };
}

/**
 * Build dynamic URL with time/location context
 */
function buildDynamicUrl(baseUrl: string, metadata?: QRMMetadata): string {
  const timeContext = getTimeContext();
  const params = new URLSearchParams();

  params.set('src', 'dooh');
  params.set('t', timeContext.dayPart);

  if (metadata?.location?.lat && metadata?.location?.lng) {
    params.set('lat', metadata.location.lat.toString());
    params.set('lng', metadata.location.lng.toString());
  }

  if (metadata?.content?.headline) {
    params.set('h', metadata.content.headline);
  }

  // Add timestamp for cache-busting
  params.set('ts', Date.now().toString());

  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${params.toString()}`;
}

// ============================================
// QR GENERATION ENGINE
// ============================================

export class QRGenerationEngine {

  /**
   * Generate a new QR code for a DOOH screen
   */
  async generateQR(request: QRGenerationRequest): Promise<QRCodePayload> {
    const { screenId, campaignId, type, dynamic, landingUrl, expiresAt, metadata } = request;

    // Generate unique identifiers
    const id = generateQRId();
    const shortCode = generateShortCode(screenId, campaignId);
    const shortUrl = `${SHORT_URL_PREFIX}${shortCode}`;

    // Determine expiration
    const expiration = expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days default

    // Build dynamic URL if needed
    const finalUrl = dynamic ? buildDynamicUrl(landingUrl, metadata) : landingUrl;

    // Create QR data object
    const qrData: DOOHQR = {
      id,
      screenId,
      campaignId,
      url: finalUrl,
      shortCode,
      type,
      dynamic,
      impressions: 0,
      scans: 0,
      scanRate: 0,
      createdAt: new Date(),
      expiresAt: expiration,
      status: 'active',
      metadata
    };

    // Store in Redis
    await this.storeQRData(qrData);

    // Add to screen's QR list
    await redis.zadd(screenQRsKey(screenId), Date.now(), id);

    // Add to campaign's QR list
    await redis.zadd(campaignQRsKey(campaignId), Date.now(), id);

    // Generate QR code image (returns data URL)
    const qrCodeDataUrl = await this.generateQRCodeImage(shortUrl, type);

    return {
      qr: qrData,
      qrCodeDataUrl,
      shortUrl
    };
  }

  /**
   * Generate QR code image as data URL
   */
  private async generateQRCodeImage(url: string, type: QRType): Promise<string> {
    const template = QR_TEMPLATES[type];

    // In production, this would use a QR library like 'qrcode'
    // For now, return a placeholder data URL
    // The actual implementation would generate a real QR code:
    // const QRCode = require('qrcode');
    // return await QRCode.toDataURL(url, { width: template.size, margin: template.margin });

    // Placeholder - in production replace with actual QR generation
    const svg = this.generatePlaceholderSVG(url, template);
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  /**
   * Generate placeholder SVG for QR code
   */
  private generatePlaceholderSVG(url: string, template: QRTemplateConfig): string {
    // This is a placeholder SVG. In production, use a proper QR library.
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${template.size}" height="${template.size}" viewBox="0 0 ${template.size} ${template.size}">
      <rect width="100%" height="100%" fill="${template.backgroundColor}"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="${template.foregroundColor}">
        QR: ${url.substring(0, 20)}...
      </text>
    </svg>`;
  }

  /**
   * Store QR data in Redis
   */
  protected async storeQRData(qr: DOOHQR): Promise<void> {
    const key = qrKey(qr.id);
    await redis.setex(key, TTL_SECONDS, JSON.stringify(qr));
  }

  /**
   * Public method to update QR data
   */
  async updateQRData(qr: DOOHQR): Promise<void> {
    return this.storeQRData(qr);
  }

  /**
   * Get QR by ID
   */
  async getQRById(qrId: string): Promise<DOOHQR | null> {
    const key = qrKey(qrId);
    const data = await redis.get(key);

    if (!data) return null;

    const qr = JSON.parse(data);
    return {
      ...qr,
      createdAt: new Date(qr.createdAt),
      expiresAt: new Date(qr.expiresAt)
    };
  }

  /**
   * Get QR by short code
   */
  async getQRByShortCode(shortCode: string): Promise<DOOHQR | null> {
    // Scan for matching short code
    const pattern = `${REDIS_PREFIX}data:*`;
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const qr: DOOHQR = JSON.parse(data);
          if (qr.shortCode === shortCode) {
            return {
              ...qr,
              createdAt: new Date(qr.createdAt),
              expiresAt: new Date(qr.expiresAt)
            };
          }
        }
      }
    } while (cursor !== '0');

    return null;
  }

  /**
   * Get all QR codes for a screen
   */
  async getScreenQRCodes(screenId: string, includeExpired: boolean = false): Promise<DOOHQR[]> {
    const key = screenQRsKey(screenId);
    const qrIds = await redis.zrange(key, 0, -1);

    const qrs: DOOHQR[] = [];
    const now = Date.now();

    for (const qrId of qrIds) {
      const qr = await this.getQRById(qrId);
      if (qr) {
        // Filter expired if needed
        if (!includeExpired && qr.expiresAt.getTime() < now) {
          continue;
        }
        qrs.push(qr);
      }
    }

    return qrs;
  }

  /**
   * Update QR status
   */
  async updateQRStatus(qrId: string, status: QRStatus): Promise<boolean> {
    const qr = await this.getQRById(qrId);
    if (!qr) return false;

    qr.status = status;
    await this.storeQRData(qr);
    return true;
  }

  /**
   * Regenerate dynamic QR with updated content
   */
  async regenerateDynamicQR(qrId: string): Promise<QRCodePayload | null> {
    const qr = await this.getQRById(qrId);
    if (!qr || !qr.dynamic) return null;

    // Update the dynamic URL with fresh time context
    qr.url = buildDynamicUrl(qr.url.split('?')[0], qr.metadata); // Strip old params, rebuild
    await this.storeQRData(qr);

    const qrCodeDataUrl = await this.generateQRCodeImage(qr.url, qr.type);

    return {
      qr,
      qrCodeDataUrl,
      shortUrl: `${SHORT_URL_PREFIX}${qr.shortCode}`
    };
  }

  /**
   * Delete QR code
   */
  async deleteQR(qrId: string): Promise<boolean> {
    const qr = await this.getQRById(qrId);
    if (!qr) return false;

    // Mark as deleted instead of removing
    qr.status = 'deleted';
    await this.storeQRData(qr);

    return true;
  }
}

// ============================================
// SCAN TRACKING ENGINE
// ============================================

export class ScanTrackingEngine {

  /**
   * Record a QR scan event
   */
  async recordScan(
    shortCode: string,
    scanData: Partial<ScanEvent> = {}
  ): Promise<{ success: boolean; scanEvent?: ScanEvent; qr?: DOOHQR; error?: string }> {
    // Find the QR by short code
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRByShortCode(shortCode);

    if (!qr) {
      return { success: false, error: 'QR code not found' };
    }

    if (qr.status !== 'active') {
      return { success: false, error: `QR code is ${qr.status}` };
    }

    if (qr.expiresAt < new Date()) {
      return { success: false, error: 'QR code has expired' };
    }

    // Create scan event
    const scanEvent: ScanEvent = {
      id: `scan_${Date.now()}_${randomBytes(4).toString('hex')}`,
      qrId: qr.id,
      screenId: qr.screenId,
      campaignId: qr.campaignId,
      userId: scanData.userId,
      timestamp: new Date(),
      userAgent: scanData.userAgent,
      ipHash: scanData.ipHash,
      location: scanData.location,
      referrer: scanData.referrer,
      metadata: scanData.metadata
    };

    // Store scan event
    await this.storeScanEvent(scanEvent);

    // Update QR scan count
    await this.updateQRScanCount(qr.id);

    // Update screen analytics
    await this.updateScreenAnalytics(qr.screenId, 'scan');

    return {
      success: true,
      scanEvent,
      qr
    };
  }

  /**
   * Store scan event in Redis
   */
  private async storeScanEvent(event: ScanEvent): Promise<void> {
    const key = scanEventsKey(event.qrId);
    await redis.zadd(key, event.timestamp.getTime(), JSON.stringify(event));
    await redis.expire(key, TTL_SECONDS);
  }

  /**
   * Update QR scan count and rate
   */
  private async updateQRScanCount(qrId: string): Promise<void> {
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRById(qrId);

    if (qr) {
      qr.scans++;
      qr.scanRate = calculateScanRate(qr.impressions, qr.scans);
      await qrEngine.updateQRData(qr);
    }
  }

  /**
   * Update screen analytics
   */
  private async updateScreenAnalytics(screenId: string, eventType: 'scan' | 'impression'): Promise<void> {
    const key = screenAnalyticsKey(screenId);
    const hour = new Date().getHours();

    await redis.hincrby(key, `total${eventType === 'scan' ? 'Scans' : 'Impressions'}`, 1);
    await redis.hincrby(key, `hour${hour}${eventType === 'scan' ? 'Scans' : 'Impressions'}`, 1);
    await redis.hincrby(key, 'lastActivity', Date.now());
    await redis.expire(key, TTL_SECONDS);
  }

  /**
   * Get scan events for a QR
   */
  async getScanEvents(
    qrId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ScanEvent[]> {
    const key = scanEventsKey(qrId);
    const minScore = startDate ? startDate.getTime() : '-inf';
    const maxScore = endDate ? endDate.getTime() : '+inf';

    const eventStrings = await redis.zrangebyscore(key, minScore, maxScore);

    return eventStrings.map(str => {
      const event = JSON.parse(str);
      return {
        ...event,
        timestamp: new Date(event.timestamp)
      };
    });
  }

  /**
   * Get scan count for a QR
   */
  async getScanCount(qrId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const events = await this.getScanEvents(qrId, startDate, endDate);
    return events.length;
  }

  /**
   * Get unique scanners for a QR
   */
  async getUniqueScanners(qrId: string): Promise<number> {
    const events = await this.getScanEvents(qrId);
    const userIds = new Set(events.filter(e => e.userId).map(e => e.userId));
    return userIds.size;
  }

  /**
   * Get scan events for a user across all QRs
   */
  async getUserScans(userId: string): Promise<ScanEvent[]> {
    const pattern = `${REDIS_PREFIX}scans:*:events`;
    const allScans: ScanEvent[] = [];
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const eventStrings = await redis.zrange(key, 0, -1);
        for (const str of eventStrings) {
          const event = JSON.parse(str);
          if (event.userId === userId) {
            allScans.push({
              ...event,
              timestamp: new Date(event.timestamp)
            });
          }
        }
      }
    } while (cursor !== '0');

    return allScans.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Calculate impression-to-scan conversion rate
   */
  async getConversionMetrics(qrId: string): Promise<{
    impressions: number;
    scans: number;
    scanRate: number;
    uniqueUsers: number;
    peakHour: number;
  }> {
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRById(qrId);

    if (!qr) {
      return {
        impressions: 0,
        scans: 0,
        scanRate: 0,
        uniqueUsers: 0,
        peakHour: 0
      };
    }

    const scans = await this.getScanEvents(qrId);
    const uniqueUsers = await this.getUniqueScanners(qrId);

    // Find peak scan hour
    const hourCounts: Record<number, number> = {};
    for (const scan of scans) {
      const hour = scan.timestamp.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    let peakHour = 0;
    let maxCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    }

    return {
      impressions: qr.impressions,
      scans: qr.scans,
      scanRate: qr.scanRate,
      uniqueUsers,
      peakHour
    };
  }
}

// ============================================
// IMPRESSION TRACKING ENGINE
// ============================================

export class ImpressionTrackingEngine {

  /**
   * Record impressions for a QR code
   * Called when the QR is displayed on screen
   */
  async recordImpressions(
    qrId: string,
    count: number = 1,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; totalImpressions: number }> {
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRById(qrId);

    if (!qr || qr.status !== 'active') {
      return { success: false, totalImpressions: 0 };
    }

    const key = impressionsKey(qrId);
    const now = Date.now();
    const hour = new Date().getHours();

    // Store impression event
    const impressionEvent: ImpressionEvent = {
      screenId: qr.screenId,
      qrId,
      timestamp: new Date(),
      count,
      metadata
    };

    // Add to sorted set for time-series analysis
    await redis.zadd(key, now, JSON.stringify(impressionEvent));
    await redis.expire(key, TTL_SECONDS);

    // Increment impression counter on QR
    qr.impressions++;
    qr.scanRate = calculateScanRate(qr.impressions, qr.scans);
    await qrEngine.updateQRData(qr);

    // Update screen analytics
    const screenKey = screenAnalyticsKey(qr.screenId);
    await redis.hincrby(screenKey, 'totalImpressions', count);
    await redis.hincrby(screenKey, `hour${hour}Impressions`, count);

    return {
      success: true,
      totalImpressions: qr.impressions
    };
  }

  /**
   * Get impression data for a QR
   */
  async getImpressionData(
    qrId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ImpressionEvent[]> {
    const key = impressionsKey(qrId);
    const minScore = startDate ? startDate.getTime() : '-inf';
    const maxScore = endDate ? endDate.getTime() : '+inf';

    const eventStrings = await redis.zrangebyscore(key, minScore, maxScore);

    return eventStrings.map(str => {
      const event = JSON.parse(str);
      return {
        ...event,
        timestamp: new Date(event.timestamp)
      };
    });
  }

  /**
   * Get total impressions for a QR
   */
  async getTotalImpressions(qrId: string): Promise<number> {
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRById(qrId);
    return qr?.impressions || 0;
  }

  /**
   * Get hourly impression distribution for a QR
   */
  async getHourlyDistribution(qrId: string): Promise<Record<number, number>> {
    const impressions = await this.getImpressionData(qrId);
    const distribution: Record<number, number> = {};

    for (let i = 0; i < 24; i++) {
      distribution[i] = 0;
    }

    for (const impression of impressions) {
      const hour = impression.timestamp.getHours();
      distribution[hour] += impression.count;
    }

    return distribution;
  }

  /**
   * Get daily impression totals
   */
  async getDailyTotals(
    qrId: string,
    days: number = 7
  ): Promise<{ date: string; impressions: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const impressions = await this.getImpressionData(qrId, startDate);
    const daily: Record<string, number> = {};

    for (const impression of impressions) {
      const dateStr = impression.timestamp.toISOString().split('T')[0];
      daily[dateStr] = (daily[dateStr] || 0) + impression.count;
    }

    return Object.entries(daily)
      .map(([date, count]) => ({ date, impressions: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// ============================================
// PERFORMANCE ANALYTICS ENGINE
// ============================================

export class PerformanceAnalyticsEngine {

  /**
   * Get performance metrics for a screen
   */
  async getScreenPerformance(screenId: string): Promise<ScreenPerformance> {
    const qrEngine = new QRGenerationEngine();
    const scanEngine = new ScanTrackingEngine();

    const qrs = await qrEngine.getScreenQRCodes(screenId);

    const qrPerformance: QRPerformance[] = [];
    let totalImpressions = 0;
    let totalScans = 0;

    for (const qr of qrs) {
      const lastScan = await scanEngine.getScanEvents(qr.id);
      const lastScanAt = lastScan.length > 0 ? lastScan[0].timestamp : null;

      qrPerformance.push({
        qrId: qr.id,
        type: qr.type,
        impressions: qr.impressions,
        scans: qr.scans,
        scanRate: qr.scanRate,
        createdAt: qr.createdAt,
        lastScanAt
      });

      totalImpressions += qr.impressions;
      totalScans += qr.scans;
    }

    // Calculate peak scan hour
    const screenKey = screenAnalyticsKey(screenId);
    const hourlyScans: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      const count = await redis.hget(screenKey, `hour${i}Scans`);
      hourlyScans[i] = parseInt(count || '0');
    }

    let peakScanHour = 0;
    let maxScans = 0;
    for (const [hour, count] of Object.entries(hourlyScans)) {
      if (count > maxScans) {
        maxScans = count;
        peakScanHour = parseInt(hour);
      }
    }

    // Determine performance trend
    const trend = await this.calculateTrend(screenId, qrs);

    return {
      screenId,
      totalQRCodes: qrs.length,
      activeQRCodes: qrs.filter(q => q.status === 'active').length,
      totalImpressions,
      totalScans,
      overallScanRate: calculateScanRate(totalImpressions, totalScans),
      avgScanRate: qrs.length > 0
        ? qrs.reduce((sum, q) => sum + q.scanRate, 0) / qrs.length
        : 0,
      peakScanHour,
      performanceTrend: trend,
      qrBreakdown: qrPerformance
    };
  }

  /**
   * Calculate performance trend for a screen
   */
  private async calculateTrend(screenId: string, qrs: DOOHQR[]): Promise<'improving' | 'stable' | 'declining'> {
    if (qrs.length < 2) return 'stable';

    // Get recent vs older scan rates
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);
    const older = new Date();
    older.setDate(older.getDate() - 7);

    let recentScans = 0;
    let recentImpressions = 0;
    let olderScans = 0;
    let olderImpressions = 0;

    for (const qr of qrs) {
      if (qr.createdAt > older) {
        recentImpressions += qr.impressions;
        recentScans += qr.scans;
      } else {
        olderImpressions += qr.impressions;
        olderScans += qr.scans;
      }
    }

    const recentRate = calculateScanRate(recentImpressions, recentScans);
    const olderRate = calculateScanRate(olderImpressions, olderScans);

    const diff = recentRate - olderRate;
    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'declining';
    return 'stable';
  }

  /**
   * Compare performance across multiple screens
   */
  async compareScreens(screenIds: string[]): Promise<ScreenPerformance[]> {
    const performances: ScreenPerformance[] = [];
    for (const screenId of screenIds) {
      const perf = await this.getScreenPerformance(screenId);
      performances.push(perf);
    }
    return performances.sort((a, b) => b.overallScanRate - a.overallScanRate);
  }

  /**
   * Get campaign-level QR performance
   */
  async getCampaignPerformance(campaignId: string): Promise<{
    totalQRCodes: number;
    totalImpressions: number;
    totalScans: number;
    overallScanRate: number;
    screenBreakdown: { screenId: string; scans: number; impressions: number }[];
  }> {
    const qrEngine = new QRGenerationEngine();

    // Find all QR codes for this campaign
    const key = campaignQRsKey(campaignId);
    const qrIds = await redis.zrange(key, 0, -1);

    const screenStats: Record<string, { impressions: number; scans: number }> = {};
    let totalImpressions = 0;
    let totalScans = 0;

    for (const qrId of qrIds) {
      const qr = await qrEngine.getQRById(qrId);
      if (qr && qr.status === 'active') {
        totalImpressions += qr.impressions;
        totalScans += qr.scans;

        if (!screenStats[qr.screenId]) {
          screenStats[qr.screenId] = { impressions: 0, scans: 0 };
        }
        screenStats[qr.screenId].impressions += qr.impressions;
        screenStats[qr.screenId].scans += qr.scans;
      }
    }

    return {
      totalQRCodes: qrIds.length,
      totalImpressions,
      totalScans,
      overallScanRate: calculateScanRate(totalImpressions, totalScans),
      screenBreakdown: Object.entries(screenStats).map(([screenId, stats]) => ({
        screenId,
        ...stats
      }))
    };
  }

  /**
   * Get top performing QRs
   */
  async getTopPerformingQRs(limit: number = 10): Promise<QRPerformance[]> {
    const pattern = `${REDIS_PREFIX}data:*`;
    const allQrs: DOOHQR[] = [];
    let cursor = '0';

    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const qr: DOOHQR = JSON.parse(data);
          if (qr.status === 'active' && qr.impressions > 0) {
            allQrs.push({
              ...qr,
              createdAt: new Date(qr.createdAt),
              expiresAt: new Date(qr.expiresAt)
            });
          }
        }
      }
    } while (cursor !== '0');

    // Sort by scan rate
    return allQrs
      .sort((a, b) => b.scanRate - a.scanRate)
      .slice(0, limit)
      .map(qr => ({
        qrId: qr.id,
        type: qr.type,
        impressions: qr.impressions,
        scans: qr.scans,
        scanRate: qr.scanRate,
        createdAt: qr.createdAt,
        lastScanAt: null // Would need to query scan events
      }));
  }
}

// ============================================
// SHORT URL RESOLUTION
// ============================================

export class ShortUrlResolver {

  /**
   * Resolve short URL and redirect to full URL
   * This would typically be handled by an API endpoint
   */
  async resolve(shortCode: string): Promise<{
    found: boolean;
    url?: string;
    qr?: DOOHQR;
  }> {
    const qrEngine = new QRGenerationEngine();
    const qr = await qrEngine.getQRByShortCode(shortCode);

    if (!qr || qr.status !== 'active') {
      return { found: false };
    }

    // Check expiration
    if (qr.expiresAt < new Date()) {
      return { found: false };
    }

    return {
      found: true,
      url: qr.url,
      qr
    };
  }
}

// ============================================
// SINGLETON EXPORTS
// ============================================

export const qrGenerationEngine = new QRGenerationEngine();
export const scanTrackingEngine = new ScanTrackingEngine();
export const impressionTrackingEngine = new ImpressionTrackingEngine();
export const performanceAnalyticsEngine = new PerformanceAnalyticsEngine();
export const shortUrlResolver = new ShortUrlResolver();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create a new QR code for a DOOH screen
 */
export async function createDOOHQR(
  screenId: string,
  campaignId: string,
  landingUrl: string,
  type: QRType = 'full',
  dynamic: boolean = true,
  metadata?: QRMMetadata
): Promise<QRCodePayload> {
  return qrGenerationEngine.generateQR({
    screenId,
    campaignId,
    type,
    dynamic,
    landingUrl,
    metadata
  });
}

/**
 * Record a scan event
 */
export async function recordQRScan(
  shortCode: string,
  userId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; scanEvent?: ScanEvent; error?: string }> {
  const result = await scanTrackingEngine.recordScan(shortCode, { userId, metadata });
  return {
    success: result.success,
    scanEvent: result.scanEvent,
    error: result.error
  };
}

/**
 * Record impressions for a QR
 */
export async function recordQRImpressions(
  qrId: string,
  count: number = 1
): Promise<{ success: boolean; totalImpressions: number }> {
  return impressionTrackingEngine.recordImpressions(qrId, count);
}

/**
 * Get QR performance metrics
 */
export async function getQRPerformance(
  qrId: string
): Promise<{
  impressions: number;
  scans: number;
  scanRate: number;
  uniqueUsers: number;
  peakHour: number;
}> {
  return scanTrackingEngine.getConversionMetrics(qrId);
}

/**
 * Get screen performance
 */
export async function getScreenQRPerformance(
  screenId: string
): Promise<ScreenPerformance> {
  return performanceAnalyticsEngine.getScreenPerformance(screenId);
}

/**
 * Resolve short URL to full URL
 */
export async function resolveShortUrl(
  shortCode: string
): Promise<{ found: boolean; url?: string; qr?: DOOHQR }> {
  return shortUrlResolver.resolve(shortCode);
}

/**
 * Get QR by short code
 */
export async function getQRByShortCode(shortCode: string): Promise<DOOHQR | null> {
  return qrGenerationEngine.getQRByShortCode(shortCode);
}

/**
 * Get all QR codes for a screen
 */
export async function getScreenQRCodes(
  screenId: string,
  includeExpired: boolean = false
): Promise<DOOHQR[]> {
  return qrGenerationEngine.getScreenQRCodes(screenId, includeExpired);
}
