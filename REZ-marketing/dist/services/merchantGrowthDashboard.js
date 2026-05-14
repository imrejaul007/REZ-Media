"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.merchantGrowthDashboard = exports.MerchantGrowthDashboardService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const Voucher_1 = require("../models/Voucher");
const VoucherRedemption_1 = require("../models/VoucherRedemption");
// ── Helper Collections ──────────────────────────────────────────────────────────
const getNotificationLogs = () => mongoose_1.default.connection.collection('notificationlogs');
const getBroadcastLogs = () => mongoose_1.default.connection.collection('broadcastlogs');
const getAdBazaarAds = () => mongoose_1.default.connection.collection('adbazaar_ads');
// ── Growth Dashboard Service ────────────────────────────────────────────────────
class MerchantGrowthDashboardService {
    /**
     * Get complete growth dashboard data for a merchant
     */
    async getDashboard(merchantId, days = 30) {
        const end = new Date();
        const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
        const [campaigns, ads, notifications, vouchers, growthScore] = await Promise.all([
            this.getCampaignOverview(merchantId, start, end),
            this.getAdPerformance(merchantId, start, end),
            this.getNotificationStats(merchantId, start, end),
            this.getVoucherMetrics(merchantId, start, end),
            this.getGrowthScore(merchantId, start, end),
        ]);
        return {
            merchantId,
            period: { start, end },
            overview: { campaigns, ads, notifications, vouchers },
            growthScore,
            generatedAt: new Date(),
        };
    }
    /**
     * Get campaign overview with engagement metrics
     */
    async getCampaignOverview(merchantId, start, end) {
        if (!mongoose_1.default.isValidObjectId(merchantId)) {
            return this.emptyCampaignOverview();
        }
        const campaigns = await MarketingCampaign_1.MarketingCampaign.find({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            createdAt: { $gte: start, $lte: end },
        })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        if (!campaigns.length) {
            return this.emptyCampaignOverview();
        }
        const campaignSummaries = campaigns.map((c) => {
            const s = c.stats || { sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0 };
            const delivered = s.delivered || s.sent || 0;
            const engagementRate = delivered > 0
                ? Math.round(((s.opened || 0) + (s.clicked || 0)) / delivered * 100)
                : 0;
            return {
                campaignId: c._id.toString(),
                name: c.name,
                channel: c.channel,
                status: c.status,
                sentAt: c.sentAt,
                audienceSize: c.audience?.estimatedCount || 0,
                sent: s.sent || 0,
                delivered,
                opened: s.opened || 0,
                clicked: s.clicked || 0,
                converted: s.converted || 0,
                engagementRate,
            };
        });
        const totalReach = campaignSummaries.reduce((sum, c) => sum + c.sent, 0);
        const avgEngagementRate = Math.round(campaignSummaries.reduce((sum, c) => sum + c.engagementRate, 0) / campaignSummaries.length);
        return {
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter((c) => ['draft', 'scheduled', 'sending'].includes(c.status)).length,
            completedCampaigns: campaigns.filter((c) => c.status === 'sent').length,
            totalReach,
            avgEngagementRate,
            campaigns: campaignSummaries,
        };
    }
    /**
     * Get ad performance metrics
     */
    async getAdPerformance(merchantId, start, end) {
        if (!mongoose_1.default.isValidObjectId(merchantId)) {
            return this.emptyAdPerformance();
        }
        const adsCollection = getAdBazaarAds();
        const ads = await adsCollection
            .find({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            createdAt: { $gte: start, $lte: end },
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        if (!ads.length) {
            return this.emptyAdPerformance();
        }
        const adMetrics = ads.map((ad) => {
            const impressions = ad.impressions || ad.views || 0;
            const clicks = ad.clicks || 0;
            const conversions = ad.conversions || ad.converted || 0;
            const spend = ad.spend || ad.cost || 0;
            return {
                adId: ad._id.toString(),
                name: ad.name || ad.title || 'Unnamed Ad',
                channel: ad.channel || 'push',
                impressions,
                clicks,
                conversions,
                ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
                conversionRate: impressions > 0 ? Math.round((conversions / impressions) * 10000) / 100 : 0,
                spend,
            };
        });
        const totalImpressions = adMetrics.reduce((sum, ad) => sum + ad.impressions, 0);
        const totalClicks = adMetrics.reduce((sum, ad) => sum + ad.clicks, 0);
        const totalConversions = adMetrics.reduce((sum, ad) => sum + ad.conversions, 0);
        const totalSpend = adMetrics.reduce((sum, ad) => sum + ad.spend, 0);
        return {
            totalAds: ads.length,
            totalImpressions,
            totalClicks,
            totalConversions,
            ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
            conversionRate: totalImpressions > 0
                ? Math.round((totalConversions / totalImpressions) * 10000) / 100
                : 0,
            avgCpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
            totalSpend,
            ads: adMetrics,
        };
    }
    /**
     * Get notification statistics (sent, delivered, opened, clicked)
     */
    async getNotificationStats(merchantId, start, end) {
        if (!mongoose_1.default.isValidObjectId(merchantId)) {
            return this.emptyNotificationStats();
        }
        const notificationLogs = getNotificationLogs();
        const broadcastLogs = getBroadcastLogs();
        // Query both notification logs and broadcast logs for comprehensive stats
        const [notifLogs, broadLogs] = await Promise.all([
            notificationLogs
                .find({
                merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
                createdAt: { $gte: start, $lte: end },
            })
                .toArray(),
            broadcastLogs
                .find({
                merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
                sentAt: { $gte: start, $lte: end },
            })
                .toArray(),
        ]);
        // Aggregate stats
        let totalSent = 0;
        let totalDelivered = 0;
        let totalOpened = 0;
        let totalClicked = 0;
        const channelStats = {};
        // Process notification logs
        for (const log of notifLogs) {
            const sent = log.sent || log.count || 0;
            const delivered = log.delivered || log.deliveredCount || sent;
            const opened = log.opened || log.openCount || 0;
            const clicked = log.clicked || log.clickCount || 0;
            const channel = log.channel || 'push';
            totalSent += sent;
            totalDelivered += delivered;
            totalOpened += opened;
            totalClicked += clicked;
            if (!channelStats[channel]) {
                channelStats[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
            }
            channelStats[channel].sent += sent;
            channelStats[channel].delivered += delivered;
            channelStats[channel].opened += opened;
            channelStats[channel].clicked += clicked;
        }
        // Process broadcast logs
        for (const log of broadLogs) {
            const sent = log.userCount || 0;
            const channel = log.channel || 'push';
            totalSent += sent;
            if (!channelStats[channel]) {
                channelStats[channel] = { sent: 0, delivered: 0, opened: 0, clicked: 0 };
            }
            channelStats[channel].sent += sent;
        }
        const totalNotifications = notifLogs.length + broadLogs.length;
        // Calculate rates
        const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0;
        const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0;
        const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 10000) / 100 : 0;
        const byChannel = Object.entries(channelStats).map(([channel, stats]) => ({
            channel,
            sent: stats.sent,
            delivered: stats.delivered,
            opened: stats.opened,
            clicked: stats.clicked,
            deliveryRate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 10000) / 100 : 0,
            openRate: stats.delivered > 0 ? Math.round((stats.opened / stats.delivered) * 10000) / 100 : 0,
        }));
        return {
            totalNotifications,
            sent: totalSent,
            delivered: totalDelivered,
            opened: totalOpened,
            clicked: totalClicked,
            deliveryRate,
            openRate,
            clickRate,
            byChannel,
        };
    }
    /**
     * Get voucher metrics (issued, redeemed, revenue impact)
     */
    async getVoucherMetrics(merchantId, start, end) {
        if (!mongoose_1.default.isValidObjectId(merchantId)) {
            return this.emptyVoucherMetrics();
        }
        // Get vouchers created in the period
        const vouchers = await Voucher_1.Voucher.find({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            createdAt: { $gte: start, $lte: end },
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        if (!vouchers.length) {
            return this.emptyVoucherMetrics();
        }
        // Get redemptions for these vouchers
        const voucherIds = vouchers.map((v) => v._id);
        const redemptions = await VoucherRedemption_1.VoucherRedemption.find({
            voucherId: { $in: voucherIds },
            redeemedAt: { $gte: start, $lte: end },
        }).lean();
        // Calculate per-voucher stats
        const voucherSummaries = vouchers.map((v) => {
            const voucherRedemptions = redemptions.filter((r) => r.voucherId?.toString() === v._id.toString());
            const redeemed = voucherRedemptions.length;
            const totalDiscountGiven = voucherRedemptions.reduce((sum, r) => sum + (r.discountApplied || 0), 0);
            const issued = v.maxUses || redeemed;
            const redemptionRate = issued > 0 ? Math.round((redeemed / issued) * 10000) / 100 : 0;
            return {
                voucherId: v._id.toString(),
                code: v.code,
                type: v.type,
                status: v.status,
                value: v.value,
                issued,
                redeemed,
                redemptionRate,
                totalDiscountGiven,
            };
        });
        const totalIssued = voucherSummaries.reduce((sum, v) => sum + v.issued, 0);
        const totalRedeemed = voucherSummaries.reduce((sum, v) => sum + v.redeemed, 0);
        const totalDiscountGiven = voucherSummaries.reduce((sum, v) => sum + v.totalDiscountGiven, 0);
        const redemptionRate = totalIssued > 0 ? Math.round((totalRedeemed / totalIssued) * 10000) / 100 : 0;
        const avgOrderValue = totalRedeemed > 0
            ? Math.round(voucherSummaries.reduce((sum, v) => {
                const vRedemptions = redemptions.filter((r) => r.voucherId?.toString() === v.voucherId);
                const orderValues = vRedemptions.map((r) => r.orderValue || 0);
                return sum + orderValues.reduce((s, o) => s + o, 0);
            }, 0) / totalRedeemed)
            : 0;
        return {
            totalVouchers: vouchers.length,
            activeVouchers: vouchers.filter((v) => v.status === 'active').length,
            issued: totalIssued,
            redeemed: totalRedeemed,
            redemptionRate,
            totalDiscountGiven,
            avgOrderValue,
            vouchers: voucherSummaries,
        };
    }
    /**
     * Calculate combined growth health score (0-100)
     *
     * Weights:
     *   - Campaign engagement: 30%
     *   - Ad performance: 30%
     *   - Notification open rate: 20%
     *   - Voucher redemption: 20%
     */
    async getGrowthScore(merchantId, start, end) {
        const [campaignOverview, adPerformance, notificationStats, voucherMetrics,] = await Promise.all([
            this.getCampaignOverview(merchantId, start, end),
            this.getAdPerformance(merchantId, start, end),
            this.getNotificationStats(merchantId, start, end),
            this.getVoucherMetrics(merchantId, start, end),
        ]);
        // Calculate individual component scores (0-100)
        const campaignEngagementScore = this.calculateCampaignEngagementScore(campaignOverview);
        const adPerformanceScore = this.calculateAdPerformanceScore(adPerformance);
        const notificationOpenRateScore = this.calculateNotificationOpenRateScore(notificationStats);
        const voucherRedemptionScore = this.calculateVoucherRedemptionScore(voucherMetrics);
        // Weights
        const WEIGHTS = {
            campaignEngagement: 0.30,
            adPerformance: 0.30,
            notificationOpenRate: 0.20,
            voucherRedemption: 0.20,
        };
        // Calculate weighted overall score
        const overall = Math.round(campaignEngagementScore * WEIGHTS.campaignEngagement +
            adPerformanceScore * WEIGHTS.adPerformance +
            notificationOpenRateScore * WEIGHTS.notificationOpenRate +
            voucherRedemptionScore * WEIGHTS.voucherRedemption);
        return {
            overall,
            campaignEngagement: Math.round(campaignEngagementScore),
            adPerformance: Math.round(adPerformanceScore),
            notificationOpenRate: Math.round(notificationOpenRateScore),
            voucherRedemption: Math.round(voucherRedemptionScore),
            breakdown: {
                campaignEngagementScore: Math.round(campaignEngagementScore),
                campaignEngagementWeight: WEIGHTS.campaignEngagement * 100,
                adPerformanceScore: Math.round(adPerformanceScore),
                adPerformanceWeight: WEIGHTS.adPerformance * 100,
                notificationOpenRateScore: Math.round(notificationOpenRateScore),
                notificationOpenRateWeight: WEIGHTS.notificationOpenRate * 100,
                voucherRedemptionScore: Math.round(voucherRedemptionScore),
                voucherRedemptionWeight: WEIGHTS.voucherRedemption * 100,
            },
        };
    }
    /**
     * Calculate campaign engagement score (0-100)
     * Based on: engagement rate, campaign frequency, reach
     */
    calculateCampaignEngagementScore(overview) {
        if (overview.totalCampaigns === 0)
            return 0;
        // Engagement rate component (40% of this score)
        const engagementComponent = Math.min(overview.avgEngagementRate, 50) * 2; // Scale to 0-100
        // Campaign frequency component (30% of this score)
        // Assume 4 campaigns/month is good frequency (normalize to 0-100)
        const frequencyScore = Math.min(overview.totalCampaigns / 4 * 25, 30);
        // Reach component (30% of this score)
        // Normalize: 1000 reach = 15 points, 10000+ = 30 points
        const reachScore = Math.min(Math.log10(overview.totalReach + 1) * 10, 30);
        return Math.min(engagementComponent + frequencyScore + reachScore, 100);
    }
    /**
     * Calculate ad performance score (0-100)
     * Based on: CTR, conversion rate, total impressions
     */
    calculateAdPerformanceScore(performance) {
        if (performance.totalAds === 0)
            return 0;
        // CTR component (40% of this score) - benchmark: 2% is good
        const ctrScore = Math.min(performance.ctr / 2 * 40, 40);
        // Conversion rate component (35% of this score) - benchmark: 0.5% is good
        const conversionScore = Math.min(performance.conversionRate / 0.5 * 35, 35);
        // Volume component (25% of this score)
        // Normalize: 1000 impressions = 10 points, 100000+ = 25 points
        const volumeScore = Math.min(Math.log10(performance.totalImpressions + 1) * 5, 25);
        return Math.min(ctrScore + conversionScore + volumeScore, 100);
    }
    /**
     * Calculate notification open rate score (0-100)
     * Based on: delivery rate, open rate
     */
    calculateNotificationOpenRateScore(stats) {
        if (stats.totalNotifications === 0)
            return 0;
        // Delivery rate component (40% of this score) - benchmark: 90% is good
        const deliveryComponent = Math.min(stats.deliveryRate / 90 * 40, 40);
        // Open rate component (60% of this score) - benchmark: 30% is good
        const openRateComponent = Math.min(stats.openRate / 30 * 60, 60);
        return Math.min(deliveryComponent + openRateComponent, 100);
    }
    /**
     * Calculate voucher redemption score (0-100)
     * Based on: redemption rate, active vouchers
     */
    calculateVoucherRedemptionScore(metrics) {
        if (metrics.totalVouchers === 0)
            return 0;
        // Redemption rate component (70% of this score) - benchmark: 30% is good
        const redemptionComponent = Math.min(metrics.redemptionRate / 30 * 70, 70);
        // Active voucher diversity component (30% of this score)
        // More active vouchers = better merchant engagement
        const diversityScore = Math.min(metrics.activeVouchers / 5 * 30, 30);
        return Math.min(redemptionComponent + diversityScore, 100);
    }
    // ── Empty State Helpers ────────────────────────────────────────────────────────
    emptyCampaignOverview() {
        return {
            totalCampaigns: 0,
            activeCampaigns: 0,
            completedCampaigns: 0,
            totalReach: 0,
            avgEngagementRate: 0,
            campaigns: [],
        };
    }
    emptyAdPerformance() {
        return {
            totalAds: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            ctr: 0,
            conversionRate: 0,
            avgCpc: 0,
            totalSpend: 0,
            ads: [],
        };
    }
    emptyNotificationStats() {
        return {
            totalNotifications: 0,
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            deliveryRate: 0,
            openRate: 0,
            clickRate: 0,
            byChannel: [],
        };
    }
    emptyVoucherMetrics() {
        return {
            totalVouchers: 0,
            activeVouchers: 0,
            issued: 0,
            redeemed: 0,
            redemptionRate: 0,
            totalDiscountGiven: 0,
            avgOrderValue: 0,
            vouchers: [],
        };
    }
}
exports.MerchantGrowthDashboardService = MerchantGrowthDashboardService;
// Singleton instance
exports.merchantGrowthDashboard = new MerchantGrowthDashboardService();
exports.default = exports.merchantGrowthDashboard;
//# sourceMappingURL=merchantGrowthDashboard.js.map