import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { biddingService } from '../services/biddingService.js';
import { campaignService } from '../services/campaignService.js';

const router = Router();

// Validation schemas
const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  exchange: z.enum(['google_adx', 'amazon_tam']).optional(),
  budget: z.number().positive(),
  dailyLimit: z.number().positive().optional(),
  bidStrategy: z.enum(['fixed', 'dynamic', 'optimized']).default('dynamic'),
  maxBidPrice: z.number().positive().optional(),
  targeting: z.object({
    geo: z.array(z.string()).optional(),
    screenTypes: z.array(z.string()).optional(),
    locations: z.array(z.string()).optional(),
  }).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

const BidRequestSchema = z.object({
  exchange: z.enum(['google_adx', 'amazon_tam']),
  impression: z.object({
    id: z.string(),
    floor: z.number().positive(),
    currency: z.string().default('INR'),
    inventory: z.object({
      screenId: z.string(),
      screenType: z.string(),
      location: z.string(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string(),
    }),
  }),
  campaign: z.object({
    id: z.string(),
    targeting: z.object({
      geo: z.array(z.string()).optional(),
      screenTypes: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
    }).optional(),
    maxBid: z.number().positive().optional(),
  }),
});

// ============================================
// CAMPAIGNS
// ============================================

/**
 * GET /api/campaigns
 * List all campaigns
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const { status, exchange } = req.query;
    const campaigns = await campaignService.listCampaigns({
      status: status as 'active' | 'paused' | 'ended' | undefined,
      exchange: exchange as string | undefined,
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign
 */
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors });
      return;
    }

    const campaign = await campaignService.createCampaign({
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    });

    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details
 */
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch campaign' });
  }
});

/**
 * PATCH /api/campaigns/:id
 * Update campaign
 */
router.patch('/api/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
});

/**
 * POST /api/campaigns/:id/pause
 * Pause campaign
 */
router.post('/api/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const campaign = await campaignService.pauseCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to pause campaign' });
  }
});

/**
 * POST /api/campaigns/:id/resume
 * Resume campaign
 */
router.post('/api/campaigns/:id/resume', async (req: Request, res: Response) => {
  try {
    const campaign = await campaignService.resumeCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resume campaign' });
  }
});

/**
 * GET /api/campaigns/:id/stats
 * Get campaign statistics
 */
router.get('/api/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await campaignService.getCampaignStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/campaigns/:id/budget
 * Get campaign budget
 */
router.get('/api/campaigns/:id/budget', async (req: Request, res: Response) => {
  try {
    const budget = await campaignService.getCampaignBudget(req.params.id);
    res.json({ success: true, data: budget });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch budget' });
  }
});

// ============================================
// BIDDING
// ============================================

/**
 * POST /api/bid
 * Evaluate and bid on an impression
 */
router.post('/bid', async (req: Request, res: Response) => {
  try {
    const parsed = BidRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors });
      return;
    }

    const bidRequest = {
      ...parsed.data,
      requestId: uuidv4(),
      timestamp: new Date(),
    };

    const response = await biddingService.evaluateAndBid(bidRequest);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Bid failed' });
  }
});

/**
 * POST /api/bid/batch
 * Batch bid evaluation
 */
router.post('/bid/batch', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body as { requests: unknown[] };
    if (!Array.isArray(requests)) {
      res.status(400).json({ success: false, error: 'requests must be an array' });
      return;
    }

    const bidRequests = requests.map((r: unknown) => {
      const parsed = BidRequestSchema.safeParse(r);
      return {
        ...parsed.data,
        requestId: uuidv4(),
        timestamp: new Date(),
      };
    });

    const responses = await Promise.all(
      bidRequests.map(req => biddingService.evaluateAndBid(req))
    );

    res.json({ success: true, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Batch bid failed' });
  }
});

export default router;
