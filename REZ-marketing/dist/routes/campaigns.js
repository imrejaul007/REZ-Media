"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const CampaignOrchestrator_1 = require("../campaigns/CampaignOrchestrator");
const AudienceBuilder_1 = require("../audience/AudienceBuilder");
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const auth_1 = require("../middleware/auth");
const intentCaptureService_1 = require("../services/intentCaptureService");
const growthAnalytics_1 = require("../services/growthAnalytics");
const notificationService_1 = require("../services/notificationService");
const router = (0, express_1.Router)();
// CRIT FIX: All campaign routes require merchant authentication
router.use(auth_1.verifyMerchant);
// CRIT FIX: Add input validation middleware for campaign routes
function validateMerchantId(req, res, next) {
    const merchantId = req.body?.merchantId || req.query?.merchantId;
    if (merchantId && typeof merchantId === 'string' && merchantId.length > 100) {
        res.status(400).json({ error: 'merchantId too long' });
        return;
    }
    next();
}
router.use(validateMerchantId);
// GET /campaigns — list campaigns for a merchant
router.get('/', async (req, res) => {
    const { merchantId, status, limit: limitQ = '20', page = '1' } = req.query;
    if (!merchantId)
        return res.status(400).json({ error: 'merchantId required' });
    const limit = Math.min(100, Math.max(1, parseInt(limitQ) || 20));
    const query = { merchantId };
    if (status)
        query.status = status;
    const skip = (parseInt(page) - 1) * limit;
    const [campaigns, total] = await Promise.all([
        MarketingCampaign_1.MarketingCampaign.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        MarketingCampaign_1.MarketingCampaign.countDocuments(query),
    ]);
    res.json({ campaigns, total, page: parseInt(page), limit });
});
// GET /campaigns/:id — single campaign
router.get('/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(req.params.id).lean();
    if (!campaign)
        return res.status(404).json({ error: 'Not found' });
    res.json(campaign);
});
// POST /campaigns — create campaign
router.post('/', async (req, res) => {
    const { merchantId, name, objective, channel, message, audience, scheduledAt, templateName, imageUrl, ctaUrl, ctaText, createdBy, } = req.body;
    // HIGH FIX: Rate limit campaign creation (max 20 per merchant per hour)
    if (merchantId) {
        try {
            const redis = (0, redis_1.getRedis)();
            const rateLimitKey = `mkt:campaign:create:ratelimit:${merchantId}`;
            const script = `
        local key = KEYS[1]
        local ttl = tonumber(ARGV[1])
        local current = redis.call('incr', key)
        if current == 1 then
          redis.call('expire', key, ttl)
        end
        return current
      `;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const count = await redis.eval(script, 1, rateLimitKey, 3600);
            if (count > 20) {
                return res.status(429).json({ error: 'Too many campaign creations. Maximum 20 per hour.' });
            }
        }
        catch (err) {
            logger_1.logger.warn('[Campaigns] Rate limit check failed — allowing request', { error: err.message });
        }
    }
    if (!merchantId || !name || !objective || !channel || !message || !audience) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    // HIGH FIX: Validate name length to prevent abuse
    if (typeof name !== 'string' || name.length > 200) {
        return res.status(400).json({ error: 'Campaign name must be a string under 200 characters' });
    }
    // HIGH FIX: Validate message length
    if (typeof message !== 'string' || message.length > 5000) {
        return res.status(400).json({ error: 'Message must be a string under 5000 characters' });
    }
    // BE-MKT-006 FIX: Validate channel value is in allowed list
    const validChannels = ['push', 'sms', 'email', 'whatsapp', 'in_app'];
    if (!validChannels.includes(channel)) {
        return res.status(400).json({
            error: `Invalid channel. Must be one of: ${validChannels.join(', ')}`,
        });
    }
    // BE-MKT-014 FIX: Validate template exists if templateName is provided
    if (templateName) {
        try {
            const templateExists = await mongoose_1.default.connection.db.collection('templates').findOne({ name: templateName });
            if (!templateExists) {
                return res.status(400).json({
                    error: `Template '${templateName}' not found. Create template first.`,
                });
            }
        }
        catch (err) {
            logger_1.logger.warn('[Campaigns] Template validation failed', { err: err.message });
        }
    }
    // BE-MKT-015 FIX: Validate and sanitize CTA URL
    if (ctaUrl) {
        try {
            new URL(ctaUrl); // Will throw if invalid URL
        }
        catch {
            return res.status(400).json({
                error: 'ctaUrl must be a valid URL',
            });
        }
    }
    // Estimate audience size and cache in the campaign doc
    let estimatedCount = 0;
    try {
        estimatedCount = await AudienceBuilder_1.audienceBuilder.estimate(merchantId, audience);
    }
    catch (err) {
        logger_1.logger.warn('[Campaigns] Audience estimate failed', { err: err.message });
    }
    const campaign = await MarketingCampaign_1.MarketingCampaign.create({
        merchantId,
        name,
        objective,
        channel,
        message,
        templateName,
        imageUrl,
        ctaUrl,
        ctaText,
        audience: { ...audience, estimatedCount },
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        audienceEstimatedCountUpdatedAt: new Date(), // BE-MKT-003: Record when estimate was made
        createdBy,
    });
    // RTMN Commerce Memory: track campaign creation as merchant marketing intent
    (0, intentCaptureService_1.track)({ userId: merchantId, event: 'campaign_created', intentKey: `marketing_campaign_${campaign._id}`, properties: { campaignId: String(campaign._id), channel, objective, audienceType: audience.type } }).catch(() => { });
    // Growth Analytics: track campaign creation event
    growthAnalytics_1.growthAnalytics.trackEvent({
        eventType: 'campaign_created',
        sourceService: 'marketing',
        merchantId: String(merchantId),
        metadata: {
            campaignId: String(campaign._id),
            campaignName: name,
            campaignObjective: objective,
        },
    }).catch((err) => logger_1.logger.warn('[Campaigns] Growth analytics tracking failed', { error: err.message }));
    // MKT-NOTIF-001: Send push notification to targeted users when campaign is created
    // Only notify for immediate campaigns (not draft), non-blocking to avoid delaying response
    if (!scheduledAt) {
        (0, notificationService_1.sendCampaignNotification)({
            campaignId: String(campaign._id),
            campaignName: name,
            merchantId,
            channel: channel,
            message,
            audienceType: audience.segment,
            audienceCount: estimatedCount,
            imageUrl,
            ctaUrl,
            ctaText,
        }).catch((err) => logger_1.logger.warn('[Campaigns] Notification trigger failed', { campaignId: String(campaign._id), error: err.message }));
    }
    res.status(201).json(campaign);
});
// PATCH /campaigns/:id — update draft campaign
// BE-MKT-001 FIX: Enforce valid campaign status transitions
router.patch('/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(req.params.id);
    if (!campaign)
        return res.status(404).json({ error: 'Not found' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
        return res.status(400).json({ error: 'Only draft or scheduled campaigns can be edited' });
    }
    // BE-MKT-001: Validate status transitions if status is being updated
    if (req.body.status && req.body.status !== campaign.status) {
        const legalTransitions = {
            'draft': ['scheduled', 'cancelled'],
            'scheduled': ['sending', 'cancelled'],
            'sending': ['sent'],
            'sent': [],
            'cancelled': [],
        };
        if (!legalTransitions[campaign.status]?.includes(req.body.status)) {
            return res.status(400).json({
                error: `Invalid state transition: '${campaign.status}' → '${req.body.status}'`,
            });
        }
    }
    // MED-36 FIX: Block edits to critical fields when campaign is actively sending/sent
    const protectedFields = ['message', 'ctaUrl'];
    const sendingOrSent = ['sending', 'sent'].includes(campaign.status);
    for (const field of protectedFields) {
        if (sendingOrSent && req.body[field] !== undefined) {
            return res.status(400).json({
                error: `Cannot edit '${field}' — campaign is ${campaign.status}`,
            });
        }
    }
    // BAK-MKT-001 FIX: Explicit field-by-field assignments instead of dynamic key loop.
    // Dynamic key loops allow any key that matches the allowlist to be written, including
    // keys not explicitly intended. Use explicit assignments so TypeScript and code reviewers
    // can audit exactly what fields are writable. Also remove duplicate Redis import (line 157
    // vs the top-level import at line 7 — the in-function redeclaration is removed).
    // BAK-MKT-001 FIX: Explicit field-by-field assignments instead of dynamic key loop.
    // The typed array approach (above) is better than no allowlist, but a loop still
    // creates mass assignment risk. Each field is explicitly assigned so TypeScript
    // and reviewers can audit exactly what is writable. No dynamic keys used.
    if (req.body.name !== undefined)
        campaign.name = req.body.name;
    if (req.body.message !== undefined)
        campaign.message = req.body.message;
    if (req.body.audience !== undefined)
        campaign.audience = req.body.audience;
    if (req.body.channel !== undefined)
        campaign.channel = req.body.channel;
    if (req.body.objective !== undefined)
        campaign.objective = req.body.objective;
    if (req.body.scheduledAt !== undefined)
        campaign.scheduledAt = req.body.scheduledAt;
    if (req.body.templateName !== undefined)
        campaign.templateName = req.body.templateName;
    if (req.body.imageUrl !== undefined)
        campaign.imageUrl = req.body.imageUrl;
    if (req.body.ctaUrl !== undefined)
        campaign.ctaUrl = req.body.ctaUrl;
    if (req.body.ctaText !== undefined)
        campaign.ctaText = req.body.ctaText;
    await campaign.save();
    res.json(campaign);
});
// POST /campaigns/:id/launch — dispatch now
// BE-MKT-002 FIX: Use longer TTL for distributed lock to prevent double-send
// BE-MKT-011 FIX: Check dispatch result and return proper error handling
router.post('/:id/launch', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const campaignId = req.params.id;
    const lockKey = `lock:campaign:launch:${campaignId}`;
    const redis = (0, redis_1.getRedis)();
    // BE-MKT-002: Acquire a distributed lock with longer TTL (5 min instead of 30s)
    // to prevent double-send for large campaigns (>100k users)
    const lockAcquired = await redis.set(lockKey, '1', 'EX', 300, 'NX');
    if (!lockAcquired) {
        return res.status(409).json({ error: 'Campaign launch already in progress' });
    }
    try {
        const campaign = await MarketingCampaign_1.MarketingCampaign.findById(campaignId);
        if (!campaign)
            return res.status(404).json({ error: 'Not found' });
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            return res.status(400).json({ error: `Cannot launch campaign in state: ${campaign.status}` });
        }
        // BE-MKT-011: Check dispatch result and return job ID or error
        let dispatchResult;
        try {
            dispatchResult = await CampaignOrchestrator_1.campaignOrchestrator.dispatch(campaignId);
            if (!dispatchResult || dispatchResult.error) {
                return res.status(500).json({
                    error: 'Campaign dispatch failed',
                    details: dispatchResult?.error || 'Unknown error',
                });
            }
        }
        catch (dispatchErr) {
            logger_1.logger.error('[Campaigns] Dispatch error', { campaignId, error: dispatchErr.message });
            return res.status(500).json({
                error: 'Failed to dispatch campaign',
                details: dispatchErr.message,
            });
        }
        // RTMN Commerce Memory: track campaign launch as merchant marketing intent
        (0, intentCaptureService_1.track)({ userId: String(campaign.merchantId), event: 'campaign_launched', intentKey: `marketing_campaign_${campaignId}`, properties: { campaignId, jobId: dispatchResult?.jobId } }).catch(() => { });
        // MKT-NOTIF-002: Send push notification when campaign is launched
        // This notifies all targeted users in the campaign audience
        (0, notificationService_1.sendCampaignNotification)({
            campaignId,
            campaignName: campaign.name,
            merchantId: String(campaign.merchantId),
            channel: campaign.channel,
            message: campaign.message,
            audienceType: campaign.audience?.segment || 'unknown',
            audienceCount: campaign.audience?.estimatedCount || 0,
            imageUrl: campaign.imageUrl,
            ctaUrl: campaign.ctaUrl,
            ctaText: campaign.ctaText,
        }).catch((err) => logger_1.logger.warn('[Campaigns] Launch notification trigger failed', { campaignId, error: err.message }));
        res.json({ queued: true, campaignId, jobId: dispatchResult?.jobId });
    }
    finally {
        await redis.del(lockKey).catch((err) => {
            logger_1.logger.warn('[Campaigns] Failed to release launch lock', { campaignId, error: err.message });
        });
    }
});
// POST /campaigns/:id/cancel
router.post('/:id/cancel', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(req.params.id);
    if (!campaign)
        return res.status(404).json({ error: 'Not found' });
    if (campaign.status === 'sending') {
        return res.status(400).json({ error: 'Cannot cancel a campaign that is already sending' });
    }
    campaign.status = 'cancelled';
    await campaign.save();
    // RTMN Commerce Memory: track campaign cancellation as merchant marketing intent
    (0, intentCaptureService_1.track)({ userId: String(campaign.merchantId), event: 'campaign_cancelled', intentKey: `marketing_campaign_${campaign._id}`, properties: { campaignId: String(campaign._id) } }).catch(() => { });
    res.json({ cancelled: true });
});
// DELETE /campaigns/:id — delete draft only
// BE-MKT-013 FIX: Prevent deletion of campaigns in 'sending' or 'sent' state
router.delete('/:id', async (req, res) => {
    if (!mongoose_1.default.isValidObjectId(req.params.id))
        return res.status(400).json({ error: 'Invalid id' });
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(req.params.id);
    if (!campaign)
        return res.status(404).json({ error: 'Not found' });
    // BE-MKT-013: Prevent deletion of sending/sent campaigns
    if (['sending', 'sent'].includes(campaign.status)) {
        return res.status(400).json({
            error: `Cannot delete campaign in '${campaign.status}' state. Archive instead.`,
        });
    }
    if (campaign.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft campaigns can be deleted' });
    }
    await campaign.deleteOne();
    res.json({ deleted: true });
});
exports.default = router;
//# sourceMappingURL=campaigns.js.map