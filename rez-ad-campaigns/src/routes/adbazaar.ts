// @ts-nocheck
import { Router, Request, Response } from 'express';
import AdCampaign from '../models/AdCampaign';
import AdInteraction from '../models/AdInteraction';
import { track } from '../services/intentCaptureService';
import { logger } from '../config/logger';
import { err } from '../utils/response';

const router = Router();

const INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY || process.env.INTERNAL_SERVICE_TOKEN;

function verifyInternal(req: Request, res: Response, next: Function) {
  const key = req.headers['x-internal-key'] || req.headers['x-internal-token'];
  if (key !== INTERNAL_KEY) {
    return res.status(401).json(err('SRV_001', 'Unauthorized'));
  }
  next();
}

// ── POST /adbazaar/campaign — Create campaign from AdBazaar ─────────────────
router.post('/adbazaar/campaign', verifyInternal, async (req: Request, res: Response) => {
  try {
    const {
      merchantId,
      merchantName,
      adBazaarBookingId,
      title,
      description,
      targetUrl,
      budget,
      startDate,
      endDate,
      targeting,
    } = req.body;

    const campaign = new AdCampaign({
      merchantId,
      merchantName,
      adBazaarBookingId,
      name: title,
      description,
      targetUrl,
      budget,
      startDate,
      endDate,
      targeting,
      status: 'pending',
      source: 'adbazaar',
    });

    await campaign.save();

    // Track in intent graph
    track({
      userId: merchantId,
      event: 'campaign_created',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        campaignId: campaign._id.toString(),
        bookingId: adBazaarBookingId,
        merchantId,
        source: 'adbazaar',
      },
    });

    res.status(201).json({
      success: true,
      campaignId: campaign._id.toString(),
      status: campaign.status,
    });
  } catch (error) {
    logger.error('Error creating AdBazaar campaign', { error });
    res.status(500).json(err('SRV_001', 'Failed to create campaign'));
  }
});

// ── POST /adbazaar/impression ───────────────────────────────────────────────
router.post('/adbazaar/impression', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { adBazaarBookingId, userId, metadata } = req.body;

    const interaction = new AdInteraction({
      campaignId: adBazaarBookingId,
      userId,
      type: 'impression',
      metadata,
    });

    await interaction.save();

    // Track in intent graph
    track({
      userId,
      event: 'ad_impression',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking impression', { error });
    res.status(500).json(err('SRV_001', 'Failed to track impression'));
  }
});

// ── POST /adbazaar/click ──────────────────────────────────────────────────
router.post('/adbazaar/click', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { adBazaarBookingId, userId, metadata } = req.body;

    const interaction = new AdInteraction({
      campaignId: adBazaarBookingId,
      userId,
      type: 'click',
      metadata,
    });

    await interaction.save();

    track({
      userId,
      event: 'ad_click',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking click', { error });
    res.status(500).json(err('SRV_001', 'Failed to track click'));
  }
});

// ── POST /adbazaar/conversion ─────────────────────────────────────────────
router.post('/adbazaar/conversion', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { adBazaarBookingId, userId, metadata } = req.body;

    const interaction = new AdInteraction({
      campaignId: adBazaarBookingId,
      userId,
      type: 'conversion',
      metadata,
    });

    await interaction.save();

    track({
      userId,
      event: 'conversion',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking conversion', { error });
    res.status(500).json(err('SRV_001', 'Failed to track conversion'));
  }
});

// ── GET /adbazaar/analytics ────────────────────────────────────────────────
// PERFORMANCE FIX: Eliminated N+1 query by fetching campaign IDs once and reusing
router.get('/adbazaar/analytics', verifyInternal, async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.query;

    // PERFORMANCE FIX: Fetch campaign IDs once instead of 3 times
    const campaignIds = await AdCampaign.find({ merchantId }).distinct('_id');
    const campaignIdsArray = Array.from(campaignIds);

    // PERFORMANCE FIX: Use Promise.all for parallel count queries with pre-fetched IDs
    const [impressions, clicks, conversions, spendAggregation] = await Promise.all([
      AdInteraction.countDocuments({
        campaignId: { $in: campaignIdsArray },
        type: 'impression',
      }),
      AdInteraction.countDocuments({
        campaignId: { $in: campaignIdsArray },
        type: 'click',
      }),
      AdInteraction.countDocuments({
        campaignId: { $in: campaignIdsArray },
        type: 'conversion',
      }),
      // Also fetch spend in parallel to avoid separate query
      AdCampaign.aggregate([
        { $match: { merchantId } },
        { $group: { _id: null, total: { $sum: '$budget' } } },
      ]),
    ]);

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    res.json({
      impressions,
      clicks,
      conversions,
      ctr: ctr.toFixed(2),
      spend: spendAggregation[0]?.total || 0,
    });
  } catch (error) {
    logger.error('Error fetching analytics', { error });
    res.status(500).json(err('SRV_001', 'Failed to fetch analytics'));
  }
});

export default router;
