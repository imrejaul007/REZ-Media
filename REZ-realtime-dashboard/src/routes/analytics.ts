import { Router, Response } from 'express';
import { liveMetricsService } from '../services/liveMetrics.js';
import { broadcastService } from '../services/broadcast.js';
import { authMiddleware, AuthenticatedRequest, generateToken } from '../middleware/auth.js';

const router = Router();

// Get live snapshot (all campaigns)
router.get('/snapshot', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const snapshot = liveMetricsService.getSnapshot();

    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error fetching snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics snapshot',
    });
  }
});

// Get alerts
router.get('/alerts', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const alerts = liveMetricsService.getAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        critical: alerts.filter((a) => a.severity === 'critical').length,
        high: alerts.filter((a) => a.severity === 'high').length,
        medium: alerts.filter((a) => a.severity === 'medium').length,
        low: alerts.filter((a) => a.severity === 'low').length,
      },
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

// Get aggregated metrics
router.get('/aggregated', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = liveMetricsService.getMetrics() as ReturnType<typeof liveMetricsService.getMetrics>;

    if (!Array.isArray(campaigns)) {
      res.status(500).json({
        success: false,
        error: 'Invalid data',
      });
      return;
    }

    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0);

    const aggregated = {
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpend,
      totalBudget,
      avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      avgCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
      avgConversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
      avgROI: totalSpend > 0 ? (totalConversions * 100) / totalSpend : 0,
      budgetUtilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      campaignsCount: campaigns.length,
    };

    res.json({
      success: true,
      data: aggregated,
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error fetching aggregated metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch aggregated metrics',
    });
  }
});

// WebSocket connection stats
router.get('/ws/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = {
      connections: broadcastService.getConnectionCount(),
      rooms: broadcastService.getRoomCount(),
      roomDetails: broadcastService.getConnectionRooms(),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error fetching WebSocket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch WebSocket stats',
    });
  }
});

// Broadcast to specific rooms
router.post('/broadcast', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { event, data, roomIds } = req.body;

    if (!event || !roomIds || !Array.isArray(roomIds)) {
      res.status(400).json({
        success: false,
        error: 'Invalid broadcast parameters',
      });
      return;
    }

    const status = await broadcastService.broadcastWithProgress(
      roomIds,
      event,
      () => data
    );

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error broadcasting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast',
    });
  }
});

// Trigger simulation update (for demo/testing)
router.post('/simulate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    liveMetricsService.simulateUpdates();
    const snapshot = liveMetricsService.getSnapshot();
    const alerts = liveMetricsService.getAlerts();

    // Broadcast to all connections
    broadcastService.broadcast('metrics:refreshed', { ...snapshot, alerts });

    res.json({
      success: true,
      data: {
        message: 'Simulation triggered',
        snapshot,
      },
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error simulating:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger simulation',
    });
  }
});

// Generate test token (for development only)
router.post('/dev/token', async (req, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({
      success: false,
      error: 'Not available in production',
    });
    return;
  }

  try {
    const { userId = 'test-user', email = 'test@example.com', role = 'admin' } = req.body;

    const token = generateToken({ userId, email, role });

    res.json({
      success: true,
      data: { token },
    });
  } catch (error) {
    console.error('[AnalyticsRoutes] Error generating token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate token',
    });
  }
});

export default router;
