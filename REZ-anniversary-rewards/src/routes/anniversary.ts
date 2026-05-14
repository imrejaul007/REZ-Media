/**
 * Anniversary Rewards Routes
 */

import { Router, Request, Response } from 'express';
import { anniversaryService, MilestoneReward, NotificationChannel } from '../services/anniversaryService';

const router = Router();

/**
 * GET /api/anniversary/config/:merchantId
 * Get anniversary configuration for a merchant
 */
router.get('/config/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const config = await anniversaryService.getConfig(merchantId);
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anniversary config',
    });
  }
});

/**
 * PUT /api/anniversary/config/:merchantId
 * Update anniversary configuration
 */
router.put('/config/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const config = await anniversaryService.updateConfig(merchantId, req.body);
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update anniversary config',
    });
  }
});

/**
 * GET /api/anniversary/milestones/:merchantId
 * Get milestone rewards configuration
 */
router.get('/milestones/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const milestones = await anniversaryService.getMilestones(merchantId);
    res.json({
      success: true,
      data: milestones,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestones',
    });
  }
});

/**
 * PUT /api/anniversary/milestones/:merchantId
 * Update milestone rewards configuration
 */
router.put('/milestones/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const milestones: MilestoneReward[] = req.body.milestones;
    const updated = await anniversaryService.updateMilestones(merchantId, milestones);
    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update milestones',
    });
  }
});

/**
 * GET /api/anniversary/tenure/:merchantId/:userId
 * Get user's tenure information
 */
router.get('/tenure/:merchantId/:userId', async (req: Request, res: Response) => {
  try {
    const { merchantId, userId } = req.params;
    const tenure = await anniversaryService.getUserTenure(userId, merchantId);

    if (!tenure) {
      res.status(404).json({
        success: false,
        error: 'User tenure not found',
      });
      return;
    }

    res.json({
      success: true,
      data: tenure,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user tenure',
    });
  }
});

/**
 * POST /api/anniversary/calculate-tenure
 * Calculate user tenure (after registration)
 */
router.post('/calculate-tenure', async (req: Request, res: Response) => {
  try {
    const { userId, merchantId, registrationDate } = req.body;

    if (!userId || !merchantId || !registrationDate) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, merchantId, registrationDate',
      });
      return;
    }

    const tenure = await anniversaryService.calculateTenure(
      userId,
      merchantId,
      new Date(registrationDate)
    );

    res.json({
      success: true,
      data: tenure,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate tenure',
    });
  }
});

/**
 * GET /api/anniversary/eligibility/:merchantId/:userId
 * Check if user is eligible for anniversary reward
 */
router.get('/eligibility/:merchantId/:userId', async (req: Request, res: Response) => {
  try {
    const { merchantId, userId } = req.params;
    const eligibility = await anniversaryService.checkEligibility(userId, merchantId);

    res.json({
      success: true,
      data: eligibility,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check eligibility',
    });
  }
});

/**
 * GET /api/anniversary/offers/:merchantId/:userId
 * Get available anniversary offers for a user
 */
router.get('/offers/:merchantId/:userId', async (req: Request, res: Response) => {
  try {
    const { merchantId, userId } = req.params;
    const offers = await anniversaryService.getAvailableOffers(userId, merchantId);

    res.json({
      success: true,
      data: offers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offers',
    });
  }
});

/**
 * POST /api/anniversary/generate-offer
 * Generate anniversary reward offer for a user
 */
router.post('/generate-offer', async (req: Request, res: Response) => {
  try {
    const { userId, merchantId } = req.body;

    if (!userId || !merchantId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, merchantId',
      });
      return;
    }

    const offer = await anniversaryService.generateRewardOffer(userId, merchantId);

    if (!offer) {
      res.status(404).json({
        success: false,
        error: 'No eligible anniversary reward found',
      });
      return;
    }

    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate offer',
    });
  }
});

/**
 * POST /api/anniversary/claim
 * Claim an anniversary reward
 */
router.post('/claim', async (req: Request, res: Response) => {
  try {
    const { userId, merchantId, offerId } = req.body;

    if (!userId || !merchantId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, merchantId',
      });
      return;
    }

    const result = await anniversaryService.claimReward(userId, merchantId, offerId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.message,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      data: {
        offerCode: result.offerCode,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to claim reward',
    });
  }
});

/**
 * GET /api/anniversary/analytics/:merchantId
 * Get anniversary analytics for a merchant
 */
router.get('/analytics/:merchantId', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.params;
    const { period } = req.query;
    const analytics = await anniversaryService.getAnalytics(merchantId, period as string);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

/**
 * POST /api/anniversary/trigger
 * Manually trigger batch anniversary check
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.body;
    const result = await anniversaryService.triggerBatchCheck(merchantId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger batch check',
    });
  }
});

/**
 * GET /api/anniversary/channels
 * Get available notification channels
 */
router.get('/channels', (req: Request, res: Response) => {
  const channels: NotificationChannel[] = ['email', 'whatsapp', 'sms', 'push', 'in_app'];
  res.json({
    success: true,
    data: channels,
  });
});

export { router };
