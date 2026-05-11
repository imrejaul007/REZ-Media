/**
 * WhatsApp Service - WhatsApp Business API via Twilio
 * Handles WhatsApp messaging including text, media, and templates
 */

import twilio from 'twilio';
import { Client, LocalAuth } from 'whatsapp-web.js';
import { v4 as uuidv4 } from 'uuid';
import {
  IWhatsAppService,
  WhatsAppMessage,
  DeliveryResult,
  WhatsAppConfig,
  ChannelType,
  MessageStatus
} from '../types';
import { WhatsAppError, ProviderError, ValidationError } from '../utils/errors';
import { Validator } from '../utils/validation';
import { logger, LogContext } from '../utils/logger';

export class WhatsAppService implements IWhatsAppService {
  private config: WhatsAppConfig;
  private log: LogContext;
  private twilioClient: twilio.Twilio | null = null;
  private whatsappClient: Client | null = null;
  private isTwilioConfigured: boolean = false;
  private isWebConfigured: boolean = false;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.log = new LogContext(logger, { service: 'WhatsAppService' });

    this.initialize();
  }

  private initialize(): void {
    // Initialize Twilio WhatsApp client
    if (this.config.provider === 'twilio' && this.config.accountSid && this.config.authToken) {
      this.twilioClient = twilio(this.config.accountSid, this.config.authToken);
      this.isTwilioConfigured = true;
      this.log.info('WhatsApp service initialized with Twilio', {
        fromNumber: this.config.fromNumber
      });
    }
    // Initialize WhatsApp Web client
    else if (this.config.provider === 'whatsapp-web' && this.config.sessionPath) {
      this.whatsappClient = new Client({
        authStrategy: new LocalAuth({
          dataPath: this.config.sessionPath
        }),
        qrCallback: (qr) => {
          this.log.info('WhatsApp QR Code received');
          if (this.config.qrCallback) {
            this.config.qrCallback(qr);
          }
        }
      });

      this.whatsappClient.on('ready', () => {
        this.isWebConfigured = true;
        this.log.info('WhatsApp Web client ready');
      });

      this.whatsappClient.on('authenticated', () => {
        this.log.info('WhatsApp Web authenticated');
      });

      this.whatsappClient.on('auth_failure', (error) => {
        this.log.error('WhatsApp Web authentication failed', error);
        this.isWebConfigured = false;
      });

      this.whatsappClient.initialize();
    }
    // Mock mode
    else {
      this.log.warn('WhatsApp service running in mock mode');
    }
  }

  /**
   * Send a WhatsApp message
   */
  async send(message: WhatsAppMessage): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    this.log.info('Sending WhatsApp message', {
      messageId,
      to: message.to,
      bodyLength: message.body.length
    });

    // Validate message
    const validation = Validator.validateWhatsAppMessage(message);
    if (!validation.valid) {
      throw new ValidationError('Invalid WhatsApp message', [{
        field: 'whatsappMessage',
        message: validation.error!
      }]);
    }

    try {
      if (this.isTwilioConfigured) {
        return await this.sendViaTwilio(message, messageId, startTime);
      } else if (this.isWebConfigured && this.whatsappClient) {
        return await this.sendViaWeb(message, messageId, startTime);
      } else {
        return this.mockSend(message, messageId, startTime);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error('Failed to send WhatsApp message', error, { messageId, to: message.to });

      if (err.message.includes('63001') || err.message.includes('63002')) {
        throw new ProviderError(
          'WhatsApp session expired or invalid',
          'whatsapp',
          err,
          { retryable: true }
        );
      }

      throw new WhatsAppError(err.message, 'SEND_FAILED', { retryable: true });
    }
  }

  /**
   * Send message via Twilio WhatsApp API
   */
  private async sendViaTwilio(message: WhatsAppMessage, messageId: string, startTime: number): Promise<DeliveryResult> {
    const to = this.formatWhatsAppNumber(message.to);
    const from = message.from
      ? this.formatWhatsAppNumber(message.from)
      : this.config.fromNumber!;

    const twilioMessage = await this.twilioClient!.messages.create({
      to,
      from,
      body: message.body,
      mediaUrl: message.mediaUrl ? [message.mediaUrl] : undefined,
      contentSid: undefined // For template messages
    } as unknown as twilio.types.TwilioInboundMessageParams);

    return {
      messageId,
      channel: ChannelType.WHATSAPP,
      status: this.mapTwilioStatus(twilioMessage.status),
      timestamp: new Date(),
      providerMessageId: twilioMessage.sid,
      metadata: {
        latencyMs: Date.now() - startTime,
        price: twilioMessage.price,
        priceUnit: twilioMessage.priceUnit
      }
    };
  }

  /**
   * Send message via WhatsApp Web.js
   */
  private async sendViaWeb(message: WhatsAppMessage, messageId: string, startTime: number): Promise<DeliveryResult> {
    const chatId = message.to.includes('@c.us') ? message.to : `${message.to}@c.us`;

    if (message.mediaUrl) {
      const media = await this.whatsappClient!.sendMessage(chatId, {
        media: message.mediaUrl,
        caption: message.mediaCaption || message.body
      });

      return {
        messageId,
        channel: ChannelType.WHATSAPP,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        providerMessageId: media.id.id,
        metadata: {
          latencyMs: Date.now() - startTime,
          type: 'media'
        }
      };
    }

    const sentMessage = await this.whatsappClient!.sendMessage(chatId, message.body, {
      reply_to: message.replyTo
    } as unknown as object);

    return {
      messageId,
      channel: ChannelType.WHATSAPP,
      status: MessageStatus.SENT,
      timestamp: new Date(),
      providerMessageId: sentMessage.id.id,
      metadata: {
        latencyMs: Date.now() - startTime,
        type: 'text'
      }
    };
  }

  /**
   * Send a pre-approved WhatsApp template
   */
  async sendTemplate(templateName: string, variables: Record<string, string>): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    if (!this.isTwilioConfigured) {
      return this.mockSend(
        { to: 'mock-user', body: `Template: ${templateName}` },
        messageId,
        startTime
      );
    }

    try {
      // Note: Template messages require pre-approval from WhatsApp
      // This is a simplified implementation
      const message = await this.twilioClient!.messages.create({
        to: 'unknown', // Must be provided in actual implementation
        from: this.config.fromNumber!,
        contentSid: templateName,
        contentVariables: JSON.stringify(variables)
      } as unknown as twilio.types.TwilioInboundMessageParams);

      return {
        messageId,
        channel: ChannelType.WHATSAPP,
        status: this.mapTwilioStatus(message.status),
        timestamp: new Date(),
        providerMessageId: message.sid,
        metadata: {
          templateName,
          variables
        }
      };
    } catch (error) {
      throw new WhatsAppError(
        `Failed to send template: ${(error as Error).message}`,
        'TEMPLATE_SEND_FAILED',
        { retryable: true }
      );
    }
  }

  /**
   * Send batch of WhatsApp messages
   */
  async sendBatch(messages: WhatsAppMessage[]): Promise<DeliveryResult[]> {
    const batchId = uuidv4();
    this.log.info('Starting batch WhatsApp send', { batchId, count: messages.length });

    if (messages.length === 0) {
      return [];
    }

    // Validate all messages
    const invalidMessages: { index: number; error: string }[] = [];
    messages.forEach((msg, index) => {
      const validation = Validator.validateWhatsAppMessage(msg);
      if (!validation.valid) {
        invalidMessages.push({ index, error: validation.error! });
      }
    });

    if (invalidMessages.length > 0) {
      throw new ValidationError(
        `${invalidMessages.length} invalid messages in batch`,
        invalidMessages.map(i => ({ field: `messages[${i.index}]`, message: i.error }))
      );
    }

    // WhatsApp has stricter rate limits - process slower
    const chunkSize = 20;
    const results: DeliveryResult[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);

      const chunkResults = await Promise.allSettled(
        chunk.map(msg => this.send(msg))
      );

      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const msg = chunk[index];
          results.push({
            messageId: uuidv4(),
            channel: ChannelType.WHATSAPP,
            status: MessageStatus.FAILED,
            timestamp: new Date(),
            error: result.reason.message
          });
        }
      });

      // WhatsApp rate limiting (1 msg/sec for standard, higher for business)
      if (i + chunkSize < messages.length) {
        await this.delay(2000);
      }
    }

    return results;
  }

  /**
   * Format number for WhatsApp (with country code)
   */
  private formatWhatsAppNumber(number: string): string {
    if (number.startsWith('whatsapp:')) {
      return number;
    }
    if (number.startsWith('+')) {
      return `whatsapp:${number}`;
    }
    return `whatsapp:+${number}`;
  }

  /**
   * Map Twilio status to MessageStatus
   */
  private mapTwilioStatus(status: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      'queued': MessageStatus.QUEUED,
      'sent': MessageStatus.SENT,
      'delivered': MessageStatus.DELIVERED,
      'read': MessageStatus.READ,
      'failed': MessageStatus.FAILED,
      'undelivered': MessageStatus.FAILED
    };
    return statusMap[status.toLowerCase()] || MessageStatus.PENDING;
  }

  /**
   * Mock send for testing
   */
  private mockSend(message: WhatsAppMessage, messageId: string, startTime: number): DeliveryResult {
    this.log.info('Mock WhatsApp message sent', {
      messageId,
      to: message.to,
      bodyLength: message.body.length
    });

    return {
      messageId,
      channel: ChannelType.WHATSAPP,
      status: MessageStatus.SENT,
      timestamp: new Date(),
      providerMessageId: `mock-whatsapp-${messageId}`,
      metadata: {
        latencyMs: Date.now() - startTime,
        mock: true
      }
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();

    if (!this.isTwilioConfigured && !this.isWebConfigured) {
      return { healthy: true, latency: 0, error: 'Running in mock mode' };
    }

    if (this.isTwilioConfigured) {
      try {
        await this.twilioClient!.api.accounts(this.config.accountSid!).fetch();
        return { healthy: true, latency: Date.now() - startTime };
      } catch (error) {
        return {
          healthy: false,
          latency: Date.now() - startTime,
          error: (error as Error).message
        };
      }
    }

    return {
      healthy: this.isWebConfigured,
      latency: Date.now() - startTime,
      error: this.isWebConfigured ? undefined : 'Web client not initialized'
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.whatsappClient) {
      await this.whatsappClient.destroy();
      this.log.info('WhatsApp Web client destroyed');
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createWhatsAppService(config: WhatsAppConfig): WhatsAppService {
  return new WhatsAppService(config);
}
