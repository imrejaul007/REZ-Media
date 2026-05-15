/**
 * REZ Partner Portal - Routes
 */

import { Router, Request, Response } from 'express';
import { AuthRequest, authenticate, authorize } from '../middleware';
import {
  partnerService,
  partnerUserService,
  campaignService,
  payoutService,
} from '../services';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'rez-partner-portal' });
});

// ============ Partner Routes ============

// Register new partner
router.post('/partners', async (req: Request, res: Response) => {
  try {
    const partner = await partnerService.createPartner(req.body);
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// List partners (admin)
router.get('/partners', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { type, status, page, limit } = req.query;
    const result = await partnerService.listPartners({
      type: type as any,
      status: status as any,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get partner by ID
router.get('/partners/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const partner = await partnerService.getPartner(req.params.id);
    if (!partner) {
      res.status(404).json({ success: false, error: 'Partner not found' });
      return;
    }
    res.json({ success: true, data: partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Update partner status (admin)
router.patch('/partners/:id/status', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const partner = await partnerService.updatePartnerStatus(req.params.id, status);
    if (!partner) {
      res.status(404).json({ success: false, error: 'Partner not found' });
      return;
    }
    res.json({ success: true, data: partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Regenerate API credentials
router.post('/partners/:id/credentials', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const credentials = await partnerService.updateApiCredentials(req.params.id);
    res.json({ success: true, data: credentials });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============ Auth Routes ============

// Register partner user
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const user = await partnerUserService.createUser(req.body);
    res.status(201).json({ success: true, data: { ...user.toObject(), password: undefined } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Login
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await partnerUserService.authenticate(email, password);

    if (!result) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    res.json({
      success: true,
      data: {
        user: { ...result.user.toObject(), password: undefined },
        token: result.token,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get current user
router.get('/auth/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await partnerUserService.getUser(req.user!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============ Campaign Routes ============

// Create campaign
router.post('/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await campaignService.createCampaign({
      partnerId: req.user!.partnerId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// List partner campaigns
router.get('/campaigns', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const campaigns = await campaignService.getPartnerCampaigns(req.user!.partnerId);
    res.json({ success: true, data: campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Update campaign status
router.patch('/campaigns/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const campaign = await campaignService.updateCampaignStatus(req.params.id, status);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// ============ Payout Routes ============

// Request payout
router.post('/payouts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method } = req.body;
    const payout = await payoutService.requestPayout(req.user!.partnerId, amount, method);
    res.status(201).json({ success: true, data: payout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Get payout history
router.get('/payouts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payouts = await payoutService.getPayoutHistory(req.user!.partnerId);
    res.json({ success: true, data: payouts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// Process payout (admin)
router.post('/payouts/:id/process', authenticate, authorize('admin'), async (req: Request, res: Response) => {
  try {
    const payout = await payoutService.processPayout(req.params.id);
    if (!payout) {
      res.status(404).json({ success: false, error: 'Payout not found or already processed' });
      return;
    }
    res.json({ success: true, data: payout });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
