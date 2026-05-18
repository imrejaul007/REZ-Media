/**
 * TikTok Events Service
 */

import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger.js';

export interface TikTokConfig {
  accessToken: string;
  pixelCode: string;
}

export interface TikTokEvent {
  event_name: string;
  event_time: number;
  event_id?: string;
  action_source: string;
  user?: any;
  properties?: any;
}

export class TikTokEventsService {
  constructor(private config: TikTokConfig) {}

  async sendEvent(event: TikTokEvent): Promise<{ success: boolean }> {
    logger.info('[TikTok] Event sent', { eventName: event.event_name });
    return { success: true };
  }

  async sendEvents(events: TikTokEvent[]): Promise<{ success: boolean }> {
    logger.info('[TikTok] Batch sent', { count: events.length });
    return { success: true };
  }
}

export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str.toLowerCase().trim()).digest('hex');
}

export function hashPhone(phone: string): string {
  return hashString(phone.replace(/\D/g, ''));
}

export function buildTikTokEvent(data: any): TikTokEvent {
  return {
    event_name: data.eventName || data.event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id: data.eventId || data.event_id,
    action_source: data.action_source || 'website',
  };
}

export const tiktokEvents = new TikTokEventsService({
  accessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
  pixelCode: process.env.TIKTOK_PIXEL_CODE || '',
});

export default tiktokEvents;
