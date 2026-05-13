import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { liveMetricsService } from '../services/liveMetrics.js';
import { broadcastService } from '../services/broadcast.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { CampaignMetrics } from '../types/index.js';

const router = Router();

// Validation schemas
const UpdateMetricsSchema = z.object({
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
  spend: z.number().min(0).optional(),
  budget: z.number().min(0).optional(),
});

const CampaignIdSchema = z.object({
  campaignId: z.string().min(1),
});

// Get all campaigns
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = liveMetricsService.getMetrics();

    res.json({
      success: true,
      data: {
        campaigns,
        total: Array.isArray(campaigns) ? campaigns.length : 0,
      },
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns',
    });
  }
});

// Get single campaign
router.get('/:campaignId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const metrics = liveMetricsService.getMetrics(campaignId);

    if (!metrics) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign',
    });
  }
});

// Update campaign metrics
router.patch('/:campaignId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.params;

    const parseResult = UpdateMetricsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.errors,
      });
      return;
    }

    const updated = liveMetricsService.updateMetrics(campaignId, parseResult.data);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    // Broadcast update to all subscribers
    broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
    });
  }
});

// Increment impressions
router.post('/:campaignId/impressions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { count = 1 } = req.body;

    const updated = liveMetricsService.incrementImpressions(campaignId, count);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error incrementing impressions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment impressions',
    });
  }
});

// Increment clicks
router.post('/:campaignId/clicks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { count = 1 } = req.body;

    const updated = liveMetricsService.incrementClicks(campaignId, count);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error incrementing clicks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment clicks',
    });
  }
});

// Increment conversions
router.post('/:campaignId/conversions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { count = 1 } = req.body;

    const updated = liveMetricsService.incrementConversions(campaignId, count);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error incrementing conversions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment conversions',
    });
  }
});

// Add spend
router.post('/:campaignId/spend', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount < 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid amount',
      });
      return;
    }

    const updated = liveMetricsService.addSpend(campaignId, amount);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Campaign not found',
      });
      return;
    }

    broadcastService.broadcastToRoom(`campaign:${campaignId}`, 'campaign:updated', updated);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error adding spend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add spend',
    });
  }
});

// Get campaign history
router.get('/:campaignId/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const history = liveMetricsService.getHistory(campaignId);

    res.json({
      success: true,
      data: {
        campaignId,
        history,
        points: history.length,
      },
    });
  } catch (error) {
    console.error('[CampaignRoutes] Error fetching history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign history',
    });
  }
});

export default router;
