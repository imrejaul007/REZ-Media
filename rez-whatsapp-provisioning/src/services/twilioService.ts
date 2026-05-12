import { getTwilioClient, twilioConfig, webhookConfig, getWebhookUrl } from '../config/twilio.config';
import { logger } from '../utils/logger';
import { WebhookEventType } from '../types';
import crypto from 'crypto';

export interface TwilioWebhookSignature {
  signature: string;
  timestamp: string;
}

export interface OutboundMessagePayload {
  to: string;
  body: string;
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
  mediaUrl?: string[];
  contentVariables?: Record<string, string>;
}

export interface MessageResult {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  dateCreated: Date;
  errorCode?: number;
  errorMessage?: string;
}

class TwilioService {
  private client = getTwilioClient();

  async validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string | string[]>
  ): Promise<boolean> {
    try {
      const authToken = twilioConfig.authToken;
      const signatureWithAuthToken = crypto
        .createHmac('sha256', authToken)
        .update(new URL(url).pathname + Object.values(params).join(''))
        .digest('base64');

      const signatureBuffer = Buffer.from(signature, 'base64');
      const expectedBuffer = Buffer.from(signatureWithAuthToken, 'base64');

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      logger.error('Webhook signature validation failed', { error });
      return false;
    }
  }

  async sendWhatsAppMessage(payload: OutboundMessagePayload): Promise<MessageResult> {
    try {
      const messageParams: Record<string, unknown> = {
        body: payload.body,
        to: this.formatWhatsAppAddress(payload.to),
        from: payload.from
          ? this.formatWhatsAppAddress(payload.from)
          : this.formatWhatsAppAddress(twilioConfig.whatsappSandboxNumber),
        statusCallback: payload.statusCallback || getWebhookUrl(webhookConfig.statusPath),
      };

      if (payload.messagingServiceSid) {
        messageParams.messagingServiceSid = payload.messagingServiceSid;
      }

      if (payload.mediaUrl && payload.mediaUrl.length > 0) {
        messageParams.mediaUrl = payload.mediaUrl;
      }

      if (payload.contentVariables) {
        messageParams.contentVariables = JSON.stringify(payload.contentVariables);
      }

      const message = await this.client.messages.create(messageParams);

      logger.info('WhatsApp message sent', {
        messageSid: message.sid,
        to: payload.to,
        status: message.status,
      });

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: new Date(message.dateCreated),
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp message', {
        error: errorMessage,
        to: payload.to,
      });
      throw error;
    }
  }

  async sendBulkMessages(
    messages: OutboundMessagePayload[]
  ): Promise<{ successful: MessageResult[]; failed: { payload: OutboundMessagePayload; error: string }[] }> {
    const successful: MessageResult[] = [];
    const failed: { payload: OutboundMessagePayload; error: string }[] = [];

    for (const payload of messages) {
      try {
        const result = await this.sendWhatsAppMessage(payload);
        successful.push(result);
      } catch (error) {
        failed.push({
          payload,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }

  async getMessage(messageSid: string): Promise<MessageResult | null> {
    try {
      const message = await this.client.messages(messageSid).fetch();

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: new Date(message.dateCreated),
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      if ((error as any)?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listMessages(
    filters: {
      to?: string;
      from?: string;
      dateSentAfter?: Date;
      dateSentBefore?: Date;
      limit?: number;
    } = {}
  ): Promise<MessageResult[]> {
    const params: Record<string, unknown> = {};

    if (filters.to) params.to = filters.to;
    if (filters.from) params.from = filters.from;
    if (filters.dateSentAfter) params.dateSentAfter = filters.dateSentAfter;
    if (filters.dateSentBefore) params.dateSentBefore = filters.dateSentBefore;
    params.limit = filters.limit || 100;

    const messages = await this.client.messages.list(params);

    return messages.map(msg => ({
      sid: msg.sid,
      status: msg.status,
      to: msg.to,
      from: msg.from,
      body: msg.body,
      dateCreated: new Date(msg.dateCreated),
      errorCode: msg.errorCode,
      errorMessage: msg.errorMessage,
    }));
  }

  async addNumberToSandbox(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.client.conversations.v1.conversations(
        'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
      ).participants.create({
        messagingBinding: {
          type: 'sandbox',
          address: phoneNumber,
        },
      });

      logger.info('Number added to WhatsApp sandbox', { phoneNumber });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add number to sandbox', {
        error: errorMessage,
        phoneNumber,
      });
      return { success: false, message: errorMessage };
    }
  }

  async removeNumberFromSandbox(phoneNumber: string): Promise<{ success: boolean; message?: string }> {
    try {
      const conversationSid = 'CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      const participants = await this.client.conversations
        .v1.conversations(conversationSid)
        .participants.list();

      const participant = participants.find(
        p => p.messagingBinding?.address === phoneNumber
      );

      if (participant) {
        await this.client.conversations
          .v1.conversations(conversationSid)
          .participants(participant.sid)
          .remove();
      }

      logger.info('Number removed from WhatsApp sandbox', { phoneNumber });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to remove number from sandbox', {
        error: errorMessage,
        phoneNumber,
      });
      return { success: false, message: errorMessage };
    }
  }

  async getAccountUsage(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalMessages: number;
    totalCalls: number;
    totalSms: number;
    totalMms: number;
  }> {
    try {
      const records = await this.client.usage.records.list({
        startDate,
        endDate,
      });

      let totalMessages = 0;
      let totalCalls = 0;
      let totalSms = 0;
      let totalMms = 0;

      for (const record of records) {
        switch (record.usageCategory) {
          case 'totalphonecalls':
          case 'inboundphonecalls':
          case 'outboundphonecalls':
            totalCalls += parseInt(String(record.usage), 10);
            break;
          case 'smsinbound':
          case 'smsoutbound':
          case 'sms':
            totalSms += parseInt(String(record.usage), 10);
            break;
          case 'mmsinbound':
          case 'mmsoutbound':
          case 'mms':
            totalMms += parseInt(String(record.usage), 10);
            break;
        }
        totalMessages += parseInt(String(record.usage), 10);
      }

      return { totalMessages, totalCalls, totalSms, totalMms };
    } catch (error) {
      logger.error('Failed to get account usage', { error });
      throw error;
    }
  }

  private formatWhatsAppAddress(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('whatsapp:')) {
      return cleaned;
    }
    if (cleaned.startsWith('+')) {
      return `whatsapp:${cleaned}`;
    }
    return `whatsapp:+${cleaned}`;
  }

  async getAvailablePhoneNumbers(
    countryCode: string,
    options: {
      type?: 'local' | 'mobile' | 'toll_free';
      areaCode?: string;
      contains?: string;
      pageSize?: number;
    } = {}
  ): Promise<
    Array<{
      phoneNumber: string;
      friendlyName: string;
      lata?: string;
      rateCenter?: string;
      latitude?: number;
      longitude?: number;
      region?: string;
    }>
  > {
    try {
      const params: Record<string, unknown> = {
        countryCode,
        pageSize: options.pageSize || 20,
      };

      if (options.type) params.type = options.type;
      if (options.areaCode) params.areaCode = options.areaCode;
      if (options.contains) params.contains = options.contains;

      let availableNumbers;

      if (options.type === 'toll_free' || countryCode === 'US') {
        availableNumbers = await this.client.availablePhoneNumbers(countryCode).tollFree.list(params);
      } else {
        availableNumbers = await this.client.availablePhoneNumbers(countryCode).local.list(params);
      }

      return availableNumbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        lata: num.lata,
        rateCenter: num.rateCenter,
        latitude: num.latitude,
        longitude: num.longitude,
        region: num.region,
      }));
    } catch (error) {
      logger.error('Failed to get available phone numbers', {
        countryCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const twilioService = new TwilioService();
export default twilioService;
