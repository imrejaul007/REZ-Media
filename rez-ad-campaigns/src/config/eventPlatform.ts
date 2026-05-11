/**
 * Event Platform Integration Config
 *
 * Configures how rez-ads-service connects to rez-event-platform
 * for emitting ad events (impression, click, conversion).
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

export interface EventPlatformConfig {
  url: string;
  enabled: boolean;
  timeout: number;
}

export const eventPlatformConfig: EventPlatformConfig = {
  url: process.env.EVENT_PLATFORM_URL || 'http://localhost:4008',
  enabled: process.env.EVENT_PLATFORM_ENABLED !== 'false',
  timeout: parseInt(process.env.EVENT_PLATFORM_TIMEOUT || '5000', 10),
};

/**
 * Forward event to event-platform
 * Non-blocking - won't fail the main operation if event-platform is unavailable
 */
export async function forwardToEventPlatform(
  eventType: string,
  payload: Record<string, any>
): Promise<{ success: boolean; eventId?: string }> {
  if (!eventPlatformConfig.enabled) {
    logger.debug('[EventPlatform] Disabled via config');
    return { success: false };
  }

  try {
    const response = await axios.post(
      `${eventPlatformConfig.url}/events/publish`,
      {
        id: uuidv4(),
        type: eventType,
        timestamp: new Date().toISOString(),
        source: 'rez-ads-service',
        payload,
      },
      {
        timeout: eventPlatformConfig.timeout,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    return {
      success: response.data.success !== false,
      eventId: response.data.eventId,
    };
  } catch (error: any) {
    logger.warn('[EventPlatform] Failed to forward event', {
      eventType,
      error: error.message,
      url: eventPlatformConfig.url,
    });
    return { success: false };
  }
}

/**
 * Emit ad.impression event
 */
export async function emitAdImpression(payload: {
  adId: string;
  campaignId: string;
  merchantId: string;
  userId?: string;
  placement?: string;
  deviceType?: string;
  platform?: string;
  location?: string;
  referrer?: string;
}): Promise<{ success: boolean; eventId?: string }> {
  return forwardToEventPlatform('ad.impression', payload);
}

/**
 * Emit ad.click event
 */
export async function emitAdClick(payload: {
  adId: string;
  campaignId: string;
  merchantId: string;
  userId?: string;
  placement?: string;
  deviceType?: string;
  platform?: string;
  location?: string;
  ctaClicked?: string;
}): Promise<{ success: boolean; eventId?: string }> {
  return forwardToEventPlatform('ad.click', payload);
}

/**
 * Emit conversion event
 */
export async function emitConversion(payload: {
  conversionId: string;
  campaignId: string;
  merchantId: string;
  userId?: string;
  orderId?: string;
  value: number;
  currency?: string;
  source?: string;
  channel?: string;
}): Promise<{ success: boolean; eventId?: string }> {
  return forwardToEventPlatform('conversion', payload);
}
