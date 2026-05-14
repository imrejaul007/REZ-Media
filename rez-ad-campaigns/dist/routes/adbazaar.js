"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const AdInteraction_1 = __importDefault(require("../models/AdInteraction"));
const intentCaptureService_1 = require("../services/intentCaptureService");
const logger_1 = require("../config/logger");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
const INTERNAL_KEY = process.env.ADBAZAAR_INTERNAL_KEY || process.env.INTERNAL_SERVICE_TOKEN;
function verifyInternal(req, res, next) {
    const key = req.headers['x-internal-key'] || req.headers['x-internal-token'];
    if (key !== INTERNAL_KEY) {
        return res.status(401).json((0, response_1.err)('SRV_001', 'Unauthorized'));
    }
    next();
}
// ── POST /adbazaar/campaign — Create campaign from AdBazaar ─────────────────
router.post('/adbazaar/campaign', verifyInternal, async (req, res) => {
    try {
        const { merchantId, merchantName, adBazaarBookingId, title, description, targetUrl, budget, startDate, endDate, targeting, } = req.body;
        const campaign = new AdCampaign_1.default({
            merchantId,
            merchantName,
            adBazaarBookingId,
            name: title,
            description,
            targetUrl,
            budget,
            startDate,
            endDate,
            targeting,
            status: 'pending',
            source: 'adbazaar',
        });
        await campaign.save();
        // Track in intent graph
        (0, intentCaptureService_1.track)({
            userId: merchantId,
            event: 'campaign_created',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: {
                campaignId: campaign._id.toString(),
                bookingId: adBazaarBookingId,
                merchantId,
                source: 'adbazaar',
            },
        });
        res.status(201).json({
            success: true,
            campaignId: campaign._id.toString(),
            status: campaign.status,
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating AdBazaar campaign', { error });
        res.status(500).json((0, response_1.err)('SRV_001', 'Failed to create campaign'));
    }
});
// ── POST /adbazaar/impression ───────────────────────────────────────────────
router.post('/adbazaar/impression', verifyInternal, async (req, res) => {
    try {
        const { adBazaarBookingId, userId, metadata } = req.body;
        const interaction = new AdInteraction_1.default({
            campaignId: adBazaarBookingId,
            userId,
            type: 'impression',
            metadata,
        });
        await interaction.save();
        // Track in intent graph
        (0, intentCaptureService_1.track)({
            userId,
            event: 'ad_impression',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
        });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Error tracking impression', { error });
        res.status(500).json((0, response_1.err)('SRV_001', 'Failed to track impression'));
    }
});
// ── POST /adbazaar/click ──────────────────────────────────────────────────
router.post('/adbazaar/click', verifyInternal, async (req, res) => {
    try {
        const { adBazaarBookingId, userId, metadata } = req.body;
        const interaction = new AdInteraction_1.default({
            campaignId: adBazaarBookingId,
            userId,
            type: 'click',
            metadata,
        });
        await interaction.save();
        (0, intentCaptureService_1.track)({
            userId,
            event: 'ad_click',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
        });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Error tracking click', { error });
        res.status(500).json((0, response_1.err)('SRV_001', 'Failed to track click'));
    }
});
// ── POST /adbazaar/conversion ─────────────────────────────────────────────
router.post('/adbazaar/conversion', verifyInternal, async (req, res) => {
    try {
        const { adBazaarBookingId, userId, metadata } = req.body;
        const interaction = new AdInteraction_1.default({
            campaignId: adBazaarBookingId,
            userId,
            type: 'conversion',
            metadata,
        });
        await interaction.save();
        (0, intentCaptureService_1.track)({
            userId,
            event: 'conversion',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: { bookingId: adBazaarBookingId, source: 'adbazaar' },
        });
        res.json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Error tracking conversion', { error });
        res.status(500).json((0, response_1.err)('SRV_001', 'Failed to track conversion'));
    }
});
// ── GET /adbazaar/analytics ────────────────────────────────────────────────
router.get('/adbazaar/analytics', verifyInternal, async (req, res) => {
    try {
        const { merchantId } = req.query;
        const [impressions, clicks, conversions] = await Promise.all([
            AdInteraction_1.default.countDocuments({
                campaignId: { $in: await AdCampaign_1.default.find({ merchantId }).distinct('_id') },
                type: 'impression',
            }),
            AdInteraction_1.default.countDocuments({
                campaignId: { $in: await AdCampaign_1.default.find({ merchantId }).distinct('_id') },
                type: 'click',
            }),
            AdInteraction_1.default.countDocuments({
                campaignId: { $in: await AdCampaign_1.default.find({ merchantId }).distinct('_id') },
                type: 'conversion',
            }),
        ]);
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const totalSpend = await AdCampaign_1.default.aggregate([
            { $match: { merchantId } },
            { $group: { _id: null, total: { $sum: '$budget' } } },
        ]);
        res.json({
            impressions,
            clicks,
            conversions,
            ctr: ctr.toFixed(2),
            spend: totalSpend[0]?.total || 0,
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching analytics', { error });
        res.status(500).json((0, response_1.err)('SRV_001', 'Failed to fetch analytics'));
    }
});
exports.default = router;
//# sourceMappingURL=adbazaar.js.map