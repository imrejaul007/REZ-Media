"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TouchpointTracker_1 = require("../services/TouchpointTracker");
const ConversionTracker_1 = require("../services/ConversionTracker");
const Touchpoint_1 = require("../models/Touchpoint");
const Conversion_1 = require("../models/Conversion");
const AttributionReport_1 = require("../models/AttributionReport");
const AttributionEngine_1 = require("../services/AttributionEngine");
const router = (0, express_1.Router)();
/**
 * POST /api/track/touchpoint
 * Track a new touchpoint (ad view, store visit, etc.)
 */
router.post('/touchpoint', async (req, res, next) => {
    try {
        const { userId, sessionId, type, channel, campaignId, adId, creativeId, merchantId, storeId, location, deviceFingerprint, ipAddress, userAgent, metadata, timestamp } = req.body;
        // Validate required fields
        if (!userId || !sessionId || !type || !channel) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, sessionId, type, channel'
            });
            return;
        }
        // Validate enum values
        if (!Object.values(Touchpoint_1.TouchpointType).includes(type)) {
            res.status(400).json({
                success: false,
                error: `Invalid touchpoint type. Must be one of: ${Object.values(Touchpoint_1.TouchpointType).join(', ')}`
            });
            return;
        }
        if (!Object.values(Touchpoint_1.Channel).includes(channel)) {
            res.status(400).json({
                success: false,
                error: `Invalid channel. Must be one of: ${Object.values(Touchpoint_1.Channel).join(', ')}`
            });
            return;
        }
        const touchpointData = {
            userId,
            sessionId,
            type,
            channel,
            campaignId,
            adId,
            creativeId,
            merchantId,
            storeId,
            location,
            deviceFingerprint,
            ipAddress,
            userAgent,
            metadata,
            timestamp: timestamp ? new Date(timestamp) : undefined
        };
        const touchpoint = await TouchpointTracker_1.touchpointTracker.createTouchpoint(touchpointData);
        res.status(201).json({
            success: true,
            data: {
                id: touchpoint.id,
                userId: touchpoint.userId,
                type: touchpoint.type,
                channel: touchpoint.channel,
                timestamp: touchpoint.timestamp
            },
            message: 'Touchpoint tracked successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/track/conversion
 * Track a conversion (purchase, signup, etc.)
 */
router.post('/conversion', async (req, res, next) => {
    try {
        const { userId, sessionId, type, merchantId, storeId, orderId, value, currency, items, location, metadata, timestamp, applyAttribution, attributionConfig } = req.body;
        // Validate required fields
        if (!userId || !sessionId || !type || !merchantId) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, sessionId, type, merchantId'
            });
            return;
        }
        // Validate conversion type
        if (!Object.values(Conversion_1.ConversionType).includes(type)) {
            res.status(400).json({
                success: false,
                error: `Invalid conversion type. Must be one of: ${Object.values(Conversion_1.ConversionType).join(', ')}`
            });
            return;
        }
        const conversionData = {
            userId,
            sessionId,
            type,
            merchantId,
            storeId,
            orderId,
            value,
            currency,
            items,
            location,
            metadata,
            conversionTimestamp: timestamp ? new Date(timestamp) : undefined
        };
        const conversion = await ConversionTracker_1.conversionTracker.createConversion(conversionData);
        // Optionally apply attribution
        if (applyAttribution) {
            const config = {
                model: attributionConfig?.model || AttributionReport_1.AttributionModel.LINEAR,
                lookbackDays: attributionConfig?.lookbackDays || 30,
                attributionWindow: attributionConfig?.attributionWindow || 7
            };
            // Get touchpoints for this user
            const touchpoints = await TouchpointTracker_1.touchpointTracker.getUserTouchpointsForAttribution(userId, conversion.conversionTimestamp, config.lookbackDays);
            if (touchpoints.length > 0) {
                const attribution = AttributionEngine_1.attributionEngine.calculateConversionAttribution(touchpoints, conversion, config);
                // Update conversion with attribution data
                const primaryAttribution = attribution.contributions[0];
                await ConversionTracker_1.conversionTracker.addAttributionData(conversion.id, {
                    touchpointIds: attribution.contributions.map(c => c.touchpointId),
                    attributionModel: config.model,
                    attributedChannel: primaryAttribution?.attributedChannel || 'unknown',
                    attributedCampaignId: primaryAttribution?.attributedCampaignId
                });
                res.status(201).json({
                    success: true,
                    data: {
                        id: conversion.id,
                        userId: conversion.userId,
                        type: conversion.type,
                        value: conversion.value,
                        timestamp: conversion.conversionTimestamp,
                        attribution: {
                            model: attribution.attributionModel,
                            contributions: attribution.contributions.map(c => ({
                                touchpointId: c.touchpointId,
                                channel: c.attributedChannel,
                                contributionPercentage: c.contributionPercentage
                            }))
                        }
                    },
                    message: 'Conversion tracked with attribution'
                });
                return;
            }
        }
        res.status(201).json({
            success: true,
            data: {
                id: conversion.id,
                userId: conversion.userId,
                type: conversion.type,
                value: conversion.value,
                timestamp: conversion.conversionTimestamp
            },
            message: 'Conversion tracked successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/track/touchpoints/batch
 * Batch track multiple touchpoints
 */
router.post('/touchpoints/batch', async (req, res, next) => {
    try {
        const { touchpoints } = req.body;
        if (!Array.isArray(touchpoints) || touchpoints.length === 0) {
            res.status(400).json({
                success: false,
                error: 'touchpoints must be a non-empty array'
            });
            return;
        }
        // Validate all touchpoints
        for (let i = 0; i < touchpoints.length; i++) {
            const tp = touchpoints[i];
            if (!tp.userId || !tp.sessionId || !tp.type || !tp.channel) {
                res.status(400).json({
                    success: false,
                    error: `Touchpoint at index ${i} missing required fields`
                });
                return;
            }
            if (!Object.values(Touchpoint_1.TouchpointType).includes(tp.type)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid touchpoint type at index ${i}`
                });
                return;
            }
            if (!Object.values(Touchpoint_1.Channel).includes(tp.channel)) {
                res.status(400).json({
                    success: false,
                    error: `Invalid channel at index ${i}`
                });
                return;
            }
        }
        const touchpointDTOs = touchpoints.map(tp => ({
            userId: tp.userId,
            sessionId: tp.sessionId,
            type: tp.type,
            channel: tp.channel,
            campaignId: tp.campaignId,
            adId: tp.adId,
            creativeId: tp.creativeId,
            merchantId: tp.merchantId,
            storeId: tp.storeId,
            location: tp.location,
            deviceFingerprint: tp.deviceFingerprint,
            ipAddress: tp.ipAddress,
            userAgent: tp.userAgent,
            metadata: tp.metadata,
            timestamp: tp.timestamp ? new Date(tp.timestamp) : undefined
        }));
        const created = await TouchpointTracker_1.touchpointTracker.createTouchpointsBatch(touchpointDTOs);
        res.status(201).json({
            success: true,
            data: {
                count: created.length,
                ids: created.map(tp => tp.id)
            },
            message: `${created.length} touchpoints tracked successfully`
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/track/touchpoints
 * Get touchpoints with filtering
 */
router.get('/touchpoints', async (req, res, next) => {
    try {
        const { userId, merchantId, campaignId, channel, type, startDate, endDate, limit, skip } = req.query;
        const options = {
            userId: userId,
            merchantId: merchantId,
            campaignId: campaignId,
            channel: channel,
            type: type,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            skip: skip ? parseInt(skip) : undefined
        };
        const { touchpoints, total } = await TouchpointTracker_1.touchpointTracker.getTouchpoints(options);
        res.json({
            success: true,
            data: {
                touchpoints,
                pagination: {
                    total,
                    limit: options.limit || 100,
                    skip: options.skip || 0
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/track/conversions
 * Get conversions with filtering
 */
router.get('/conversions', async (req, res, next) => {
    try {
        const { userId, merchantId, storeId, type, status, startDate, endDate, minValue, maxValue, limit, skip } = req.query;
        const options = {
            userId: userId,
            merchantId: merchantId,
            storeId: storeId,
            type: type,
            status: status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            minValue: minValue ? parseFloat(minValue) : undefined,
            maxValue: maxValue ? parseFloat(maxValue) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            skip: skip ? parseInt(skip) : undefined
        };
        const { conversions, total } = await ConversionTracker_1.conversionTracker.getConversions(options);
        res.json({
            success: true,
            data: {
                conversions,
                pagination: {
                    total,
                    limit: options.limit || 100,
                    skip: options.skip || 0
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/track/conversion/:id
 * Get a specific conversion
 */
router.get('/conversion/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const conversion = await ConversionTracker_1.conversionTracker.getConversion(id);
        if (!conversion) {
            res.status(404).json({
                success: false,
                error: 'Conversion not found'
            });
            return;
        }
        res.json({
            success: true,
            data: conversion
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * PATCH /api/track/conversion/:id/status
 * Update conversion status (e.g., for refunds)
 */
router.patch('/conversion/:id/status', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['pending', 'completed', 'cancelled', 'refunded'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
            return;
        }
        const conversion = await ConversionTracker_1.conversionTracker.updateConversionStatus(id, status);
        if (!conversion) {
            res.status(404).json({
                success: false,
                error: 'Conversion not found'
            });
            return;
        }
        res.json({
            success: true,
            data: conversion,
            message: 'Conversion status updated'
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/track/stats
 * Get tracking statistics
 */
router.get('/stats', async (req, res, next) => {
    try {
        const { merchantId, campaignId, startDate, endDate } = req.query;
        const [touchpointStats, conversionStats] = await Promise.all([
            TouchpointTracker_1.touchpointTracker.getTouchpointStats(merchantId, campaignId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined),
            ConversionTracker_1.conversionTracker.getConversionStats(merchantId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined)
        ]);
        res.json({
            success: true,
            data: {
                touchpoints: touchpointStats,
                conversions: conversionStats
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=track.js.map