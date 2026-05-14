"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const AudienceBuilder_1 = require("../audience/AudienceBuilder");
const InterestEngine_1 = require("../audience/InterestEngine");
const UserInterestProfile_1 = require("../models/UserInterestProfile");
const notificationService_1 = require("../services/notificationService");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
/**
 * POST /audience/estimate
 * Returns estimated audience size for a given filter.
 * Used by the UI to show reach count before campaign launch.
 * BAK-MKT-003 FIX: Uses req.merchantId from JWT, not body.merchantId.
 */
router.post('/estimate', auth_1.verifyMerchant, async (req, res) => {
    const { filter, channel = 'whatsapp' } = req.body;
    if (!filter) {
        return res.status(400).json({ error: 'filter required' });
    }
    const count = await AudienceBuilder_1.audienceBuilder.estimate(req.merchantId, filter);
    res.json({ estimatedCount: count, channel });
});
/**
 * GET /audience/interests
 * Returns available interest tags with user counts.
 * Used to populate the interest picker in the Ads Manager UI.
 */
router.get('/interests', auth_1.verifyConsumer, async (_req, res) => {
    const result = await UserInterestProfile_1.UserInterestProfile.aggregate([
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
router.get('/locations', auth_1.verifyConsumer, async (_req, res) => {
    const [cities, areas] = await Promise.all([
        UserInterestProfile_1.UserInterestProfile.aggregate([
            { $match: { 'primaryLocation.city': { $exists: true } } },
            { $group: { _id: '$primaryLocation.city', userCount: { $sum: 1 } } },
            { $sort: { userCount: -1 } },
            { $limit: 20 },
        ]),
        UserInterestProfile_1.UserInterestProfile.aggregate([
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
router.get('/institutions', auth_1.verifyConsumer, async (_req, res) => {
    const result = await UserInterestProfile_1.UserInterestProfile.aggregate([
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
router.post('/search-signal', auth_1.verifyInternal, async (req, res) => {
    const { userId, term } = req.body;
    if (!userId || !term)
        return res.status(400).json({ error: 'userId and term required' });
    await InterestEngine_1.interestEngine.recordSearch(userId, term);
    res.json({ recorded: true });
});
/**
 * POST /audience/location-signal
 * Updates location signals for a user from an order delivery address.
 * Called by rez-backend after each order placement.
 * BAK-MKT-006 FIX: Added verifyInternal auth — previously no auth, anyone could
 * inject fake GPS locations for any userId, corrupting the behavioral profile.
 */
router.post('/location-signal', auth_1.verifyInternal, async (req, res) => {
    const { userId, address } = req.body;
    if (!userId || !address)
        return res.status(400).json({ error: 'userId and address required' });
    await InterestEngine_1.interestEngine.updateLocationFromOrder(userId, address);
    res.json({ updated: true });
});
/**
 * POST /audience/segment/sync
 * Syncs notification preferences for an audience segment.
 * Called when audience segment is updated to sync user notification preferences
 * with the notification service.
 * MKT-NOTIF-003: Audience segment updated → Sync notification preferences
 */
router.post('/segment/sync', auth_1.verifyInternal, async (req, res) => {
    const { merchantId, segmentId, userIds } = req.body;
    if (!merchantId || !segmentId || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'merchantId, segmentId, and userIds array are required' });
    }
    const result = await (0, notificationService_1.syncAudiencePreferences)(merchantId, segmentId, userIds);
    if (!result.success) {
        logger_1.logger.warn('[Audience] Segment sync failed', { segmentId, error: result.error });
    }
    res.json({
        success: result.success,
        synced: result.synced,
        error: result.error,
    });
});
exports.default = router;
//# sourceMappingURL=audience.js.map