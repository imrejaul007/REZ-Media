import { Router, Request, Response } from 'express';
import { verifyConsumer, verifyMerchant, verifyInternal } from '../middleware/auth';
import { audienceBuilder } from '../audience/AudienceBuilder';
import { interestEngine } from '../audience/InterestEngine';
import { UserInterestProfile } from '../models/UserInterestProfile';
import { IAudienceFilter } from '../models/MarketingCampaign';
import { syncAudiencePreferences } from '../services/notificationService';
import { logger } from '../config/logger';

const router = Router();

/**
 * POST /audience/estimate
 * Returns estimated audience size for a given filter.
 * Used by the UI to show reach count before campaign launch.
 * BAK-MKT-003 FIX: Uses req.merchantId from JWT, not body.merchantId.
 */
router.post('/estimate', verifyMerchant, async (req: Request, res: Response) => {
  const { filter, channel = 'whatsapp' } = req.body;
  if (!filter) {
    return res.status(400).json({ error: 'filter required' });
  }

  const count = await audienceBuilder.estimate(req.merchantId!, filter as IAudienceFilter);
  res.json({ estimatedCount: count, channel });
});

/**
 * GET /audience/interests
 * Returns available interest tags with user counts.
 * Used to populate the interest picker in the Ads Manager UI.
 */
router.get('/interests', verifyConsumer, async (_req: Request, res: Response) => {
  const result = await UserInterestProfile.aggregate([
    { $unwind: '$interests' },
    { $match: { 'interests.score': { $gte: 20 } } },
    { $group: { _id: '$interests.tag', userCount: { $sum: 1 } } },
    { $sort: { userCount: -1 } },
    { $limit: 50 },
  ]);

  res.json({ interests: result.map((r) => ({ tag: r._id, userCount: r.userCount })) });
});

/**
 * GET /audience/locations
 * Returns top areas/cities with user counts.
 * Used to populate location picker in Ads Manager.
 */
router.get('/locations', verifyConsumer, async (_req: Request, res: Response) => {
  const [cities, areas] = await Promise.all([
    UserInterestProfile.aggregate([
      { $match: { 'primaryLocation.city': { $exists: true } } },
      { $group: { _id: '$primaryLocation.city', userCount: { $sum: 1 } } },
      { $sort: { userCount: -1 } },
      { $limit: 20 },
    ]),
    UserInterestProfile.aggregate([
      { $match: { 'primaryLocation.area': { $exists: true } } },
      { $group: { _id: '$primaryLocation.area', userCount: { $sum: 1 } } },
      { $sort: { userCount: -1 } },
      { $limit: 50 },
    ]),
  ]);

  res.json({
    cities: cities.map((c) => ({ name: c._id, userCount: c.userCount })),
    areas: areas.map((a) => ({ name: a._id, userCount: a.userCount })),
  });
});

/**
 * GET /audience/institutions
 * Returns institutions with user counts.
 */
router.get('/institutions', verifyConsumer, async (_req: Request, res: Response) => {
  const result = await UserInterestProfile.aggregate([
    { $match: { 'institution.name': { $exists: true } } },
    { $group: { _id: { name: '$institution.name', type: '$institution.type', area: '$institution.area' }, userCount: { $sum: 1 } } },
    { $sort: { userCount: -1 } },
    { $limit: 100 },
  ]);

  res.json({
    institutions: result.map((r) => ({
      name: r._id.name,
      type: r._id.type,
      area: r._id.area,
      userCount: r.userCount,
    })),
  });
});

/**
 * POST /audience/search-signal
 * Records a user keyword search from the REZ consumer app.
 * Called by rez-backend after each user search event.
 * BAK-MKT-005 FIX: Added verifyInternal auth — previously no auth, anyone could
 * inject fake search terms for any userId, polluting the interest graph.
 */
router.post('/search-signal', verifyInternal, async (req: Request, res: Response) => {
  const { userId, term } = req.body;
  if (!userId || !term) return res.status(400).json({ error: 'userId and term required' });

  await interestEngine.recordSearch(userId, term);
  res.json({ recorded: true });
});

/**
 * POST /audience/location-signal
 * Updates location signals for a user from an order delivery address.
 * Called by rez-backend after each order placement.
 * BAK-MKT-006 FIX: Added verifyInternal auth — previously no auth, anyone could
 * inject fake GPS locations for any userId, corrupting the behavioral profile.
 */
router.post('/location-signal', verifyInternal, async (req: Request, res: Response) => {
  const { userId, address } = req.body;
  if (!userId || !address) return res.status(400).json({ error: 'userId and address required' });

  await interestEngine.updateLocationFromOrder(userId, address);
  res.json({ updated: true });
});

/**
 * POST /audience/segment/sync
 * Syncs notification preferences for an audience segment.
 * Called when audience segment is updated to sync user notification preferences
 * with the notification service.
 * MKT-NOTIF-003: Audience segment updated → Sync notification preferences
 */
router.post('/segment/sync', verifyInternal, async (req: Request, res: Response) => {
  const { merchantId, segmentId, userIds } = req.body;
  if (!merchantId || !segmentId || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'merchantId, segmentId, and userIds array are required' });
  }

  const result = await syncAudiencePreferences(merchantId, segmentId, userIds);

  if (!result.success) {
    logger.warn('[Audience] Segment sync failed', { segmentId, error: result.error });
  }

  res.json({
    success: result.success,
    synced: result.synced,
    error: result.error,
  });
});

export default router;
