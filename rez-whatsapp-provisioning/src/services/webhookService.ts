import { twilioService } from './twilioService';
import templateService from './templateService';
import { logger } from '../utils/logger';
import { WebhookEventType, MessageStatus } from '../types';

export interface InboundMessagePayload {
  accountSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: string;
  mediaContentType0?: string;
  mediaUrl0?: string;
  messageSid: string;
  messageTimestamp: string;
  profileName?: string;
}

export interface MessageStatusPayload {
  accountSid: string;
  messageSid: string;
  messageStatus: string;
  to: string;
  from: string;
  errorCode?: number;
  errorMessage?: string;
  price?: string;
  priceUnit?: string;
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: Date;
  accountSid: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

class WebhookService {
  private eventStore: Map<string, WebhookEvent> = new Map();
  private readonly DEDUP_WINDOW_MS = 5 * 60 * 1000;

  async validateAndProcessWebhook(
    signature: string,
    url: string,
    params: Record<string, string | string[]>
  ): Promise<boolean> {
    return twilioService.validateWebhookSignature(signature, url, params);
  }

  async processInboundMessage(
    payload: InboundMessagePayload
  ): Promise<{
    eventId: string;
    shouldForward: boolean;
    response?: string;
  }> {
    const eventId = this.generateEventId();

    try {
      const isDuplicate = await this.checkDuplicate(eventId);
      if (isDuplicate) {
        logger.warn('Duplicate inbound message detected', {
          eventId,
          messageSid: payload.messageSid,
        });
        return { eventId, shouldForward: false };
      }

      const event: WebhookEvent = {
        id: eventId,
        type: WebhookEventType.INBOUND_MESSAGE,
        timestamp: new Date(),
        accountSid: payload.accountSid,
        payload: payload as unknown as Record<string, unknown>,
        processed: false,
      };

      this.eventStore.set(eventId, event);

      logger.info('Processing inbound WhatsApp message', {
        eventId,
        from: payload.from,
        to: payload.to,
        messageSid: payload.messageSid,
      });

      const response = await this.handleInboundMessage(payload);

      event.processed = true;
      event.processedAt = new Date();
      this.eventStore.set(eventId, event);

      this.scheduleCleanup(eventId);

      return {
        eventId,
        shouldForward: true,
        response,
      };
    } catch (error) {
      logger.error('Failed to process inbound message', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const event = this.eventStore.get(eventId);
      if (event) {
        event.error = error instanceof Error ? error.message : 'Unknown error';
        this.eventStore.set(eventId, event);
      }

      throw error;
    }
  }

  async processMessageStatusUpdate(
    payload: MessageStatusPayload
  ): Promise<{
    eventId: string;
    status: MessageStatus;
  }> {
    const eventId = this.generateEventId();

    try {
      const isDuplicate = await this.checkDuplicate(eventId);
      if (isDuplicate) {
        logger.warn('Duplicate message status update detected', {
          eventId,
          messageSid: payload.messageSid,
        });
        return { eventId, status: this.mapStatus(payload.messageStatus) };
      }

      const event: WebhookEvent = {
        id: eventId,
        type: WebhookEventType.MESSAGE_STATUS,
        timestamp: new Date(),
        accountSid: payload.accountSid,
        payload: payload as unknown as Record<string, unknown>,
        processed: false,
      };

      this.eventStore.set(eventId, event);

      logger.info('Processing message status update', {
        eventId,
        messageSid: payload.messageSid,
        status: payload.messageStatus,
        errorCode: payload.errorCode,
      });

      await this.handleMessageStatusUpdate(payload);

      event.processed = true;
      event.processedAt = new Date();
      this.eventStore.set(eventId, event);

      this.scheduleCleanup(eventId);

      return {
        eventId,
        status: this.mapStatus(payload.messageStatus),
      };
    } catch (error) {
      logger.error('Failed to process message status update', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const event = this.eventStore.get(eventId);
      if (event) {
        event.error = error instanceof Error ? error.message : 'Unknown error';
        this.eventStore.set(eventId, event);
      }

      throw error;
    }
  }

  async processTemplateStatusUpdate(
    payload: {
      accountSid: string;
      templateSid: string;
      templateStatus: string;
      rejectionReason?: string;
    }
  ): Promise<{
    eventId: string;
  }> {
    const eventId = this.generateEventId();

    try {
      const event: WebhookEvent = {
        id: eventId,
        type: WebhookEventType.TEMPLATE_STATUS,
        timestamp: new Date(),
        accountSid: payload.accountSid,
        payload: payload as unknown as Record<string, unknown>,
        processed: false,
      };

      this.eventStore.set(eventId, event);

      logger.info('Processing template status update', {
        eventId,
        templateSid: payload.templateSid,
        status: payload.templateStatus,
      });

      await templateService.handleTemplateStatusUpdate(
        payload.templateSid,
        payload.templateStatus,
        payload.rejectionReason
      );

      event.processed = true;
      event.processedAt = new Date();
      this.eventStore.set(eventId, event);

      this.scheduleCleanup(eventId);

      return { eventId };
    } catch (error) {
      logger.error('Failed to process template status update', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async processOutboundWebhook(
    payload: Record<string, unknown>
  ): Promise<{
    eventId: string;
  }> {
    const eventId = this.generateEventId();

    try {
      const event: WebhookEvent = {
        id: eventId,
        type: WebhookEventType.OUTBOUND_MESSAGE,
        timestamp: new Date(),
        accountSid: payload.AccountSid as string || '',
        payload,
        processed: false,
      };

      this.eventStore.set(eventId, event);

      logger.info('Processing outbound webhook', {
        eventId,
        eventType: payload.EventType,
      });

      const eventType = payload.EventType as string;

      switch (eventType) {
        case 'message-delivered':
        case 'message-sent':
        case 'message-read':
        case 'message-failed':
          await this.handleMessageStatusUpdate({
            accountSid: payload.AccountSid as string,
            messageSid: payload.MessageSid as string,
            messageStatus: this.mapEventTypeToStatus(eventType),
            to: payload.To as string,
            from: payload.From as string,
            errorCode: payload.ErrorCode as number,
            errorMessage: payload.ErrorMessage as string,
          });
          break;

        default:
          logger.debug('Unhandled outbound event type', { eventType });
      }

      event.processed = true;
      event.processedAt = new Date();
      this.eventStore.set(eventId, event);

      this.scheduleCleanup(eventId);

      return { eventId };
    } catch (error) {
      logger.error('Failed to process outbound webhook', {
        eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async handleInboundMessage(
    payload: InboundMessagePayload
  ): Promise<string | undefined> {
    const lowerBody = payload.body?.toLowerCase().trim();

    if (lowerBody === 'help') {
      return this.buildHelpResponse();
    }

    if (lowerBody === 'stop') {
      return 'You have been unsubscribed from messages.';
    }

    if (lowerBody?.startsWith('verify ')) {
      return this.buildVerificationResponse(payload.body);
    }

    return undefined;
  }

  private async handleMessageStatusUpdate(
    payload: MessageStatusPayload
  ): Promise<void> {
    const status = this.mapStatus(payload.messageStatus);

    logger.info('Message status recorded', {
      messageSid: payload.messageSid,
      status,
      errorCode: payload.errorCode,
    });

    if (status === MessageStatus.FAILED && payload.errorCode) {
      logger.error('Message delivery failed', {
        messageSid: payload.messageSid,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
      });
    }
  }

  private buildHelpResponse(): string {
    return `Welcome to ReZ WhatsApp Support!

Available commands:
- HELP: Show this message
- STOP: Unsubscribe
- For assistance, contact support@rez.com`;
  }

  private buildVerificationResponse(body: string): string {
    const code = body.replace('verify ', '').trim();
    return `Your verification code is: ${code}. Do not share this code with anyone.`;
  }

  private async checkDuplicate(eventId: string): Promise<boolean> {
    const event = this.eventStore.get(eventId);
    if (event) {
      const timeDiff = Date.now() - event.timestamp.getTime();
      return timeDiff < this.DEDUP_WINDOW_MS;
    }
    return false;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapStatus(status: string): MessageStatus {
    const mapping: Record<string, MessageStatus> = {
      queued: MessageStatus.QUEUED,
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
      undelivered: MessageStatus.UNDELIVERED,
      accepted: MessageStatus.SENT,
      receiving: MessageStatus.QUEUED,
    };

    return mapping[status.toLowerCase()] || MessageStatus.QUEUED;
  }

  private mapEventTypeToStatus(eventType: string): string {
    const mapping: Record<string, string> = {
      'message-sent': 'sent',
      'message-delivered': 'delivered',
      'message-read': 'read',
      'message-failed': 'failed',
    };

    return mapping[eventType] || 'unknown';
  }

  private scheduleCleanup(eventId: string): void {
    setTimeout(() => {
      this.eventStore.delete(eventId);
    }, this.DEDUP_WINDOW_MS);
  }

  getEventHistory(limit: number = 100): WebhookEvent[] {
    const events = Array.from(this.eventStore.values());
    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getEvent(eventId: string): WebhookEvent | undefined {
    return this.eventStore.get(eventId);
  }
}

export const webhookService = new WebhookService();
export default webhookService;
