"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportGenerator = exports.ReportGenerator = void 0;
const Touchpoint_1 = require("../models/Touchpoint");
const Conversion_1 = require("../models/Conversion");
const AttributionReport_1 = require("../models/AttributionReport");
const TouchpointTracker_1 = require("./TouchpointTracker");
const ConversionTracker_1 = require("./ConversionTracker");
const AttributionEngine_1 = require("./AttributionEngine");
class ReportGenerator {
    /**
     * Generate attribution report
     */
    async generateAttributionReport(filters) {
        const { merchantId, campaignId, startDate, endDate, attributionModel = AttributionReport_1.AttributionModel.LINEAR, lookbackDays = 30 } = filters;
        // Set default date range if not provided
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Get touchpoints
        const touchpointFilter = {
            merchantId,
            campaignId,
            startDate: start,
            endDate: end
        };
        const { touchpoints } = await TouchpointTracker_1.touchpointTracker.getTouchpoints(touchpointFilter);
        // Get conversions
        const conversionFilter = {
            merchantId,
            startDate: start,
            endDate: end
        };
        const { conversions } = await ConversionTracker_1.conversionTracker.getConversions(conversionFilter);
        // Generate report
        const report = await AttributionEngine_1.attributionEngine.generateAttributionReport(touchpoints, conversions, {
            reportType: 'custom',
            entityId: merchantId || campaignId,
            entityType: merchantId ? 'merchant' : 'campaign',
            model: attributionModel,
            lookbackDays
        });
        return this.formatAttributionReport(report);
    }
    /**
     * Format attribution report for API response
     */
    formatAttributionReport(report) {
        return {
            reportId: report.id,
            summary: {
                totalTouchpoints: report.totalTouchpoints,
                totalConversions: report.totalConversions,
                totalValue: report.totalValue,
                conversionRate: report.conversionRate
            },
            channelAttribution: report.channelAttribution.map(ca => ({
                channel: ca.channel,
                touchpoints: ca.touchpoints,
                conversions: ca.conversions,
                value: ca.attributedValue,
                percentage: ca.attributionPercentage
            })),
            campaignAttribution: report.campaignAttribution.map(ca => ({
                campaignId: ca.campaignId,
                touchpoints: ca.touchpoints,
                conversions: ca.conversions,
                value: ca.attributedValue,
                percentage: ca.attributionPercentage,
                channels: ca.channelBreakdown.map(cb => ({
                    channel: cb.channel,
                    touchpoints: cb.touchpoints,
                    value: cb.attributedValue
                }))
            })),
            model: report.attributionModel,
            dateRange: {
                start: report.startDate,
                end: report.endDate
            }
        };
    }
    /**
     * Generate funnel report
     */
    async generateFunnelReport(filters) {
        const { merchantId, campaignId, startDate, endDate } = filters;
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Get touchpoints
        const touchpoints = await Touchpoint_1.Touchpoint.find({
            ...(merchantId && { merchantId }),
            ...(campaignId && { campaignId }),
            timestamp: { $gte: start, $lte: end }
        }).lean();
        // Get conversions
        const conversions = await Conversion_1.Conversion.find({
            ...(merchantId && { merchantId }),
            conversionTimestamp: { $gte: start, $lte: end },
            status: 'completed'
        }).lean();
        const uniqueUsers = new Set(touchpoints.map(t => t.userId));
        // Define funnel stages
        const funnelStages = [
            { stage: 'Awareness (Ad Views)', count: 0, dropoffRate: 0, dropoffCount: 0 },
            { stage: 'Store Visits', count: 0, dropoffRate: 0, dropoffCount: 0 },
            { stage: 'Engagement', count: 0, dropoffRate: 0, dropoffCount: 0 },
            { stage: 'Conversion', count: conversions.length, dropoffRate: 0, dropoffCount: 0 }
        ];
        // Count by touchpoint type
        const adViews = touchpoints.filter(t => t.type === 'ad_view').length;
        const storeVisits = touchpoints.filter(t => t.type === 'store_visit').length;
        const engaged = touchpoints.filter(t => ['website_visit', 'app_open', 'search', 'social_engagement'].includes(t.type)).length;
        funnelStages[0].count = adViews;
        funnelStages[1].count = storeVisits;
        funnelStages[2].count = engaged;
        // Calculate dropoff rates
        let previousCount = uniqueUsers.size;
        for (let i = 0; i < funnelStages.length; i++) {
            if (i === 0) {
                funnelStages[i].count = previousCount;
            }
            else {
                funnelStages[i].dropoffCount = previousCount - funnelStages[i].count;
                funnelStages[i].dropoffRate =
                    previousCount > 0 ? (funnelStages[i].dropoffCount / previousCount) * 100 : 0;
            }
            previousCount = funnelStages[i].count;
        }
        // Overall conversion rate
        const conversionRate = uniqueUsers.size > 0 ? (conversions.length / uniqueUsers.size) * 100 : 0;
        return {
            funnelStages,
            totalUsers: uniqueUsers.size,
            conversionRate,
            dateRange: { start, end }
        };
    }
    /**
     * Generate campaign attribution report
     */
    async generateCampaignAttribution(campaignId, filters = {}) {
        const { startDate, endDate, attributionModel = AttributionReport_1.AttributionModel.LINEAR } = filters;
        const end = endDate || new Date();
        const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Get touchpoints for campaign
        const touchpoints = await Touchpoint_1.Touchpoint.find({
            campaignId,
            timestamp: { $gte: start, $lte: end }
        }).lean();
        // Get conversions attributed to this campaign
        const conversions = await Conversion_1.Conversion.find({
            conversionTimestamp: { $gte: start, $lte: end },
            status: 'completed'
        }).lean();
        // Calculate attribution
        const userTouchpoints = new Map();
        for (const tp of touchpoints) {
            if (!userTouchpoints.has(tp.userId)) {
                userTouchpoints.set(tp.userId, []);
            }
            userTouchpoints.get(tp.userId).push(tp);
        }
        // Get conversions by user
        const userConversions = new Map();
        for (const conv of conversions) {
            if (!userConversions.has(conv.userId)) {
                userConversions.set(conv.userId, []);
            }
            userConversions.get(conv.userId).push(conv);
        }
        // Filter users who have both touchpoints and conversions
        const attributedConversions = [];
        for (const [userId, userTpList] of userTouchpoints) {
            const userConvList = userConversions.get(userId) || [];
            for (const conv of userConvList) {
                // Check if conversion is within attribution window
                const lastTouchpoint = userTpList[userTpList.length - 1];
                if (lastTouchpoint) {
                    const daysDiff = (new Date(conv.conversionTimestamp).getTime() -
                        new Date(lastTouchpoint.timestamp).getTime()) /
                        (1000 * 60 * 60 * 24);
                    if (daysDiff <= 30) {
                        attributedConversions.push(conv);
                    }
                }
            }
        }
        const uniqueUsers = new Set(touchpoints.map(t => t.userId));
        const totalValue = attributedConversions.reduce((sum, c) => sum + (c.value || 0), 0);
        // Channel breakdown
        const channelData = new Map();
        for (const tp of touchpoints) {
            const current = channelData.get(tp.channel) || { touchpoints: 0, conversions: 0, value: 0 };
            current.touchpoints++;
            channelData.set(tp.channel, current);
        }
        for (const conv of attributedConversions) {
            const userTpList = userTouchpoints.get(conv.userId);
            if (userTpList && userTpList.length > 0) {
                const attributedTp = this.getAttributedTouchpoint(userTpList, conv, attributionModel);
                if (attributedTp) {
                    const current = channelData.get(attributedTp.channel) || { touchpoints: 0, conversions: 0, value: 0 };
                    current.conversions++;
                    current.value += conv.value || 0;
                    channelData.set(attributedTp.channel, current);
                }
            }
        }
        // Touchpoint type breakdown
        const typeBreakdown = new Map();
        for (const tp of touchpoints) {
            typeBreakdown.set(tp.type, (typeBreakdown.get(tp.type) || 0) + 1);
        }
        // Top converting channels
        const topChannels = Array.from(channelData.entries())
            .map(([channel, data]) => ({
            channel,
            conversions: data.conversions,
            value: data.value
        }))
            .sort((a, b) => b.conversions - a.conversions)
            .slice(0, 5);
        return {
            campaignId,
            metrics: {
                totalTouchpoints: touchpoints.length,
                uniqueUsers: uniqueUsers.size,
                conversions: attributedConversions.length,
                conversionRate: uniqueUsers.size > 0 ? (attributedConversions.length / uniqueUsers.size) * 100 : 0,
                totalValue,
                averageOrderValue: attributedConversions.length > 0 ? totalValue / attributedConversions.length : 0
            },
            channelBreakdown: Array.from(channelData.entries()).map(([channel, data]) => ({
                channel: channel,
                touchpoints: data.touchpoints,
                conversions: data.conversions,
                value: data.value,
                contribution: totalValue > 0 ? (data.value / totalValue) * 100 : 0
            })),
            touchpointTypeBreakdown: Array.from(typeBreakdown.entries()).map(([type, count]) => ({
                type,
                count
            })),
            topConvertingChannels: topChannels
        };
    }
    /**
     * Get attributed touchpoint based on model
     */
    getAttributedTouchpoint(touchpoints, conversion, model) {
        if (touchpoints.length === 0)
            return null;
        const sorted = [...touchpoints].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        switch (model) {
            case AttributionReport_1.AttributionModel.FIRST_TOUCH:
                return sorted[0];
            case AttributionReport_1.AttributionModel.LAST_TOUCH:
                return sorted[sorted.length - 1];
            case AttributionReport_1.AttributionModel.LINEAR:
            case AttributionReport_1.AttributionModel.TIME_DECAY:
            case AttributionReport_1.AttributionModel.POSITION_BASED:
                return sorted[sorted.length - 1]; // Default to last touch for simplicity
            default:
                return sorted[sorted.length - 1];
        }
    }
    /**
     * Get historical reports
     */
    async getHistoricalReports(filters = {}) {
        const filter = {};
        if (filters.reportType)
            filter.reportType = filters.reportType;
        if (filters.entityId)
            filter.entityId = filters.entityId;
        const results = await AttributionReport_1.AttributionReport.find(filter)
            .sort({ generatedAt: -1 })
            .limit(filters.limit || 10)
            .lean();
        return results;
    }
    /**
     * Get report by ID
     */
    async getReport(reportId) {
        const result = await AttributionReport_1.AttributionReport.findOne({ id: reportId }).lean();
        return result;
    }
    /**
     * Generate real-time dashboard metrics
     */
    async getDashboardMetrics(merchantId) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const prev7Days = new Date(last7Days.getTime() - 7 * 24 * 60 * 60 * 1000);
        // Today metrics
        const [todayTouchpoints, todayConversions] = await Promise.all([
            Touchpoint_1.Touchpoint.countDocuments({ merchantId, timestamp: { $gte: today } }),
            Conversion_1.Conversion.countDocuments({
                merchantId,
                conversionTimestamp: { $gte: today },
                status: 'completed'
            })
        ]);
        const todayConversionsData = await Conversion_1.Conversion.find({
            merchantId,
            conversionTimestamp: { $gte: today },
            status: 'completed'
        });
        const todayValue = todayConversionsData.reduce((sum, c) => sum + (c.value || 0), 0);
        // Last 7 days metrics
        const [weekTouchpoints, weekConversions] = await Promise.all([
            Touchpoint_1.Touchpoint.countDocuments({ merchantId, timestamp: { $gte: last7Days } }),
            Conversion_1.Conversion.countDocuments({
                merchantId,
                conversionTimestamp: { $gte: last7Days },
                status: 'completed'
            })
        ]);
        const weekConversionsData = await Conversion_1.Conversion.find({
            merchantId,
            conversionTimestamp: { $gte: last7Days },
            status: 'completed'
        });
        const weekValue = weekConversionsData.reduce((sum, c) => sum + (c.value || 0), 0);
        // Last 30 days metrics
        const [monthTouchpoints, monthConversions] = await Promise.all([
            Touchpoint_1.Touchpoint.countDocuments({ merchantId, timestamp: { $gte: last30Days } }),
            Conversion_1.Conversion.countDocuments({
                merchantId,
                conversionTimestamp: { $gte: last30Days },
                status: 'completed'
            })
        ]);
        const monthConversionsData = await Conversion_1.Conversion.find({
            merchantId,
            conversionTimestamp: { $gte: last30Days },
            status: 'completed'
        });
        const monthValue = monthConversionsData.reduce((sum, c) => sum + (c.value || 0), 0);
        // Previous 7 days for trend comparison
        const [prevWeekTouchpoints, prevWeekConversions] = await Promise.all([
            Touchpoint_1.Touchpoint.countDocuments({
                merchantId,
                timestamp: { $gte: prev7Days, $lt: last7Days }
            }),
            Conversion_1.Conversion.countDocuments({
                merchantId,
                conversionTimestamp: { $gte: prev7Days, $lt: last7Days },
                status: 'completed'
            })
        ]);
        const prevWeekConversionsData = await Conversion_1.Conversion.find({
            merchantId,
            conversionTimestamp: { $gte: prev7Days, $lt: last7Days },
            status: 'completed'
        });
        const prevWeekValue = prevWeekConversionsData.reduce((sum, c) => sum + (c.value || 0), 0);
        // Calculate trends
        const touchpointTrend = prevWeekTouchpoints > 0
            ? ((weekTouchpoints - prevWeekTouchpoints) / prevWeekTouchpoints) * 100
            : 0;
        const conversionTrend = prevWeekConversions > 0
            ? ((weekConversions - prevWeekConversions) / prevWeekConversions) * 100
            : 0;
        const valueTrend = prevWeekValue > 0
            ? ((weekValue - prevWeekValue) / prevWeekValue) * 100
            : 0;
        return {
            today: {
                touchpoints: todayTouchpoints,
                conversions: todayConversions,
                value: todayValue
            },
            last7Days: {
                touchpoints: weekTouchpoints,
                conversions: weekConversions,
                value: weekValue
            },
            last30Days: {
                touchpoints: monthTouchpoints,
                conversions: monthConversions,
                value: monthValue
            },
            trends: {
                touchpointTrend,
                conversionTrend,
                valueTrend
            }
        };
    }
}
exports.ReportGenerator = ReportGenerator;
exports.reportGenerator = new ReportGenerator();
//# sourceMappingURL=ReportGenerator.js.map