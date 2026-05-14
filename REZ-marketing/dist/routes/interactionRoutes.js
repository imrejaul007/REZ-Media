"use strict";
/**
 * Ad interaction routes — auth-protected impression and click tracking.
 *
 * These routes are called by client apps when a user views or clicks on
 * an ad served by the marketing campaign system. Authentication is required
 * (JWT user token via Authorization header). Returns 401 for anonymous requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const logger_1 = require("../config/logger");
const billingService_1 = require("../services/billingService");
const intentCaptureService_1 = require("../services/intentCaptureService");
const router = (0, express_1.Router)();
const billingService = new billingService_1.BillingService();
/**
 * POST /interaction/:id/impression
 *
 * Records an ad impression and deducts from the campaign budget.
 * Requires authenticated user (req.userId must be set by auth middleware).
 */
router.post('/:id/impression', async (req, res) => {
    try {
        const { id: adId } = req.params;
        const userId = req.userId;
        const ip = req.ip || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ success: false, message: 'Invalid ad ID' });
        }
        await billingService.chargeCampaign(adId, 'CPM', 1);
        logger_1.logger.info('[Interaction] Ad impression recorded', {
            adId,
            userId,
            ip,
            userAgent,
        });
        // RTMN Commerce Memory: track ad impression as engagement intent
        (0, intentCaptureService_1.track)({ userId, event: 'ad_impression', intentKey: `marketing_ad_${adId}`, properties: { campaignId: adId } }).catch(() => { });
        return res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('[Interaction] Impression tracking failed', {
            adId: req.params.id,
            error: error.message,
        });
        return res.status(500).json({ success: false, message: 'Failed to record impression' });
    }
});
/**
 * POST /interaction/:id/click
 *
 * Records an ad click (higher cost than impression) and deducts from the
 * campaign budget. Requires authenticated user.
 */
router.post('/:id/click', async (req, res) => {
    try {
        const { id: adId } = req.params;
        const userId = req.userId;
        const ip = req.ip || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ success: false, message: 'Invalid ad ID' });
        }
        await billingService.chargeCampaign(adId, 'CPC', 1);
        logger_1.logger.info('[Interaction] Ad click recorded', {
            adId,
            userId,
            ip,
            userAgent,
        });
        // RTMN Commerce Memory: track ad click as engagement intent
        (0, intentCaptureService_1.track)({ userId, event: 'ad_click', intentKey: `marketing_ad_${adId}`, properties: { campaignId: adId } }).catch(() => { });
        return res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('[Interaction] Click tracking failed', {
            adId: req.params.id,
            error: error.message,
        });
        return res.status(500).json({ success: false, message: 'Failed to record click' });
    }
});
exports.default = router;
//# sourceMappingURL=interactionRoutes.js.map