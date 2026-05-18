/**
 * Meta Conversions API Service
 */

import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';

interface Config {
  accessToken: string;
  pixelId: string;
  apiUrl?: string;
  testMode?: boolean;
}

export function hashData(data: string): string {
  if (!data) return '';
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim();
}

export class MetaCAPIService {
  private client: AxiosInstance;
  private pixelId: string;
  private testMode: boolean;
  private accessToken: string;

  constructor(config: Config) {
    this.pixelId = config.pixelId;
    this.accessToken = config.accessToken;
    this.testMode = config.testMode ?? false;

    this.client = axios.create({
      baseURL: config.apiUrl || 'https://graph.facebook.com/v18.0',
      timeout: 30000,
    });
  }

  async sendEvent(event: any): Promise<any> {
    return this.sendEvents([event]);
  }

  async sendEvents(events: any[]): Promise<any> {
    if (events.length === 0) {
      return { success: true, events_received: 0 };
    }

    const batch = this.prepareBatch(events);

    try {
      const response = await this.client.post(
        `/${this.pixelId}/events`,
        batch,
        {
          params: { access_token: this.accessToken },
        headers: { 'Content-Type': 'application/json' },
      }
      );

      logger.info('[Meta CAPI] Events sent', { count: events.length });
      return response.data;
    } catch (error: any) {
      logger.error('[Meta CAPI] Failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  private prepareBatch(events: any[]): any {
    return {
      data: events.map(e => this.normalizeEvent(e)),
      ...(this.testMode && { test_event_code: 'TEST12345' }),
    };
  }

  private normalizeEvent(event: any): any {
    const userData: any = {};

    if (event.email) userData.em = hashData(event.email);
    if (event.phone) userData.ph = hashData(normalizePhone(event.phone));
    if (event.firstName) userData.fn = hashData(normalizeName(event.firstName));
    if (event.lastName) userData.ln = hashData(normalizeName(event.lastName));

    return {
      event_name: event.eventName,
      event_id: event.eventId,
      event_time: event.timestamp || Math.floor(Date.now() / 1000),
      user_data: userData,
      custom_data: {
        value: event.value,
        currency: event.currency || 'INR',
        content_ids: event.contentIds,
        contents: event.contents,
        order_id: event.orderId,
      },
      action_source: event.actionSource || 'website',
    };
  }
}

export function buildCAPIEvent(data: any): any {
  return {
    event_name: data.eventName,
    event_id: data.eventId,
    event_time: data.timestamp || Math.floor(Date.now() / 1000),
    user_data: {
      em: data.email ? hashData(data.email) : undefined,
      ph: data.phone ? hashData(normalizePhone(data.phone)) : undefined,
      fn: data.firstName ? hashData(normalizeName(data.firstName)) : undefined,
      ln: data.lastName ? hashData(normalizeName(data.lastName)) : undefined,
    },
    custom_data: {
      value: data.value,
      currency: data.currency || 'INR',
      content_ids: data.contentIds,
      contents: data.contents,
      order_id: data.orderId,
    },
    action_source: data.actionSource || 'website',
  };
}

export default new MetaCAPIService({
  accessToken: process.env.META_ACCESS_TOKEN || '',
  pixelId: process.env.META_PIXEL_ID || '',
  testMode: process.env.NODE_ENV !== 'production',
});
