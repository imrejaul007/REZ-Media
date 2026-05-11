/**
 * Influencer Routes
 */

import { Router, Request, Response } from 'express';
import { influencerService } from '../services/influencerService';
import { verifyConsumer } from '../middleware/auth';

const router = Router();

// ===================== INFLUENCER PROFILE =====================

/**
 * POST /api/influencer/register
 * Register as influencer
 */
router.post('/register', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const influencer = await influencerService.registerInfluencer({
      ...req.body,
      userId: (req as any).user?.id || req.body.userId,
    });
    res.status(201).json({ success: true, data: influencer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/influencer/profile
 * Get my influencer profile
 */
router.get('/profile', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const influencer = await influencerService.getInfluencer(userId);
    if (!influencer) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    res.json({ success: true, data: influencer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/influencer/search
 * Search influencers
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { niche, city, minFollowers, sortBy, page, limit } = req.query;
    const result = await influencerService.searchInfluencers({
      niche: niche ? String(niche).split(',') : undefined,
      city: city as string,
      minFollowers: minFollowers ? parseInt(minFollowers as string) : undefined,
      sortBy: sortBy as any,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== INFLUENCER CAMPAIGNS =====================

/**
 * POST /api/influencer/campaigns
 * Create influencer campaign (merchant)
 */
router.post('/campaigns', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const campaign = await influencerService.createCampaign({
      ...req.body,
      merchantId: (req as any).user?.id || req.body.merchantId,
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/influencer/campaigns
 * Get merchant's campaigns
 */
router.get('/campaigns', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { status } = req.query;
    const campaigns = await influencerService.getMerchantCampaigns(merchantId, status as string);
    res.json({ success: true, data: campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/influencer/campaigns/:id
 * Get campaign details
 */
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    // Import model directly
    const { InfluencerCampaign } = await import('../services/influencerService');
    const campaign = await InfluencerCampaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== INFLUENCER APPLICATIONS =====================

/**
 * POST /api/influencer/campaigns/:id/apply
 * Apply to campaign (influencer)
 */
router.post('/campaigns/:id/apply', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const influencerId = (req as any).user?.id;
    const { proposedContent, proposedPrice } = req.body;

    const campaign = await influencerService.applyToCampaign(req.params.id, influencerId, {
      proposedContent,
      proposedPrice,
    });

    if (!campaign) {
      return res.status(400).json({ success: false, error: 'Cannot apply to this campaign' });
    }

    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/influencer/campaigns/:id/accept/:influencerId
 * Accept application (merchant)
 */
router.post('/campaigns/:id/accept/:influencerId', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const campaign = await influencerService.acceptApplication(
      req.params.id,
      req.params.influencerId
    );
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign or application not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/influencer/campaigns/:id/reject/:influencerId
 * Reject application (merchant)
 */
router.post('/campaigns/:id/reject/:influencerId', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const campaign = await influencerService.rejectApplication(
      req.params.id,
      req.params.influencerId
    );
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign or application not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== ANALYTICS =====================

/**
 * POST /api/influencer/campaigns/:id/analytics
 * Update campaign analytics
 */
router.post('/campaigns/:id/analytics', async (req: Request, res: Response) => {
  try {
    const { views, engagement, conversions } = req.body;
    const campaign = await influencerService.updateCampaignAnalytics(req.params.id, {
      views,
      engagement,
      conversions,
    });
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/influencer/analytics
 * Get influencer analytics
 */
router.get('/analytics', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const influencerId = (req as any).user?.id;
    const analytics = await influencerService.getInfluencerAnalytics(influencerId);
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
