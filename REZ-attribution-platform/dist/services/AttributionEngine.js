"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attributionEngine = exports.AttributionEngine = void 0;
const uuid_1 = require("uuid");
const AttributionReport_1 = require("../models/AttributionReport");
const logger_1 = __importDefault(require("../utils/logger"));
class AttributionEngine {
    defaultConfig = {
        model: AttributionReport_1.AttributionModel.LINEAR,
        lookbackDays: 30,
        attributionWindow: 7
    };
    /**
     * Calculate attribution for a single conversion
     */
    calculateConversionAttribution(touchpoints, conversion, config = {}) {
        const fullConfig = { ...this.defaultConfig, ...config };
        // Filter touchpoints within attribution window
        const eligibleTouchpoints = this.filterTouchpointsByWindow(touchpoints, conversion.conversionTimestamp, fullConfig.attributionWindow);
        // Sort by timestamp
        const sortedTouchpoints = this.sortByTimestamp(eligibleTouchpoints);
        // Calculate contributions based on model
        const contributions = this.applyAttributionModel(sortedTouchpoints, fullConfig.model, conversion.value || 1);
        const totalContribution = contributions.reduce((sum, c) => sum + c.contribution, 0);
        return {
            conversionId: conversion.id,
            userId: conversion.userId,
            totalValue: conversion.value || 0,
            attributionModel: fullConfig.model,
            contributions,
            totalContribution
        };
    }
    /**
     * Filter touchpoints within the attribution window
     */
    filterTouchpointsByWindow(touchpoints, conversionTimestamp, windowDays) {
        const windowStart = new Date(conversionTimestamp);
        windowStart.setDate(windowStart.getDate() - windowDays);
        return touchpoints.filter(tp => {
            const tpDate = new Date(tp.timestamp);
            return tpDate >= windowStart && tpDate <= conversionTimestamp;
        });
    }
    /**
     * Sort touchpoints by timestamp (oldest first for attribution)
     */
    sortByTimestamp(touchpoints) {
        return [...touchpoints].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    /**
     * Apply the specified attribution model
     */
    applyAttributionModel(touchpoints, model, totalValue) {
        switch (model) {
            case AttributionReport_1.AttributionModel.FIRST_TOUCH:
                return this.applyFirstTouch(touchpoints, totalValue);
            case AttributionReport_1.AttributionModel.LAST_TOUCH:
                return this.applyLastTouch(touchpoints, totalValue);
            case AttributionReport_1.AttributionModel.LINEAR:
                return this.applyLinear(touchpoints, totalValue);
            case AttributionReport_1.AttributionModel.TIME_DECAY:
                return this.applyTimeDecay(touchpoints, totalValue);
            case AttributionReport_1.AttributionModel.POSITION_BASED:
                return this.applyPositionBased(touchpoints, totalValue);
            default:
                return this.applyLinear(touchpoints, totalValue);
        }
    }
    /**
     * First-touch: 100% credit to first touchpoint
     */
    applyFirstTouch(touchpoints, totalValue) {
        if (touchpoints.length === 0)
            return [];
        const first = touchpoints[0];
        return [{
                touchpointId: first.id,
                touchpoint: first,
                contribution: totalValue,
                contributionPercentage: 100,
                attributedChannel: first.channel,
                attributedCampaignId: first.campaignId
            }];
    }
    /**
     * Last-touch: 100% credit to last touchpoint
     */
    applyLastTouch(touchpoints, totalValue) {
        if (touchpoints.length === 0)
            return [];
        const last = touchpoints[touchpoints.length - 1];
        return [{
                touchpointId: last.id,
                touchpoint: last,
                contribution: totalValue,
                contributionPercentage: 100,
                attributedChannel: last.channel,
                attributedCampaignId: last.campaignId
            }];
    }
    /**
     * Linear: Equal credit to all touchpoints
     */
    applyLinear(touchpoints, totalValue) {
        if (touchpoints.length === 0)
            return [];
        const valuePerTouchpoint = totalValue / touchpoints.length;
        const percentagePerTouchpoint = 100 / touchpoints.length;
        return touchpoints.map(tp => ({
            touchpointId: tp.id,
            touchpoint: tp,
            contribution: valuePerTouchpoint,
            contributionPercentage: percentagePerTouchpoint,
            attributedChannel: tp.channel,
            attributedCampaignId: tp.campaignId
        }));
    }
    /**
     * Time-decay: More credit to recent touchpoints (half-life of 7 days)
     */
    applyTimeDecay(touchpoints, totalValue) {
        if (touchpoints.length === 0)
            return [];
        const halfLifeDays = 7;
        const latestTimestamp = new Date(touchpoints[touchpoints.length - 1].timestamp).getTime();
        // Calculate weights based on time distance from conversion
        const weights = touchpoints.map(tp => {
            const tpTime = new Date(tp.timestamp).getTime();
            const daysDiff = (latestTimestamp - tpTime) / (1000 * 60 * 60 * 24);
            return Math.pow(0.5, daysDiff / halfLifeDays);
        });
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        return touchpoints.map((tp, i) => {
            const normalizedWeight = weights[i] / totalWeight;
            return {
                touchpointId: tp.id,
                touchpoint: tp,
                contribution: totalValue * normalizedWeight,
                contributionPercentage: normalizedWeight * 100,
                attributedChannel: tp.channel,
                attributedCampaignId: tp.campaignId
            };
        });
    }
    /**
     * Position-based (U-shaped): 40% first, 40% last, 20% distributed among middle
     */
    applyPositionBased(touchpoints, totalValue) {
        if (touchpoints.length === 0)
            return [];
        if (touchpoints.length === 1) {
            return [{
                    touchpointId: touchpoints[0].id,
                    touchpoint: touchpoints[0],
                    contribution: totalValue,
                    contributionPercentage: 100,
                    attributedChannel: touchpoints[0].channel,
                    attributedCampaignId: touchpoints[0].campaignId
                }];
        }
        if (touchpoints.length === 2) {
            return touchpoints.map(tp => ({
                touchpointId: tp.id,
                touchpoint: tp,
                contribution: totalValue * 0.5,
                contributionPercentage: 50,
                attributedChannel: tp.channel,
                attributedCampaignId: tp.campaignId
            }));
        }
        const firstContribution = totalValue * 0.4;
        const lastContribution = totalValue * 0.4;
        const middleContribution = totalValue * 0.2;
        const middleTouchpoints = touchpoints.slice(1, -1);
        const middlePerTouchpoint = middleContribution / middleTouchpoints.length;
        const results = [];
        // First touchpoint
        results.push({
            touchpointId: touchpoints[0].id,
            touchpoint: touchpoints[0],
            contribution: firstContribution,
            contributionPercentage: 40,
            attributedChannel: touchpoints[0].channel,
            attributedCampaignId: touchpoints[0].campaignId
        });
        // Middle touchpoints
        for (const tp of middleTouchpoints) {
            results.push({
                touchpointId: tp.id,
                touchpoint: tp,
                contribution: middlePerTouchpoint,
                contributionPercentage: (middlePerTouchpoint / totalValue) * 100,
                attributedChannel: tp.channel,
                attributedCampaignId: tp.campaignId
            });
        }
        // Last touchpoint
        results.push({
            touchpointId: touchpoints[touchpoints.length - 1].id,
            touchpoint: touchpoints[touchpoints.length - 1],
            contribution: lastContribution,
            contributionPercentage: 40,
            attributedChannel: touchpoints[touchpoints.length - 1].channel,
            attributedCampaignId: touchpoints[touchpoints.length - 1].campaignId
        });
        return results;
    }
    /**
     * Generate comprehensive attribution report
     */
    async generateAttributionReport(touchpoints, conversions, config) {
        const fullConfig = { ...this.defaultConfig, ...config };
        const startDate = new Date(Math.min(...touchpoints.map(t => new Date(t.timestamp).getTime())));
        const endDate = new Date(Math.max(...conversions.map(c => new Date(c.conversionTimestamp).getTime())));
        // Calculate attribution for each conversion
        const allContributions = new Map();
        const channelTotals = new Map();
        const campaignTotals = new Map();
        for (const conversion of conversions) {
            const conversionTouchpoints = touchpoints.filter(t => t.userId === conversion.userId);
            const attribution = this.calculateConversionAttribution(conversionTouchpoints, conversion, fullConfig);
            allContributions.set(conversion.id, attribution.contributions);
            // Aggregate channel attribution
            for (const contribution of attribution.contributions) {
                const channel = contribution.attributedChannel;
                const current = channelTotals.get(channel) || {
                    channel,
                    touchpoints: 0,
                    conversions: 0,
                    attributedValue: 0,
                    attributionPercentage: 0
                };
                current.touchpoints += 1;
                current.attributedValue += contribution.contribution;
                channelTotals.set(channel, current);
                // Aggregate campaign attribution
                if (contribution.attributedCampaignId) {
                    const campaignId = contribution.attributedCampaignId;
                    const currentCampaign = campaignTotals.get(campaignId) || {
                        campaignId,
                        touchpoints: 0,
                        conversions: 0,
                        attributedValue: 0,
                        attributionPercentage: 0,
                        channelBreakdown: []
                    };
                    currentCampaign.touchpoints += 1;
                    currentCampaign.attributedValue += contribution.contribution;
                    const channelInCampaign = currentCampaign.channelBreakdown.find(c => c.channel === channel);
                    if (channelInCampaign) {
                        channelInCampaign.touchpoints += 1;
                        channelInCampaign.attributedValue += contribution.contribution;
                    }
                    else {
                        currentCampaign.channelBreakdown.push({
                            channel,
                            touchpoints: 1,
                            conversions: 0,
                            attributedValue: contribution.contribution,
                            attributionPercentage: 0
                        });
                    }
                    campaignTotals.set(campaignId, currentCampaign);
                }
            }
        }
        // Count conversions per channel/campaign
        for (const [channel, data] of channelTotals) {
            data.conversions = conversions.filter(c => {
                const contributions = allContributions.get(c.id) || [];
                return contributions.some(contrib => contrib.attributedChannel === channel && contrib.contribution > 0);
            }).length;
        }
        for (const [campaignId, data] of campaignTotals) {
            data.conversions = conversions.filter(c => {
                const contributions = allContributions.get(c.id) || [];
                return contributions.some(contrib => contrib.attributedCampaignId === campaignId && contrib.contribution > 0);
            }).length;
        }
        // Calculate percentages
        const totalValue = conversions.reduce((sum, c) => sum + (c.value || 0), 0);
        for (const data of channelTotals.values()) {
            data.attributionPercentage = totalValue > 0 ? (data.attributedValue / totalValue) * 100 : 0;
        }
        for (const data of campaignTotals.values()) {
            data.attributionPercentage = totalValue > 0 ? (data.attributedValue / totalValue) * 100 : 0;
        }
        for (const data of campaignTotals.values()) {
            for (const channel of data.channelBreakdown) {
                channel.attributionPercentage =
                    data.attributedValue > 0 ? (channel.attributedValue / data.attributedValue) * 100 : 0;
            }
        }
        // Build touchpoint contributions list
        const touchpointContributions = [];
        for (const contributions of allContributions.values()) {
            for (const contribution of contributions) {
                touchpointContributions.push({
                    touchpointId: contribution.touchpointId,
                    touchpointType: contribution.touchpoint.type,
                    channel: contribution.attributedChannel,
                    campaignId: contribution.attributedCampaignId,
                    timestamp: contribution.touchpoint.timestamp,
                    contribution: contribution.contribution,
                    contributionPercentage: contribution.contributionPercentage
                });
            }
        }
        // Calculate conversion rate
        const uniqueUsers = new Set(touchpoints.map(t => t.userId)).size;
        const conversionRate = uniqueUsers > 0 ? (conversions.length / uniqueUsers) * 100 : 0;
        const report = new AttributionReport_1.AttributionReport({
            id: (0, uuid_1.v4)(),
            reportType: config.reportType,
            attributionModel: fullConfig.model,
            entityId: config.entityId,
            entityType: config.entityType,
            startDate,
            endDate,
            lookbackDays: fullConfig.lookbackDays,
            totalTouchpoints: touchpoints.length,
            totalConversions: conversions.length,
            totalValue,
            conversionRate,
            channelAttribution: Array.from(channelTotals.values()),
            campaignAttribution: Array.from(campaignTotals.values()),
            touchpointContributions,
            funnelData: this.generateFunnelData(touchpoints, conversions),
            metadata: {
                conversionIds: conversions.map(c => c.id),
                touchpointIds: touchpoints.map(t => t.id)
            },
            generatedAt: new Date()
        });
        await report.save();
        logger_1.default.info('Attribution report generated', {
            reportId: report.id,
            reportType: config.reportType,
            totalConversions: conversions.length,
            model: fullConfig.model
        });
        return report;
    }
    /**
     * Generate funnel data for visualization
     */
    generateFunnelData(touchpoints, conversions) {
        const stages = ['Awareness', 'Interest', 'Consideration', 'Conversion'];
        const uniqueUsers = new Set(touchpoints.map(t => t.userId)).size;
        // Simplified funnel stages based on touchpoint counts
        const stageCounts = [
            uniqueUsers, // All users with touchpoints
            Math.floor(uniqueUsers * 0.7), // Estimated interest
            Math.floor(uniqueUsers * 0.4), // Estimated consideration
            conversions.length // Actual conversions
        ];
        return stages.map((stage, i) => ({
            stage,
            count: stageCounts[i],
            dropoffRate: i > 0 ? ((stageCounts[i - 1] - stageCounts[i]) / stageCounts[i - 1]) * 100 : 0
        }));
    }
    /**
     * Compare attribution across different models
     */
    async compareAttributionModels(touchpoints, conversion) {
        const models = Object.values(AttributionReport_1.AttributionModel);
        const results = {};
        for (const model of models) {
            results[model] = this.calculateConversionAttribution(touchpoints, conversion, { model });
        }
        return results;
    }
}
exports.AttributionEngine = AttributionEngine;
exports.attributionEngine = new AttributionEngine();
//# sourceMappingURL=AttributionEngine.js.map