import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { campaignAnalytics } from '../analytics/CampaignAnalytics';
import { verifyMerchant } from '../middleware/auth';

const router = Router();

// BAK-MKT-003 FIX: All analytics routes require merchant authentication.
// Previously had no auth middleware — any caller could query any merchant's analytics.
router.use(verifyMerchant);

// GET /analytics/summary?days=30 — uses req.merchantId from JWT, not query param
router.get('/summary', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const summary = await campaignAnalytics.getMerchantSummary(req.merchantId!, days);
  res.json(summary);
});

// GET /analytics/campaign/:id — requires merchant owns the campaign
router.get('/campaign/:id', async (req: Request, res: Response) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const metrics = await campaignAnalytics.getCampaignMetrics(req.params.id);
  if (!metrics) return res.status(404).json({ error: 'Not found' });
  // BAK-MKT-003 FIX: Verify the merchant owns this campaign
  if ((metrics as any).merchantId && (metrics as any).merchantId !== req.merchantId) {
    return res.status(403).json({ error: 'Forbidden: you do not own this campaign' });
  }
  res.json(metrics);
});

// POST /analytics/track/open
router.post('/track/open', async (req: Request, res: Response) => {
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId required' });
  await campaignAnalytics.trackOpen(campaignId);
  res.json({ tracked: true });
});

// POST /analytics/track/click
router.post('/track/click', async (req: Request, res: Response) => {
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId required' });
  await campaignAnalytics.trackClick(campaignId);
  res.json({ tracked: true });
});

// POST /analytics/track/conversion — merchantId from JWT, userId from body
router.post('/track/conversion', async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  // BAK-MKT-003 FIX: Use req.merchantId from JWT, not body.merchantId
  await campaignAnalytics.trackConversion(req.merchantId!, userId);
  res.json({ tracked: true });
});

export default router;
