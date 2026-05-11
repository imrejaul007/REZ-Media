/**
 * Dashboard Routes
 */

import { Router, Request, Response } from 'express';
import { marketingDashboardService } from '../services/marketingDashboardService';
import { verifyConsumer } from '../middleware/auth';

const router = Router();

/**
 * GET /api/dashboard/metrics
 * Get dashboard metrics
 */
router.get('/metrics', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { from, to } = req.query;

    const dateRange = from && to
      ? { from: new Date(from as string), to: new Date(to as string) }
      : undefined;

    const metrics = await marketingDashboardService.getDashboardMetrics(merchantId, dateRange);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/channels
 * Get channel performance
 */
router.get('/channels', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const performance = await marketingDashboardService.getChannelPerformance(merchantId);
    res.json({ success: true, data: performance });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/timeline
 * Get campaign timeline
 */
router.get('/timeline', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { days } = req.query;
    const data = await marketingDashboardService.getCampaignTimeline(
      merchantId,
      days ? parseInt(days as string) : 30
    );
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/audience
 * Get audience segments
 */
router.get('/audience', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const segments = await marketingDashboardService.getAudienceSegments(merchantId);
    res.json({ success: true, data: segments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/top-campaigns
 * Get top performing campaigns
 */
router.get('/top-campaigns', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { limit } = req.query;
    const campaigns = await marketingDashboardService.getTopCampaigns(
      merchantId,
      limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, data: campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/funnel
 * Get conversion funnel
 */
router.get('/funnel', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const funnel = await marketingDashboardService.getConversionFunnel(merchantId);
    res.json({ success: true, data: funnel });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/benchmark
 * Get competitor benchmarking
 */
router.get('/benchmark', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const benchmark = await marketingDashboardService.getCompetitorBenchmark(merchantId);
    res.json({ success: true, data: benchmark });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/attribution
 * Get revenue attribution
 */
router.get('/attribution', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const attribution = await marketingDashboardService.getRevenueAttribution(merchantId);
    res.json({ success: true, data: attribution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/clv
 * Get CLV distribution
 */
router.get('/clv', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const distribution = await marketingDashboardService.getCLVDistribution(merchantId);
    res.json({ success: true, data: distribution });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/predictive
 * Get predictive analytics
 */
router.get('/predictive', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const predictive = await marketingDashboardService.getPredictiveAnalytics(merchantId);
    res.json({ success: true, data: predictive });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
