// @ts-nocheck
/**
 * Conversion Event Routes
 *
 * Receives conversion events from other services (order, payment, etc.)
 * to track attribution and update ad targeting.
 * Forwards events to event-platform for unified analytics.
 */

import { Router, Request, Response } from 'express';
import { track } from '../services/intentCaptureService';
import { logger } from '../config/logger';
import { emitConversion } from '../config/eventPlatform';

const router = Router();

// Simple validation without zod
function isValidConversion(data: any): boolean {
  return data && typeof data.eventType === 'string' && typeof data.userId === 'string';
}

/**
 * POST /api/events/conversion
 * Receives order completion events from order service
 */
router.post('/api/events/conversion', async (req: Request, res: Response) => {
  try {
    if (!isValidConversion(req.body)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const { userId, orderId, value, merchantId, campaignId } = req.body;

    logger.info('[Ads] Conversion event received', { userId, orderId, value });

    // Track intent for ad targeting
    track({
      userId,
      event: 'conversion',
      intentKey: `order_${orderId}`,
      properties: {
        orderId,
        value,
        merchantId,
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    // Forward to event-platform for unified analytics (non-blocking)
    emitConversion({
      conversionId: orderId || `conv_${Date.now()}`,
      campaignId: campaignId || 'direct',
      merchantId: merchantId || 'unknown',
      userId,
      orderId,
      value: value || 0,
      currency: 'INR',
      source: 'ad',
      channel: 'ads_service',
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('[Ads] Conversion event error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/**
 * POST /api/events/attribution
 * Receives attribution data from other services
 */
router.post('/api/events/attribution', async (req: Request, res: Response) => {
  try {
    const { userId, source, campaignId, action } = req.body;

    logger.info('[Ads] Attribution event received', { userId, source, campaignId, action });

    track({
      userId,
      event: action || 'attribution',
      intentKey: source || 'unknown',
      properties: {
        campaignId,
        source,
        action,
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    res.json({ success: true });
  } catch (err) {
    logger.error('[Ads] Attribution event error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/**
 * POST /api/events/roi
 * Receives ROI data from other services
 */
router.post('/api/events/roi', async (req: Request, res: Response) => {
  try {
    const { campaignId, revenue, cost } = req.body;

    logger.info('[Ads] ROI event received', { campaignId, revenue, cost });

    track({
      userId: campaignId,
      event: 'roi_calculated',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        campaignId,
        revenue,
        cost,
        roi: cost > 0 ? revenue / cost : 0,
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    res.json({ success: true });
  } catch (err) {
    logger.error('[Ads] ROI event error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
