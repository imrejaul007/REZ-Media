/**
 * Webhook Routes for REZ Communications Platform
 *
 * Handles incoming webhooks from:
 * - WhatsApp Business API
 * - Twilio (SMS, WhatsApp, Voice)
 * - Other notification providers
 *
 * These routes are NOT protected by internal service auth - they verify
 * webhook signatures instead.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookEvent {
  provider: 'whatsapp' | 'twilio' | 'sendgrid' | 'firebase';
  eventType: string;
  payload: unknown;
  timestamp: Date;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          wa_id: string;
          profile: { name: string };
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          audio?: { id: string; mime_type: string };
          video?: { id: string; mime_type: string; sha256: string; caption?: string };
          document?: { id: string; mime_type: string; sha256: string; filename: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          sticker?: { id: string; mime_type: string; sha256: string };
          reaction?: { message_id: string; emoji: string };
          button?: { payload: string; text: string };
          interactive?: {
            type: string;
            [key: string]: unknown;
          };
          context?: { from: string; id: string };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
          timestamp: string;
          recipient_id: string;
          conversation?: {
            id: string;
            origin: { type: string };
          };
          pricing?: {
            billable: boolean;
            pricing_model: string;
            category: string;
          };
          error?: {
            code: number;
            title: string;
          };
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface TwilioWebhookPayload {
  AccountSid: string;
  From: string;
  To: string;
  Body?: string;
  MessageSid: string;
  MessageStatus?: 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  ErrorCode?: string;
  ErrorMessage?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  FromCity?: string;
  FromState?: string;
  FromCountry?: string;
  ToCity?: string;
  ToState?: string;
  ToCountry?: string;
}

// ============================================================================
// ROUTER FACTORY
// ============================================================================

export function createWebhookRoutes(config: WebhookConfig): Router {
  const router = Router();

  // Initialize webhook state store (in production, use Redis)
  const webhookState = new Map<string, {
    processed: Set<string>;
    lastCleanup: number;
  }>();

  // Cleanup old webhooks every hour
  setInterval(() => cleanupWebhookState(webhookState), 3600000);

  // =========================================================================
  // WHATSAPP BUSINESS WEBHOOK
  // =========================================================================

  /**
   * GET /webhooks/whatsapp
   * Webhook verification endpoint for WhatsApp Business API
   *
   * WhatsApp sends a GET request to verify the webhook URL.
   */
  router.get('/whatsapp', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
      return;
    }

    console.warn('WhatsApp webhook verification failed', { mode, token });
    res.status(403).send('Forbidden');
  });

  /**
   * POST /webhooks/whatsapp
   * Receive incoming WhatsApp messages and status updates
   */
  router.post('/whatsapp', async (req: Request, res: Response) => {
    // Respond immediately to WhatsApp (they expect fast response)
    res.status(200).send('OK');

    const payload = req.body as WhatsAppWebhookPayload;

    try {
      // Verify signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!verifyWhatsAppSignature(req.body, signature, config.whatsapp.appSecret)) {
        console.warn('Invalid WhatsApp webhook signature');
        return;
      }

      // Process webhook asynchronously
      await processWhatsAppWebhook(payload, config, webhookState);
    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
    }
  });

  // =========================================================================
  // TWILIO WEBHOOK
  // =========================================================================

  /**
   * POST /webhooks/twilio/sms
   * Receive Twilio SMS status callbacks
   */
  router.post('/twilio/sms', async (req: Request, res: Response) => {
    // Respond quickly to Twilio
    res.status(200).type('text/xml').send('<Response></Response>');

    const payload = req.body as TwilioWebhookPayload;

    try {
      // Verify Twilio signature
      if (!verifyTwilioSignature(req, config.twilio.authToken)) {
        console.warn('Invalid Twilio webhook signature');
        return;
      }

      // Process SMS status update
      await processTwilioSmsWebhook(payload, config, webhookState);
    } catch (error) {
      console.error('Error processing Twilio SMS webhook:', error);
    }
  });

  /**
   * POST /webhooks/twilio/whatsapp
   * Receive Twilio WhatsApp status callbacks
   */
  router.post('/twilio/whatsapp', async (req: Request, res: Response) => {
    res.status(200).type('text/xml').send('<Response></Response>');

    const payload = req.body as TwilioWebhookPayload;

    try {
      if (!verifyTwilioSignature(req, config.twilio.authToken)) {
        console.warn('Invalid Twilio WhatsApp webhook signature');
        return;
      }

      await processTwilioWhatsAppWebhook(payload, config, webhookState);
    } catch (error) {
      console.error('Error processing Twilio WhatsApp webhook:', error);
    }
  });

  /**
   * POST /webhooks/twilio/voice
   * Receive Twilio Voice callbacks
   */
  router.post('/twilio/voice', async (req: Request, res: Response) => {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling REZ. An agent will contact you shortly.</Say>
</Response>`;

    res.status(200).type('text/xml').send(twiml);

    // Log voice call event
    console.log('Twilio voice callback received', {
      from: req.body.From,
      to: req.body.To,
      callSid: req.body.CallSid,
    });
  });

  // =========================================================================
  // SENDGRID WEBHOOK (Email Events)
  // =========================================================================

  /**
   * POST /webhooks/sendgrid
   * Receive SendGrid email event webhooks
   */
  router.post('/sendgrid', async (req: Request, res: Response) => {
    res.status(200).json({ accepted: true });

    const events = req.body;

    if (!Array.isArray(events)) {
      console.warn('SendGrid webhook received non-array payload');
      return;
    }

    try {
      for (const event of events) {
        await processSendGridWebhook(event, config, webhookState);
      }
    } catch (error) {
      console.error('Error processing SendGrid webhook:', error);
    }
  });

  // =========================================================================
  // FIREBASE CLOUD MESSAGING WEBHOOK (Delivery Receipts)
  // =========================================================================

  /**
   * POST /webhooks/firebase
   * Receive Firebase FCM delivery receipts
   */
  router.post('/firebase', async (req: Request, res: Response) => {
    res.status(200).json({ success: true });

    const { messageId, success, failureReason, metadata } = req.body;

    try {
      await processFirebaseWebhook({ messageId, success, failureReason, metadata }, config);
    } catch (error) {
      console.error('Error processing Firebase webhook:', error);
    }
  });

  // =========================================================================
  // WEBHOOK EVENT FORWARDING (for testing/debugging)
  // =========================================================================

  /**
   * POST /webhooks/forward
   * Forward webhook events to configured endpoints (for integration)
   */
  router.post('/forward', async (req: Request, res: Response) => {
    const { destination, event } = req.body;

    if (!destination || !event) {
      res.status(400).json({
        error: 'Missing destination or event'
      });
      return;
    }

    try {
      const response = await fetch(destination, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'rez-communications-platform',
        },
        body: JSON.stringify(event),
      });

      res.json({
        success: response.ok,
        status: response.status,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Forward failed',
      });
    }
  });

  return router;
}

// ============================================================================
// WEBHOOK PROCESSING FUNCTIONS
// ============================================================================

async function processWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
  config: WebhookConfig,
  state: Map<string, { processed: Set<string>; lastCleanup: number }>
): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') {
    console.log('Ignoring non-WhatsApp Business webhook');
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const { messages, statuses, metadata } = change.value;

      // Process incoming messages
      if (messages) {
        for (const message of messages) {
          // Deduplicate
          if (isWebhookProcessed(state, 'whatsapp', message.id)) {
            continue;
          }

          const event: WebhookEvent = {
            provider: 'whatsapp',
            eventType: `message.${message.type}`,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            messageId: message.id,
            payload: {
              from: message.from,
              to: metadata.phone_number_id,
              type: message.type,
              text: message.text?.body,
              media: message.image || message.audio || message.video || message.document,
              location: message.location,
              sticker: message.sticker,
              reaction: message.reaction,
              button: message.button,
              interactive: message.interactive,
              context: message.context,
              contact: message.from,
              profile: change.value.contacts?.[0]?.profile,
            },
            metadata: {
              phoneNumberId: metadata.phone_number_id,
              businessAccountId: entry.id,
            },
          };

          console.log('WhatsApp message received:', JSON.stringify(event, null, 2));

          // Forward to configured handlers
          await forwardToHandlers(event, config);

          // Send auto-reply for template confirmation
          if (config.whatsapp.autoReply && message.type === 'text') {
            await handleWhatsAppAutoReply(message, config);
          }
        }
      }

      // Process status updates
      if (statuses) {
        for (const status of statuses) {
          if (isWebhookProcessed(state, 'whatsapp', status.id)) {
            continue;
          }

          const event: WebhookEvent = {
            provider: 'whatsapp',
            eventType: `status.${status.status}`,
            timestamp: new Date(parseInt(status.timestamp) * 1000),
            messageId: status.id,
            payload: {
              status: status.status,
              recipientId: status.recipient_id,
              conversation: status.conversation,
              pricing: status.pricing,
              error: status.error,
            },
          };

          console.log('WhatsApp status update:', JSON.stringify(event, null, 2));

          await forwardToHandlers(event, config);
        }
      }
    }
  }
}

async function processTwilioSmsWebhook(
  payload: TwilioWebhookPayload,
  config: WebhookConfig,
  state: Map<string, { processed: Set<string>; lastCleanup: number }>
): Promise<void> {
  if (isWebhookProcessed(state, 'twilio', payload.MessageSid)) {
    return;
  }

  const event: WebhookEvent = {
    provider: 'twilio',
    eventType: payload.MessageStatus ? `sms.${payload.MessageStatus}` : 'sms.received',
    timestamp: new Date(),
    messageId: payload.MessageSid,
    payload: {
      from: payload.From,
      to: payload.To,
      body: payload.Body,
      status: payload.MessageStatus,
      errorCode: payload.ErrorCode,
      errorMessage: payload.ErrorMessage,
      media: payload.NumMedia ? [{
        url: payload.MediaUrl0,
        contentType: payload.MediaContentType0,
      }] : [],
    },
    metadata: {
      fromCity: payload.FromCity,
      fromState: payload.FromState,
      fromCountry: payload.FromCountry,
      toCity: payload.ToCity,
      toState: payload.ToState,
      toCountry: payload.ToCountry,
    },
  };

  console.log('Twilio SMS webhook received:', JSON.stringify(event, null, 2));

  await forwardToHandlers(event, config);
}

async function processTwilioWhatsAppWebhook(
  payload: TwilioWebhookPayload,
  config: WebhookConfig,
  state: Map<string, { processed: Set<string>; lastCleanup: number }>
): Promise<void> {
  if (isWebhookProcessed(state, 'twilio', payload.MessageSid)) {
    return;
  }

  const event: WebhookEvent = {
    provider: 'twilio',
    eventType: payload.MessageStatus ? `whatsapp.${payload.MessageStatus}` : 'whatsapp.received',
    timestamp: new Date(),
    messageId: payload.MessageSid,
    payload: {
      from: payload.From?.replace('whatsapp:', ''),
      to: payload.To?.replace('whatsapp:', ''),
      body: payload.Body,
      status: payload.MessageStatus,
      errorCode: payload.ErrorCode,
      errorMessage: payload.ErrorMessage,
    },
  };

  console.log('Twilio WhatsApp webhook received:', JSON.stringify(event, null, 2));

  await forwardToHandlers(event, config);
}

async function processSendGridWebhook(
  event: Record<string, unknown>,
  config: WebhookConfig,
  state: Map<string, { processed: Set<string>; lastCleanup: number }>
): Promise<void> {
  const sgEventId = event.sg_message_id as string;
  if (isWebhookProcessed(state, 'sendgrid', sgEventId)) {
    return;
  }

  const webhookEvent: WebhookEvent = {
    provider: 'sendgrid',
    eventType: `email.${event.event}`,
    timestamp: new Date(event.timestamp as number * 1000),
    messageId: sgEventId,
    payload: {
      email: event.email,
      timestamp: event.timestamp,
      ip: event.ip,
      tls: event.tls,
      cert: event.cert,
      authentication_results: event.authentication_results,
      reason: event.reason,
      type: event.type,
      url: event.url,
      useragent: event.useragent,
    },
    metadata: {
      category: event.category,
      tags: event.tags,
    },
  };

  console.log('SendGrid webhook received:', JSON.stringify(webhookEvent, null, 2));

  await forwardToHandlers(webhookEvent, config);
}

async function processFirebaseWebhook(
  event: {
    messageId: string;
    success: boolean;
    failureReason?: string;
    metadata?: Record<string, unknown>;
  },
  config: WebhookConfig
): Promise<void> {
  const webhookEvent: WebhookEvent = {
    provider: 'firebase',
    eventType: event.success ? 'push.delivered' : 'push.failed',
    timestamp: new Date(),
    messageId: event.messageId,
    payload: {
      success: event.success,
      failureReason: event.failureReason,
      metadata: event.metadata,
    },
  };

  console.log('Firebase webhook received:', JSON.stringify(webhookEvent, null, 2));

  await forwardToHandlers(webhookEvent, config);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function verifyWhatsAppSignature(
  body: unknown,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature || !appSecret) {
    // If no secret configured, skip verification (development mode)
    return true;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(JSON.stringify(body))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function verifyTwilioSignature(req: Request, authToken: string): boolean {
  if (!authToken) {
    return true; // Skip in development
  }

  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) {
    return false;
  }

  // Build the full URL (use X-Forwarded-Proto for proxied requests)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${protocol}://${req.headers.host}${req.originalUrl}`;

  // Build the data string (sorted params)
  const data = Object.keys(req.body)
    .sort()
    .map(key => `${key}${req.body[key]}`)
    .join('');

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(url + data)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function isWebhookProcessed(
  state: Map<string, { processed: Set<string>; lastCleanup: number }>,
  provider: string,
  eventId: string
): boolean {
  const key = `${provider}:${eventId}`;
  const entry = state.get(key);

  if (!entry) {
    state.set(key, { processed: new Set([eventId]), lastCleanup: Date.now() });
    return false;
  }

  if (entry.processed.has(eventId)) {
    return true;
  }

  entry.processed.add(eventId);
  return false;
}

function cleanupWebhookState(
  state: Map<string, { processed: Set<string>; lastCleanup: number }>
): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [key, entry] of state.entries()) {
    if (now - entry.lastCleanup > maxAge) {
      state.delete(key);
    } else {
      // Clean up old event IDs
      entry.processed.clear();
    }
  }

  console.log(`Webhook state cleanup complete. Active entries: ${state.size}`);
}

async function forwardToHandlers(
  event: WebhookEvent,
  config: WebhookConfig
): Promise<void> {
  // Forward to configured handler URLs
  for (const handler of config.handlers) {
    try {
      const response = await fetch(handler.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': `rez-communications-platform-${event.provider}`,
          'X-Webhook-Event-Type': event.eventType,
          'X-Webhook-Message-Id': event.messageId || '',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        console.error(`Webhook handler ${handler.url} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to forward webhook to ${handler.url}:`, error);
    }
  }
}

async function handleWhatsAppAutoReply(
  message: { from: string; text?: { body: string } },
  config: WebhookConfig
): Promise<void> {
  if (!config.whatsapp.autoReply) return;

  const autoReplyMessage = config.whatsapp.autoReplyMessage || 'Thanks for your message! We will respond shortly.';

  // This would call the WhatsApp service to send the reply
  console.log(`Sending auto-reply to ${message.from}: ${autoReplyMessage}`);
  // await whatsappService.send({ to: message.from, body: autoReplyMessage });
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface WebhookConfig {
  whatsapp: {
    verifyToken: string;
    appSecret: string;
    autoReply?: boolean;
    autoReplyMessage?: string;
  };
  twilio: {
    authToken: string;
    accountSid: string;
  };
  sendgrid?: {
    verifyKey: string;
  };
  handlers: Array<{
    url: string;
    events?: string[];
  }>;
}
