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
const AdInteraction_1 = __importDefault(require("../models/AdInteraction"));
const clickFraudService_1 = require("../services/clickFraudService");
const attributionService_1 = require("../services/attributionService");
const logger_1 = require("../config/logger");
const reEngagementService_1 = require("../services/reEngagementService");
const eventPlatform_1 = require("../config/eventPlatform");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
/**
 * POST /ads/:id/click - Record a click with fraud detection
 * Requires: consumer auth
 */
router.post('/:id/click', auth_1.verifyConsumer, async (req, res) => {
    try {
        const { id: adId } = req.params;
        const userId = req.userId;
        const ip = req.ip || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        if (!userId) {
            return res.status(401).json((0, response_1.err)('SRV_001', 'Authentication required'));
        }
        // Validate ad ID
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad ID'));
        }
        // Detect fraudulent click (before any DB write)
        const fraudCheck = await clickFraudService_1.clickFraudService.detectFraudulentClick(adId, userId, ip, userAgent);
        // Record the interaction
        const interaction = await AdInteraction_1.default.create({
            campaignId: new mongoose_1.Types.ObjectId(adId),
            userId,
            type: 'click',
            ip,
            userAgent,
            isFraud: fraudCheck.isFraud,
            fraudReason: fraudCheck.reason,
        });
        // Record click for future fraud analysis (Redis-backed, async)
        if (!fraudCheck.isFraud) {
            await clickFraudService_1.clickFraudService.recordClick(adId, userId, ip, userAgent);
        }
        // ADS-H2 FIX: Atomic budget-checked click increment + charge in one operation.
        // Previously did findByIdAndUpdate then chargeCampaign as two separate ops,
        // allowing a paused campaign to still record a click. Now uses $expr to
        // atomically verify budget BEFORE incrementing.
        if (!fraudCheck.isFraud) {
            const ad = await AdCampaign_1.default.findOneAndUpdate({ _id: adId, status: 'active', $expr: { $lt: ['$totalSpent', '$totalBudget'] } }, [
                {
                    $set: {
                        clicks: { $add: ['$clicks', 1] },
                        totalSpent: {
                            $cond: {
                                if: { $eq: ['$bidType', 'CPC'] },
                                then: { $add: ['$totalSpent', '$bidAmount'] },
                                else: '$totalSpent',
                            },
                        },
                    },
                },
                {
                    $set: {
                        status: {
                            $cond: {
                                if: { $gte: ['$totalSpent', '$totalBudget'] },
                                then: 'completed',
                                else: '$status',
                            },
                        },
                    },
                },
            ], { new: true });
            if (!ad) {
                // Campaign not found, not active, or budget exhausted — click not counted
                return res.json({
                    success: true,
                    data: { interactionId: interaction._id, isFraud: false, budgetExhausted: true },
                    message: 'Click not counted — campaign inactive or budget exhausted',
                });
            }
            // Process for re-engagement flow (schedule follow-up if no conversion)
            await (0, reEngagementService_1.processInteractionForReengagement)(userId, adId, 'click');
            // Update spend metrics and check for budget alerts
            await (0, reEngagementService_1.processSpendUpdate)(ad.merchantId.toString(), adId, ad.title, ad.dailyBudget, ad.totalBudget, ad.totalSpent);
            // Emit event to event-platform for unified analytics (non-blocking)
            (0, eventPlatform_1.emitAdClick)({
                adId: adId,
                campaignId: adId,
                merchantId: ad.merchantId.toString(),
                userId,
                placement: req.headers['x-ad-placement'],
                deviceType: req.headers['x-device-type'],
                platform: req.headers['x-platform'],
                location: req.headers['x-location'],
            });
        }
        return res.json({
            success: true,
            data: {
                interactionId: interaction._id,
                isFraud: fraudCheck.isFraud,
                fraudReason: fraudCheck.reason,
            },
            message: fraudCheck.isFraud ? 'Click flagged as fraudulent' : 'Click recorded successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('[INTERACTION] click error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to record click'));
    }
});
/**
 * POST /ads/:id/impression - Record an impression
 * Requires: consumer auth
 */
router.post('/:id/impression', auth_1.verifyConsumer, async (req, res) => {
    try {
        const { id: adId } = req.params;
        const userId = req.userId;
        const ip = req.ip || 'unknown';
        const userAgent = req.get('user-agent') || 'unknown';
        if (!userId) {
            return res.status(401).json((0, response_1.err)('SRV_001', 'Authentication required'));
        }
        // Validate ad ID
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad ID'));
        }
        // Record the interaction
        await AdInteraction_1.default.create({
            campaignId: new mongoose_1.Types.ObjectId(adId),
            userId,
            type: 'impression',
            ip,
            userAgent,
            isFraud: false,
        });
        // ADS-H1 FIX: Atomic budget-checked impression increment.
        // Previously did AdCampaign.findByIdAndUpdate + billingService.chargeCampaign as
        // two separate operations. Between them the campaign could be paused or exhausted,
        // causing impressions to be counted but not billed (or vice versa). Now uses
        // $expr to atomically verify budget BEFORE incrementing — same pattern as serve.ts.
        const ad = await AdCampaign_1.default.findOneAndUpdate({ _id: adId, status: 'active', $expr: { $lt: ['$totalSpent', '$totalBudget'] } }, [
            {
                $set: {
                    impressions: { $add: ['$impressions', 1] },
                    totalSpent: {
                        $cond: {
                            if: { $eq: ['$bidType', 'CPM'] },
                            then: { $add: ['$totalSpent', { $divide: ['$bidAmount', 1000] }] },
                            else: '$totalSpent',
                        },
                    },
                    status: {
                        $cond: {
                            if: { $gte: [{ $add: ['$totalSpent', { $divide: ['$bidAmount', 1000] }] }, '$totalBudget'] },
                            then: 'completed',
                            else: '$status',
                        },
                    },
                },
            },
        ], { new: true });
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found or not active'));
        }
        // Process for re-engagement flow (schedule retarget if no click after 24h)
        await (0, reEngagementService_1.processInteractionForReengagement)(userId, adId, 'impression');
        // Update spend metrics and check for budget alerts
        await (0, reEngagementService_1.processSpendUpdate)(ad.merchantId.toString(), adId, ad.title, ad.dailyBudget, ad.totalBudget, ad.totalSpent);
        // Emit event to event-platform for unified analytics (non-blocking)
        (0, eventPlatform_1.emitAdImpression)({
            adId: adId,
            campaignId: adId,
            merchantId: ad.merchantId.toString(),
            userId,
            placement: req.headers['x-ad-placement'],
            deviceType: req.headers['x-device-type'],
            platform: req.headers['x-platform'],
            location: req.headers['x-location'],
        });
        return res.json({
            success: true,
            message: 'Impression recorded successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('[INTERACTION] impression error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to record impression'));
    }
});
/**
 * POST /ads/attribute - Link an order to a campaign
 * Requires: internal service auth (called by order service)
 */
router.post('/attribute', auth_1.verifyInternal, async (req, res) => {
    try {
        const { orderId, userId, storeId } = req.body;
        if (!orderId || !userId || !storeId) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'orderId, userId, and storeId are required'));
        }
        const result = await attributionService_1.attributionService.attributeOrderToCampaign(orderId, userId, storeId);
        if (!result.success) {
            return res.status(400).json((0, response_1.err)('SRV_001', result.message));
        }
        // Mark user as converted to cancel any pending re-engagement notifications
        if (result.campaignId) {
            await (0, reEngagementService_1.markUserConverted)(userId, result.campaignId.toString());
        }
        return res.json({
            success: true,
            data: { campaignId: result.campaignId },
            message: result.message,
        });
    }
    catch (error) {
        logger_1.logger.error('[INTERACTION] attribute error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to attribute order'));
    }
});
/**
 * GET /ads/:id/analytics - Get interaction and ROI metrics for an ad
 * Requires: merchant auth
 */
router.get('/:id/analytics', auth_1.verifyMerchant, async (req, res) => {
    try {
        const { id: adId } = req.params;
        const merchantId = req.merchantId;
        // Validate ad ID
        if (!mongoose_1.Types.ObjectId.isValid(adId)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid ad ID'));
        }
        // Verify merchant owns this ad
        const ad = await AdCampaign_1.default.findOne({
            _id: adId,
            merchantId: new mongoose_1.Types.ObjectId(merchantId),
        })
            .select('_id title impressions clicks totalSpent')
            .lean();
        if (!ad) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Ad not found'));
        }
        // Get interaction stats
        const interactions = await AdInteraction_1.default.aggregate([
            {
                $match: {
                    campaignId: new mongoose_1.Types.ObjectId(adId),
                },
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    fraudCount: {
                        $sum: { $cond: [{ $eq: ['$isFraud', true] }, 1, 0] },
                    },
                },
            },
        ]);
        const stats = {
            impression: { count: 0, fraudCount: 0 },
            click: { count: 0, fraudCount: 0 },
            conversion: { count: 0, fraudCount: 0 },
        };
        for (const row of interactions) {
            stats[row._id] = { count: row.count, fraudCount: row.fraudCount };
        }
        // Get fraud stats
        const fraudInteractions = await AdInteraction_1.default.countDocuments({
            campaignId: new mongoose_1.Types.ObjectId(adId),
            isFraud: true,
        });
        // Get ROI
        const roi = await attributionService_1.attributionService.getCampaignROI(adId);
        return res.json({
            success: true,
            data: {
                adId,
                title: ad.title,
                impressions: {
                    total: ad.impressions,
                    recorded: stats.impression.count,
                    fraudulent: stats.impression.fraudCount,
                },
                clicks: {
                    total: ad.clicks,
                    recorded: stats.click.count,
                    fraudulent: stats.click.fraudCount,
                },
                conversions: {
                    total: stats.conversion.count,
                    fraudulent: stats.conversion.fraudCount,
                },
                totalFraudulentInteractions: fraudInteractions,
                roi: roi ? {
                    conversions: roi.conversions,
                    totalSpent: roi.totalSpent,
                    revenueGenerated: roi.revenueGenerated,
                    roi: roi.roi,
                    ctr: roi.ctr,
                    conversionRate: roi.conversionRate,
                } : null,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[INTERACTION] analytics error:', error);
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to retrieve analytics'));
    }
});
exports.default = router;
//# sourceMappingURL=interactionRoutes.js.map