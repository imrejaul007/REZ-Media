import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Twilio } from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import { getWhatsAppTemplates, WhatsAppTemplateType } from './templates';
import {
  verifyInternalToken,
  AuthenticatedRequest,
} from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { redisClient } from '../config/redis';
import { mongodbClient } from '../config/mongodb';
import mongoose from 'mongoose';

const router = express.Router();

// Twilio client configuration
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

// Message deduplication window (24 hours in seconds)
const DEDUP_WINDOW_SECONDS = 86400;

// Types
interface WhatsAppMessagePayload {
  recipientPhone: string;
  templateType: WhatsAppTemplateType;
  templateData?: Record<string, string>;
  metadata?: {
    sourceApp: string;
    userId?: string;
    correlationId?: string;
  };
}

interface WhatsAppIncomingMessage {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  NumMedia?: string;
  MediaContentType0?: string;
  MediaUrl0?: string;
}

// Validation schemas
const sendMessageValidation = [
  body('recipientPhone')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format (E.164 required)'),
  body('templateType')
    .isIn([
      'order_confirmation',
      'delivery_update',
      'appointment_reminder',
      'abandonment_recovery',
      'win_back',
      'campaign_promotion',
    ])
    .withMessage('Invalid template type'),
  body('templateData')
    .optional()
    .isObject()
    .withMessage('templateData must be an object'),
  body('metadata.sourceApp')
    .isString()
    .withMessage('sourceApp is required in metadata'),
];

// Helper: Validate E.164 format
function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

// Helper: Normalize phone number to E.164
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('whatsapp:')) {
    return cleaned.replace('whatsapp:', '');
  }
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  return cleaned;
}

// Helper: Check for duplicate message (replay prevention)
async function isDuplicateMessage(messageId: string): Promise<boolean> {
  const key = `whatsapp:dedup:${messageId}`;
  const exists = await redisClient.exists(key);
  return exists === 1;
}

// Helper: Mark message as processed
async function markMessageProcessed(messageId: string): Promise<void> {
  const key = `whatsapp:dedup:${messageId}`;
  await redisClient.setEx(key, DEDUP_WINDOW_SECONDS, '1');
}

// Helper: Format WhatsApp phone number for Twilio
function formatForTwilio(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return `whatsapp:${normalized}`;
}

// Helper: Log WhatsApp event to MongoDB
async function logWhatsAppEvent(
  eventType: 'outgoing' | 'incoming',
  payload: Record<string, unknown>
): Promise<void> {
  const db = mongodbClient.db('rez_communications');
  const collection = db.collection('whatsapp_events');

  await collection.insertOne({
    eventType,
    timestamp: new Date(),
    ...payload,
  });
}

// Helper: Send message via Twilio
async function sendViaTwilio(
  to: string,
  content: string | null,
  templateName?: string,
  templateVariables?: Record<string, string>
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    let messageParams: Record<string, string> = {
      from: TWILIO_WHATSAPP_FROM,
      to: formatForTwilio(to),
    };

    if (templateName) {
      messageParams.contentSid = templateName;
      if (templateVariables) {
        messageParams.contentVariables = JSON.stringify(templateVariables);
      }
    } else if (content) {
      messageParams.body = content;
    }

    const message = await twilioClient.messages.create(messageParams);

    return {
      success: true,
      messageSid: message.sid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twilio message send failed', {
      error: errorMessage,
      to,
      templateName,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Middleware: Validate request
function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array(),
    });
    return;
  }
  next();
}

// GET /whatsapp/status - Check WhatsApp API status
router.get(
  '/status',
  verifyInternalToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      // Check if Twilio credentials are configured
      if (!accountSid || !authToken) {
        res.status(503).json({
          success: false,
          status: 'unconfigured',
          message: 'Twilio credentials not configured',
        });
        return;
      }

      // Verify credentials by fetching account
      const account = await twilioClient.api.accounts(accountSid).fetch();

      // Check Redis connectivity
      let redisStatus = 'connected';
      try {
        await redisClient.ping();
      } catch {
        redisStatus = 'disconnected';
      }

      // Check MongoDB connectivity
      let mongoStatus = 'connected';
      try {
        if (mongoose.connection.readyState !== 1) {
          mongoStatus = 'disconnected';
        }
      } catch {
        mongoStatus = 'disconnected';
      }

      res.json({
        success: true,
        status: {
          twilio: account.status === 'active' ? 'active' : 'inactive',
          redis: redisStatus,
          mongodb: mongoStatus,
          whatsappFrom: TWILIO_WHATSAPP_FROM,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp status check failed', { error: errorMessage });

      res.status(500).json({
        success: false,
        status: 'error',
        message: errorMessage,
      });
    }
  }
);

// POST /api/whatsapp/send - Send WhatsApp message
router.post(
  '/api/whatsapp/send',
  verifyInternalToken,
  sendMessageValidation,
  validateRequest,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    const startTime = Date.now();
    const payload = req.body as WhatsAppMessagePayload;
    const correlationId = payload.metadata?.correlationId || uuidv4();

    logger.info('WhatsApp send request received', {
      correlationId,
      recipientPhone: payload.recipientPhone,
      templateType: payload.templateType,
      sourceApp: payload.metadata?.sourceApp,
    });

    try {
      // Validate phone number
      if (!isValidE164(payload.recipientPhone)) {
        res.status(400).json({
          success: false,
          error: 'Invalid phone number format',
          correlationId,
        });
        return;
      }

      const templates = getWhatsAppTemplates();
      const template = templates[payload.templateType];

      if (!template) {
        res.status(400).json({
          success: false,
          error: `Unknown template type: ${payload.templateType}`,
          correlationId,
        });
        return;
      }

      // Merge template data with defaults
      const mergedData = {
        ...template.defaults,
        ...payload.templateData,
      };

      // Check for replay prevention
      const dedupKey = `send:${payload.recipientPhone}:${payload.templateType}:${JSON.stringify(mergedData)}`;
      const isDup = await isDuplicateMessage(dedupKey);

      if (isDup) {
        logger.warn('Duplicate message detected', {
          correlationId,
          recipientPhone: payload.recipientPhone,
        });

        res.status(429).json({
          success: false,
          error: 'Duplicate message',
          correlationId,
        });
        return;
      }

      // Prepare template variables for Twilio
      const templateVariables: Record<string, string> = {};
      Object.entries(mergedData).forEach(([key, value], index) => {
        templateVariables[`{{${index + 1}}}`] = String(value);
      });

      // Send message via Twilio
      const result = await sendViaTwilio(
        payload.recipientPhone,
        null,
        template.twilioContentSid,
        templateVariables
      );

      if (!result.success) {
        await logWhatsAppEvent('outgoing', {
          correlationId,
          recipientPhone: payload.recipientPhone,
          templateType: payload.templateType,
          status: 'failed',
          error: result.error,
          durationMs: Date.now() - startTime,
        });

        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send message',
          correlationId,
        });
        return;
      }

      // Mark as processed for deduplication
      await markMessageProcessed(dedupKey);

      // Log success
      await logWhatsAppEvent('outgoing', {
        correlationId,
        messageSid: result.messageSid,
        recipientPhone: payload.recipientPhone,
        templateType: payload.templateType,
        status: 'sent',
        durationMs: Date.now() - startTime,
      });

      logger.info('WhatsApp message sent successfully', {
        correlationId,
        messageSid: result.messageSid,
        durationMs: Date.now() - startTime,
      });

      res.status(200).json({
        success: true,
        messageSid: result.messageSid,
        correlationId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp send failed', {
        correlationId,
        error: errorMessage,
      });

      await logWhatsAppEvent('outgoing', {
        correlationId,
        recipientPhone: payload.recipientPhone,
        templateType: payload.templateType,
        status: 'error',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        error: errorMessage,
        correlationId,
      });
    }
  }
);

// POST /webhooks/whatsapp/incoming - Handle incoming messages
router.post(
  '/webhooks/whatsapp/incoming',
  express.urlencoded({ extended: false }),
  async (req: Request, res: Response): Promise<void> => {
    const messageSid = req.body.MessageSid;

    logger.info('WhatsApp incoming webhook received', {
      messageSid,
      from: req.body.From,
      body: req.body.Body,
    });

    try {
      // Verify Twilio signature in production
      if (process.env.NODE_ENV === 'production') {
        const twilioSignature = req.headers['x-twilio-signature'] as string;
        const valid = twilioClient.validateRequest(
          process.env.TWILIO_AUTH_TOKEN!,
          twilioSignature,
          req.originalUrl,
          req.body
        );

        if (!valid) {
          logger.warn('Invalid Twilio signature', { messageSid });
          res.status(403).send('Forbidden');
          return;
        }
      }

      // Check for duplicate (replay prevention)
      const isDup = await isDuplicateMessage(messageSid);
      if (isDup) {
        logger.info('Duplicate incoming message ignored', { messageSid });
        res.status(200).send('OK');
        return;
      }

      // Parse the incoming message
      const incomingMessage: WhatsAppIncomingMessage = {
        From: req.body.From,
        To: req.body.To,
        Body: req.body.Body,
        MessageSid: messageSid,
        AccountSid: req.body.AccountSid,
        MessagingServiceSid: req.body.MessagingServiceSid,
        NumMedia: req.body.NumMedia,
        MediaContentType0: req.body.MediaContentType0,
        MediaUrl0: req.body.MediaUrl0,
      };

      // Extract phone number (remove whatsapp: prefix)
      const fromPhone = incomingMessage.From.replace('whatsapp:', '');

      // Log incoming message
      await logWhatsAppEvent('incoming', {
        messageSid: incomingMessage.MessageSid,
        fromPhone,
        toPhone: incomingMessage.To,
        body: incomingMessage.Body,
        hasMedia: parseInt(incomingMessage.NumMedia || '0') > 0,
        mediaType: incomingMessage.MediaContentType0,
      });

      // Process the message based on content
      let responseMessage = '';
      const lowerBody = incomingMessage.Body.trim().toLowerCase();

      // Handle different commands
      if (lowerBody === 'stop' || lowerBody === 'unsubscribe') {
        // User opted out - handle in user preferences
        responseMessage = 'You have been unsubscribed from WhatsApp notifications.';
        await handleOptOut(fromPhone);
      } else if (lowerBody === 'start' || lowerBody === 'subscribe') {
        // User opted back in
        responseMessage = 'You have been subscribed to WhatsApp notifications.';
        await handleOptIn(fromPhone);
      } else if (lowerBody === 'help') {
        responseMessage =
          'ReZ WhatsApp Bot Help:\n' +
          'Reply STOP to unsubscribe\n' +
          'Reply HELP for this message\n' +
          'Reply STATUS to check your orders';
      } else if (lowerBody === 'status') {
        // Fetch order status for user
        responseMessage = await handleStatusRequest(fromPhone);
      } else {
        // Generic response for unrecognized commands
        responseMessage =
          'Thanks for your message. A team member will respond shortly.';
      }

      // Mark message as processed
      await markMessageProcessed(messageSid);

      // Send automated response if applicable
      if (responseMessage) {
        await sendViaTwilio(fromPhone, responseMessage);
      }

      // Return 200 to Twilio immediately
      res.status(200).send('OK');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp incoming webhook error', {
        messageSid,
        error: errorMessage,
      });

      // Still return 200 to prevent Twilio retries
      res.status(200).send('OK');
    }
  }
);

// Helper: Handle user opt-out
async function handleOptOut(phone: string): Promise<void> {
  const db = mongodbClient.db('rez_communications');
  const collection = db.collection('user_preferences');

  await collection.updateOne(
    { phone },
    {
      $set: {
        whatsappOptedOut: true,
        optedOutAt: new Date(),
      },
    },
    { upsert: true }
  );

  logger.info('User opted out of WhatsApp', { phone });
}

// Helper: Handle user opt-in
async function handleOptIn(phone: string): Promise<void> {
  const db = mongodbClient.db('rez_communications');
  const collection = db.collection('user_preferences');

  await collection.updateOne(
    { phone },
    {
      $set: {
        whatsappOptedOut: false,
        optedInAt: new Date(),
      },
    },
    { upsert: true }
  );

  logger.info('User opted in to WhatsApp', { phone });
}

// Helper: Handle status request
async function handleStatusRequest(phone: string): Promise<string> {
  const db = mongodbClient.db('rez_orders');
  const orders = db.collection('orders');

  // Get recent orders for this user
  const recentOrders = await orders
    .find({
      customerPhone: phone,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .toArray();

  if (recentOrders.length === 0) {
    return 'No recent orders found. Visit our app to place a new order!';
  }

  const orderSummaries = recentOrders
    .map(
      (order) =>
        `Order #${order.orderId}: ${order.status} - ${order.restaurantName || 'Restaurant'}`
    )
    .join('\n');

  return `Your Recent Orders:\n${orderSummaries}\n\nReply HELP for more options.`;
}

// POST /api/whatsapp/broadcast - Broadcast to multiple recipients (admin only)
router.post(
  '/api/whatsapp/broadcast',
  verifyInternalToken,
  [
    body('recipients').isArray({ min: 1 }).withMessage('recipients must be a non-empty array'),
    body('recipients.*').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone format'),
    body('templateType').isIn([
      'order_confirmation',
      'delivery_update',
      'appointment_reminder',
      'abandonment_recovery',
      'win_back',
      'campaign_promotion',
    ]),
    body('templateData').optional().isObject(),
  ],
  validateRequest,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    const { recipients, templateType, templateData } = req.body as {
      recipients: string[];
      templateType: WhatsAppTemplateType;
      templateData?: Record<string, string>;
    };

    const correlationId = uuidv4();

    logger.info('WhatsApp broadcast initiated', {
      correlationId,
      recipientCount: recipients.length,
      templateType,
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { phone: string; error: string }[],
    };

    for (const phone of recipients) {
      try {
        const result = await sendViaTwilio(phone, null, templateType, templateData);
        if (result.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ phone, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          phone,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('WhatsApp broadcast completed', {
      correlationId,
      ...results,
    });

    res.json({
      success: true,
      correlationId,
      ...results,
    });
  }
);

export default router;
