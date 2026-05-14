"use strict";
/**
 * AdBazaar integration routes.
 *
 * Protected by x-internal-key header matching ADBAZAAR_INTERNAL_KEY env var.
 * Called by AdBazaar when a brand books a WhatsApp/push/SMS listing in order to
 * trigger a broadcast to REZ users on behalf of a merchant.
 *
 *   POST  /adbazaar/broadcast          — trigger or schedule a broadcast
 *   GET   /adbazaar/status/:broadcastId — check status of an AdBazaar broadcast
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const CampaignOrchestrator_1 = require("../campaigns/CampaignOrchestrator");
const logger_1 = require("../config/logger");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
// ── Auth middleware ───────────────────────────────────────────────────────────
router.use((req, res, next) => {
    const key = req.headers['x-internal-key'];
    const expected = process.env.ADBAZAAR_INTERNAL_KEY;
    if (!expected || !key) {
        return res.status(401).json((0, response_1.err)('SRV_001', 'Unauthorized'));
    }
    try {
        const keyBuf = Buffer.from(Array.isArray(key) ? key[0] : key);
        const expBuf = Buffer.from(expected);
        if (keyBuf.length !== expBuf.length || !crypto_1.default.timingSafeEqual(keyBuf, expBuf)) {
            return res.status(401).json((0, response_1.err)('SRV_001', 'Unauthorized'));
        }
    }
    catch {
        return res.status(401).json((0, response_1.err)('SRV_001', 'Unauthorized'));
    }
    return next();
});
const VALID_CHANNELS = ['whatsapp', 'push', 'sms'];
const VALID_SEGMENTS = ['all', 'high_value', 'at_risk', 'new_users'];
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Resolve the user IDs for a given segment by querying cointransactions.
 */
async function resolveSegmentUserIds(segment) {
    const CoinTransactions = mongoose_1.default.connection.collection('cointransactions');
    const now = new Date();
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    if (segment === 'all') {
        const docs = await CoinTransactions.distinct('user', { createdAt: { $gte: days90 } });
        return docs.map((d) => String(d));
    }
    if (segment === 'high_value') {
        const result = await CoinTransactions.aggregate([
            { $match: { type: 'earned', createdAt: { $gte: days30 } } },
            { $group: { _id: '$user', totalEarned: { $sum: '$amount' } } },
            { $match: { totalEarned: { $gt: 500 } } },
        ]).toArray();
        return result.map((r) => String(r._id));
    }
    if (segment === 'at_risk') {
        const result = await CoinTransactions.aggregate([
            { $match: { createdAt: { $gte: days90 } } },
            { $group: { _id: '$user', lastTx: { $max: '$createdAt' } } },
            { $match: { lastTx: { $lt: days30 } } },
        ]).toArray();
        return result.map((r) => String(r._id));
    }
    // new_users
    const result = await CoinTransactions.aggregate([
        { $group: { _id: '$user', firstTx: { $min: '$createdAt' } } },
        { $match: { firstTx: { $gte: days7 } } },
    ]).toArray();
    return result.map((r) => String(r._id));
}
// ── POST /adbazaar/broadcast ──────────────────────────────────────────────────
/**
 * POST /adbazaar/broadcast
 *
 * Called by AdBazaar when a brand books a broadcast listing. Validates the
 * payload, enforces a 3-per-merchant-per-24h rate limit (checked against
 * broadcastlogs with source='adbazaar'), then either schedules the campaign
 * or dispatches it immediately via the notification-events BullMQ queue.
 */
router.post('/broadcast', async (req, res) => {
    const { adBazaarBookingId, rezMerchantId, channel, segment, title, body, qrCodeUrl, coinsPerScan, scheduledAt, } = req.body;
    // ── Validate required fields ──────────────────────────────────────────────
    if (!adBazaarBookingId) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'adBazaarBookingId is required'));
    }
    if (!rezMerchantId) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'rezMerchantId is required'));
    }
    if (!channel || !VALID_CHANNELS.includes(channel)) {
        return res.status(400).json((0, response_1.err)('SRV_001', `channel must be one of: ${VALID_CHANNELS.join(', ')}`));
    }
    if (!segment || !VALID_SEGMENTS.includes(segment)) {
        return res.status(400).json((0, response_1.err)('SRV_001', `segment must be one of: ${VALID_SEGMENTS.join(', ')}`));
    }
    if (!title) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'title is required'));
    }
    if (!body) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'body is required'));
    }
    const BroadcastLogs = mongoose_1.default.connection.collection('broadcastlogs');
    // ── Rate limit: max 3 AdBazaar-triggered broadcasts per merchant per 24h ──
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await BroadcastLogs.countDocuments({
        merchantId: rezMerchantId,
        source: 'adbazaar',
        sentAt: { $gte: twentyFourHoursAgo },
    });
    if (recentCount >= 3) {
        return res.status(429).json((0, response_1.err)('SRV_001', 'AdBazaar broadcast rate limit: max 3 broadcasts per merchant per 24 hours'));
    }
    // ── Build notification body (append QR incentive if provided) ────────────
    let finalBody = body;
    if (qrCodeUrl) {
        const coinsText = coinsPerScan ? `Scan QR to earn ${coinsPerScan} coins` : 'Scan QR';
        finalBody = `${body}\n${coinsText} → ${qrCodeUrl}`;
    }
    const now = new Date();
    const isScheduled = Boolean(scheduledAt);
    let scheduledDate;
    if (isScheduled) {
        scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json((0, response_1.err)('SRV_001', 'scheduledAt must be a valid ISO date string'));
        }
        if (scheduledDate <= now) {
            // Treat past/present scheduledAt as immediate
            scheduledDate = undefined;
        }
    }
    const isFutureScheduled = Boolean(scheduledDate);
    // ── Create the MarketingCampaign document ─────────────────────────────────
    const campaign = await MarketingCampaign_1.MarketingCampaign.create({
        merchantId: rezMerchantId,
        name: `AdBazaar [${adBazaarBookingId}] — ${title.slice(0, 60)}`,
        objective: 'awareness',
        channel,
        message: finalBody,
        audience: { segment },
        status: isFutureScheduled ? 'scheduled' : 'draft',
        scheduledAt: isFutureScheduled ? scheduledDate : undefined,
    });
    const broadcastId = campaign.id;
    if (!isFutureScheduled) {
        // ── Immediate dispatch ──────────────────────────────────────────────────
        // MRS-H3: campaignOrchestrator.dispatch() handles all notification dispatch.
        // Do NOT also enqueue to notification-events queue — that causes duplicate delivery.
        await CampaignOrchestrator_1.campaignOrchestrator.dispatch(broadcastId);
        // ── Log to broadcastlogs ────────────────────────────────────────────────
        const userIds = await resolveSegmentUserIds(segment);
        await BroadcastLogs.insertOne({
            broadcastId,
            merchantId: rezMerchantId,
            segment,
            channel,
            title,
            body: finalBody,
            source: 'adbazaar',
            adBazaarBookingId,
            userCount: userIds.length,
            sentAt: now,
            status: 'sent',
        });
        logger_1.logger.info('[AdBazaar] Broadcast dispatched', {
            broadcastId,
            adBazaarBookingId,
            rezMerchantId,
            segment,
            channel,
            userCount: userIds.length,
        });
        return res.status(201).json({
            success: true,
            broadcastId,
            estimatedReach: userIds.length,
        });
    }
    // ── Scheduled dispatch ────────────────────────────────────────────────────
    // Estimate reach without resolving full segment at schedule time
    const estimatedReach = await (async () => {
        const userIds = await resolveSegmentUserIds(segment);
        return userIds.length;
    })();
    // Log to broadcastlogs with scheduled status
    await BroadcastLogs.insertOne({
        broadcastId,
        merchantId: rezMerchantId,
        segment,
        channel,
        title,
        body: finalBody,
        source: 'adbazaar',
        adBazaarBookingId,
        userCount: 0, // will be updated when actually dispatched
        sentAt: null,
        scheduledAt: scheduledDate,
        status: 'scheduled',
    });
    logger_1.logger.info('[AdBazaar] Broadcast scheduled', {
        broadcastId,
        adBazaarBookingId,
        rezMerchantId,
        segment,
        channel,
        scheduledAt: scheduledDate.toISOString(),
    });
    return res.status(201).json({
        success: true,
        broadcastId,
        estimatedReach,
        scheduledAt: scheduledDate.toISOString(),
    });
});
// ── GET /adbazaar/status/:broadcastId ─────────────────────────────────────────
/**
 * GET /adbazaar/status/:broadcastId
 *
 * Returns the delivery status of an AdBazaar-triggered broadcast by looking
 * up broadcastlogs filtered by broadcastId and source='adbazaar'.
 */
router.get('/status/:broadcastId', async (req, res) => {
    const { broadcastId } = req.params;
    if (!broadcastId) {
        return res.status(400).json((0, response_1.err)('SRV_001', 'broadcastId is required'));
    }
    const BroadcastLogs = mongoose_1.default.connection.collection('broadcastlogs');
    const log = await BroadcastLogs.findOne({
        broadcastId,
        source: 'adbazaar',
    });
    if (!log) {
        return res.status(404).json((0, response_1.err)('RES_NOT_FOUND', 'AdBazaar broadcast not found'));
    }
    // Pull delivery counters from the campaign stats if available
    const campaign = await MarketingCampaign_1.MarketingCampaign.findById(broadcastId)
        .select('stats status sentAt')
        .lean();
    const stats = campaign?.stats ?? { sent: 0, delivered: 0, failed: 0 };
    return res.json({
        broadcastId,
        status: log.status,
        sentCount: stats.sent ?? 0,
        deliveredCount: stats.delivered ?? 0,
        failedCount: stats.failed ?? 0,
        sentAt: log.sentAt ?? null,
    });
});
exports.default = router;
//# sourceMappingURL=adbazaar.js.map