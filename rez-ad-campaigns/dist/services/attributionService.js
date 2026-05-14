"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributionService = void 0;
// @ts-nocheck
const mongoose_1 = require("mongoose");
const AdCampaign_1 = __importDefault(require("../models/AdCampaign"));
const AdInteraction_1 = __importDefault(require("../models/AdInteraction"));
const logger_1 = require("../config/logger");
const ATTRIBUTION_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
class AttributionService {
    async fetchWithTimeout(url, options, timeoutMs = 5000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * Link an order to a campaign by finding the most recent click from the user
     * within the last 24 hours
     */
    async attributeOrderToCampaign(orderId, userId, storeId) {
        try {
            if (!orderId || !userId || !storeId) {
                return { success: false, message: 'orderId, userId, and storeId are required' };
            }
            const now = new Date();
            const windowStart = new Date(now.getTime() - ATTRIBUTION_WINDOW);
            // Find the most recent click by this user for this store's campaign within 24h
            const recentClick = await AdInteraction_1.default.findOne({
                userId,
                type: 'click',
                isFraud: false,
                createdAt: { $gte: windowStart, $lte: now },
            })
                .populate('campaignId')
                .sort({ createdAt: -1 })
                .lean();
            if (!recentClick) {
                return { success: false, message: 'No recent ad click found within attribution window' };
            }
            const campaign = recentClick.campaignId;
            if (campaign.storeId.toString() !== storeId.toString()) {
                return { success: false, message: 'Recent click is not for this store' };
            }
            // Create or update conversion record
            const conversion = await AdInteraction_1.default.findOneAndUpdate({ orderId }, {
                campaignId: campaign._id,
                userId,
                type: 'conversion',
                orderId,
                isFraud: false,
                createdAt: now,
                updatedAt: now,
            }, { upsert: true, new: true });
            return {
                success: true,
                campaignId: campaign._id.toString(),
                message: `Order ${orderId} attributed to campaign ${campaign._id}`,
            };
        }
        catch (error) {
            logger_1.logger.error('[AttributionService] attributeOrderToCampaign error:', error);
            return { success: false, message: 'Failed to attribute order to campaign' };
        }
    }
    /**
     * Get ROI metrics for a campaign
     */
    async getCampaignROI(campaignId) {
        try {
            if (!mongoose_1.Types.ObjectId.isValid(campaignId)) {
                return null;
            }
            const campaign = await AdCampaign_1.default.findById(campaignId).lean();
            if (!campaign) {
                return null;
            }
            // Get interaction stats
            const interactions = await AdInteraction_1.default.aggregate([
                {
                    $match: {
                        campaignId: new mongoose_1.Types.ObjectId(campaignId),
                        isFraud: false,
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        count: { $sum: 1 },
                    },
                },
            ]);
            const stats = {
                impression: 0,
                click: 0,
                conversion: 0,
            };
            for (const row of interactions) {
                stats[row._id] = row.count;
            }
            const impressions = campaign.impressions;
            const clicks = campaign.clicks;
            const conversions = stats.conversion;
            const totalSpent = campaign.totalSpent;
            // Revenue is estimated as conversion count * average order value
            // In a real system, this would come from the order service
            const revenueGenerated = conversions * 50; // Assume $50 average order
            const roi = totalSpent > 0 ? ((revenueGenerated - totalSpent) / totalSpent) * 100 : 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
            return {
                impressions,
                clicks,
                conversions,
                totalSpent,
                revenueGenerated,
                roi,
                ctr,
                conversionRate,
            };
        }
        catch (error) {
            logger_1.logger.error('[AttributionService] getCampaignROI error:', error);
            return null;
        }
    }
    /**
     * Get attribution report for all campaigns by merchant within date range
     */
    async getAttributionReport(merchantId, startDate, endDate) {
        try {
            if (!mongoose_1.Types.ObjectId.isValid(merchantId)) {
                return [];
            }
            const campaigns = await AdCampaign_1.default.find({
                merchantId: new mongoose_1.Types.ObjectId(merchantId),
                createdAt: { $gte: startDate, $lte: endDate },
            })
                .select('_id title impressions clicks totalSpent')
                .lean();
            const report = [];
            for (const campaign of campaigns) {
                const roi = await this.getCampaignROI(campaign._id.toString());
                if (roi) {
                    report.push({
                        campaignId: campaign._id.toString(),
                        campaignTitle: campaign.title,
                        impressions: roi.impressions,
                        clicks: roi.clicks,
                        conversions: roi.conversions,
                        totalSpent: roi.totalSpent,
                        revenueGenerated: roi.revenueGenerated,
                        roi: roi.roi,
                        ctr: roi.ctr,
                        conversionRate: roi.conversionRate,
                    });
                }
            }
            return report;
        }
        catch (error) {
            logger_1.logger.error('[AttributionService] getAttributionReport error:', error);
            return [];
        }
    }
}
exports.attributionService = new AttributionService();
//# sourceMappingURL=attributionService.js.map