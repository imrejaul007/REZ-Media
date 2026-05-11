/**
 * DOOH Service - Analytics Engine
 *
 * Handles all analytics and metrics:
 * - Impression tracking
 * - Interaction tracking
 * - Attribution
 * - Campaign performance
 * - Screen performance
 * - Revenue and payouts
 * - AdQR integration
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ImpressionEvent,
  InteractionEvent,
  DOOHAnalytics,
  NetworkAnalytics,
  CampaignPerformance,
  ScreenPerformance,
  AdQRConnection,
  QRGenerationRequest,
  QRGenerationResponse,
  PaymentSummary,
  PayoutRecord,
  Screen,
  ScreenHealth,
  DEFAULT_CPM_RATES,
  ScreenType,
} from '../types';
import { ScreenManagementService } from './screenManagement';

// ============================================================================
// Types
// ============================================================================

interface AnalyticsConfig {
  retention_days: number;
  aggregation_interval_minutes: number;
  fraud_detection_threshold: number;
}

const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  retention_days: 90,
  aggregation_interval_minutes: 5,
  fraud_detection_threshold: 100, // max scans per hour per screen
};

interface QRConnection {
  qr_id: string;
  screen_id: string;
  ad_id: string;
  campaign_id?: string;
  scan_events: QR scan event[];
  conversions: {
    trial_count: number;
    purchase_count: number;
    revenue: number;
  };
  created_at: Date;
  expires_at?: Date;
}

interface QR scan event {
  user_id?: string;
  timestamp: Date;
  location: { lat: number; lng: number };
}

interface AggregatedMetrics {
  screen_id: string;
  period_start: Date;
  period_end: Date;
  impressions: number;
  unique_users: number;
  avg_duration: number;
  interactions: number;
  scans: number;
}

interface FraudAlert {
  screen_id: string;
  alert_type: 'high_scan_rate' | 'suspicious_pattern' | 'bot_activity';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: Date;
}

// ============================================================================
// Analytics Service
// ============================================================================

export class AnalyticsService extends EventEmitter {
  private config: AnalyticsConfig;
  private screenService: ScreenManagementService;

  // Data stores
  private impressions: ImpressionEvent[] = [];
  private interactions: InteractionEvent[] = [];
  private screenAnalytics: Map<string, DOOHAnalytics> = new Map();
  private qrConnections: Map<string, QRConnection> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetrics[]> = new Map();
  private payoutRecords: Map<string, PayoutRecord> = new Map();
  private fraudAlerts: FraudAlert[] = [];

  constructor(
    screenService: ScreenManagementService,
    config?: Partial<AnalyticsConfig>
  ) {
    super();
    this.config = { ...DEFAULT_ANALYTICS_CONFIG, ...config };
    this.screenService = screenService;
  }

  // -------------------------------------------------------------------------
  // Impression Tracking
  // -------------------------------------------------------------------------

  /**
   * Record an impression
   */
  recordImpression(event: Omit<ImpressionEvent, 'timestamp'>): void {
    const impression: ImpressionEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.impressions.push(impression);

    // Update screen analytics
    const analytics = this.getOrCreateScreenAnalytics(event.screen_id);
    analytics.impressions++;
    analytics.unique_views++;
    if (event.duration_played > 0) {
      analytics.avg_view_duration =
        (analytics.avg_view_duration * (analytics.impressions - 1) + event.duration_played) /
        analytics.impressions;
    }

    this.screenAnalytics.set(event.screen_id, analytics);

    // Update screen metrics
    this.screenService.updateScreenMetrics(event.screen_id, { impressions: 1 });

    this.emit('impressionRecorded', impression);
  }

  /**
   * Record multiple impressions (batch)
   */
  recordImpressions(events: Omit<ImpressionEvent, 'timestamp'>[]): void {
    for (const event of events) {
      this.recordImpression(event);
    }
  }

  // -------------------------------------------------------------------------
  // Interaction Tracking
  // -------------------------------------------------------------------------

  /**
   * Record an interaction
   */
  recordInteraction(event: Omit<InteractionEvent, 'timestamp'>): void {
    const interaction: InteractionEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.interactions.push(interaction);

    // Update screen analytics
    const analytics = this.getOrCreateScreenAnalytics(event.screen_id);
    analytics.interactions++;

    // Handle scan specifically
    if (event.type === 'scan') {
      analytics.attribution.scan_count++;

      // Create QR connection if not exists
      this.createQRConnectionIfNeeded(event.screen_id, event.ad_id);

      // Check for fraud
      this.checkFraud(event.screen_id);
    }

    this.screenAnalytics.set(event.screen_id, analytics);

    this.emit('interactionRecorded', interaction);
  }

  // -------------------------------------------------------------------------
  // Conversion Attribution
  // -------------------------------------------------------------------------

  /**
   * Record a conversion (trial or purchase)
   */
  recordConversion(
    screenId: string,
    type: 'trial' | 'purchase',
    revenue?: number
  ): void {
    const analytics = this.getOrCreateScreenAnalytics(screenId);

    if (type === 'trial') {
      analytics.attribution.trial_count++;
    } else if (type === 'purchase') {
      analytics.attribution.purchase_count++;
      if (revenue) {
        analytics.conversions += revenue;
      }
    }

    analytics.last_updated = new Date();
    this.screenAnalytics.set(screenId, analytics);

    this.emit('conversionRecorded', { screenId, type, revenue });
  }

  /**
   * Record a conversion from QR scan
   */
  recordQRConversion(
    qrId: string,
    type: 'trial' | 'purchase',
    revenue?: number
  ): void {
    const connection = this.qrConnections.get(qrId);
    if (!connection) return;

    if (type === 'trial') {
      connection.conversions.trial_count++;
    } else if (type === 'purchase') {
      connection.conversions.purchase_count++;
      if (revenue) {
        connection.conversions.revenue += revenue;
      }
    }

    this.qrConnections.set(qrId, connection);

    this.emit('qrConversionRecorded', { qrId, type, revenue });
  }

  // -------------------------------------------------------------------------
  // Screen Analytics
  // -------------------------------------------------------------------------

  /**
   * Get analytics for a screen
   */
  getScreenAnalytics(screenId: string): DOOHAnalytics | null {
    return this.screenAnalytics.get(screenId) || null;
  }

  /**
   * Get analytics for a screen over a period
   */
  getScreenAnalyticsForPeriod(
    screenId: string,
    period: 'hour' | 'day' | 'week' | 'month'
  ): DOOHAnalytics {
    const cutoff = this.getCutoffDate(period);

    const filteredImpressions = this.impressions.filter(
      i => i.screen_id === screenId && new Date(i.timestamp) >= cutoff
    );
    const filteredInteractions = this.interactions.filter(
      i => i.screen_id === screenId && new Date(i.timestamp) >= cutoff
    );

    const uniqueUsers = new Set(
      filteredImpressions.filter(i => i.user_id).map(i => i.user_id)
    ).size;

    const totalDuration = filteredImpressions.reduce(
      (sum, i) => sum + i.duration_played,
      0
    );

    const scans = filteredInteractions.filter(i => i.type === 'scan').length;

    return {
      screen_id: screenId,
      impressions: filteredImpressions.length,
      unique_views: uniqueUsers,
      avg_view_duration: filteredImpressions.length > 0 ? totalDuration / filteredImpressions.length : 0,
      interactions: filteredInteractions.length,
      conversions: 0, // Would need attribution logic
      attribution: {
        scan_count: scans,
        trial_count: 0,
        purchase_count: 0,
      },
      last_updated: new Date(),
    };
  }

  /**
   * Get screen performance summary
   */
  getScreenPerformance(screenId: string): ScreenPerformance | null {
    const screen = this.screenService.getScreen(screenId);
    if (!screen) return null;

    const analytics = this.getScreenAnalyticsForPeriod(screenId, 'day');
    const health = this.screenService.getScreenHealth(screenId);
    const todayCutoff = this.getCutoffDate('day');
    const weekCutoff = this.getCutoffDate('week');

    const todayImpressions = this.impressions.filter(
      i => i.screen_id === screenId && new Date(i.timestamp) >= todayCutoff
    ).length;

    const weekImpressions = this.impressions.filter(
      i => i.screen_id === screenId && new Date(i.timestamp) >= weekCutoff
    ).length;

    const todayScans = this.interactions.filter(
      i => i.screen_id === screenId && i.type === 'scan' && new Date(i.timestamp) >= todayCutoff
    ).length;

    // Calculate earnings
    const cpm = screen.cpm || DEFAULT_CPM_RATES[screen.type] || 10;
    const earnings = (todayImpressions / 1000) * cpm * 0.8; // 80% to owner

    return {
      screen_id: screenId,
      screen_name: screen.name,
      screen_type: screen.type,
      location: screen.location,
      metrics: {
        impressions_today: todayImpressions,
        impressions_week: weekImpressions,
        scans_today: todayScans,
        earnings_today: earnings,
      },
      health: health || {
        screenId,
        status: 'offline',
        lastHeartbeat: new Date(0),
        uptime: 0,
        errorCount: 0,
        connectionQuality: 'poor',
        bandwidth: 0,
        storageAvailable: 0,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Network Analytics
  // -------------------------------------------------------------------------

  /**
   * Get network-wide analytics
   */
  getNetworkAnalytics(period: 'hour' | 'day' | 'week' | 'month' = 'day'): NetworkAnalytics {
    const screens = this.screenService.getAllScreens();
    const cutoff = this.getCutoffDate(period);

    const filteredImpressions = this.impressions.filter(
      i => new Date(i.timestamp) >= cutoff
    );
    const filteredInteractions = this.interactions.filter(
      i => new Date(i.timestamp) >= cutoff
    );

    const uniqueUsers = new Set(
      filteredImpressions.filter(i => i.user_id).map(i => i.user_id)
    ).size;

    const scans = filteredInteractions.filter(i => i.type === 'scan').length;

    const activeScreens = screens.filter(s => s.status === 'active').length;

    const totalImpressions = filteredImpressions.length;
    const totalInteractions = filteredInteractions.length;
    const engagementRate = totalImpressions > 0 ? totalInteractions / totalImpressions : 0;
    const scanRate = totalImpressions > 0 ? scans / totalImpressions : 0;

    return {
      total_screens: screens.length,
      active_screens: activeScreens,
      total_impressions: totalImpressions,
      total_interactions: totalInteractions,
      total_conversions: 0,
      avg_engagement_rate: engagementRate,
      scan_rate: scanRate,
      visit_rate: 0,
      purchase_rate: 0,
      total_revenue: 0,
      period,
    };
  }

  // -------------------------------------------------------------------------
  // Campaign Performance
  // -------------------------------------------------------------------------

  /**
   * Get campaign performance
   */
  getCampaignPerformance(campaignId: string): CampaignPerformance | null {
    // Get impressions and interactions for this campaign
    const campaignImpressions = this.impressions.filter(i => i.campaign_id === campaignId);
    const campaignInteractions = this.interactions.filter(
      i => this.findAdById(i.ad_id)?.campaign_id === campaignId
    );

    if (campaignImpressions.length === 0 && campaignInteractions.length === 0) {
      return null;
    }

    const scans = campaignInteractions.filter(i => i.type === 'scan').length;
    const uniqueUsers = new Set(
      campaignImpressions.filter(i => i.user_id).map(i => i.user_id)
    ).size;

    const totalDuration = campaignImpressions.reduce(
      (sum, i) => sum + i.duration_played,
      0
    );

    return {
      campaign_id: campaignId,
      campaign_name: 'Campaign', // Would be fetched from campaign service
      status: 'active',
      metrics: {
        impressions: campaignImpressions.length,
        unique_impressions: uniqueUsers,
        avg_view_duration: campaignImpressions.length > 0 ? totalDuration / campaignImpressions.length : 0,
        interactions: campaignInteractions.length,
        scans,
        visits: 0,
        purchases: 0,
        revenue: 0,
        scan_rate: campaignImpressions.length > 0 ? scans / campaignImpressions.length : 0,
        visit_rate: 0,
        purchase_rate: 0,
        total_spent: 0,
        cpm_actual: 0,
        cpc_actual: 0,
        cpu_actual: 0,
        cpp_actual: 0,
        last_updated: new Date(),
      },
      roi: {
        roas: 0,
        cpp: 0,
        cpv: 0,
        confidence: 0,
        data_points: campaignImpressions.length,
        used_fallback: true,
        breakdown: {
          scans,
          expected_visits: 0,
          expected_purchases: 0,
          expected_revenue: 0,
          total_cost: 0,
        },
      },
      spend_progress: 0,
      time_remaining: 0,
    };
  }

  // -------------------------------------------------------------------------
  // QR / AdQR Integration
  // -------------------------------------------------------------------------

  /**
   * Generate a QR code for an ad
   */
  generateQR(request: QRGenerationRequest): QRGenerationResponse {
    const qrId = `qr_${uuidv4()}`;
    const shortCode = this.generateShortCode();

    const connection: QRConnection = {
      qr_id: qrId,
      screen_id: request.screen_id,
      ad_id: request.ad_id,
      campaign_id: request.campaign_id,
      scan_events: [],
      conversions: {
        trial_count: 0,
        purchase_count: 0,
        revenue: 0,
      },
      created_at: new Date(),
      expires_at: request.expires_at,
    };

    this.qrConnections.set(qrId, connection);

    // Generate QR URL
    const baseUrl = process.env.DOOH_QR_BASE_URL || 'https://dooh.rezapp.com/qr';
    const url = `${baseUrl}/${shortCode}`;

    this.emit('qrGenerated', { qrId, shortCode, url });

    return {
      qr_id: qrId,
      url,
      short_code: shortCode,
      expires_at: request.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  /**
   * Record QR scan
   */
  recordQRScan(
    qrId: string,
    userId?: string,
    location?: { lat: number; lng: number }
  ): void {
    const connection = this.qrConnections.get(qrId);
    if (!connection) return;

    const event: QR scan event = {
      user_id: userId,
      timestamp: new Date(),
      location: location || { lat: 0, lng: 0 },
    };

    connection.scan_events.push(event);
    this.qrConnections.set(qrId, connection);

    // Record as interaction on the screen
    this.recordInteraction({
      screen_id: connection.screen_id,
      ad_id: connection.ad_id,
      user_id: userId,
      type: 'scan',
      metadata: { qr_id: qrId },
    });

    this.emit('qrScanRecorded', { qrId, userId });
  }

  /**
   * Get QR connection details
   */
  getQRConnection(qrId: string): AdQRConnection | null {
    const connection = this.qrConnections.get(qrId);
    if (!connection) return null;

    return {
      qr_id: connection.qr_id,
      screen_id: connection.screen_id,
      ad_id: connection.ad_id,
      campaign_id: connection.campaign_id,
      scan_events: connection.scan_events,
      conversions: connection.conversions,
    };
  }

  /**
   * Get QR analytics
   */
  getQRAnalytics(qrId: string): {
    total_scans: number;
    unique_users: number;
    trial_conversions: number;
    purchase_conversions: number;
    revenue: number;
    conversion_rate: number;
  } | null {
    const connection = this.qrConnections.get(qrId);
    if (!connection) return null;

    const uniqueUsers = new Set(
      connection.scan_events.filter(e => e.user_id).map(e => e.user_id)
    ).size;

    const totalScans = connection.scan_events.length;
    const conversions = connection.conversions.trial_count + connection.conversions.purchase_count;

    return {
      total_scans: totalScans,
      unique_users: uniqueUsers,
      trial_conversions: connection.conversions.trial_count,
      purchase_conversions: connection.conversions.purchase_count,
      revenue: connection.conversions.revenue,
      conversion_rate: totalScans > 0 ? conversions / totalScans : 0,
    };
  }

  // -------------------------------------------------------------------------
  // Revenue & Payouts
  // -------------------------------------------------------------------------

  /**
   * Calculate earnings for a screen
   */
  calculateEarnings(screenId: string): PaymentSummary {
    const screen = this.screenService.getScreen(screenId);
    if (!screen) {
      return {
        screen_id: screenId,
        impressions: 0,
        gross_revenue: 0,
        platform_fee: 0,
        owner_amount: 0,
      };
    }

    const cpm = screen.cpm || DEFAULT_CPM_RATES[screen.type] || 10;
    const impressions = screen.total_impressions || 0;
    const grossRevenue = (impressions / 1000) * cpm;
    const platformFee = grossRevenue * 0.2; // 20% platform fee
    const ownerAmount = grossRevenue - platformFee;

    return {
      screen_id: screenId,
      impressions,
      gross_revenue: Math.round(grossRevenue * 100) / 100,
      platform_fee: Math.round(platformFee * 100) / 100,
      owner_amount: Math.round(ownerAmount * 100) / 100,
    };
  }

  /**
   * Get payout record
   */
  getPayoutRecord(payoutId: string): PayoutRecord | null {
    return this.payoutRecords.get(payoutId) || null;
  }

  /**
   * Get payout history for owner
   */
  getPayoutHistory(ownerId: string): PayoutRecord[] {
    const screens = this.screenService.getScreensByOwner(ownerId);
    const screenIds = new Set(screens.map(s => s.id));

    return Array.from(this.payoutRecords.values()).filter(p => screenIds.has(p.screen_id));
  }

  // -------------------------------------------------------------------------
  // Fraud Detection
  // -------------------------------------------------------------------------

  /**
   * Check for fraud patterns
   */
  private checkFraud(screenId: string): void {
    const cutoff = this.getCutoffDate('hour');
    const recentScans = this.interactions.filter(
      i => i.screen_id === screenId && i.type === 'scan' && new Date(i.timestamp) >= cutoff
    ).length;

    if (recentScans > this.config.fraud_detection_threshold) {
      const alert: FraudAlert = {
        screen_id: screenId,
        alert_type: 'high_scan_rate',
        severity: recentScans > this.config.fraud_detection_threshold * 2 ? 'high' : 'medium',
        message: `High scan rate detected: ${recentScans} scans in the last hour`,
        timestamp: new Date(),
      };

      this.fraudAlerts.push(alert);
      this.emit('fraudAlert', alert);
    }
  }

  /**
   * Get fraud alerts
   */
  getFraudAlerts(screenId?: string, limit: number = 100): FraudAlert[] {
    let alerts = this.fraudAlerts;

    if (screenId) {
      alerts = alerts.filter(a => a.screen_id === screenId);
    }

    return alerts.slice(-limit);
  }

  // -------------------------------------------------------------------------
  // Data Management
  // -------------------------------------------------------------------------

  /**
   * Get cutoff date for period
   */
  private getCutoffDate(period: 'hour' | 'day' | 'week' | 'month'): Date {
    const now = new Date();
    const cutoffs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now.getTime() - cutoffs[period]);
  }

  /**
   * Clean up old data
   */
  cleanup(retentionDays?: number): number {
    const days = retentionDays || this.config.retention_days;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const beforeImpressions = this.impressions.length;
    const beforeInteractions = this.interactions.length;

    this.impressions = this.impressions.filter(i => new Date(i.timestamp) >= cutoff);
    this.interactions = this.interactions.filter(i => new Date(i.timestamp) >= cutoff);

    // Clean expired QR connections
    const expiredQRs: string[] = [];
    for (const [qrId, connection] of this.qrConnections) {
      if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
        expiredQRs.push(qrId);
      }
    }
    expiredQRs.forEach(qrId => this.qrConnections.delete(qrId));

    // Clean old fraud alerts
    this.fraudAlerts = this.fraudAlerts.filter(
      a => new Date(a.timestamp) >= cutoff
    );

    const removedImpressions = beforeImpressions - this.impressions.length;
    const removedInteractions = beforeInteractions - this.interactions.length;

    this.emit('cleanupCompleted', {
      removed_impressions: removedImpressions,
      removed_interactions: removedInteractions,
      removed_qrs: expiredQRs.length,
    });

    return removedImpressions + removedInteractions;
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private getOrCreateScreenAnalytics(screenId: string): DOOHAnalytics {
    let analytics = this.screenAnalytics.get(screenId);
    if (!analytics) {
      analytics = {
        screen_id: screenId,
        impressions: 0,
        unique_views: 0,
        avg_view_duration: 0,
        interactions: 0,
        conversions: 0,
        attribution: {
          scan_count: 0,
          trial_count: 0,
          purchase_count: 0,
        },
        last_updated: new Date(),
      };
      this.screenAnalytics.set(screenId, analytics);
    }
    return analytics;
  }

  private createQRConnectionIfNeeded(screenId: string, adId: string): void {
    // Check if there's already an active QR for this screen/ad
    for (const connection of this.qrConnections.values()) {
      if (
        connection.screen_id === screenId &&
        connection.ad_id === adId &&
        (!connection.expires_at || new Date(connection.expires_at) > new Date())
      ) {
        return; // Already exists
      }
    }

    // Generate new QR
    this.generateQR({
      screen_id: screenId,
      ad_id: adId,
    });
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private findAdById(adId: string): { campaign_id?: string } | undefined {
    // This would normally look up the ad in the ad store
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get analytics statistics
   */
  getStats(): {
    total_impressions: number;
    total_interactions: number;
    total_screens_tracked: number;
    total_qr_codes: number;
    fraud_alerts: number;
  } {
    return {
      total_impressions: this.impressions.length,
      total_interactions: this.interactions.length,
      total_screens_tracked: this.screenAnalytics.size,
      total_qr_codes: this.qrConnections.size,
      fraud_alerts: this.fraudAlerts.length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: AnalyticsService | null = null;

export function createAnalyticsService(
  screenService: ScreenManagementService,
  config?: Partial<AnalyticsConfig>
): AnalyticsService {
  serviceInstance = new AnalyticsService(screenService, config);
  return serviceInstance;
}

export function getAnalyticsService(): AnalyticsService | null {
  return serviceInstance;
}
