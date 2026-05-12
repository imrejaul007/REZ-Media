import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { campaignAnalytics } from '../analytics/CampaignAnalytics';
import { MarketingCampaign } from '../models/MarketingCampaign';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { track } from '../services/intentCaptureService';

// Event Platform URL for forwarding events
const EVENT_PLATFORM_URL = process.env.EVENT_PLATFORM_URL || 'http://localhost:4008';

// Service URLs
const COMMUNICATIONS_URL = process.env.COMMUNICATIONS_SERVICE_URL || 'http://localhost:4005';
const GAMIFICATION_URL = process.env.GAMIFICATION_SERVICE_URL || 'http://localhost:4006';
const AGENTS_URL = process.env.AGENTS_SERVICE_URL || 'http://localhost:4007';

// Request timeout for internal service calls (5 seconds)
const INTERNAL_SERVICE_TIMEOUT = 5000;

/**
 * Parse internal service tokens from environment.
 * Format: INTERNAL_SERVICE_TOKENS_JSON={"service-name":"token"}
 */
function getInternalServiceToken(): string | undefined {
  const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
  if (!tokensJson) return undefined;
  try {
    const tokens = JSON.parse(tokensJson);
    return tokens['rez-marketing-service'];
  } catch {
    return undefined;
  }
}

/**
 * Make an authenticated internal service call with timing-safe token comparison.
 */
async function callInternalService<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  body?: unknown,
): Promise<{ success: boolean; data?: T; error?: string }> {
  const serviceToken = getInternalServiceToken();
  if (!serviceToken) {
    logger.warn('[Marketing] INTERNAL_SERVICE_TOKENS_JSON not configured — cannot call internal services');
    return { success: false, error: 'Service token not configured' };
  }

  try {
    const response = await axios({
      url,
      method,
      data: body,
      timeout: INTERNAL_SERVICE_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': serviceToken,
      },
      validateStatus: () => true, // Don't throw on non-2xx
    });

    if (response.status >= 200 && response.status < 300) {
      return { success: true, data: response.data as T };
    }

    return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
  } catch (err: any) {
    const errorMessage = err.code === 'ECONNABORTED' ? 'Request timeout' : err.message;
    return { success: false, error: errorMessage };
  }
}

/**
 * Forward event to event-platform for unified analytics
 */
async function forwardToEventPlatform(eventType: string, payload: any): Promise<void> {
  try {
    await axios.post(`${EVENT_PLATFORM_URL}/events/publish`, {
      id: uuidv4(),
      type: eventType,
      timestamp: new Date().toISOString(),
      source: 'rez-marketing-service',
      payload,
    }, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    // Non-blocking - don't fail the request if event-platform is unavailable
    logger.warn('[Marketing] Failed to forward event to event-platform', {
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

const router = Router();

// BAK-MKT-009 FIX: Throw at startup if WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set.
// Previously defaulted to a randomly-generated token, meaning every service restart
// invalidated the webhook URL and Meta had to re-verify — causing a silent outage
// window during which incoming WhatsApp receipts were rejected.
// Use env var when available; fail closed if not configured.
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
if (!VERIFY_TOKEN) {
  throw new Error(
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN is not set. ' +
    'This token must be configured before starting the service and must remain stable across restarts. ' +
    'Set WHATSAPP_WEBHOOK_VERIFY_TOKEN in your environment.',
  );
}

// ── WhatsApp webhook verification (GET) ──────────────────────────────────────
router.get('/whatsapp', (req: Request, res: Response) => {
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
  const isValid = crypto.timingSafeEqual(tokenBuf, expectedBuf);

  if (mode === 'subscribe' && isValid) {
    logger.info('[Webhook] WhatsApp webhook verified');
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
router.post('/whatsapp', async (req: Request, res: Response) => {
  // Verify Meta HMAC signature before processing.
  // Fail CLOSED: if WHATSAPP_APP_SECRET is not configured, reject all requests
  // rather than letting unverified webhooks inflate delivery stats or trigger
  // unsubscribes for arbitrary phone numbers.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    logger.warn('[Webhook:WA] WHATSAPP_APP_SECRET not configured — rejecting all webhook POSTs');
    return res.status(503).json({ error: 'Webhook not configured' });
  }
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody: Buffer = req.body; // Buffer when express.raw() is applied
  if (!signature || !rawBody) {
    logger.warn('[Webhook:WA] Missing signature or raw body — rejected');
    return res.status(401).json({ error: 'Missing signature' });
  }
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      logger.warn('[Webhook:WA] Invalid HMAC signature — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Always respond 200 immediately — Meta retries if we take too long
  res.status(200).json({ received: true });

  // MRS-C1 FIX: Extract processing to a separate async function called after
  // the response is sent. This ensures Meta gets a timely 200 while processing
  // continues in the background and failures are no longer silently swallowed.
  processWebhookEvent(req.body).catch((err: any) => {
    logger.error('[Webhook:WA] Processing error', { err: err.message });
  });
});

async function processWebhookEvent(body: unknown): Promise<void> {
  const parsed = Buffer.isBuffer(body) ? JSON.parse(body.toString('utf8')) : body;
  if ((parsed as any).object !== 'whatsapp_business_account') return;

  const entries = (parsed as any).entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const statuses = value.statuses || [];

      for (const status of statuses) {
        const { id: messageId, status: deliveryStatus, recipient_id: phone } = status;
        if (!messageId || !deliveryStatus) continue;

        logger.debug('[Webhook:WA] Status update', { messageId, deliveryStatus, phone: `***${String(phone).slice(-4)}` });

        // Look up which campaign sent this message via Redis dedup keys
        const campaignId = await resolveCampaignFromMessageId(messageId, phone);
        if (!campaignId) continue;

        // Deduplicate receipt processing — if this messageId was already processed,
        // increment deduped counter and skip further processing.
        const receiptKey = `wa:mkt:receipt:${messageId}`;
        try {
          const redis = getRedis();
          const isNew = await redis.set(receiptKey, '1', 'EX', 7 * 86400, 'NX');
          if (!isNew) {
            await MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.deduped': 1 } });
            continue;
          }
        } catch {
          // Non-critical: proceed with processing if Redis is unavailable
        }

        switch (deliveryStatus) {
          case 'sent':
            await MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.sent': 1 } });
            break;
          case 'delivered':
            await MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.delivered': 1 } });
            break;
          case 'read':
            await campaignAnalytics.trackOpen(campaignId);
            break;
          case 'failed':
            await MarketingCampaign.findByIdAndUpdate(campaignId, { $inc: { 'stats.failed': 1 } });
            break;
        }
      }

      // Handle inbound messages (user replies — "STOP" = unsubscribe)
      const messages = value.messages || [];
      for (const msg of messages) {
        if (msg.type === 'text' && msg.text?.body?.trim().toUpperCase() === 'STOP') {
          const maskedPhone = `***${String(msg.from).slice(-4)}`;
          logger.info('[Webhook:WA] User requested unsubscribe', { from: maskedPhone });
          // Update whatsappOptIn directly on the shared collection.
          // MerchantCustomerSnapshot lives in the monolith DB (same cluster).
          const db = mongoose.connection.useDb('rez', { useCache: true });
          await db.collection('merchantcustomersnapshots').updateMany(
            { phone: msg.from },
            { $set: { whatsappOptIn: false, whatsappOptOutAt: new Date() } },
          );
          logger.info('[Webhook:WA] whatsappOptIn cleared', { from: maskedPhone });
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
async function resolveCampaignFromMessageId(
  messageId: string,
  phone: string,
): Promise<string | null> {
  try {
    const redis = getRedis();
    const campaignId = await redis.get(`wa:mkt:msgid:${messageId}`);
    return campaignId;
  } catch {
    return null;
  }
}

// ── Track open via pixel (GET) ────────────────────────────────────────────────
// Tracking pixel embedded in email templates: GET /webhooks/track/open?cid=...
router.get('/track/open', async (req: Request, res: Response) => {
  const { cid } = req.query as { cid?: string };
  if (cid) {
    campaignAnalytics.trackOpen(cid).catch((err) => logger.warn('[Webhook:Track] Open tracking failed', { cid, err: err.message }));
  }
  // Return 1x1 transparent GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store');
  res.send(gif);
});

// ── Conversion events from other services ──────────────────────────────────

const conversionSchema = z.object({
  eventType: z.string(),
  userId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  total: z.number(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
  })).optional(),
  merchantId: z.string().optional(),
  timestamp: z.string().optional(),
});

const abandonmentSchema = z.object({
  eventType: z.string(),
  userId: z.string(),
  cartId: z.string(),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })),
  timestamp: z.string().optional(),
});

/**
 * POST /api/events/conversion
 * Receives order completion events from order service
 */
router.post('/events/conversion', async (req: Request, res: Response) => {
  try {
    const parsed = conversionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const { userId, orderId, orderNumber, total, items, merchantId } = parsed.data;

    logger.info('[Marketing] Conversion event received', { userId, orderId, total });

    // Track intent for personalization
    track({
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
    }).catch(() => {});

    // Forward to event-platform for unified analytics
    forwardToEventPlatform('conversion', {
      conversionId: orderId,
      campaignId: req.headers['x-campaign-id'] as string || 'direct',
      merchantId: merchantId || 'unknown',
      userId,
      orderId,
      value: total,
      currency: 'INR',
      source: 'marketing',
      channel: req.headers['x-channel'] as string || 'direct',
    });

    // Trigger welcome campaign sequence
    try {
      await callInternalService(`${COMMUNICATIONS_URL}/api/notifications/send`, 'POST', {
        userId,
        channels: ['email', 'whatsapp'],
        templateId: 'welcome_sequence',
        payload: {
          title: 'Welcome to REZ!',
          body: 'Thanks for your first order! Start exploring great deals near you.',
          email,
          phone,
        },
      });
      logger.info('[Marketing] Welcome campaign triggered', { userId });
    } catch (err) {
      logger.error('[Marketing] Welcome campaign failed', { userId, error: (err as Error).message });
    }

    // Enroll in loyalty program
    try {
      await callInternalService(`${GAMIFICATION_URL}/api/enroll`, 'POST', {
        userId,
        program: 'loyalty',
        source: 'marketing_conversion',
      });
      logger.info('[Marketing] Loyalty enrollment triggered', { userId });
    } catch (err) {
      logger.error('[Marketing] Loyalty enrollment failed', { userId, error: (err as Error).message });
    }

    // Trigger upsell recommendations
    try {
      await callInternalService(`${COMMUNICATIONS_URL}/api/agents/trigger/upsell_agent`, 'POST', {
        agentType: 'upsell_agent',
        action: 'recommend',
        context: {
          userId,
          orderId,
          category: 'cross_sell',
        },
      });
      logger.info('[Marketing] Upsell triggered', { userId });
    } catch (err) {
      logger.error('[Marketing] Upsell trigger failed', { userId, error: (err as Error).message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[Marketing] Conversion event error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/**
 * POST /api/events/abandonment
 * Receives cart abandonment events
 */
router.post('/events/abandonment', async (req: Request, res: Response) => {
  try {
    const parsed = abandonmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const { userId, cartId, items } = parsed.data;

    logger.info('[Marketing] Abandonment event received', { userId, cartId });

    // Track for retargeting
    track({
      userId,
      event: 'cart_abandoned',
      intentKey: `cart_${cartId}`,
      properties: {
        cartId,
        itemCount: items.length,
        totalValue: items.reduce((sum, i) => sum + i.price, 0),
      },
    }).catch(() => {});

    // Trigger abandonment email sequence (30 min delay via scheduledFor)
    try {
      const totalValue = items.reduce((sum, i) => sum + i.price, 0);
      await callInternalService(`${COMMUNICATIONS_URL}/api/notifications/send`, 'POST', {
        userId,
        channels: ['email', 'sms', 'whatsapp'],
        templateId: 'abandonment_recovery',
        payload: {
          title: 'Complete Your Order',
          body: `You left items in your cart! Complete your purchase now and get 10% off.`,
          data: { cartId, items, totalValue },
        },
        scheduledFor: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min delay
      });
      logger.info('[Marketing] Abandonment campaign triggered', { userId, cartId });
    } catch (err) {
      logger.error('[Marketing] Abandonment campaign failed', { userId, cartId, error: (err as Error).message });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[Marketing] Abandonment event error', { error: (err as Error).message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
