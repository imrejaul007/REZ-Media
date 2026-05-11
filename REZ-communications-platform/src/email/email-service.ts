/**
 * Email Service - Transactional Email via SendGrid
 * Handles all email operations including single sends, batch sends, and tracking
 */

import sgMail from '@sendgrid/mail';
import { v4 as uuidv4 } from 'uuid';
import {
  IEmailService,
  EmailMessage,
  DeliveryResult,
  EmailConfig,
  ChannelType,
  MessageStatus,
  EmailAddress
} from '../types';
import { EmailError, ProviderError, ValidationError } from '../utils/errors';
import { Validator } from '../utils/validation';
import { logger, LogContext } from '../utils/logger';
import { TemplateEngine } from '../templates/template-engine';

export class EmailService implements IEmailService {
  private config: EmailConfig;
  private log: LogContext;
  private templateEngine: TemplateEngine;
  private isConfigured: boolean = false;

  constructor(config: EmailConfig) {
    this.config = config;
    this.log = new LogContext(logger, { service: 'EmailService' });
    this.templateEngine = new TemplateEngine();

    this.initialize();
  }

  private initialize(): void {
    if (this.config.provider === 'mock' || !this.config.apiKey) {
      this.log.warn('Email service running in mock mode - no API key configured');
      this.isConfigured = false;
      return;
    }

    if (this.config.provider === 'sendgrid' && this.config.apiKey) {
      sgMail.setApiKey(this.config.apiKey);
      this.isConfigured = true;
      this.log.info('Email service initialized with SendGrid', {
        trackingEnabled: this.config.trackingEnabled
      });
    }
  }

  /**
   * Send a single email message
   */
  async send(message: EmailMessage): Promise<DeliveryResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    this.log.info('Sending email', { messageId, to: message.to.email, subject: message.subject });

    // Validate message
    const validation = Validator.validateEmailMessage(message);
    if (!validation.valid) {
      throw new ValidationError('Invalid email message', [{
        field: 'emailMessage',
        message: validation.error!
      }]);
    }

    try {
      if (!this.isConfigured) {
        return this.mockSend(message, messageId, startTime);
      }

      const msg = this.buildSendGridMessage(message, messageId);

      if (this.config.trackingEnabled) {
        msg.openTracking = this.config.openTracking ?? false;
        msg.clickTracking = this.config.clickTracking ?? false;
      }

      const [response] = await sgMail.send(msg);

      const deliveryResult: DeliveryResult = {
        messageId,
        channel: ChannelType.EMAIL,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        providerMessageId: response.headers['x-message-id'] as string,
        metadata: {
          latencyMs: Date.now() - startTime,
          statusCode: response.statusCode
        }
      };

      this.log.info('Email sent successfully', {
        messageId,
        providerMessageId: deliveryResult.providerMessageId,
        latencyMs: Date.now() - startTime
      });

      return deliveryResult;
    } catch (error) {
      const err = error as Error;
      this.log.error('Failed to send email', error, { messageId, to: message.to.email });

      if (err.message.includes('429')) {
        throw new ProviderError(
          'SendGrid rate limit exceeded',
          'sendgrid',
          err,
          { retryable: true }
        );
      }

      if (err.message.includes('401') || err.message.includes('403')) {
        throw new ProviderError(
          'SendGrid authentication failed',
          'sendgrid',
          err,
          { retryable: false }
        );
      }

      throw new EmailError(err.message, 'SEND_FAILED', { retryable: true });
    }
  }

  /**
   * Send batch of emails with concurrency control
   */
  async sendBatch(messages: EmailMessage[]): Promise<DeliveryResult[]> {
    const batchId = uuidv4();
    this.log.info('Starting batch email send', { batchId, count: messages.length });

    if (messages.length === 0) {
      return [];
    }

    // Validate all messages first
    const invalidMessages: { index: number; error: string }[] = [];
    messages.forEach((msg, index) => {
      const validation = Validator.validateEmailMessage(msg);
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
    const chunkSize = 100;
    const results: DeliveryResult[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      this.log.debug(`Processing chunk ${Math.floor(i / chunkSize) + 1}`, {
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
            channel: ChannelType.EMAIL,
            status: MessageStatus.FAILED,
            timestamp: new Date(),
            error: result.reason.message
          });
          this.log.error('Batch item failed', result.reason, {
            batchId,
            messageIndex: i + index,
            to: msg.to.email
          });
        }
      });

      // Rate limiting delay between chunks
      if (i + chunkSize < messages.length) {
        await this.delay(1000);
      }
    }

    const successCount = results.filter(r => r.status !== MessageStatus.FAILED).length;
    this.log.info('Batch email send completed', {
      batchId,
      total: messages.length,
      successful: successCount,
      failed: messages.length - successCount
    });

    return results;
  }

  /**
   * Get the template engine instance
   */
  getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * Build SendGrid message object
   */
  private buildSendGridMessage(message: EmailMessage, messageId: string): sgMail.MailDataRequired {
    const msg: sgMail.MailDataRequired = {
      to: this.formatAddress(message.to),
      from: this.formatAddress(message.from || { email: this.config.fromEmail, name: this.config.fromName }),
      replyTo: this.config.replyTo ? this.formatAddress({ email: this.config.replyTo }) : undefined,
      subject: message.subject,
      text: message.body,
      html: message.html || message.body.replace(/\n/g, '<br>'),
      customArgs: { messageId },
      headers: message.headers
    };

    if (message.attachments && message.attachments.length > 0) {
      msg.attachments = message.attachments.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content)
          ? att.content.toString('base64')
          : Buffer.from(att.content).toString('base64'),
        type: att.contentType,
        disposition: 'attachment'
      }));
    }

    if (this.config.cc && this.config.cc.length > 0) {
      msg.cc = this.config.cc.map(email => this.formatAddress({ email }));
    }

    if (this.config.bcc && this.config.bcc.length > 0) {
      msg.bcc = this.config.bcc.map(email => this.formatAddress({ email }));
    }

    return msg;
  }

  /**
   * Format email address for SendGrid
   */
  private formatAddress(address: EmailAddress): string {
    return address.name ? `"${address.name}" <${address.email}>` : address.email;
  }

  /**
   * Mock send for testing without API credentials
   */
  private async mockSend(message: EmailMessage, messageId: string, startTime: number): Promise<DeliveryResult> {
    // Simulate network latency
    await this.delay(Math.random() * 500 + 100);

    this.log.info('Mock email sent (no API configured)', {
      messageId,
      to: message.to.email,
      subject: message.subject
    });

    return {
      messageId,
      channel: ChannelType.EMAIL,
      status: MessageStatus.SENT,
      timestamp: new Date(),
      providerMessageId: `mock-${messageId}`,
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

    if (!this.isConfigured) {
      return { healthy: true, latency: 0, error: 'Running in mock mode' };
    }

    try {
      // Simple API check by sending a test
      await sgMail.send({
        to: 'healthcheck@localhost',
        from: this.config.fromEmail,
        subject: 'Health Check',
        text: 'Health check'
      });
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

export function createEmailService(config: EmailConfig): EmailService {
  return new EmailService(config);
}
