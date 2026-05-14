"use strict";
// @ts-nocheck
/**
 * Conversion Event Routes
 *
 * Receives conversion events from other services (order, payment, etc.)
 * to track attribution and update ad targeting.
 * Forwards events to event-platform for unified analytics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const intentCaptureService_1 = require("../services/intentCaptureService");
const logger_1 = require("../config/logger");
const eventPlatform_1 = require("../config/eventPlatform");
const router = (0, express_1.Router)();
// Simple validation without zod
function isValidConversion(data) {
    return data && typeof data.eventType === 'string' && typeof data.userId === 'string';
}
/**
 * POST /api/events/conversion
 * Receives order completion events from order service
 */
router.post('/api/events/conversion', async (req, res) => {
    try {
        if (!isValidConversion(req.body)) {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }
        const { userId, orderId, value, merchantId, campaignId } = req.body;
        logger_1.logger.info('[Ads] Conversion event received', { userId, orderId, value });
        // Track intent for ad targeting
        (0, intentCaptureService_1.track)({
            userId,
            event: 'conversion',
            intentKey: `order_${orderId}`,
            properties: {
                orderId,
                value,
                merchantId,
            },
        }).catch((err) => {
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        // Forward to event-platform for unified analytics (non-blocking)
        (0, eventPlatform_1.emitConversion)({
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
    }
    catch (err) {
        logger_1.logger.error('[Ads] Conversion event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
/**
 * POST /api/events/attribution
 * Receives attribution data from other services
 */
router.post('/api/events/attribution', async (req, res) => {
    try {
        const { userId, source, campaignId, action } = req.body;
        logger_1.logger.info('[Ads] Attribution event received', { userId, source, campaignId, action });
        (0, intentCaptureService_1.track)({
            userId,
            event: action || 'attribution',
            intentKey: source || 'unknown',
            properties: {
                campaignId,
                source,
                action,
            },
        }).catch((err) => {
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Ads] Attribution event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
/**
 * POST /api/events/roi
 * Receives ROI data from other services
 */
router.post('/api/events/roi', async (req, res) => {
    try {
        const { campaignId, revenue, cost } = req.body;
        logger_1.logger.info('[Ads] ROI event received', { campaignId, revenue, cost });
        (0, intentCaptureService_1.track)({
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
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Ads] ROI event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
exports.default = router;
//# sourceMappingURL=conversion.js.map