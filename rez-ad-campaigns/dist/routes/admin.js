"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const logger_1 = require("../config/logger");
const intentCaptureService_1 = require("../services/intentCaptureService");
const notificationService_1 = require("../services/notificationService");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
router.use(auth_1.verifyAdmin);
// ── GET / — list all ads with filters ───────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;
        const filter = {};
        if (req.query.status) {
            filter.status = req.query.status;
        }
        if (req.query.merchantId) {
            if (!mongoose_1.Types.ObjectId.isValid(req.query.merchantId)) {
                return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid merchantId'));
            }
            filter.merchantId = new mongoose_1.Types.ObjectId(req.query.merchantId);
        }
        if (req.query.placement) {
            filter.placement = req.query.placement;
        }
        if (req.query.from || req.query.to) {
            const dateFilter = {};
            if (req.query.from) {
                const d = new Date(req.query.from);
                if (isNaN(d.getTime()))
                    return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid from date'));
                dateFilter.$gte = d;
            }
            if (req.query.to) {
                const d = new Date(req.query.to);
                if (isNaN(d.getTime()))
                    return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid to date'));
                dateFilter.$lte = d;
            }
            filter.createdAt = dateFilter;
        }
        const [ads, total] = await Promise.all([
            // BE-ADS-014: Use hint to ensure compound index is used for merchant populate
            AdCampaign_1.default.find(filter)
                .hint({ merchantId: 1, createdAt: -1 })
                .populate('merchantId', 'businessName email')
                .populate('storeId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AdCampaign_1.default.countDocuments(filter),
        ]);
        return res.json({
            success: true,
            data: ads,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] list error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to retrieve ads'));
    }
});
// ── GET /stats — network-wide stats ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [statusCounts, totals] = await Promise.all([
            AdCampaign_1.default.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            AdCampaign_1.default.aggregate([
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
        const byStatus = {};
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
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] stats error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to retrieve stats'));
    }
});
// ── GET /:id — single ad ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad id'));
        }
        const ad = await AdCampaign_1.default.findById(req.params.id)
            .populate('merchantId', 'businessName email phone')
            .populate('storeId', 'name address')
            .populate('reviewedBy', 'name email');
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found'));
        }
        return res.json({ success: true, data: ad });
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] get single error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to retrieve ad'));
    }
});
// ── PATCH /:id/approve — approve ad ─────────────────────────────────────────
router.patch('/:id/approve', async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad id'));
        }
        const ad = await AdCampaign_1.default.findById(req.params.id);
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found'));
        }
        if (ad.status !== 'pending_review') {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Only pending_review ads can be approved'));
        }
        ad.status = 'active';
        ad.reviewedBy = req.userId ? new mongoose_1.Types.ObjectId(req.userId) : undefined;
        ad.reviewedAt = new Date();
        await ad.save();
        // Notify merchant that ad is approved
        await (0, notificationService_1.notifyAdApproved)(ad.merchantId.toString(), ad._id.toString(), ad.title, ad.placement);
        (0, intentCaptureService_1.track)({
            event: 'campaign_approved',
            intentKey: 'RTMN_COMMERCE_MEMORY',
            properties: {
                merchantId: ad.merchantId.toString(),
                campaignId: ad._id.toString(),
                category: 'GENERAL',
                appType: 'rez-ads-service',
            },
        }).catch((err) => {
            logger_1.logger.error('[Ads] Operation failed', { error: err });
        });
        return res.json({ success: true, data: ad, message: 'Ad approved and set to active' });
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] approve error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to approve ad'));
    }
});
// ── PATCH /:id/reject — reject ad ───────────────────────────────────────────
router.patch('/:id/reject', async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        if (!rejectionReason || typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'rejectionReason is required'));
        }
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad id'));
        }
        const ad = await AdCampaign_1.default.findById(req.params.id);
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found'));
        }
        if (ad.status !== 'pending_review') {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Only pending_review ads can be rejected'));
        }
        ad.status = 'rejected';
        ad.rejectionReason = rejectionReason.trim();
        ad.reviewedBy = req.userId ? new mongoose_1.Types.ObjectId(req.userId) : undefined;
        ad.reviewedAt = new Date();
        await ad.save();
        // Notify merchant that ad was rejected (with reason)
        await (0, notificationService_1.notifyAdRejected)(ad.merchantId.toString(), ad._id.toString(), ad.title, rejectionReason.trim());
        return res.json({ success: true, data: ad, message: 'Ad rejected' });
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] reject error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to reject ad'));
    }
});
// ── PATCH /:id/pause — force pause active ad ────────────────────────────────
router.patch('/:id/pause', async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad id'));
        }
        const ad = await AdCampaign_1.default.findById(req.params.id);
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found'));
        }
        if (ad.status !== 'active') {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Only active ads can be paused'));
        }
        ad.status = 'paused';
        await ad.save();
        return res.json({ success: true, data: ad, message: 'Ad paused by admin' });
    }
    catch (error) {
        logger_1.logger.error('[ADMIN ADS] pause error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to pause ad'));
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map