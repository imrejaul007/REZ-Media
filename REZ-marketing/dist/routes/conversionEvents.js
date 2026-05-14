"use strict";
/**
 * Conversion Event Routes
 *
 * Receives conversion events from other services (order, payment, etc.)
 * to trigger marketing campaigns and track attribution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const intentCaptureService_1 = require("../services/intentCaptureService");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
// Validation schemas
const conversionSchema = zod_1.z.object({
    eventType: zod_1.z.string(),
    userId: zod_1.z.string(),
    orderId: zod_1.z.string(),
    orderNumber: zod_1.z.string().optional(),
    total: zod_1.z.number(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        quantity: zod_1.z.number(),
        price: zod_1.z.number(),
    })).optional(),
    merchantId: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
});
const abandonmentSchema = zod_1.z.object({
    eventType: zod_1.z.string(),
    userId: zod_1.z.string(),
    cartId: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        price: zod_1.z.number(),
    })),
    timestamp: zod_1.z.string().optional(),
});
/**
 * POST /api/events/conversion
 * Receives order completion events from order service
 */
router.post('/api/events/conversion', auth_1.requireInternalToken, async (req, res) => {
    try {
        const parsed = conversionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }
        const { userId, orderId, orderNumber, total, items, merchantId } = parsed.data;
        logger_1.logger.info('[Marketing] Conversion event received', { userId, orderId, total });
        // Track intent for personalization
        (0, intentCaptureService_1.track)({
            userId,
            event: 'conversion',
            intentKey: `order_${orderId}`,
            properties: {
                orderId,
                orderNumber,
                total,
                itemCount: items?.length || 0,
                merchantId,
            },
        }).catch(() => { });
        // TODO: Trigger welcome campaign sequence
        // TODO: Enroll in loyalty program
        // TODO: Trigger upsell recommendations
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Marketing] Conversion event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
/**
 * POST /api/events/abandonment
 * Receives cart abandonment events
 */
router.post('/api/events/abandonment', auth_1.requireInternalToken, async (req, res) => {
    try {
        const parsed = abandonmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }
        const { userId, cartId, items } = parsed.data;
        logger_1.logger.info('[Marketing] Abandonment event received', { userId, cartId });
        // Track for retargeting
        (0, intentCaptureService_1.track)({
            userId,
            event: 'cart_abandoned',
            intentKey: `cart_${cartId}`,
            properties: {
                cartId,
                itemCount: items.length,
                totalValue: items.reduce((sum, i) => sum + i.price, 0),
            },
        }).catch(() => { });
        // TODO: Trigger abandonment email sequence
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Marketing] Abandonment event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
exports.default = router;
//# sourceMappingURL=conversionEvents.js.map