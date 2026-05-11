/**
 * SMS Service - SMS via Twilio
 * Handles all SMS operations including single sends, batch sends, and number validation
 */

import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';
import {
  ISMSService,
  SMSMessage,
  DeliveryResult,
  SMSConfig,
  ChannelType,
  MessageStatus,
  PhoneNumber
} from '../types';
import { SMSError, ProviderError, ValidationError } from '../utils/errors';
import { Validator } from '../utils/validation';
import { logger, LogContext } from '../utils/logger';

export class SMSService implements ISMSService {
  private config: SMSConfig;
  private log: LogContext;
  private client: twilio.Twilio | null = null;
  private isConfigured: boolean = false;

  constructor(config: SMSConfig) {
    this.config = config;
    this.log = new LogContext(logger, { service: 'SMSService' });

    this.initialize();
  }

  private initialize(): void {
    if (this.config.provider === 'mock' || !this.config.accountSid || !this.config.authToken) {
      this.log.warn('SMS service running in mock mode - no Twilio credentials configured');
      this.isConfigured = false;
      return;
    }

    if (this.config.provider === 'twilio' && this.config.accountSid && this.config.authToken) {
      this.client = twilio(this.config.accountSid, this.config.authToken);
      this.isConfigured = true;
      this.log.info('SMS service initialized with Twilio', {
        fromNumber: this.config.fromNumber
      });
    }
  }

  /**
   * Send a single SMS message
   */
  async send(message: SMSMessage): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    this.log.info('Sending SMS', {
      messageId,
      to: this.formatPhoneNumber(message.to),
      bodyLength: message.body.length
    });

    // Validate message
    const validation = Validator.validateSMSMessage(message);
    if (!validation.valid) {
      throw new ValidationError('Invalid SMS message', [{
        field: 'smsMessage',
        message: validation.error!
      }]);
    }

    try {
      if (!this.isConfigured) {
        return this.mockSend(message, messageId, startTime);
      }

      const to = this.formatPhoneNumber(message.to);
      const from = message.from
        ? this.formatPhoneNumber(message.from)
        : this.config.fromNumber!;

      const twilioMessage = await this.client!.messages.create({
        to,
        from,
        body: message.body,
        mediaUrl: message.mediaUrl ? [message.mediaUrl] : undefined
      });

      const deliveryResult: DeliveryResult = {
        messageId,
        channel: ChannelType.SMS,
        status: this.mapTwilioStatus(twilioMessage.status),
        timestamp: new Date(),
        providerMessageId: twilioMessage.sid,
        metadata: {
          latencyMs: Date.now() - startTime,
          price: twilioMessage.price,
          priceUnit: twilioMessage.priceUnit,
          numSegments: twilioMessage.numSegments
        }
      };

      this.log.info('SMS sent successfully', {
        messageId,
        providerMessageId: twilioMessage.sid,
        status: twilioMessage.status,
        latencyMs: Date.now() - startTime
      });

      return deliveryResult;
    } catch (error) {
      const err = error as Error;

      this.log.error('Failed to send SMS', error, { messageId, to: this.formatPhoneNumber(message.to) });

      if (err.message.includes('21211') || err.message.includes('21408')) {
        throw new SMSError(
          'Invalid phone number',
          'INVALID_PHONE_NUMBER',
          { retryable: false, details: { phoneNumber: this.formatPhoneNumber(message.to) } }
        );
      }

      if (err.message.includes('21614')) {
        throw new SMSError(
          'Not a mobile number',
          'NOT_MOBILE_NUMBER',
          { retryable: false }
        );
      }

      if (err.message.includes('20429')) {
        throw new ProviderError(
          'Twilio rate limit exceeded',
          'twilio',
          err,
          { retryable: true }
        );
      }

      throw new SMSError(err.message, 'SEND_FAILED', { retryable: true });
    }
  }

  /**
   * Send batch of SMS messages with concurrency control
   */
  async sendBatch(messages: SMSMessage[]): Promise<DeliveryResult[]> {
    const batchId = uuidv4();
    this.log.info('Starting batch SMS send', { batchId, count: messages.length });

    if (messages.length === 0) {
      return [];
    }

    // Validate all messages first
    const invalidMessages: { index: number; error: string }[] = [];
    messages.forEach((msg, index) => {
      const validation = Validator.validateSMSMessage(msg);
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

    // Process in chunks to respect rate limits
    const chunkSize = this.config.maxBatchSize || 50;
    const results: DeliveryResult[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      this.log.debug(`Processing SMS chunk ${Math.floor(i / chunkSize) + 1}`, {
        batchId,
        chunkStart: i,
        chunkSize: chunk.length
      });

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
            channel: ChannelType.SMS,
            status: MessageStatus.FAILED,
            timestamp: new Date(),
            error: result.reason.message
          });
          this.log.error('SMS batch item failed', result.reason, {
            batchId,
            messageIndex: i + index,
            to: this.formatPhoneNumber(msg.to)
          });
        }
      });

      // Rate limiting delay between chunks (Twilio limit is 1 msg/sec for some accounts)
      if (i + chunkSize < messages.length) {
        await this.delay(1000);
      }
    }

    const successCount = results.filter(r => r.status !== MessageStatus.FAILED).length;
    this.log.info('Batch SMS send completed', {
      batchId,
      total: messages.length,
      successful: successCount,
      failed: messages.length - successCount
    });

    return results;
  }

  /**
   * Validate phone number format and reachability
   */
  async validateNumber(phoneNumber: PhoneNumber): Promise<boolean> {
    if (!this.isConfigured) {
      // In mock mode, just validate format
      return this.isValidPhoneFormat(phoneNumber);
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const lookup = await this.client!.lookups.v2.phoneNumbers(formattedNumber).fetch({
        countryCode: phoneNumber.countryCode
      });

      return lookup.valid === true;
    } catch (error) {
      this.log.warn('Phone number validation failed', {
        number: this.formatPhoneNumber(phoneNumber),
        error: (error as Error).message
      });
      return false;
    }
  }

  /**
   * Get message status from Twilio
   */
  async getMessageStatus(providerMessageId: string): Promise<{ status: MessageStatus; timestamp?: Date }> {
    if (!this.isConfigured) {
      return { status: MessageStatus.SENT };
    }

    try {
      const message = await this.client!.messages(providerMessageId).fetch();
      return {
        status: this.mapTwilioStatus(message.status),
        timestamp: message.dateUpdated ? new Date(message.dateUpdated) : undefined
      };
    } catch (error) {
      throw new SMSError(
        `Failed to get message status: ${(error as Error).message}`,
        'STATUS_FETCH_FAILED'
      );
    }
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: PhoneNumber): string {
    const countryCode = phone.countryCode.startsWith('+')
      ? phone.countryCode
      : `+${phone.countryCode}`;
    const number = phone.number.startsWith('0')
      ? phone.number.substring(1)
      : phone.number;
    return `${countryCode}${number}`;
  }

  /**
   * Check if phone number format is valid
   */
  private isValidPhoneFormat(phone: PhoneNumber): boolean {
    const numberPattern = /^\+?[0-9]{7,15}$/;
    const fullNumber = `+${phone.countryCode}${phone.number}`;
    return numberPattern.test(fullNumber);
  }

  /**
   * Map Twilio status to our MessageStatus
   */
  private mapTwilioStatus(twilioStatus: string): MessageStatus {
    const statusMap: Record<string, MessageStatus> = {
      'queued': MessageStatus.QUEUED,
      'sent': MessageStatus.SENT,
      'delivered': MessageStatus.DELIVERED,
      'undelivered': MessageStatus.FAILED,
      'failed': MessageStatus.FAILED,
      'receiving': MessageStatus.PENDING,
      'received': MessageStatus.DELIVERED
    };

    return statusMap[twilioStatus.toLowerCase()] || MessageStatus.PENDING;
  }

  /**
   * Mock send for testing
   */
  private async mockSend(message: SMSMessage, messageId: string, startTime: number): Promise<DeliveryResult> {
    await this.delay(Math.random() * 300 + 50);

    this.log.info('Mock SMS sent (no Twilio configured)', {
      messageId,
      to: this.formatPhoneNumber(message.to),
      bodyLength: message.body.length
    });

    return {
      messageId,
      channel: ChannelType.SMS,
      status: MessageStatus.SENT,
      timestamp: new Date(),
      providerMessageId: `mock-${messageId}`,
      metadata: {
        latencyMs: Date.now() - startTime,
        mock: true,
        segments: Math.ceil(message.body.length / 160) || 1
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

    if (!this.isConfigured) {
      return { healthy: true, latency: 0, error: 'Running in mock mode' };
    }

    try {
      // Verify credentials by fetching account info
      await this.client!.api.accounts(this.config.accountSid!).fetch();
      return { healthy: true, latency: Date.now() - startTime };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: (error as Error).message
      };
    }
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createSMSService(config: SMSConfig): SMSService {
  return new SMSService(config);
}
