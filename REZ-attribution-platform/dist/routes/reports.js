"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReportGenerator_1 = require("../services/ReportGenerator");
const TouchpointTracker_1 = require("../services/TouchpointTracker");
const ConversionTracker_1 = require("../services/ConversionTracker");
const AttributionEngine_1 = require("../services/AttributionEngine");
const AttributionReport_1 = require("../models/AttributionReport");
const router = (0, express_1.Router)();
/**
 * GET /api/reports/attribution
 * Get attribution report with configurable parameters
 */
router.get('/attribution', async (req, res, next) => {
    try {
        const { merchantId, campaignId, startDate, endDate, model, lookbackDays } = req.query;
        // Validate model if provided
        if (model && !Object.values(AttributionReport_1.AttributionModel).includes(model)) {
            res.status(400).json({
                success: false,
                error: `Invalid attribution model. Must be one of: ${Object.values(AttributionReport_1.AttributionModel).join(', ')}`
            });
            return;
        }
        const filters = {
            merchantId: merchantId,
            campaignId: campaignId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            attributionModel: model,
            lookbackDays: lookbackDays ? parseInt(lookbackDays) : 30
        };
        const report = await ReportGenerator_1.reportGenerator.generateAttributionReport(filters);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/reports/funnel
 * Get conversion funnel report
 */
router.get('/funnel', async (req, res, next) => {
    try {
        const { merchantId, campaignId, startDate, endDate } = req.query;
        const report = await ReportGenerator_1.reportGenerator.generateFunnelReport({
            merchantId: merchantId,
            campaignId: campaignId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        });
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/campaigns/:id/attribution
 * Get attribution report for a specific campaign
 */
router.post('/campaigns/:id/attribution', async (req, res, next) => {
    try {
        const { id: campaignId } = req.params;
        const { startDate, endDate, attributionModel } = req.body;
        const report = await ReportGenerator_1.reportGenerator.generateCampaignAttribution(campaignId, {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            attributionModel: attributionModel || AttributionReport_1.AttributionModel.LINEAR
        });
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/campaigns/:id/attribution
 * Get attribution report for a specific campaign (GET version)
 */
router.get('/campaigns/:id/attribution', async (req, res, next) => {
    try {
        const { id: campaignId } = req.params;
        const { startDate, endDate, model } = req.query;
        const report = await ReportGenerator_1.reportGenerator.generateCampaignAttribution(campaignId, {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            attributionModel: model || AttributionReport_1.AttributionModel.LINEAR
        });
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/reports/compare
 * Compare attribution across different models
 */
router.post('/compare', async (req, res, next) => {
    try {
        const { userId, conversionId, lookbackDays } = req.body;
        if (!userId || !conversionId) {
            res.status(400).json({
                success: false,
                error: 'userId and conversionId are required'
            });
            return;
        }
        // Get the conversion
        const conversion = await ConversionTracker_1.conversionTracker.getConversion(conversionId);
        if (!conversion) {
            res.status(404).json({
                success: false,
                error: 'Conversion not found'
            });
            return;
        }
        // Get touchpoints for this user
        const touchpoints = await TouchpointTracker_1.touchpointTracker.getUserTouchpointsForAttribution(userId, conversion.conversionTimestamp, lookbackDays || 30);
        if (touchpoints.length === 0) {
            res.status(404).json({
                success: false,
                error: 'No touchpoints found for this user within the attribution window'
            });
            return;
        }
        const comparison = await AttributionEngine_1.attributionEngine.compareAttributionModels(touchpoints, conversion);
        res.json({
            success: true,
            data: {
                conversionId: conversion.id,
                totalValue: conversion.value,
                touchpointsCount: touchpoints.length,
                models: Object.keys(comparison).map(model => ({
                    model,
                    contributions: comparison[model].contributions.map(c => ({
                        touchpointId: c.touchpointId,
                        channel: c.attributedChannel,
                        contribution: c.contribution,
                        contributionPercentage: c.contributionPercentage
                    })),
                    totalContribution: comparison[model].totalContribution
                }))
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/reports/historical
 * Get historical attribution reports
 */
router.get('/historical', async (req, res, next) => {
    try {
        const { reportType, entityId, limit } = req.query;
        const reports = await ReportGenerator_1.reportGenerator.getHistoricalReports({
            reportType: reportType,
            entityId: entityId,
            limit: limit ? parseInt(limit) : 10
        });
        res.json({
            success: true,
            data: {
                reports,
                count: reports.length
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
router.get('/report/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const report = await ReportGenerator_1.reportGenerator.getReport(id);
        if (!report) {
            res.status(404).json({
                success: false,
                error: 'Report not found'
            });
            return;
        }
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/reports/dashboard/:merchantId
 * Get real-time dashboard metrics for a merchant
 */
router.get('/dashboard/:merchantId', async (req, res, next) => {
    try {
        const { merchantId } = req.params;
        const metrics = await ReportGenerator_1.reportGenerator.getDashboardMetrics(merchantId);
        res.json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/reports/channel-performance
 * Get channel performance metrics
 */
router.get('/channel-performance', async (req, res, next) => {
    try {
        const { merchantId, campaignId, startDate, endDate } = req.query;
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate
            ? new Date(startDate)
            : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        const [touchpoints, conversions] = await Promise.all([
            TouchpointTracker_1.touchpointTracker.getTouchpoints({
                merchantId: merchantId,
                campaignId: campaignId,
                startDate: start,
                endDate: end,
                limit: 10000
            }),
            ConversionTracker_1.conversionTracker.getConversions({
                merchantId: merchantId,
                startDate: start,
                endDate: end,
                limit: 10000
            })
        ]);
        // Calculate channel performance
        const channelStats = new Map();
        // Initialize all channels
        const channels = ['display', 'social', 'search', 'video', 'audio', 'ooh', 'print', 'direct', 'email', 'referral'];
        for (const channel of channels) {
            channelStats.set(channel, {
                touchpoints: 0,
                conversions: 0,
                value: 0,
                uniqueUsers: 0
            });
        }
        // Count touchpoints by channel
        for (const tp of touchpoints.touchpoints) {
            const stats = channelStats.get(tp.channel) || { touchpoints: 0, conversions: 0, value: 0, uniqueUsers: 0 };
            stats.touchpoints++;
            channelStats.set(tp.channel, stats);
        }
        // Count conversions (simplified - attributed to last touchpoint's channel)
        for (const conv of conversions.conversions) {
            if (conv.attributionData?.attributedChannel) {
                const stats = channelStats.get(conv.attributionData.attributedChannel) || {
                    touchpoints: 0, conversions: 0, value: 0, uniqueUsers: 0
                };
                stats.conversions++;
                stats.value += conv.value || 0;
                channelStats.set(conv.attributionData.attributedChannel, stats);
            }
        }
        const performance = Array.from(channelStats.entries())
            .map(([channel, stats]) => ({
            channel,
            ...stats,
            conversionRate: stats.touchpoints > 0
                ? (stats.conversions / stats.touchpoints) * 100
                : 0
        }))
            .filter(s => s.touchpoints > 0)
            .sort((a, b) => b.value - a.value);
        res.json({
            success: true,
            data: {
                channelPerformance: performance,
                dateRange: { start, end },
                totals: {
                    touchpoints: touchpoints.total,
                    conversions: conversions.total
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=reports.js.map