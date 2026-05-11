/**
 * DOOH Service - Analytics Routes
 *
 * Express routes for analytics:
 * - Impression tracking
 * - Interaction tracking
 * - Screen analytics
 * - Campaign analytics
 * - QR code management
 * - Revenue & payouts
 */

import { Router, Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics';
import { ScreenManagementService } from '../services/screenManagement';
import { QRGenerationRequest } from '../types';

export interface AnalyticsRoutesConfig {
  analyticsService: AnalyticsService;
  screenService: ScreenManagementService;
}

export function createAnalyticsRoutes(config: AnalyticsRoutesConfig): Router {
  const router = Router();
  const { analyticsService, screenService } = config;

  // ==========================================================================
  // Impression Tracking
  // ==========================================================================

  /**
   * POST /analytics/impressions
   * Record impression events
   */
  router.post('/impressions', async (req: Request, res: Response) => {
    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No impression events provided',
        });
      }

      for (const event of events) {
        if (!event.screen_id || !event.ad_id) {
          return res.status(400).json({
            success: false,
            error: 'Each event must have screen_id and ad_id',
          });
        }

        analyticsService.recordImpression({
          screen_id: event.screen_id,
          campaign_id: event.campaign_id,
          ad_id: event.ad_id,
          user_id: event.user_id,
          duration_played: event.duration_played || 0,
          viewable: event.viewable ?? true,
          metadata: event.metadata,
        });
      }

      return res.json({
        success: true,
        recorded: events.length,
      });
    } catch (error) {
      console.error('Record impressions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record impressions',
      });
    }
  });

  /**
   * GET /analytics/impressions
   * Get impression summary
   */
  router.get('/impressions', async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';
      const networkAnalytics = analyticsService.getNetworkAnalytics(period);

      return res.json({
        success: true,
        total_impressions: networkAnalytics.total_impressions,
        period,
      });
    } catch (error) {
      console.error('Get impressions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get impressions',
      });
    }
  });

  // ==========================================================================
  // Interaction Tracking
  // ==========================================================================

  /**
   * POST /analytics/interactions
   * Record interaction events
   */
  router.post('/interactions', async (req: Request, res: Response) => {
    try {
      const events = Array.isArray(req.body) ? req.body : [req.body];

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No interaction events provided',
        });
      }

      for (const event of events) {
        if (!event.screen_id || !event.ad_id || !event.type) {
          return res.status(400).json({
            success: false,
            error: 'Each event must have screen_id, ad_id, and type',
          });
        }

        analyticsService.recordInteraction({
          screen_id: event.screen_id,
          ad_id: event.ad_id,
          user_id: event.user_id,
          type: event.type,
          metadata: event.metadata,
        });
      }

      return res.json({
        success: true,
        recorded: events.length,
      });
    } catch (error) {
      console.error('Record interactions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record interactions',
      });
    }
  });

  // ==========================================================================
  // Screen Analytics
  // ==========================================================================

  /**
   * GET /analytics/screens/:id
   * Get analytics for a screen
   */
  router.get('/screens/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';

      const screen = screenService.getScreen(id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      const analytics = analyticsService.getScreenAnalyticsForPeriod(id, period);
      const performance = analyticsService.getScreenPerformance(id);

      return res.json({
        success: true,
        screen_id: id,
        period,
        analytics,
        performance,
      });
    } catch (error) {
      console.error('Get screen analytics error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get screen analytics',
      });
    }
  });

  /**
   * GET /analytics/screens/:id/earnings
   * Get earnings for a screen
   */
  router.get('/screens/:id/earnings', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const screen = screenService.getScreen(id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      const earnings = analyticsService.calculateEarnings(id);

      return res.json({
        success: true,
        screen_id: id,
        ...earnings,
      });
    } catch (error) {
      console.error('Get earnings error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get earnings',
      });
    }
  });

  // ==========================================================================
  // Network Analytics
  // ==========================================================================

  /**
   * GET /analytics/network
   * Get network-wide analytics
   */
  router.get('/network', async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';
      const analytics = analyticsService.getNetworkAnalytics(period);

      return res.json({
        success: true,
        ...analytics,
      });
    } catch (error) {
      console.error('Get network analytics error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get network analytics',
      });
    }
  });

  /**
   * GET /analytics/overview
   * Get analytics overview (summary stats)
   */
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const networkAnalytics = analyticsService.getNetworkAnalytics('day');
      const networkStats = screenService.getNetworkStats();
      const serviceStats = analyticsService.getStats();

      return res.json({
        success: true,
        summary: {
          screens: {
            total: networkStats.total,
            active: networkStats.active,
            impressions_today: networkAnalytics.total_impressions,
            scans_today: networkAnalytics.total_interactions,
          },
          engagement: {
            engagement_rate: networkAnalytics.avg_engagement_rate,
            scan_rate: networkAnalytics.scan_rate,
          },
          revenue: {
            total_impressions: serviceStats.total_impressions,
            total_interactions: serviceStats.total_interactions,
          },
        },
      });
    } catch (error) {
      console.error('Get overview error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get overview',
      });
    }
  });

  // ==========================================================================
  # QR / AdQR Integration
  // ==========================================================================

  /**
   * POST /analytics/qr/generate
   * Generate QR code for an ad
   */
  router.post('/qr/generate', async (req: Request, res: Response) => {
    try {
      const request: QRGenerationRequest = req.body;

      if (!request.screen_id || !request.ad_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: screen_id, ad_id',
        });
      }

      const qr = analyticsService.generateQR(request);

      return res.json({
        success: true,
        qr_id: qr.qr_id,
        url: qr.url,
        short_code: qr.short_code,
        expires_at: qr.expires_at,
      });
    } catch (error) {
      console.error('Generate QR error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate QR code',
      });
    }
  });

  /**
   * POST /analytics/qr/scan
   * Record QR scan
   */
  router.post('/qr/scan', async (req: Request, res: Response) => {
    try {
      const { qr_id, user_id, location } = req.body;

      if (!qr_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: qr_id',
        });
      }

      analyticsService.recordQRScan(qr_id, user_id, location);

      // Get the QR connection for additional context
      const connection = analyticsService.getQRConnection(qr_id);

      return res.json({
        success: true,
        message: 'QR scan recorded',
        screen_id: connection?.screen_id,
        ad_id: connection?.ad_id,
      });
    } catch (error) {
      console.error('Record QR scan error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record QR scan',
      });
    }
  });

  /**
   * GET /analytics/qr/:id
   * Get QR code analytics
   */
  router.get('/qr/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const connection = analyticsService.getQRConnection(id);
      if (!connection) {
        return res.status(404).json({
          success: false,
          error: 'QR code not found',
        });
      }

      const analytics = analyticsService.getQRAnalytics(id);

      return res.json({
        success: true,
        qr_id: id,
        connection: {
          screen_id: connection.screen_id,
          ad_id: connection.ad_id,
          campaign_id: connection.campaign_id,
          created_at: connection.scan_events[0]?.timestamp,
        },
        analytics,
      });
    } catch (error) {
      console.error('Get QR analytics error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get QR analytics',
      });
    }
  });

  /**
   * POST /analytics/qr/:id/convert
   * Record QR conversion
   */
  router.post('/qr/:id/convert', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { type, revenue } = req.body;

      if (!type || !['trial', 'purchase'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid required field: type (trial or purchase)',
        });
      }

      analyticsService.recordQRConversion(id, type, revenue);

      return res.json({
        success: true,
        message: 'Conversion recorded',
      });
    } catch (error) {
      console.error('Record QR conversion error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to record conversion',
      });
    }
  });

  // ==========================================================================
  // Payouts
  // ==========================================================================

  /**
   * GET /analytics/payouts/:ownerId
   * Get payout history for an owner
   */
  router.get('/payouts/:ownerId', async (req: Request, res: Response) => {
    try {
      const { ownerId } = req.params;
      const payouts = analyticsService.getPayoutHistory(ownerId);

      return res.json({
        success: true,
        count: payouts.length,
        payouts,
      });
    } catch (error) {
      console.error('Get payout history error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get payout history',
      });
    }
  });

  // ==========================================================================
  // Fraud Detection
  // ==========================================================================

  /**
   * GET /analytics/fraud
   * Get fraud alerts
   */
  router.get('/fraud', async (req: Request, res: Response) => {
    try {
      const screenId = req.query.screen_id as string;
      const limit = parseInt(req.query.limit as string) || 100;

      const alerts = analyticsService.getFraudAlerts(screenId, limit);

      return res.json({
        success: true,
        count: alerts.length,
        alerts,
      });
    } catch (error) {
      console.error('Get fraud alerts error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get fraud alerts',
      });
    }
  });

  // ==========================================================================
  // Data Management
  // ==========================================================================

  /**
   * POST /analytics/cleanup
   * Clean up old data
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const retentionDays = req.body.retention_days || 90;
      const removed = analyticsService.cleanup(retentionDays);

      return res.json({
        success: true,
        removed_records: removed,
        retention_days: retentionDays,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup data',
      });
    }
  });

  /**
   * GET /analytics/stats
   * Get analytics service statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = analyticsService.getStats();

      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get stats',
      });
    }
  });

  return router;
}
