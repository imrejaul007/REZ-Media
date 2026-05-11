/**
 * Ad interaction routes — auth-protected impression and click tracking.
 *
 * These routes are called by client apps when a user views or clicks on
 * an ad served by the marketing campaign system. Authentication is required
 * (JWT user token via Authorization header). Returns 401 for anonymous requests.
 */

import { Router, Request, Response } from 'express';
import mongoose, { Types } from 'mongoose';
import { logger } from '../config/logger';
import { BillingService } from '../services/billingService';
import { track } from '../services/intentCaptureService';

const router = Router();
const billingService = new BillingService();

/**
 * POST /interaction/:id/impression
 *
 * Records an ad impression and deducts from the campaign budget.
 * Requires authenticated user (req.userId must be set by auth middleware).
 */
router.post(
  '/:id/impression',
  async (req: Request, res: Response) => {
    try {
      const { id: adId } = req.params;
      const userId = req.userId;
      const ip = req.ip || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!Types.ObjectId.isValid(adId)) {
        return res.status(400).json({ success: false, message: 'Invalid ad ID' });
      }

      await billingService.chargeCampaign(adId, 'CPM', 1);

      logger.info('[Interaction] Ad impression recorded', {
        adId,
        userId,
        ip,
        userAgent,
      });

      // RTMN Commerce Memory: track ad impression as engagement intent
      track({ userId, event: 'ad_impression', intentKey: `marketing_ad_${adId}`, properties: { campaignId: adId } }).catch(() => {});

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Interaction] Impression tracking failed', {
        adId: req.params.id,
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Failed to record impression' });
    }
  },
);

/**
 * POST /interaction/:id/click
 *
 * Records an ad click (higher cost than impression) and deducts from the
 * campaign budget. Requires authenticated user.
 */
router.post(
  '/:id/click',
  async (req: Request, res: Response) => {
    try {
      const { id: adId } = req.params;
      const userId = req.userId;
      const ip = req.ip || 'unknown';
      const userAgent = req.get('user-agent') || 'unknown';

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!Types.ObjectId.isValid(adId)) {
        return res.status(400).json({ success: false, message: 'Invalid ad ID' });
      }

      await billingService.chargeCampaign(adId, 'CPC', 1);

      logger.info('[Interaction] Ad click recorded', {
        adId,
        userId,
        ip,
        userAgent,
      });

      // RTMN Commerce Memory: track ad click as engagement intent
      track({ userId, event: 'ad_click', intentKey: `marketing_ad_${adId}`, properties: { campaignId: adId } }).catch(() => {});

      return res.json({ success: true });
    } catch (error: any) {
      logger.error('[Interaction] Click tracking failed', {
        adId: req.params.id,
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Failed to record click' });
    }
  },
);

export default router;
