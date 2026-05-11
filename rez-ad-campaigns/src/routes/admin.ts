// @ts-nocheck
import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { verifyAdmin } from '../middleware/auth';
import AdCampaign from '../models/AdCampaign';
import { logger } from '../config/logger';
import { track } from '../services/intentCaptureService';
import { notifyAdApproved, notifyAdRejected } from '../services/notificationService';
import { err } from '../utils/response';
import {
  getCampaignById,
  getCampaignsByIds,
  updateCampaign,
  invalidateCampaignCache
} from '../services/campaignService';

const router = Router();

router.use(verifyAdmin);

// ── GET / — list all ads with filters ───────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.merchantId) {
      if (!Types.ObjectId.isValid(req.query.merchantId as string)) {
        return res.status(400).json(err('SRV_001', 'Invalid merchantId'));
      }
      filter.merchantId = new Types.ObjectId(req.query.merchantId as string);
    }
    if (req.query.placement) {
      filter.placement = req.query.placement;
    }

    if (req.query.from || req.query.to) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.from) {
        const d = new Date(req.query.from as string);
        if (isNaN(d.getTime())) return res.status(400).json(err('SRV_001', 'Invalid from date'));
        dateFilter.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to as string);
        if (isNaN(d.getTime())) return res.status(400).json(err('SRV_001', 'Invalid to date'));
        dateFilter.$lte = d;
      }
      filter.createdAt = dateFilter;
    }

    const [ads, total] = await Promise.all([
      // BE-ADS-014: Use hint to ensure compound index is used for merchant populate
      AdCampaign.find(filter)
        .hint({ merchantId: 1, createdAt: -1 })
        .populate('merchantId', 'businessName email')
        .populate('storeId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdCampaign.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: ads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[ADMIN ADS] list error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to retrieve ads'));
  }
});

// ── GET /stats — network-wide stats ─────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [statusCounts, totals] = await Promise.all([
      AdCampaign.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AdCampaign.aggregate([
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: '$impressions' },
            totalClicks: { $sum: '$clicks' },
            totalSpend: { $sum: '$totalSpent' },
          },
        },
      ]),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatus[row._id] = row.count;
    }

    const aggregate = totals[0] || { totalImpressions: 0, totalClicks: 0, totalSpend: 0 };

    return res.json({
      success: true,
      data: {
        byStatus,
        totalImpressions: aggregate.totalImpressions,
        totalClicks: aggregate.totalClicks,
        totalSpend: aggregate.totalSpend,
      },
    });
  } catch (error) {
    logger.error('[ADMIN ADS] stats error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to retrieve stats'));
  }
});

// ── GET /:id — single ad (with caching) ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(err('SRV_001', 'Invalid ad id'));
    }

    // Use cached lookup with population
    const ad = await getCampaignById(req.params.id, {
      populate: ['merchantId', 'storeId', 'reviewedBy']
    });

    if (!ad) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    return res.json({ success: true, data: ad });
  } catch (error) {
    logger.error('[ADMIN ADS] get single error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to retrieve ad'));
  }
});

// ── PATCH /:id/approve — approve ad ─────────────────────────────────────────
router.patch('/:id/approve', async (req: Request, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(err('SRV_001', 'Invalid ad id'));
    }

    // Use cached lookup for verification
    const ad = await getCampaignById(req.params.id);
    if (!ad) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    if (ad.status !== 'pending_review') {
      return res.status(400).json(err('SRV_001', 'Only pending_review ads can be approved'));
    }

    // Fetch fresh from DB for atomic save
    const freshAd = await AdCampaign.findById(req.params.id);
    if (!freshAd) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    freshAd.status = 'active';
    freshAd.reviewedBy = req.userId ? new Types.ObjectId(req.userId) : undefined;
    freshAd.reviewedAt = new Date();
    await freshAd.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    // Notify merchant that ad is approved
    await notifyAdApproved(
      ad.merchantId.toString(),
      ad._id.toString(),
      ad.title,
      ad.placement
    );

    track({
      event: 'campaign_approved',
      intentKey: 'RTMN_COMMERCE_MEMORY',
      properties: {
        merchantId: ad.merchantId.toString(),
        campaignId: ad._id.toString(),
        category: 'GENERAL',
        appType: 'rez-ads-service',
      },
    }).catch((err) => {
  logger.error('[Ads] Operation failed', { error: err });
});

    return res.json({ success: true, data: freshAd, message: 'Ad approved and set to active' });
  } catch (error) {
    logger.error('[ADMIN ADS] approve error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to approve ad'));
  }
});

// ── PATCH /:id/reject — reject ad ───────────────────────────────────────────
router.patch('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      return res.status(400).json(err('SRV_001', 'rejectionReason is required'));
    }
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(err('SRV_001', 'Invalid ad id'));
    }

    // Use cached lookup for verification
    const ad = await getCampaignById(req.params.id);
    if (!ad) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    if (ad.status !== 'pending_review') {
      return res.status(400).json(err('SRV_001', 'Only pending_review ads can be rejected'));
    }

    // Fetch fresh from DB for atomic save
    const freshAd = await AdCampaign.findById(req.params.id);
    if (!freshAd) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    freshAd.status = 'rejected';
    freshAd.rejectionReason = rejectionReason.trim();
    freshAd.reviewedBy = req.userId ? new Types.ObjectId(req.userId) : undefined;
    freshAd.reviewedAt = new Date();
    await freshAd.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    // Notify merchant that ad was rejected (with reason)
    await notifyAdRejected(
      ad.merchantId.toString(),
      ad._id.toString(),
      ad.title,
      rejectionReason.trim()
    );

    return res.json({ success: true, data: freshAd, message: 'Ad rejected' });
  } catch (error) {
    logger.error('[ADMIN ADS] reject error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to reject ad'));
  }
});

// ── PATCH /:id/pause — force pause active ad ────────────────────────────────
router.patch('/:id/pause', async (req: Request, res: Response) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(err('SRV_001', 'Invalid ad id'));
    }

    // Use cached lookup for verification
    const ad = await getCampaignById(req.params.id);
    if (!ad) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    if (ad.status !== 'active') {
      return res.status(400).json(err('SRV_001', 'Only active ads can be paused'));
    }

    // Fetch fresh from DB for atomic save
    const freshAd = await AdCampaign.findById(req.params.id);
    if (!freshAd) {
      return res.status(404).json(err('RES_NOT_FOUND', 'Ad not found'));
    }

    freshAd.status = 'paused';
    await freshAd.save();

    // Invalidate cache after update
    await invalidateCampaignCache(req.params.id);

    return res.json({ success: true, data: freshAd, message: 'Ad paused by admin' });
  } catch (error) {
    logger.error('[ADMIN ADS] pause error:', error);
    return res.status(500).json(err('SRV_001', 'Failed to pause ad'));
  }
});

export default router;
