"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.growthAnalytics = exports.GrowthAnalytics = void 0;
const uuid_1 = require("uuid");
const mongoose_1 = require("mongoose");
const GrowthEvent_1 = require("../models/GrowthEvent");
const logger_1 = require("../config/logger");
class GrowthAnalytics {
    /**
     * trackEvent — Record any growth event.
     * Uses eventId for idempotency to prevent duplicate recording.
     */
    async trackEvent(input) {
        const eventId = (0, uuid_1.v4)();
        const event = new GrowthEvent_1.GrowthEvent({
            eventId,
            eventType: input.eventType,
            sourceService: input.sourceService,
            userId: input.userId ? new mongoose_1.Types.ObjectId(input.userId) : undefined,
            merchantId: new mongoose_1.Types.ObjectId(input.merchantId),
            metadata: input.metadata || {},
            value: input.value || 0,
            timestamp: input.timestamp || new Date(),
            sessionId: input.sessionId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            processedAt: new Date(),
        });
        try {
            const saved = await event.save();
            logger_1.logger.debug('[GrowthAnalytics] Event tracked', {
                eventId,
                eventType: input.eventType,
                sourceService: input.sourceService,
                merchantId: input.merchantId,
            });
            return saved;
        }
        catch (err) {
            // Handle duplicate key error (idempotency)
            if (err instanceof Error && err.message.includes('duplicate key')) {
                logger_1.logger.debug('[GrowthAnalytics] Duplicate event ignored', { eventId });
                const existing = await GrowthEvent_1.GrowthEvent.findOne({ eventId }).lean();
                if (existing)
                    return existing;
            }
            throw err;
        }
    }
    /**
     * getCampaignMetrics — Get combined metrics from all services for a campaign.
     */
    async getCampaignMetrics(input) {
        const merchantOid = new mongoose_1.Types.ObjectId(input.merchantId);
        // Get all events for this campaign
        const query = {
            merchantId: merchantOid,
            'metadata.campaignId': input.campaignId,
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // last 90 days
        };
        const events = await GrowthEvent_1.GrowthEvent.find(query).lean();
        if (events.length === 0)
            return null;
        // Aggregate metrics by event type
        const counts = this.aggregateByEventType(events);
        const impressions = counts.ad_impression;
        const clicks = counts.ad_click;
        const conversions = counts.conversion;
        const vouchersIssued = counts.voucher_issued;
        const notificationsSent = counts.notification_sent;
        // Calculate rates
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;
        const voucherConversionRate = vouchersIssued > 0 ? (conversions / vouchersIssued) * 100 : 0;
        const notificationOpenRate = notificationsSent > 0
            ? ((counts.notification_opened || 0) / notificationsSent) * 100
            : 0;
        // Calculate value metrics
        const conversionEvents = events.filter((e) => e.eventType === 'conversion');
        const totalValue = conversionEvents.reduce((sum, e) => sum + (e.value || 0), 0);
        const avgOrderValue = conversions > 0 ? totalValue / conversions : 0;
        // Revenue attributed to this campaign (sum of conversion values)
        const revenueAttributed = totalValue;
        // Get campaign name from metadata
        const campaignCreated = events.find((e) => e.eventType === 'campaign_created');
        const campaignName = campaignCreated?.metadata?.campaignName || input.campaignId;
        return {
            campaignId: input.campaignId,
            campaignName,
            created: counts.campaign_created,
            impressions,
            clicks,
            ctr: Math.round(ctr * 100) / 100,
            conversions,
            conversionRate: Math.round(conversionRate * 100) / 100,
            totalValue,
            avgOrderValue: Math.round(avgOrderValue),
            vouchersIssued,
            vouchersRedeemed: conversions, // Simplified: assume all conversions used vouchers
            voucherConversionRate: Math.round(voucherConversionRate * 100) / 100,
            notificationsSent,
            notificationOpenRate: Math.round(notificationOpenRate * 100) / 100,
            revenueAttributed,
        };
    }
    /**
     * getConversionFunnel — Track users from first impression to conversion.
     */
    async getConversionFunnel(input) {
        const merchantOid = new mongoose_1.Types.ObjectId(input.merchantId);
        const query = {
            merchantId: merchantOid,
            timestamp: { $gte: input.startDate, $lte: input.endDate },
        };
        const events = await GrowthEvent_1.GrowthEvent.find(query)
            .sort({ userId: 1, timestamp: 1 })
            .lean();
        // Group events by user
        const userEvents = new Map();
        for (const event of events) {
            const userId = event.userId?.toString() || 'anonymous';
            if (!userEvents.has(userId)) {
                userEvents.set(userId, []);
            }
            userEvents.get(userId).push(event);
        }
        const totalUsers = userEvents.size;
        // Define funnel stages
        const funnelStages = [
            { step: 'Impressions', eventType: 'ad_impression' },
            { step: 'Clicks', eventType: 'ad_click' },
            { step: 'Notifications Sent', eventType: 'notification_sent' },
            { step: 'Notifications Opened', eventType: 'notification_opened' },
            { step: 'Vouchers Issued', eventType: 'voucher_issued' },
            { step: 'Conversions', eventType: 'conversion' },
        ];
        // Count users who reached each stage
        const stageCounts = [];
        for (const stage of funnelStages) {
            if (stage.eventType === null) {
                // Total users in period
                stageCounts.push(totalUsers);
            }
            else {
                const usersAtStage = new Set();
                for (const [userId, userEventList] of userEvents) {
                    const hasEvent = userEventList.some((e) => e.eventType === stage.eventType);
                    if (hasEvent) {
                        usersAtStage.add(userId);
                    }
                }
                stageCounts.push(usersAtStage.size);
            }
        }
        // Build funnel steps with drop-off rates
        const steps = [];
        for (let i = 0; i < funnelStages.length; i++) {
            const stage = funnelStages[i];
            const count = stageCounts[i];
            const prevCount = i > 0 ? stageCounts[i - 1] : count;
            // Get value (revenue) for conversions
            let value = 0;
            if (stage.eventType === 'conversion') {
                const conversionEvents = events.filter((e) => e.eventType === 'conversion');
                value = conversionEvents.reduce((sum, e) => sum + (e.metadata?.orderValue || 0), 0);
            }
            const dropOffRate = prevCount > 0 ? ((prevCount - count) / prevCount) * 100 : 0;
            steps.push({
                step: stage.step,
                eventType: stage.eventType || 'ad_impression',
                count,
                value,
                dropOffRate: Math.round(dropOffRate * 100) / 100,
            });
        }
        // Overall conversion rate (from impressions to conversion)
        const impressionCount = stageCounts[0];
        const conversionCount = stageCounts[funnelStages.length - 1];
        const overallConversionRate = impressionCount > 0
            ? (conversionCount / impressionCount) * 100
            : 0;
        return {
            merchantId: input.merchantId,
            startDate: input.startDate,
            endDate: input.endDate,
            totalUsers,
            steps,
            overallConversionRate: Math.round(overallConversionRate * 100) / 100,
        };
    }
    /**
     * getROAS — Calculate Return on Ad Spend.
     */
    async getROAS(input) {
        const merchantOid = new mongoose_1.Types.ObjectId(input.merchantId);
        const query = {
            merchantId: merchantOid,
            timestamp: { $gte: input.startDate, $lte: input.endDate },
        };
        const events = await GrowthEvent_1.GrowthEvent.find(query).lean();
        const counts = this.aggregateByEventType(events);
        const impressions = counts.ad_impression;
        const clicks = counts.ad_click;
        const conversions = counts.conversion;
        // Revenue from conversions
        const conversionEvents = events.filter((e) => e.eventType === 'conversion');
        const revenue = conversionEvents.reduce((sum, e) => sum + (e.metadata?.orderValue || 0), 0);
        // ROAS = Revenue / Ad Spend
        const roas = input.adSpend > 0 ? revenue / input.adSpend : 0;
        // CPA = Cost Per Acquisition = Ad Spend / Conversions
        const cpa = conversions > 0 ? input.adSpend / conversions : 0;
        // CTR = Click-through Rate
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        // Conversion Rate
        const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
        return {
            merchantId: input.merchantId,
            startDate: input.startDate,
            endDate: input.endDate,
            adSpend: input.adSpend,
            revenue,
            roas: Math.round(roas * 100) / 100,
            cpa: Math.round(cpa),
            conversions,
            impressions,
            clicks,
            ctr: Math.round(ctr * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
        };
    }
    /**
     * getMerchantDashboard — Full growth dashboard for a merchant.
     */
    async getMerchantDashboard(merchantId, startDate, endDate) {
        const merchantOid = new mongoose_1.Types.ObjectId(merchantId);
        const query = {
            merchantId: merchantOid,
            timestamp: { $gte: startDate, $lte: endDate },
        };
        const events = await GrowthEvent_1.GrowthEvent.find(query).lean();
        const counts = this.aggregateByEventType(events);
        // Summary
        const totalEvents = events.length;
        const conversionEvents = events.filter((e) => e.eventType === 'conversion');
        const totalRevenue = conversionEvents.reduce((sum, e) => sum + (e.metadata?.orderValue || 0), 0);
        const totalConversions = counts.conversion;
        const overallConversionRate = counts.ad_impression > 0
            ? (totalConversions / counts.ad_impression) * 100
            : 0;
        // By source service
        const bySource = {
            marketing: { events: 0, revenue: 0, conversions: 0 },
            ads: { events: 0, revenue: 0, conversions: 0 },
            notification: { events: 0, revenue: 0, conversions: 0 },
            analytics: { events: 0, revenue: 0, conversions: 0 },
        };
        for (const event of events) {
            const source = event.sourceService;
            bySource[source].events++;
            if (event.eventType === 'conversion') {
                bySource[source].revenue += event.metadata?.orderValue || 0;
                bySource[source].conversions++;
            }
        }
        // By channel
        const byChannel = {};
        for (const event of events) {
            const channel = event.metadata?.notificationChannel || 'unknown';
            if (!byChannel[channel]) {
                byChannel[channel] = { events: 0, revenue: 0, conversions: 0 };
            }
            byChannel[channel].events++;
            if (event.eventType === 'conversion') {
                byChannel[channel].revenue += event.metadata?.orderValue || 0;
                byChannel[channel].conversions++;
            }
        }
        // Top campaigns
        const campaignStats = new Map();
        for (const event of events) {
            if (event.metadata?.campaignId) {
                const cid = event.metadata.campaignId;
                if (!campaignStats.has(cid)) {
                    campaignStats.set(cid, {
                        conversions: 0,
                        revenue: 0,
                        name: event.metadata.campaignName || cid,
                    });
                }
                if (event.eventType === 'conversion') {
                    const stats = campaignStats.get(cid);
                    stats.conversions++;
                    stats.revenue += event.metadata?.orderValue || 0;
                }
            }
        }
        const topCampaigns = Array.from(campaignStats.entries())
            .map(([campaignId, stats]) => ({
            campaignId,
            campaignName: stats.name,
            conversions: stats.conversions,
            revenue: stats.revenue,
            roas: stats.revenue / (stats.conversions * 1000 || 1), // simplified ROAS
        }))
            .sort((a, b) => b.conversions - a.conversions)
            .slice(0, 10);
        // Daily trends
        const dailyMap = new Map();
        for (const event of events) {
            const date = event.timestamp.toISOString().split('T')[0];
            if (!dailyMap.has(date)) {
                dailyMap.set(date, { events: 0, revenue: 0, conversions: 0 });
            }
            const dayStats = dailyMap.get(date);
            dayStats.events++;
            if (event.eventType === 'conversion') {
                dayStats.revenue += event.metadata?.orderValue || 0;
                dayStats.conversions++;
            }
        }
        const daily = Array.from(dailyMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));
        return {
            merchantId,
            period: { start: startDate, end: endDate },
            summary: {
                totalEvents,
                totalRevenue,
                totalConversions,
                overallConversionRate: Math.round(overallConversionRate * 100) / 100,
            },
            bySource,
            byChannel,
            topCampaigns,
            trends: { daily },
        };
    }
    /**
     * Helper: Aggregate events by type.
     */
    aggregateByEventType(events) {
        const counts = {
            campaign_created: 0,
            ad_impression: 0,
            ad_click: 0,
            notification_sent: 0,
            notification_opened: 0,
            voucher_issued: 0,
            conversion: 0,
        };
        for (const event of events) {
            counts[event.eventType]++;
        }
        return counts;
    }
}
exports.GrowthAnalytics = GrowthAnalytics;
exports.growthAnalytics = new GrowthAnalytics();
exports.default = exports.growthAnalytics;
//# sourceMappingURL=growthAnalytics.js.map