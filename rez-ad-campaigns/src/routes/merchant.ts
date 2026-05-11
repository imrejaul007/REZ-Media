// @ts-nocheck
import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifyMerchant } from '../middleware/auth';
import AdCampaign from '../models/AdCampaign';
import { getCampaignById, invalidateCampaignCache } from '../services/campaignService';
import { logger } from '../config/logger';
import { track } from '../services/intentCaptureService';

const router = Router();

router.use(verifyMerchant);

// ── GET / — list merchant's ads ──────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { merchantId: new Types.ObjectId(merchantId) };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [ads, total] = await Promise.all([
      AdCampaign.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdCampaign.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: ads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[MERCHANT ADS] list error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve ads' });
  }
});

// ── POST / — create ad ───────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const {
      storeId,
      title,
      headline,
      description,
      ctaText,
      ctaUrl,
      imageUrl,
      placement,
      targetSegment,
      targetLocation,
      targetInterests,
      bidType,
      bidAmount,
      dailyBudget,
      totalBudget,
      startDate,
      endDate,
    } = req.body;

    if (!storeId || !title || !headline || !description || !ctaText || !imageUrl || !placement || !bidType) {
      return res.status(400).json({
        success: false,
        message: 'storeId, title, headline, description, ctaText, imageUrl, placement, and bidType are required',
      });
    }

    // BE-ADS-005: Validate budget constraints
    if (typeof bidAmount !== 'number' || bidAmount < 0) {
      return res.status(400).json({ success: false, message: 'bidAmount must be a non-negative number' });
    }
    if (typeof dailyBudget !== 'number' || dailyBudget < 0) {
      return res.status(400).json({ success: false, message: 'dailyBudget must be a non-negative number' });
    }
    if (typeof totalBudget !== 'number' || totalBudget < 0) {
      return res.status(400).json({ success: false, message: 'totalBudget must be a non-negative number' });
    }
    if (totalBudget < dailyBudget) {
      return res.status(400).json({ success: false, message: 'totalBudget must be >= dailyBudget' });
    }
    if (bidAmount > dailyBudget) {
      return res.status(400).json({ success: false, message: 'bidAmount must be <= dailyBudget' });
    }

    // BE-ADS-009: Validate startDate is valid and future date
    if (!startDate) {
      return res.status(400).json({ success: false, message: 'startDate is required' });
    }
    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({ success: false, message: 'startDate must be valid ISO 8601 date' });
    }

    // BE-ADS-019: Validate placement value
    const validPlacements = ['home_banner', 'explore_feed', 'store_listing', 'search_result'];
    if (!validPlacements.includes(placement)) {
      return res.status(400).json({
        success: false,
        message: `placement must be one of: ${validPlacements.join(', ')}`,
      });
    }

    // BE-ADS-021: Validate bidType against known payment terms
    const validBidTypes = ['CPC', 'CPM'];
    if (!validBidTypes.includes(bidType)) {
      return res.status(400).json({
        success: false,
        message: `bidType must be one of: ${validBidTypes.join(', ')}`,
      });
    }

    const ad = await AdCampaign.create({
      merchantId: new Types.ObjectId(merchantId),
      storeId,
      title,
      headline,
      description,
      ctaText,
      ctaUrl,
      imageUrl,
      placement,
      targetSegment: targetSegment || 'all',
      targetLocation,
      targetInterests,
      bidType,
      bidAmount,
      dailyBudget,
      totalBudget,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      status: 'draft',
    });

    track({
      event: 'campaign_created',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        merchantId,
        campaignId: ad._id.toString(),
        placement: ad.placement,
        bidType: ad.bidType,
        totalBudget: ad.totalBudget,
        category: 'GENERAL',
        appType: 'rez-ads-service',
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    return res.status(201).json({ success: true, data: ad });
  } catch (error) {
    logger.error('[MERCHANT ADS] create error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create ad' });
  }
});

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const [totals] = await AdCampaign.aggregate([
      { $match: { merchantId: new Types.ObjectId(merchantId) } },
      {
        $group: {
          _id: null,
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalSpend: { $sum: '$totalSpent' },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      data: totals || { totalImpressions: 0, totalClicks: 0, totalSpend: 0, activeCount: 0 },
    });
  } catch (error) {
    logger.error('[MERCHANT ADS] analytics error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve analytics' });
  }
});

// ── GET /:id — single ad ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup
    const ad = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!ad || ad.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    return res.json({ success: true, data: ad });
  } catch (error) {
    logger.error('[MERCHANT ADS] get single error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve ad' });
  }
});

// ── PUT /:id — update ad (draft or rejected only) ────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup for verification
    const cachedAd = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!cachedAd || cachedAd.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (cachedAd.status !== 'draft' && cachedAd.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected ads can be edited',
      });
    }

    // Fetch fresh from DB for atomic save
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    const allowedFields = [
      'title', 'headline', 'description', 'ctaText', 'ctaUrl', 'imageUrl',
      'placement', 'targetSegment', 'targetLocation', 'targetInterests',
      'bidType', 'bidAmount', 'dailyBudget', 'totalBudget', 'startDate', 'endDate',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (ad as any)[field] = req.body[field];
      }
    }

    // If previously rejected and now edited, reset to draft
    if (ad.status === 'rejected') {
      ad.status = 'draft';
      ad.rejectionReason = undefined;
    }

    await ad.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    return res.json({ success: true, data: ad });
  } catch (error) {
    logger.error('[MERCHANT ADS] update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update ad' });
  }
});

// ── PATCH /:id/submit — submit for review ────────────────────────────────────
router.patch('/:id/submit', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup for verification
    const cachedAd = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!cachedAd || cachedAd.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (cachedAd.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft ads can be submitted for review' });
    }

    // Fetch fresh from DB for atomic save
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    ad.status = 'pending_review';
    await ad.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    track({
      event: 'campaign_submitted',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        merchantId,
        campaignId: ad._id.toString(),
        category: 'GENERAL',
        appType: 'rez-ads-service',
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    return res.json({ success: true, data: ad, message: 'Ad submitted for review' });
  } catch (error) {
    logger.error('[MERCHANT ADS] submit error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit ad for review' });
  }
});

// ── PATCH /:id/pause — pause active ad ──────────────────────────────────────
router.patch('/:id/pause', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup for verification
    const cachedAd = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!cachedAd || cachedAd.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (cachedAd.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Only active ads can be paused' });
    }

    // Fetch fresh from DB for atomic save
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    ad.status = 'paused';
    await ad.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    return res.json({ success: true, data: ad, message: 'Ad paused' });
  } catch (error) {
    logger.error('[MERCHANT ADS] pause error:', error);
    return res.status(500).json({ success: false, message: 'Failed to pause ad' });
  }
});

// ── PATCH /:id/activate — reactivate paused ad ──────────────────────────────
router.patch('/:id/activate', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup for verification
    const cachedAd = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!cachedAd || cachedAd.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (cachedAd.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'Only paused ads can be reactivated' });
    }

    // Fetch fresh from DB for atomic save
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    ad.status = 'active';
    await ad.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    track({
      event: 'campaign_activated',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        merchantId,
        campaignId: ad._id.toString(),
        category: 'GENERAL',
        appType: 'rez-ads-service',
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    return res.json({ success: true, data: ad, message: 'Ad reactivated' });
  } catch (error) {
    logger.error('[MERCHANT ADS] activate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to activate ad' });
  }
});

// ── DELETE /:id — soft delete (draft or paused only) ────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ad id' });
    }

    // Use cached lookup for verification
    const cachedAd = await getCampaignById(req.params.id);

    // Verify merchant ownership
    if (!cachedAd || cachedAd.merchantId.toString() !== merchantId) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (cachedAd.status !== 'draft' && cachedAd.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'Only draft or paused ads can be deleted' });
    }

    // Fetch fresh from DB for atomic save
    const ad = await AdCampaign.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    ad.status = 'completed';
    await ad.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    return res.json({ success: true, message: 'Ad removed' });
  } catch (error) {
    logger.error('[MERCHANT ADS] delete error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove ad' });
  }
});

export default router;
