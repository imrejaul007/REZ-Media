"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const CampaignAnalytics_1 = require("../analytics/CampaignAnalytics");
const MarketingCampaign_1 = require("../models/MarketingCampaign");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const intentCaptureService_1 = require("../services/intentCaptureService");
// Event Platform URL for forwarding events
const EVENT_PLATFORM_URL = process.env.EVENT_PLATFORM_URL || 'http://localhost:4008';
/**
 * Forward event to event-platform for unified analytics
 */
async function forwardToEventPlatform(eventType, payload) {
    try {
        await axios_1.default.post(`${EVENT_PLATFORM_URL}/events/publish`, {
            id: (0, uuid_1.v4)(),
            type: eventType,
            timestamp: new Date().toISOString(),
            source: 'rez-marketing-service',
            payload,
        }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch (error) {
        // Non-blocking - don't fail the request if event-platform is unavailable
        logger_1.logger.warn('[Marketing] Failed to forward event to event-platform', {
            eventType,
            error: error.message,
        });
    }
}
/**
 * Webhook routes for delivery receipt tracking.
 *
 * WhatsApp (Meta) sends delivery/read receipts to:
 *   POST /webhooks/whatsapp
 *
 * Webhook verification (GET) also handled here.
 * Set webhook URL in Meta Business Manager → WhatsApp → Configuration.
 */
const router = (0, express_1.Router)();
// BAK-MKT-009 FIX: Throw at startup if WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set.
// Previously defaulted to a randomly-generated token, meaning every service restart
// invalidated the webhook URL and Meta had to re-verify — causing a silent outage
// window during which incoming WhatsApp receipts were rejected.
// Use env var when available; fail closed if not configured.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
if (!VERIFY_TOKEN) {
    throw new Error('WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set. ' +
        'This token must be configured before starting the service and must remain stable across restarts. ' +
        'Set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your environment.');
}
// ── WhatsApp webhook verification (GET) ──────────────────────────────────────
router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    // REZ-029 fix: Use crypto.timingSafeEqual for constant-time comparison.
    // Guard: reject if VERIFY_TOKEN is the startup-generated random (never configured).
    // MKT-SEC-FIX: Do NOT pad the token to expected length — padEnd creates a buffer
    // of length === VERIFY_TOKEN.length filled with spaces. When the attacker sends a
    // token of exactly VERIFY_TOKEN.length spaces, both buffers match exactly and
    // timingSafeEqual passes even though the token is invalid.
    const tokenStr = typeof token === 'string' ? token : '';
    if (tokenStr.length === 0 || tokenStr.length !== VERIFY_TOKEN.length) {
        return res.status(403).json({ error: 'Verification failed' });
    }
    const tokenBuf = Buffer.from(tokenStr);
    const expectedBuf = Buffer.from(VERIFY_TOKEN);
    const isValid = crypto_1.default.timingSafeEqual(tokenBuf, expectedBuf);
    if (mode === 'subscribe' && isValid) {
        logger_1.logger.info('[Webhook] WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
});
// ── WhatsApp delivery receipt webhook (POST) ──────────────────────────────────
/**
 * Meta sends status updates:
 *   - sent      → message left Meta servers
 *   - delivered → received on recipient device
 *   - read      → recipient opened message
 *   - failed    → delivery failed
 *
 * IMPORTANT: This route must receive the RAW body (Buffer) for HMAC verification.
 * Mount express.raw() on this path in index.ts BEFORE express.json().
 * Meta signs with X-Hub-Signature-256: sha256=<hex>.
 */
router.post('/whatsapp', async (req, res) => {
    // Verify Meta HMAC signature before processing.
    // Fail CLOSED: if WHATSAPP_APP_SECRET is not configured, reject all requests
    // rather than letting unverified webhooks inflate delivery stats or trigger
    // unsubscribes for arbitrary phone numbers.
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
        logger_1.logger.warn('[Webhook:WA] WHATSAPP_APP_SECRET not configured — rejecting all webhook POSTs');
        return res.status(503).json({ error: 'Webhook not configured' });
    }
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.body; // Buffer when express.raw() is applied
    if (!signature || !rawBody) {
        logger_1.logger.warn('[Webhook:WA] Missing signature or raw body — rejected');
        return res.status(401).json({ error: 'Missing signature' });
    }
    const expected = 'sha256=' + crypto_1.default.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
        if (!crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
            logger_1.logger.warn('[Webhook:WA] Invalid HMAC signature — rejected');
            return res.status(401).json({ error: 'Invalid signature' });
        }
    }
    catch {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    // Always respond 200 immediately — Meta retries if we take too long
    res.status(200).json({ received: true });
    // MRS-C1 FIX: Extract processing to a separate async function called after
    // the response is sent. This ensures Meta gets a timely 200 while processing
    // continues in the background and failures are no longer silently swallowed.
    processWebhookEvent(req.body).catch((err) => {
        logger_1.logger.error('[Webhook:WA] Processing error', { err: err.message });
    });
});
async function processWebhookEvent(body) {
    const parsed = Buffer.isBuffer(body) ? JSON.parse(body.toString('utf8')) : body;
    if (parsed.object !== 'whatsapp_business_account')
        return;
    const entries = parsed.entry || [];
    for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
            const value = change.value || {};
            const statuses = value.statuses || [];
            for (const status of statuses) {
                const { id: messageId, status: deliveryStatus, recipient_id: phone } = status;
                if (!messageId || !deliveryStatus)
                    continue;
                logger_1.logger.debug('[Webhook:WA] Status update', { messageId, deliveryStatus, phone: `***${String(phone).slice(-4)}` });
                // Look up which campaign sent this message via Redis dedup keys
                const campaignId = await resolveCampaignFromMessageId(messageId, phone);
                if (!campaignId)
                    continue;
                // Deduplicate receipt processing — if this messageId was already processed,
                // increment deduped counter and skip further processing.
                const receiptKey = `wa:mkt:receipt:${messageId}`;
                try {
                    const redis = (0, redis_1.getRedis)();
                    const isNew = await redis.set(receiptKey, '1', 'EX', 7 * 86400, 'NX');
                    if (!isNew) {
                        await MarketingCampaign_1.MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.deduped': 1 } });
                        continue;
                    }
                }
                catch {
                    // Non-critical: proceed with processing if Redis is unavailable
                }
                switch (deliveryStatus) {
                    case 'sent':
                        await MarketingCampaign_1.MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.sent': 1 } });
                        break;
                    case 'delivered':
                        await MarketingCampaign_1.MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.delivered': 1 } });
                        break;
                    case 'read':
                        await CampaignAnalytics_1.campaignAnalytics.trackOpen(campaignId);
                        break;
                    case 'failed':
                        await MarketingCampaign_1.MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.failed': 1 } });
                        break;
                }
            }
            // Handle inbound messages (user replies — "STOP" = unsubscribe)
            const messages = value.messages || [];
            for (const msg of messages) {
                if (msg.type === 'text' && msg.text?.body?.trim().toUpperCase() === 'STOP') {
                    const maskedPhone = `***${String(msg.from).slice(-4)}`;
                    logger_1.logger.info('[Webhook:WA] User requested unsubscribe', { from: maskedPhone });
                    // Update whatsappOptIn directly on the shared collection.
                    // MerchantCustomerSnapshot lives in the monolith DB (same cluster).
                    const db = mongoose_1.default.connection.useDb('rez', { useCache: true });
                    await db.collection('merchantcustomersnapshots').updateMany({ phone: msg.from }, { $set: { whatsappOptIn: false, whatsappOptOutAt: new Date() } });
                    logger_1.logger.info('[Webhook:WA] whatsappOptIn cleared', { from: maskedPhone });
                }
            }
        }
    }
}
/**
 * Reverse-map a WhatsApp messageId → campaignId.
 *
 * We store messageId → campaignId in Redis when sending (key: wa:mkt:msgid:{messageId}).
 * TTL: 7 days (Meta delivers receipts within minutes but we allow buffer).
 */
async function resolveCampaignFromMessageId(messageId, phone) {
    try {
        const redis = (0, redis_1.getRedis)();
        const campaignId = await redis.get(`wa:mkt:msgid:${messageId}`);
        return campaignId;
    }
    catch {
        return null;
    }
}
// ── Track open via pixel (GET) ────────────────────────────────────────────────
// Tracking pixel embedded in email templates: GET /webhooks/track/open?cid=...
router.get('/track/open', async (req, res) => {
    const { cid } = req.query;
    if (cid) {
        CampaignAnalytics_1.campaignAnalytics.trackOpen(cid).catch((err) => logger_1.logger.warn('[Webhook:Track] Open tracking failed', { cid, err: err.message }));
    }
    // Return 1x1 transparent GIF
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    res.send(gif);
});
// ── Conversion events from other services ──────────────────────────────────
const conversionSchema = zod_1.z.object({
    eventType: zod_1.z.string(),
    userId: zod_1.z.string(),
    orderId: zod_1.z.string(),
    orderNumber: zod_1.z.string().optional(),
    total: zod_1.z.number(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        quantity: zod_1.z.number(),
        price: zod_1.z.number(),
    })).optional(),
    merchantId: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().optional(),
});
const abandonmentSchema = zod_1.z.object({
    eventType: zod_1.z.string(),
    userId: zod_1.z.string(),
    cartId: zod_1.z.string(),
    items: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        price: zod_1.z.number(),
    })),
    timestamp: zod_1.z.string().optional(),
});
/**
 * POST /api/events/conversion
 * Receives order completion events from order service
 */
router.post('/events/conversion', async (req, res) => {
    try {
        const parsed = conversionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }
        const { userId, orderId, orderNumber, total, items, merchantId } = parsed.data;
        logger_1.logger.info('[Marketing] Conversion event received', { userId, orderId, total });
        // Track intent for personalization
        (0, intentCaptureService_1.track)({
            userId,
            event: 'conversion',
            intentKey: `order_${orderId}`,
            properties: {
                orderId,
                orderNumber,
                total,
                itemCount: items?.length || 0,
                merchantId,
            },
        }).catch(() => { });
        // Forward to event-platform for unified analytics
        forwardToEventPlatform('conversion', {
            conversionId: orderId,
            campaignId: req.headers['x-campaign-id'] || 'direct',
            merchantId: merchantId || 'unknown',
            userId,
            orderId,
            value: total,
            currency: 'INR',
            source: 'marketing',
            channel: req.headers['x-channel'] || 'direct',
        });
        // TODO: Trigger welcome campaign sequence
        // TODO: Enroll in loyalty program
        // TODO: Trigger upsell recommendations
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Marketing] Conversion event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
/**
 * POST /api/events/abandonment
 * Receives cart abandonment events
 */
router.post('/events/abandonment', async (req, res) => {
    try {
        const parsed = abandonmentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, error: 'Invalid payload' });
        }
        const { userId, cartId, items } = parsed.data;
        logger_1.logger.info('[Marketing] Abandonment event received', { userId, cartId });
        // Track for retargeting
        (0, intentCaptureService_1.track)({
            userId,
            event: 'cart_abandoned',
            intentKey: `cart_${cartId}`,
            properties: {
                cartId,
                itemCount: items.length,
                totalValue: items.reduce((sum, i) => sum + i.price, 0),
            },
        }).catch(() => { });
        // TODO: Trigger abandonment email sequence
        res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Marketing] Abandonment event error', { error: err.message });
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map