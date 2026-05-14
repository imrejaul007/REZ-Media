"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const growthAnalytics_1 = require("../services/growthAnalytics");
const router = (0, express_1.Router)();
// ─── Validation Schemas ────────────────────────────────────────────────────────
const trackEventSchema = zod_1.z.object({
    eventType: zod_1.z.enum([
        'campaign_created',
        'ad_impression',
        'ad_click',
        'notification_sent',
        'notification_opened',
        'voucher_issued',
        'conversion',
    ]),
    sourceService: zod_1.z.enum(['marketing', 'ads', 'notification', 'analytics']),
    userId: zod_1.z.string().optional(),
    merchantId: zod_1.z.string().min(1, 'merchantId is required'),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    value: zod_1.z.number().optional(),
    timestamp: zod_1.z.string().datetime().optional(),
    sessionId: zod_1.z.string().optional(),
});
const dateRangeSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    days: zod_1.z.coerce.number().min(1).max(365).optional().default(30),
    groupBy: zod_1.z.enum(['day', 'week', 'month']).optional(),
    adSpend: zod_1.z.coerce.number().min(0).optional(),
});
const campaignIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Campaign ID is required'),
});
const merchantIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Merchant ID is required'),
});
// ─── Routes ────────────────────────────────────────────────────────────────────
/**
 * POST /api/analytics/track
 * Track any growth event from marketing, ads, or notification services.
 */
router.post('/track', async (req, res) => {
    const parseResult = trackEventSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: 'Validation failed',
            details: parseResult.error.issues,
        });
        return;
    }
    const input = parseResult.data;
    // Validate merchantId is a valid ObjectId
    if (!mongoose_1.default.isValidObjectId(input.merchantId)) {
        res.status(400).json({ error: 'Invalid merchantId format' });
        return;
    }
    // Validate userId if provided
    if (input.userId && !mongoose_1.default.isValidObjectId(input.userId)) {
        res.status(400).json({ error: 'Invalid userId format' });
        return;
    }
    const event = await growthAnalytics_1.growthAnalytics.trackEvent({
        eventType: input.eventType,
        sourceService: input.sourceService,
        userId: input.userId,
        merchantId: input.merchantId,
        metadata: input.metadata,
        value: input.value,
        timestamp: input.timestamp ? new Date(input.timestamp) : undefined,
        sessionId: input.sessionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });
    res.status(201).json({
        success: true,
        eventId: event._id,
        eventType: event.eventType,
        timestamp: event.timestamp,
    });
});
/**
 * POST /api/analytics/track/batch
 * Track multiple growth events in a single request.
 */
router.post('/track/batch', async (req, res) => {
    const events = req.body.events;
    if (!Array.isArray(events)) {
        res.status(400).json({ error: 'events must be an array' });
        return;
    }
    if (events.length > 100) {
        res.status(400).json({ error: 'Maximum 100 events per batch' });
        return;
    }
    const results = [];
    for (let i = 0; i < events.length; i++) {
        const parseResult = trackEventSchema.safeParse(events[i]);
        if (!parseResult.success) {
            results.push({
                index: i,
                success: false,
                error: parseResult.error.issues[0]?.message || 'Validation failed',
            });
            continue;
        }
        const input = parseResult.data;
        try {
            if (!mongoose_1.default.isValidObjectId(input.merchantId)) {
                results.push({ index: i, success: false, error: 'Invalid merchantId' });
                continue;
            }
            const event = await growthAnalytics_1.growthAnalytics.trackEvent({
                eventType: input.eventType,
                sourceService: input.sourceService,
                userId: input.userId,
                merchantId: input.merchantId,
                metadata: input.metadata,
                value: input.value,
                timestamp: input.timestamp ? new Date(input.timestamp) : undefined,
                sessionId: input.sessionId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            results.push({ index: i, success: true, eventId: event._id?.toString() });
        }
        catch (err) {
            results.push({
                index: i,
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    }
    const successCount = results.filter((r) => r.success).length;
    res.status(successCount === results.length ? 201 : 207).json({
        total: events.length,
        successCount,
        failedCount: events.length - successCount,
        results,
    });
});
/**
 * GET /api/analytics/campaign/:id
 * Full campaign analytics combining all growth events.
 */
router.get('/campaign/:id', async (req, res) => {
    const parseResult = merchantIdSchema.extend({
        id: zod_1.z.string(),
    }).safeParse({ ...req.params, ...req.query });
    if (!parseResult.success) {
        res.status(400).json({ error: 'Invalid parameters' });
        return;
    }
    const { id } = parseResult.data;
    const merchantId = req.query.merchantId;
    if (!merchantId) {
        res.status(400).json({ error: 'merchantId query parameter is required' });
        return;
    }
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        res.status(400).json({ error: 'Invalid merchantId format' });
        return;
    }
    const metrics = await growthAnalytics_1.growthAnalytics.getCampaignMetrics({
        campaignId: id,
        merchantId,
    });
    if (!metrics) {
        res.status(404).json({ error: 'No events found for this campaign' });
        return;
    }
    res.json(metrics);
});
/**
 * GET /api/analytics/merchant/:id
 * Merchant growth dashboard with all metrics.
 */
router.get('/merchant/:id', async (req, res) => {
    const merchantId = req.params.id;
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        res.status(400).json({ error: 'Invalid merchantId format' });
        return;
    }
    const parseResult = dateRangeSchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: 'Invalid query parameters',
            details: parseResult.error.issues,
        });
        return;
    }
    const { startDate, endDate, days } = parseResult.data;
    // Default to last N days if not specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);
    const dashboard = await growthAnalytics_1.growthAnalytics.getMerchantDashboard(merchantId, start, end);
    res.json(dashboard);
});
/**
 * GET /api/analytics/funnel
 * Conversion funnel from impression to conversion.
 */
router.get('/funnel', async (req, res) => {
    const parseResult = dateRangeSchema.extend({
        merchantId: zod_1.z.string().min(1, 'merchantId is required'),
    }).safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: 'Invalid query parameters',
            details: parseResult.error.issues,
        });
        return;
    }
    const { merchantId, startDate, endDate, days, groupBy } = parseResult.data;
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        res.status(400).json({ error: 'Invalid merchantId format' });
        return;
    }
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);
    const funnel = await growthAnalytics_1.growthAnalytics.getConversionFunnel({
        merchantId,
        startDate: start,
        endDate: end,
        groupBy: groupBy || 'day',
    });
    res.json(funnel);
});
/**
 * GET /api/analytics/roas
 * Return on Ad Spend calculation.
 */
router.get('/roas', async (req, res) => {
    const parseResult = dateRangeSchema.extend({
        merchantId: zod_1.z.string().min(1, 'merchantId is required'),
        adSpend: zod_1.z.coerce.number().min(0, 'adSpend must be non-negative'),
    }).safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: 'Invalid query parameters',
            details: parseResult.error.issues,
        });
        return;
    }
    const { merchantId, startDate, endDate, days, adSpend } = parseResult.data;
    if (!mongoose_1.default.isValidObjectId(merchantId)) {
        res.status(400).json({ error: 'Invalid merchantId format' });
        return;
    }
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);
    const roas = await growthAnalytics_1.growthAnalytics.getROAS({
        merchantId,
        startDate: start,
        endDate: end,
        adSpend: adSpend || 0,
    });
    res.json(roas);
});
/**
 * GET /api/analytics/events
 * Query raw events with filters (admin/debug use).
 */
router.get('/events', async (req, res) => {
    const merchantId = req.query.merchantId;
    if (!merchantId || !mongoose_1.default.isValidObjectId(merchantId)) {
        res.status(400).json({ error: 'Valid merchantId is required' });
        return;
    }
    const eventTypes = req.query.eventTypes
        ? req.query.eventTypes.split(',')
        : undefined;
    const startDate = req.query.startDate
        ? new Date(req.query.startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate
        ? new Date(req.query.endDate)
        : new Date();
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const skip = parseInt(req.query.skip) || 0;
    const query = {
        merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
        timestamp: { $gte: startDate, $lte: endDate },
    };
    if (eventTypes) {
        query.eventType = { $in: eventTypes };
    }
    const [events, total] = await Promise.all([
        mongoose_1.default.connection
            .collection('growth_events')
            .find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        mongoose_1.default.connection.collection('growth_events').countDocuments(query),
    ]);
    res.json({
        events,
        pagination: {
            total,
            limit,
            skip,
            hasMore: skip + events.length < total,
        },
    });
});
exports.default = router;
//# sourceMappingURL=growthAnalytics.js.map