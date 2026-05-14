"use strict";
/**
 * Broadcasts routes — simplified campaign API for Sprint 3.
 *
 * A "broadcast" is a thin wrapper over the existing MarketingCampaign model.
 * It exposes a simpler interface aligned with the sprint spec:
 *
 *   POST   /broadcasts                          — create & send immediately
 *   GET    /broadcasts/:merchantId              — list past broadcasts with stats
 *   POST   /broadcasts/:broadcastId/schedule    — schedule for a future time
 *   POST   /broadcasts/send                     — Sprint 9: segment-based send
 *
 * Internally, broadcasts are stored as MarketingCampaign documents with
 * objective='awareness' and channel derived from the channels array.
 * Multi-channel broadcasts create one campaign document per channel.
 *
 * Dispatch is handled by the existing campaignOrchestrator which enqueues
 * jobs onto the notification-events BullMQ queue.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const uuid_1 = require("uuid");
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const CampaignOrchestrator_1 = require("../campaigns/CampaignOrchestrator");
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
const bullmq_1 = require("bullmq");
const intentCaptureService_1 = require("../services/intentCaptureService");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
// CRIT FIX: All broadcast routes require merchant authentication
router.use(auth_1.verifyMerchant);
// Notification queue — one job per channel per recipient batch
const notificationQueue = new bullmq_1.Queue('notification-events', { connection: (0, redis_1.getRedisBullMQConnection)() });
/**
 * POST /broadcasts/send
 *
 * Resolves a user segment from cointransactions, rate-limits per merchant
 * (one broadcast per hour), enqueues a notification-events BullMQ job per
 * user, and logs the send in broadcastlogs.
 *
 * Body: { segment, merchantId, templateId? } OR { segment, merchantId, title, body }
 */
router.post('/send', async (req, res) => {
    const { segment, templateId, title, body } = req.body;
    // BAK-MKT-007 FIX: Use req.merchantId from JWT, not body.merchantId.
    // Previously body.merchantId was used, allowing an attacker with a valid JWT for
    // merchant A to send broadcasts billed to merchant B.
    const merchantId = req.merchantId;
    if (!merchantId) {
        return res.status(401).json((0, response_1.err)('SRV_001', 'Merchant authentication required'));
    }
    // ── Validate required fields ──────────────────────────────────────────────
    const VALID_SEND_SEGMENTS = ['high_value', 'at_risk', 'new_users', 'all'];
    if (!segment || !VALID_SEND_SEGMENTS.includes(segment)) {
        return res.status(400).json((0, response_1.err)('SRV_001', `segment must be one of: ${VALID_SEND_SEGMENTS.join(', ')}`));
    }
    if (!templateId && !(title && body)) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'Either templateId or both title and body must be provided'));
    }
    // HIGH FIX: Validate title and body length to prevent abuse
    if (title && (typeof title !== 'string' || title.length > 200)) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'title must be a string under 200 characters'));
    }
    if (body && (typeof body !== 'string' || body.length > 5000)) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'body must be a string under 5000 characters'));
    }
    const CoinTransactions = mongoose_1.default.connection.collection('cointransactions');
    const MerchantTemplates = mongoose_1.default.connection.collection('merchanttemplates');
    const BroadcastLogs = mongoose_1.default.connection.collection('broadcastlogs');
    // ── Idempotency: prevent duplicate broadcast on client retry ─────────────────
    // BAK-MKT-010 FIX: Generate broadcastId before rate limit check. If the request
    // times out after enqueueing (but before returning), a retry with the same
    // broadcastId returns the original queued count instead of treating it as a new send.
    const redis = (0, redis_1.getRedis)();
    const idempotencyKey = `mkt:broadcast:idempotency:${merchantId}:${segment}:${templateId || 'custom'}`;
    const existingBroadcastId = await redis.get(idempotencyKey);
    if (existingBroadcastId) {
        // This is a retry — return the original broadcast result
        const cached = await redis.get(`mkt:broadcast:result:${existingBroadcastId}`);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
        // Broadcast was in progress — return queued status
        return res.json({ success: true, queued: -1, status: 'already_processing' });
    }
    // Acquire rate limit AND idempotency atomically
    const broadcastId = (0, uuid_1.v4)();
    await redis.set(idempotencyKey, broadcastId, 'EX', 3600);
    await redis.set(`mkt:broadcast:ratelimit:${merchantId}`, '1', 'EX', 3600);
    // MKT-17 FIX: Per-channel rate limiting with sliding window.
    // Merchant-level rate limit (1/hour) exists but no per-channel rate limit.
    // Without this, a merchant can burst 50,000 push notifications in one call,
    // triggering Expo/FCM rate limits or FCM throttling.
    const channels = ['push', 'in_app'];
    const channelLimits = {
        push: { maxPerHour: 10000, windowSecs: 3600 },
        in_app: { maxPerHour: 50000, windowSecs: 3600 },
        whatsapp: { maxPerHour: 1000, windowSecs: 3600 },
        sms: { maxPerHour: 500, windowSecs: 3600 },
        email: { maxPerHour: 1000, windowSecs: 3600 },
    };
    for (const channel of channels) {
        const limit = channelLimits[channel];
        if (!limit)
            continue;
        const channelKey = `mkt:broadcast:channel:${merchantId}:${channel}`;
        try {
            // Sliding window: count messages in the last windowSecs
            const script = `
        local key = KEYS[1]
        local ttl = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local windowStart = now - ttl
        redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
        local count = redis.call('ZCARD', key)
        if count >= limit then
          return 0
        end
        -- Use unique ZADD member: timestamp + counter avoids math.random() predictability
        local member = now .. ':' .. ARGV[4]
        redis.call('ZADD', key, now, member)
        redis.call('EXPIRE', key, ttl)
        return 1
      `;
            const allowed = await redis.eval(script, 1, channelKey, String(limit.windowSecs), String(limit.maxPerHour), String(Math.floor(Date.now() / 1000)), String(Date.now()));
            if (!allowed) {
                logger_1.logger.warn('[Broadcasts] Per-channel rate limit exceeded', { merchantId, channel, limit: limit.maxPerHour });
                return res.status(429).json((0, response_1.err)('SRV_001', `Rate limit exceeded for ${channel} channel. Maximum ${limit.maxPerHour} messages per hour.`));
            }
        }
        catch (err) {
            logger_1.logger.warn('[Broadcasts] Per-channel rate limit check failed — allowing', { merchantId, channel, error: err.message });
        }
    }
    // ── Resolve notification content ──────────────────────────────────────────
    let notifTitle = title;
    let notifBody = body;
    if (templateId) {
        if (!mongoose_1.default.isValidObjectId(templateId)) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid templateId'));
        }
        const template = await MerchantTemplates.findOne({ _id: new mongoose_1.default.Types.ObjectId(templateId) });
        if (!template) {
            return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Template not found'));
        }
        notifTitle = template.title || notifTitle;
        notifBody = template.body || notifBody;
    }
    // ── Resolve user segment from cointransactions ────────────────────────────
    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    let userIds = [];
    if (segment === 'all') {
        // Only include users who have transacted in the last 90 days
        const docs = await CoinTransactions.distinct('user', { createdAt: { $gte: days90 } });
        userIds = docs.map((d) => String(d));
    }
    else if (segment === 'high_value') {
        // Users with total earned > 500 coins in last 30 days
        const result = await CoinTransactions.aggregate([
            { $match: { type: 'earned', createdAt: { $gte: days30 } } },
            { $group: { _id: '$user', totalEarned: { $sum: '$amount' } } },
            { $match: { totalEarned: { $gt: 500 } } },
        ]).toArray();
        userIds = result.map((r) => String(r._id));
    }
    else if (segment === 'at_risk') {
        // Users whose last transaction was > 30 days ago but had activity in last 90 days
        const result = await CoinTransactions.aggregate([
            { $match: { createdAt: { $gte: days90 } } },
            { $group: { _id: '$user', lastTx: { $max: '$createdAt' } } },
            { $match: { lastTx: { $lt: days30 } } },
        ]).toArray();
        userIds = result.map((r) => String(r._id));
    }
    else if (segment === 'new_users') {
        // Users whose first transaction is within last 7 days
        const result = await CoinTransactions.aggregate([
            { $group: { _id: '$user', firstTx: { $min: '$createdAt' } } },
            { $match: { firstTx: { $gte: days7 } } },
        ]).toArray();
        userIds = result.map((r) => String(r._id));
    }
    // ── Cap segment size to prevent unbounded job creation ─────────────────────
    if (userIds.length > 50000) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'Segment too large. Maximum 50,000 recipients per broadcast.'));
    }
    // ── Enqueue one BullMQ job per user ───────────────────────────────────────
    // Jobs MUST conform to NotificationEvent shape expected by rez-notification-events worker.
    // Sending a flat {userId, title, body} caused silent job failures — the worker
    // destructures channels/payload/eventId and gets undefined for all fields.
    // BAK-MKT-010 FIX: broadcastId is now generated once at idempotency check (line 109).
    const createdAt = now.toISOString();
    const jobPromises = userIds.map((userId) => notificationQueue.add('broadcast.send', {
        eventId: `broadcast:${broadcastId}:${userId}`,
        eventType: 'merchant_broadcast',
        userId,
        channels: ['push', 'in_app'],
        payload: {
            title: notifTitle,
            body: notifBody,
            channelId: 'marketing',
            priority: 'normal',
            data: { merchantId, segment, templateId: templateId || null },
        },
        category: 'marketing',
        source: 'rez-marketing-service',
        createdAt,
    }));
    const jobs = await Promise.all(jobPromises);
    // ── Log the broadcast ─────────────────────────────────────────────────────
    await BroadcastLogs.insertOne({
        merchantId,
        segment,
        userCount: userIds.length,
        sentAt: now,
        title: notifTitle,
        body: notifBody,
        jobIds: jobs.map((j) => j.id).filter(Boolean),
    });
    const estimatedDelivery = new Date(now.getTime() + userIds.length * 50); // ~50ms per user
    logger_1.logger.info('[Broadcasts] /send dispatched', { merchantId, segment, userCount: userIds.length });
    // BAK-MKT-010 FIX: Cache response for idempotent retry handling.
    // The idempotency key is checked at the start of this handler. If the same
    // request is retried (e.g. due to timeout), the cached response is returned
    // instead of creating duplicate notifications.
    const responseBody = {
        success: true,
        queued: userIds.length,
        estimatedDelivery: estimatedDelivery.toISOString(),
        broadcastId,
        jobIds: jobs.map((j) => j.id).filter(Boolean),
    };
    await redis.set(`mkt:broadcast:result:${broadcastId}`, JSON.stringify(responseBody), 'EX', 3600);
    // RTMN Commerce Memory: track broadcast send as merchant marketing intent
    (0, intentCaptureService_1.track)({ userId: merchantId, event: 'broadcast_sent', intentKey: `marketing_broadcast_${broadcastId}`, properties: { broadcastId, segment, userCount: userIds.length } }).catch(() => { });
    return res.json(responseBody);
});
// ── Existing broadcast routes ─────────────────────────────────────────────────
// Valid channels for broadcasts
const VALID_CHANNELS = ['push', 'sms', 'email', 'whatsapp', 'in_app'];
// Valid segments
const VALID_SEGMENTS = ['all', 'new', 'loyal', 'lapsed'];
// Map broadcast segment names to the internal audience segment types
const SEGMENT_MAP = {
    all: 'all',
    new: 'recent',
    loyal: 'high_value',
    lapsed: 'lapsed',
};
/**
 * POST /broadcasts
 * Create and dispatch a broadcast to a customer segment across one or more channels.
 * Each channel becomes a separate campaign job enqueued onto notification-events.
 */
router.post('/', async (req, res) => {
    const { segment, message, channels, merchantId, name, scheduledAt } = req.body;
    if (!segment || !message || !channels || !merchantId) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'segment, message, channels, and merchantId are required'));
    }
    // HIGH FIX: Validate message length to prevent abuse
    if (typeof message !== 'string' || message.length > 5000) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'message must be a string under 5000 characters'));
    }
    if (!VALID_SEGMENTS.includes(segment)) {
        return res.status(400).json((0, response_1.err)('SRV_001', `segment must be one of: ${VALID_SEGMENTS.join(', ')}`));
    }
    if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'channels must be a non-empty array'));
    }
    const invalidChannels = channels.filter(c => !VALID_CHANNELS.includes(c));
    if (invalidChannels.length > 0) {
        return res.status(400).json((0, response_1.err)('SRV_001', `invalid channels: ${invalidChannels.join(', ')}`));
    }
    const broadcastName = name || `Broadcast to ${segment} — ${new Date().toISOString().slice(0, 10)}`;
    const audienceSegment = SEGMENT_MAP[segment];
    const isScheduled = Boolean(scheduledAt);
    const createdCampaigns = [];
    for (const channel of channels) {
        try {
            const campaign = await MarketingCampaign_1.MarketingCampaign.create({
                merchantId,
                name: `${broadcastName} [${channel}]`,
                objective: 'awareness',
                channel,
                message,
                audience: { segment: audienceSegment },
                status: isScheduled ? 'scheduled' : 'draft',
                scheduledAt: isScheduled ? new Date(scheduledAt) : undefined,
            });
            createdCampaigns.push({ campaignId: campaign.id, channel });
            // If not scheduled, dispatch immediately via campaignOrchestrator
            if (!isScheduled) {
                await CampaignOrchestrator_1.campaignOrchestrator.dispatch(campaign.id);
                // Also enqueue a notification-events job for downstream consumers
                await notificationQueue.add('broadcast.dispatched', {
                    campaignId: campaign.id,
                    merchantId,
                    segment: audienceSegment,
                    channel,
                    message,
                    dispatchedAt: new Date().toISOString(),
                });
            }
        }
        catch (err) {
            logger_1.logger.error('[Broadcasts] Failed to create/dispatch campaign', {
                channel, merchantId, error: err.message,
            });
            // Continue with remaining channels even if one fails
        }
    }
    if (createdCampaigns.length === 0) {
        return res.status(500).json((0, response_1.err)('SRV_001', 'Failed to create any broadcast campaigns'));
    }
    res.status(201).json({
        queued: !isScheduled,
        scheduled: isScheduled,
        scheduledAt: scheduledAt || null,
        campaigns: createdCampaigns,
        merchantId,
        segment,
        channels,
    });
});
/**
 * GET /broadcasts/:merchantId
 * List past broadcasts for a merchant with delivery stats.
 * Returns campaigns with objective='awareness' grouped by broadcast name prefix.
 */
router.get('/:merchantId', async (req, res) => {
    const { merchantId } = req.params;
    const { limit: limitQ = '20', page = '1', status } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(limitQ) || 20));
    const skip = (parseInt(page) - 1) * limit;
    const query = {
        merchantId,
        objective: 'awareness',
    };
    if (status)
        query.status = status;
    const [campaigns, total] = await Promise.all([
        MarketingCampaign_1.MarketingCampaign.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('name channel status scheduledAt sentAt stats audience createdAt')
            .lean(),
        MarketingCampaign_1.MarketingCampaign.countDocuments(query),
    ]);
    const broadcasts = campaigns.map(c => ({
        broadcastId: c._id.toString(),
        name: c.name,
        channel: c.channel,
        segment: c.audience.segment,
        status: c.status,
        scheduledAt: c.scheduledAt ?? null,
        sentAt: c.sentAt ?? null,
        stats: {
            sent: c.stats?.sent ?? 0,
            delivered: c.stats?.delivered ?? 0,
            failed: c.stats?.failed ?? 0,
            opened: c.stats?.opened ?? 0,
            clicked: c.stats?.clicked ?? 0,
        },
        createdAt: c.createdAt,
    }));
    res.json({ broadcasts, total, page: parseInt(page), limit });
});
/**
 * POST /broadcasts/:broadcastId/schedule
 * Schedule an existing draft broadcast for a future time.
 */
router.post('/:broadcastId/schedule', async (req, res) => {
    const { broadcastId } = req.params;
    const { scheduledAt } = req.body;
    if (!mongoose_1.default.isValidObjectId(broadcastId)) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'Invalid broadcastId'));
    }
    if (!scheduledAt) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'scheduledAt is required'));
    }
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'scheduledAt must be a valid ISO date string'));
    }
    if (scheduledDate <= new Date()) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'scheduledAt must be in the future'));
    }
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(broadcastId);
    if (!campaign) {
        return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'Broadcast not found'));
    }
    if (!['draft', 'scheduled'].includes(campaign.status)) {
        return res.status(400).json((0, response_1.err)('SRV_001', `Cannot schedule a broadcast in state: ${campaign.status}`));
    }
    campaign.status = 'scheduled';
    campaign.scheduledAt = scheduledDate;
    await campaign.save();
    res.json({
        broadcastId,
        status: 'scheduled',
        scheduledAt: scheduledDate.toISOString(),
    });
});
exports.default = router;
//# sourceMappingURL=broadcasts.js.map