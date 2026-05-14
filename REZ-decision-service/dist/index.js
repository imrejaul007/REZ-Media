"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const targeting_1 = require("./services/targeting");
const action_1 = require("./services/action");
const sampling_1 = __importDefault(require("./routes/sampling"));
const samplingAnalytics_1 = __importDefault(require("./routes/samplingAnalytics"));
const attribution_1 = require("./engines/sampling/attribution");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4027;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ============================================
// TARGETING ROUTES
// ============================================
app.get('/api/targeting/segments/:userId', async (req, res) => {
    try {
        const segments = await targeting_1.targetingEngine.evaluate(req.params.userId);
        res.json({ success: true, data: segments });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to evaluate segments' });
    }
});
app.post('/api/targeting/evaluate', async (req, res) => {
    try {
        const { userId, campaignId } = req.body;
        const segments = await targeting_1.targetingEngine.evaluate(userId);
        const variant = targeting_1.targetingEngine.assignVariant(userId, campaignId);
        res.json({ success: true, segments, variant });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to evaluate' });
    }
});
// ============================================
// FREQUENCY ROUTES
// ============================================
app.get('/api/frequency/:userId/:campaignId/:channel', async (req, res) => {
    try {
        const { userId, campaignId, channel } = req.params;
        const allowed = await targeting_1.targetingEngine.checkFrequencyCap(userId, campaignId, channel);
        res.json({ success: true, allowed });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to check frequency' });
    }
});
app.post('/api/frequency/record', async (req, res) => {
    try {
        const { userId, campaignId, channel } = req.body;
        await targeting_1.targetingEngine.recordImpression(userId, campaignId, channel);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to record' });
    }
});
// ============================================
// ACTION ROUTES
// ============================================
app.post('/api/actions/execute', async (req, res) => {
    try {
        const { type, payload, userId, level } = req.body;
        const result = await action_1.actionEngine.execute({
            id: `action-${Date.now()}`,
            type,
            payload,
            userId,
            level
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to execute' });
    }
});
app.get('/api/actions/pending', async (req, res) => {
    try {
        const actions = await action_1.actionEngine.getPending();
        res.json({ success: true, data: actions });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to get pending' });
    }
});
app.post('/api/actions/:id/approve', async (req, res) => {
    try {
        const result = await action_1.actionEngine.approve(req.params.id);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to approve' });
    }
});
app.post('/api/actions/:id/reject', async (req, res) => {
    try {
        const { reason } = req.body;
        await action_1.actionEngine.reject(req.params.id, reason);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to reject' });
    }
});
// ============================================
// SAMPLING ROUTES (NEW)
// ============================================
app.use('/api/sampling', sampling_1.default);
// ============================================
// SAMPLING ANALYTICS ROUTES (Phase 3)
// ============================================
app.use('/api/sampling/analytics', samplingAnalytics_1.default);
// ============================================
// ATTRIBUTION ROUTES (Phase 3)
// ============================================
/**
 * Track an attribution event
 * POST /api/attribution/track
 */
app.post('/api/attribution/track', async (req, res) => {
    try {
        const { userId, campaignId, merchantId, event, value, metadata } = req.body;
        if (!userId || !campaignId || !merchantId || !event) {
            return res.status(400).json({
                success: false,
                error: 'userId, campaignId, merchantId, and event are required'
            });
        }
        const result = await attribution_1.attributionTracker.trackEvent({
            userId,
            campaignId,
            merchantId,
            event,
            timestamp: new Date(),
            value,
            metadata
        });
        res.json({
            success: result.success,
            eventId: result.eventId,
            error: result.error
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Track error:', error);
        res.status(500).json({ success: false, error: 'Failed to track event' });
    }
});
/**
 * Get attribution summary for a user
 * GET /api/attribution/summary/:userId
 */
app.get('/api/attribution/summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const windowDays = parseInt(req.query.window) || 7;
        const summary = await attribution_1.attributionTracker.getAttributionSummary(userId, windowDays);
        res.json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Summary error:', error);
        res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
});
/**
 * Calculate attribution for a conversion
 * POST /api/attribution/attribute
 */
app.post('/api/attribution/attribute', async (req, res) => {
    try {
        const { userId, campaignId, conversionValue, model } = req.body;
        if (!userId || !campaignId || conversionValue === undefined) {
            return res.status(400).json({
                success: false,
                error: 'userId, campaignId, and conversionValue are required'
            });
        }
        const attributionModel = model || 'last-touch';
        const results = await attribution_1.attributionTracker.calculateAttribution(userId, campaignId, conversionValue, 'purchase', attributionModel);
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Attribute error:', error);
        res.status(500).json({ success: false, error: 'Failed to calculate attribution' });
    }
});
/**
 * Record a conversion (track + attribute)
 * POST /api/attribution/conversion
 */
app.post('/api/attribution/conversion', async (req, res) => {
    try {
        const { userId, campaignId, merchantId, conversionType, value, model } = req.body;
        if (!userId || !campaignId || !merchantId || !conversionType || value === undefined) {
            return res.status(400).json({
                success: false,
                error: 'userId, campaignId, merchantId, conversionType, and value are required'
            });
        }
        const attributionModel = model || 'last-touch';
        const results = await attribution_1.attributionTracker.recordConversion(userId, campaignId, merchantId, conversionType, value, attributionModel);
        res.json({
            success: true,
            data: results
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Conversion error:', error);
        res.status(500).json({ success: false, error: 'Failed to record conversion' });
    }
});
/**
 * Get campaign attribution stats
 * GET /api/attribution/campaign/:campaignId
 */
app.get('/api/attribution/campaign/:campaignId', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const stats = await attribution_1.attributionTracker.getCampaignAttribution(campaignId);
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Campaign stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get campaign stats' });
    }
});
/**
 * Quick attribution event tracking
 * POST /api/attribution/event/:eventType
 */
app.post('/api/attribution/event/:eventType', async (req, res) => {
    try {
        const { eventType } = req.params;
        const { userId, campaignId, merchantId, value, metadata } = req.body;
        const validEvents = ['scan', 'visit', 'redeem', 'purchase', 'repeat'];
        if (!validEvents.includes(eventType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid event type. Must be one of: ${validEvents.join(', ')}`
            });
        }
        if (!userId || !campaignId || !merchantId) {
            return res.status(400).json({
                success: false,
                error: 'userId, campaignId, and merchantId are required'
            });
        }
        const { trackScan, trackVisit, trackRedeem, trackPurchase, trackRepeat } = await import('./engines/sampling/attribution');
        let result;
        switch (eventType) {
            case 'scan':
                result = await trackScan(userId, campaignId, merchantId, metadata);
                break;
            case 'visit':
                result = await trackVisit(userId, campaignId, merchantId, metadata);
                break;
            case 'redeem':
                result = await trackRedeem(userId, campaignId, merchantId, value, metadata);
                break;
            case 'purchase':
                result = await trackPurchase(userId, campaignId, merchantId, value, metadata);
                break;
            case 'repeat':
                result = await trackRepeat(userId, campaignId, merchantId, metadata);
                break;
        }
        res.json({
            success: result.success,
            eventId: result.eventId,
            error: result.error
        });
    }
    catch (error) {
        console.error('[ATTRIBUTION] Event tracking error:', error);
        res.status(500).json({ success: false, error: 'Failed to track event' });
    }
});
// ============================================
// HEALTH
// ============================================
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'decision-service' });
});
app.listen(PORT, () => {
    console.log(`Decision service running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map