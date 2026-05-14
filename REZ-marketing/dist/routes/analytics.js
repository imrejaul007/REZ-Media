"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const CampaignAnalytics_1 = require("../analytics/CampaignAnalytics");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// BAK-MKT-003 FIX: All analytics routes require merchant authentication.
// Previously had no auth middleware — any caller could query any merchant's analytics.
router.use(auth_1.verifyMerchant);
// GET /analytics/summary?days=30 — uses req.merchantId from JWT, not query param
router.get('/summary', async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const summary = await CampaignAnalytics_1.campaignAnalytics.getMerchantSummary(req.merchantId, days);
    res.json(summary);
});
// GET /analytics/campaign/:id — requires merchant owns the campaign
router.get('/campaign/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const metrics = await CampaignAnalytics_1.campaignAnalytics.getCampaignMetrics(req.params.id);
    if (!metrics)
        return res.status(404).json({ error: 'Not found' });
    // BAK-MKT-003 FIX: Verify the merchant owns this campaign
    if (metrics.merchantId && metrics.merchantId !== req.merchantId) {
        return res.status(403).json({ error: 'Forbidden: you do not own this campaign' });
    }
    res.json(metrics);
});
// POST /analytics/track/open
router.post('/track/open', async (req, res) => {
    const { campaignId } = req.body;
    if (!campaignId)
        return res.status(400).json({ error: 'campaignId required' });
    await CampaignAnalytics_1.campaignAnalytics.trackOpen(campaignId);
    res.json({ tracked: true });
});
// POST /analytics/track/click
router.post('/track/click', async (req, res) => {
    const { campaignId } = req.body;
    if (!campaignId)
        return res.status(400).json({ error: 'campaignId required' });
    await CampaignAnalytics_1.campaignAnalytics.trackClick(campaignId);
    res.json({ tracked: true });
});
// POST /analytics/track/conversion — merchantId from JWT, userId from body
router.post('/track/conversion', async (req, res) => {
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    // BAK-MKT-003 FIX: Use req.merchantId from JWT, not body.merchantId
    await CampaignAnalytics_1.campaignAnalytics.trackConversion(req.merchantId, userId);
    res.json({ tracked: true });
});
exports.default = router;
//# sourceMappingURL=analytics.js.map