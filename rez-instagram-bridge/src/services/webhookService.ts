import crypto from 'crypto';
import { Request, Response } from 'express';
import { config } from '../config';
import { dmService, IncomingDM } from './dmService';
import { commentService } from './commentService';
import { mentionService } from './mentionService';
import { dmHandler } from '../handlers/dmHandler';
import { commentHandler } from '../handlers/commentHandler';
import { mentionHandler } from '../handlers/mentionHandler';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  time: number;
  changes?: any[];
  messaging?: WebhookMessage[];
  Standby?: WebhookMessage[];
}

export interface WebhookMessage {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  "referral"?: any;
  message?: {
    mid: string;
    text?: string;
    attachments?: any[];
    is_echo?: boolean;
    quick_reply?: { payload: string };
  };
  delivery?: any;
  read?: any;
  read_event?: any;
}

class WebhookService {
  verifyWebhook(req: Request): boolean {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.webhook.verifyToken) {
      logger.info('Webhook verified successfully');
      return true;
    }

    logger.warn('Webhook verification failed', { mode, token });
    return false;
  }

  async handleWebhook(payload: WebhookPayload): Promise<void> {
    try {
      logger.info('Received webhook', {
        object: payload.object,
        entryCount: payload.entry.length,
      });

      // Handle Instagram messaging webhooks
      if (payload.object === 'instagram') {
        await this.handleInstagramWebhook(payload);
      } else {
        logger.warn('Unknown webhook object', { object: payload.object });
      }
    } catch (error: any) {
      logger.error('Failed to handle webhook', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private async handleInstagramWebhook(payload: WebhookPayload): Promise<void> {
    for (const entry of payload.entry) {
      // Handle messaging events
      if (entry.messaging) {
        for (const event of entry.messaging) {
          await this.handleMessagingEvent(event);
        }
      }

      // Handle standby events (when app is in standby mode)
      if (entry.Standby) {
        for (const event of entry.Standby) {
          await this.handleMessagingEvent(event);
        }
      }

      // Handle changes (comments, mentions, etc.)
      if (entry.changes) {
        for (const change of entry.changes) {
          await this.handleChange(change, entry.id);
        }
      }
    }
  }

  private async handleMessagingEvent(event: WebhookMessage): Promise<void> {
    // Skip echo messages
    if (event.message?.is_echo) {
      logger.debug('Skipping echo message', { mid: event.message.mid });
      return;
    }

    // Handle read events
    if (event.read) {
      logger.info('Message read event', {
        sender: event.sender.id,
        watermark: event.read.watermark,
      });
      return;
    }

    // Handle delivery events
    if (event.delivery) {
      logger.info('Message delivery event', {
        mids: event.delivery.mids,
        watermark: event.delivery.watermark,
      });
      return;
    }

    // Handle incoming messages
    if (event.message) {
      const dm: IncomingDM = {
        senderId: event.sender.id,
        senderUsername: '', // Will be resolved in handler
        threadId: event.recipient.id,
        messageId: event.message.mid,
        text: event.message.text || '',
        timestamp: new Date(event.timestamp).toISOString(),
        attachments: event.message.attachments,
      };

      logger.info('Processing incoming DM', {
        senderId: dm.senderId,
        messageId: dm.messageId,
        textLength: dm.text.length,
      });

      // Delegate to DM handler
      await dmHandler.handle(dm);
    }

    // Handle quick reply
    if (event.message?.quick_reply) {
      const quickReplyPayload = event.message.quick_reply.payload;
      logger.info('Quick reply received', {
        sender: event.sender.id,
        payload: quickReplyPayload,
      });

      await dmHandler.handleQuickReply(event.sender.id, quickReplyPayload);
    }

    // Handle referral
    if (event.referral) {
      logger.info('Referral received', {
        sender: event.sender.id,
        referral: event.referral,
      });

      await dmHandler.handleReferral(event.sender.id, event.referral);
    }
  }

  private async handleChange(change: any, entryId: string): Promise<void> {
    const { field, value } = change;

    switch (field) {
      case 'mentions':
        await mentionHandler.handleMentions(value);
        break;

      case 'comments':
        await commentHandler.handleComments(value);
        break;

      case 'story_insights':
        logger.info('Story insights received', { entryId, value });
        break;

      default:
        logger.debug('Unknown change field', { field, value });
    }
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.instagram.appSecret)
      .update(payload)
      .digest('hex');

    // Instagram sends signature in format "sha256=..."
    const receivedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  }
}

export const webhookService = new WebhookService();
