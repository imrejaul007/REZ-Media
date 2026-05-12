/**
 * Analytics Routes - REST API for usage analytics and reporting
 */

import { Router, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { billingService } from '../services/billingService';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { BillingStatus } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /analytics/summary - Get analytics summary for user
 */
router.get('/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const summary = await analyticsService.getAnalyticsSummary(userId, days);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Error getting analytics summary', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/usage - Get usage statistics
 */
router.get('/usage', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await analyticsService.getUsageStats(userId, period, startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting usage stats', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/daily-trend - Get daily usage trend
 */
router.get('/daily-trend', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const trend = await analyticsService.getDailyTrend(userId, days);

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    logger.error('Error getting daily trend', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/call-types - Get call type distribution
 */
router.get('/call-types', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const distribution = await analyticsService.getCallTypeDistribution(userId, days);

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    logger.error('Error getting call type distribution', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/quality - Get call quality metrics
 */
router.get('/quality', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const metrics = await analyticsService.getCallQualityMetrics(userId, days);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Error getting quality metrics', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/peak-hours - Get peak usage hours
 */
router.get('/peak-hours', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const peakHours = await analyticsService.getPeakUsageHours(userId, days);

    res.json({
      success: true,
      data: peakHours,
    });
  } catch (error) {
    logger.error('Error getting peak hours', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/cost-breakdown - Get cost breakdown
 */
router.get('/cost-breakdown', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const breakdown = await analyticsService.getCostBreakdown(userId, days);

    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    logger.error('Error getting cost breakdown', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/realtime - Get real-time statistics
 */
router.get('/realtime', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stats = await analyticsService.getRealtimeStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting realtime stats', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/billing/history - Get billing history
 */
router.get('/billing/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = parseInt(req.query.skip as string) || 0;
    const status = req.query.status as BillingStatus | undefined;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const result = await billingService.getBillingHistory(userId, { limit, skip, status });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        transactions: result.data?.transactions.map(t => t.getSummary()),
        total: result.data?.total,
        pagination: {
          page: Math.floor(skip / limit) + 1,
          limit,
          total: result.data?.total || 0,
          totalPages: Math.ceil((result.data?.total || 0) / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting billing history', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /analytics/billing/summary - Get billing summary
 */
router.get('/billing/summary', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string || req.userId;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const summary = await billingService.getBillingSummary(userId, days);

    if (!summary.success) {
      res.status(500).json({
        success: false,
        error: summary.error,
      });
      return;
    }

    res.json({
      success: true,
      data: summary.data,
    });
  } catch (error) {
    logger.error('Error getting billing summary', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /analytics/export - Export user data
 */
router.post('/export', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.body.userId as string || req.userId;
    const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date();

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID required',
      });
      return;
    }

    const exportData = await analyticsService.exportUserData(userId, startDate, endDate);

    res.json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    logger.error('Error exporting data', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
