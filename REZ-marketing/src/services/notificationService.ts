/**
 * Notification Service Client — REZ Marketing Service
 *
 * Provides typed methods for sending notification events to the
 * REZ Notification Service (rez-notification-events).
 *
 * Uses internal service token authentication via x-internal-service header.
 */

import { logger } from '../config/logger';

// ── Configuration ─────────────────────────────────────────────────────────────

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3001';

interface InternalTokens {
  [serviceName: string]: string;
}

function getInternalTokens(): InternalTokens {
  try {
    const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore parse errors
  }
  const legacy = process.env.INTERNAL_SERVICE_TOKEN;
  if (legacy) return { 'rez-notification-events': legacy };
  return {};
}

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';

export interface NotificationEvent {
  eventId: string;
  eventType: string;
  userId?: string;
  userIds?: string[];        // For bulk/broadcast notifications
  channels: NotificationChannel[];
  payload: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    channelId?: string;
    priority?: string;
    emailSubject?: string;
    emailHtml?: string;
    emailTemplateId?: string;
    emailTemplateData?: Record<string, unknown>;
    smsMessage?: string;
    whatsappTemplateId?: string;
    whatsappTemplateVars?: string[];
  };
  category?: string;
  source?: string;
  createdAt: string;
}

export interface CampaignNotificationPayload {
  campaignId: string;
  campaignName: string;
  merchantId: string;
  channel: NotificationChannel;
  message: string;
  audienceType: string;
  audienceCount: number;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;
  targetUserIds?: string[];
}

export interface VoucherNotificationPayload {
  voucherId: string;
  voucherCode: string;
  voucherType: string;
  voucherValue: number;
  merchantId: string;
  recipientUserId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  validUntil: string;
}

export interface BroadcastNotificationPayload {
  broadcastId: string;
  merchantId: string;
  title: string;
  message: string;
  audienceSegment?: string;
  targetUserIds: string[];
  channel: NotificationChannel;
  scheduledAt?: string;
}

// ── API Client ───────────────────────────────────────────────────────────────

/**
 * Send a campaign notification to the notification service.
 * Used when a marketing campaign is created or launched.
 */
export async function sendCampaignNotification(
  payload: CampaignNotificationPayload,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  const eventId = `campaign-${payload.campaignId}-${Date.now()}`;

  const event: NotificationEvent = {
    eventId,
    eventType: 'marketing_campaign',
    channels: [payload.channel],
    payload: {
      title: payload.campaignName,
      body: payload.message,
      channelId: 'marketing',
      priority: 'default',
      data: {
        campaignId: payload.campaignId,
        merchantId: payload.merchantId,
        audienceType: payload.audienceType,
        audienceCount: payload.audienceCount,
        imageUrl: payload.imageUrl,
        ctaUrl: payload.ctaUrl,
        ctaText: payload.ctaText,
        targetUserIds: payload.targetUserIds,
      },
    },
    category: 'marketing',
    source: 'rez-marketing-service',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Campaign notification failed', {
        status: response.status,
        error: errorText,
        campaignId: payload.campaignId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    logger.info('[NotificationClient] Campaign notification sent', {
      campaignId: payload.campaignId,
      eventId,
    });
    return { success: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Campaign notification error', {
      campaignId: payload.campaignId,
      error: message,
    });
    return { success: false, error: message };
  }
}

/**
 * Send a voucher notification to the notification service.
 * Used when a voucher is generated and needs to be delivered to a user via SMS/Email.
 */
export async function sendVoucherNotification(
  payload: VoucherNotificationPayload,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  const eventId = `voucher-${payload.voucherId}-${Date.now()}`;

  // Determine preferred channel based on available contact info
  const channels: NotificationChannel[] = [];
  if (payload.recipientEmail) channels.push('email');
  if (payload.recipientPhone) channels.push('sms');
  if (channels.length === 0) {
    logger.warn('[NotificationClient] No contact info for voucher notification', {
      voucherId: payload.voucherId,
    });
    return { success: false, error: 'No recipient contact info (email or phone) provided' };
  }

  const voucherTypeLabel = payload.voucherType === 'percentage'
    ? `${payload.voucherValue}% off`
    : payload.voucherType === 'fixed'
    ? `Rs. ${payload.voucherValue} off`
    : `${payload.voucherType} offer`;

  const event: NotificationEvent = {
    eventId,
    eventType: 'marketing_voucher',
    userId: payload.recipientUserId,
    channels,
    payload: {
      title: 'Your REZ Voucher',
      body: `Use code ${payload.voucherCode} for ${voucherTypeLabel}! Valid until ${new Date(payload.validUntil).toLocaleDateString()}.`,
      channelId: 'vouchers',
      priority: 'default',
      smsMessage: `REZ: Your voucher code is ${payload.voucherCode}. ${voucherTypeLabel}. Valid till ${new Date(payload.validUntil).toLocaleDateString()}. T&C apply.`,
      emailSubject: `Your REZ Voucher: ${payload.voucherCode}`,
      emailHtml: generateVoucherEmailHtml(payload),
      data: {
        voucherId: payload.voucherId,
        voucherCode: payload.voucherCode,
        voucherType: payload.voucherType,
        voucherValue: payload.voucherValue,
        merchantId: payload.merchantId,
        validUntil: payload.validUntil,
        email: payload.recipientEmail,
        phone: payload.recipientPhone,
      },
    },
    category: 'marketing',
    source: 'rez-marketing-service',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/voucher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Voucher notification failed', {
        status: response.status,
        error: errorText,
        voucherId: payload.voucherId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    logger.info('[NotificationClient] Voucher notification sent', {
      voucherId: payload.voucherId,
      voucherCode: payload.voucherCode,
      eventId,
    });
    return { success: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Voucher notification error', {
      voucherId: payload.voucherId,
      error: message,
    });
    return { success: false, error: message };
  }
}

/**
 * Send a broadcast notification to the notification service.
 * Used for sending marketing messages to audience segments.
 */
export async function sendBroadcastNotification(
  payload: BroadcastNotificationPayload,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  const eventId = `broadcast-${payload.broadcastId}-${Date.now()}`;

  if (!payload.targetUserIds || payload.targetUserIds.length === 0) {
    logger.warn('[NotificationClient] No target users for broadcast notification', {
      broadcastId: payload.broadcastId,
    });
    return { success: false, error: 'No target users provided' };
  }

  const event: NotificationEvent = {
    eventId,
    eventType: 'marketing_broadcast',
    userIds: payload.targetUserIds,
    channels: [payload.channel],
    payload: {
      title: payload.title,
      body: payload.message,
      channelId: 'broadcast',
      priority: 'default',
      data: {
        broadcastId: payload.broadcastId,
        merchantId: payload.merchantId,
        audienceSegment: payload.audienceSegment,
        targetUserCount: payload.targetUserIds.length,
        scheduledAt: payload.scheduledAt,
      },
    },
    category: 'marketing',
    source: 'rez-marketing-service',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Broadcast notification failed', {
        status: response.status,
        error: errorText,
        broadcastId: payload.broadcastId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    logger.info('[NotificationClient] Broadcast notification sent', {
      broadcastId: payload.broadcastId,
      targetUserCount: payload.targetUserIds.length,
      eventId,
    });
    return { success: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Broadcast notification error', {
      broadcastId: payload.broadcastId,
      error: message,
    });
    return { success: false, error: message };
  }
}

/**
 * Sync notification preferences for an audience segment.
 * Called when audience segment is updated.
 */
export async function syncAudiencePreferences(
  merchantId: string,
  segmentId: string,
  userIds: string[],
): Promise<{ success: boolean; synced?: number; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/audience/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify({
        merchantId,
        segmentId,
        userIds,
        syncedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Audience sync failed', {
        status: response.status,
        error: errorText,
        segmentId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = (await response.json()) as { synced?: number };
    logger.info('[NotificationClient] Audience preferences synced', {
      segmentId,
      syncedCount: result.synced,
    });
    return { success: true, synced: result.synced };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Audience sync error', {
      segmentId,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRendezEmailHtml(payload: RendezNotificationPayload): string {
  const categoryColors = {
    couple: '#e91e63',    // Pink
    group: '#9c27b0',     // Purple
    context: '#673ab7',   // Deep Purple
  };
  const color = categoryColors[payload.offerCategory] || '#667eea';

  const categoryLabels = {
    couple: 'Couple Experience',
    group: 'Group Deal',
    context: 'Special Offer',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${payload.offerTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${categoryLabels[payload.offerCategory]}</h1>
    </div>
    <div style="padding: 32px; text-align: center;">
      <h2 style="font-size: 22px; color: #212529; margin: 0 0 16px;">${payload.offerTitle}</h2>
      <p style="color: #6c757d; font-size: 14px; margin: 0 0 24px;">Valid until ${new Date(payload.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <a href="https://rez.money/rendez/${payload.offerId}" style="display: inline-block; background: ${color}; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">View Offer</a>
    </div>
    <div style="padding: 16px 32px; background: #f8f9fa; text-align: center;">
      <p style="margin: 0; color: #6c757d; font-size: 12px;">Powered by REZ Money</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateVoucherEmailHtml(payload: VoucherNotificationPayload): string {
  const voucherTypeLabel = payload.voucherType === 'percentage'
    ? `${payload.voucherValue}% OFF`
    : payload.voucherType === 'fixed'
    ? `Rs. ${payload.voucherValue} OFF`
    : payload.voucherType.toUpperCase();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your REZ Voucher</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Your Voucher is Ready!</h1>
    </div>
    <div style="padding: 32px; text-align: center;">
      <div style="background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; color: #6c757d; font-size: 14px;">Use this code at checkout</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #212529; letter-spacing: 4px;">${payload.voucherCode}</p>
      </div>
      <p style="font-size: 18px; color: #212529; margin: 0 0 8px;">Get <strong>${voucherTypeLabel}</strong></p>
      <p style="color: #6c757d; font-size: 14px; margin: 0 0 24px;">Valid until ${new Date(payload.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <a href="https://rez.money" style="display: inline-block; background: #667eea; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">Shop Now</a>
    </div>
    <div style="padding: 16px 32px; background: #f8f9fa; text-align: center;">
      <p style="margin: 0; color: #6c757d; font-size: 12px;">Powered by REZ Money</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ── Rendez Offer Notification ─────────────────────────────────────────────────

export interface RendezNotificationPayload {
  offerId: string;
  offerTitle: string;
  offerCategory: 'couple' | 'group' | 'context';
  merchantId: string;
  recipientUserId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  validUntil: string;
}

/**
 * Send a rendez offer notification to the notification service.
 * Used when a rendez offer is created and needs to be delivered to users.
 */
export async function sendRendezNotification(
  payload: RendezNotificationPayload,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  const eventId = `rendez-${payload.offerId}-${Date.now()}`;

  // Determine preferred channel based on available contact info
  const channels: NotificationChannel[] = [];
  if (payload.recipientEmail) channels.push('email');
  if (payload.recipientPhone) channels.push('sms');
  if (channels.length === 0) {
    logger.warn('[NotificationClient] No contact info for rendez notification', {
      offerId: payload.offerId,
    });
    return { success: false, error: 'No recipient contact info (email or phone) provided' };
  }

  const categoryLabel = {
    couple: 'Couple Experience',
    group: 'Group Deal',
    context: 'Special Offer',
  }[payload.offerCategory];

  const event: NotificationEvent = {
    eventId,
    eventType: 'marketing_rendez',
    userId: payload.recipientUserId,
    channels,
    payload: {
      title: `New ${categoryLabel}: ${payload.offerTitle}`,
      body: `Don't miss this exclusive ${payload.offerCategory} offer! Valid until ${new Date(payload.validUntil).toLocaleDateString()}.`,
      channelId: 'rendez',
      priority: 'default',
      smsMessage: `REZ: New ${categoryLabel} - ${payload.offerTitle}! Book now before it expires. Valid till ${new Date(payload.validUntil).toLocaleDateString()}.`,
      emailSubject: `New ${categoryLabel}: ${payload.offerTitle}`,
      emailHtml: generateRendezEmailHtml(payload),
      data: {
        offerId: payload.offerId,
        offerTitle: payload.offerTitle,
        offerCategory: payload.offerCategory,
        merchantId: payload.merchantId,
        validUntil: payload.validUntil,
        email: payload.recipientEmail,
        phone: payload.recipientPhone,
      },
    },
    category: 'marketing',
    source: 'rez-marketing-service',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/rendez`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Rendez notification failed', {
        status: response.status,
        error: errorText,
        offerId: payload.offerId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    logger.info('[NotificationClient] Rendez notification sent', {
      offerId: payload.offerId,
      eventId,
    });
    return { success: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Rendez notification error', {
      offerId: payload.offerId,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ── Subscription Notification Types ───────────────────────────────────────────────

export interface SubscriptionNotificationPayload {
  subscriptionId: string;
  userId: string;
  eventType: string;
  title: string;
  body: string;
  planName?: string;
  planDisplayPrice?: string;
  renewalAmount?: number;
  renewalDate?: Date;
}

/**
 * Send a subscription notification to the notification service.
 * Used for welcome, renewal, cancellation, and reminder notifications.
 */
export async function sendSubscriptionNotification(
  payload: SubscriptionNotificationPayload,
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const tokens = getInternalTokens();
  const serviceToken = tokens['rez-notification-events'];
  if (!serviceToken) {
    logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
    return { success: false, error: 'Service auth not configured' };
  }

  const eventId = `subscription-${payload.subscriptionId}-${Date.now()}`;

  const event: NotificationEvent = {
    eventId,
    eventType: `subscription_${payload.eventType}`,
    userId: payload.userId,
    channels: ['push', 'email', 'in_app'],
    payload: {
      title: payload.title,
      body: payload.body,
      channelId: 'subscriptions',
      priority: payload.eventType.includes('failed') ? 'high' : 'default',
      data: {
        subscriptionId: payload.subscriptionId,
        planName: payload.planName,
        planDisplayPrice: payload.planDisplayPrice,
        renewalAmount: payload.renewalAmount,
        renewalDate: payload.renewalDate?.toISOString(),
      },
    },
    category: 'subscriptions',
    source: 'rez-marketing-service',
    createdAt: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/marketing/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': 'rez-marketing-service',
        'x-internal-token': serviceToken,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[NotificationClient] Subscription notification failed', {
        status: response.status,
        error: errorText,
        subscriptionId: payload.subscriptionId,
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    logger.info('[NotificationClient] Subscription notification sent', {
      subscriptionId: payload.subscriptionId,
      eventId,
      eventType: payload.eventType,
    });
    return { success: true, eventId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[NotificationClient] Subscription notification error', {
      subscriptionId: payload.subscriptionId,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────

export const notificationService = {
  sendCampaignNotification,
  sendVoucherNotification,
  sendBroadcastNotification,
  sendRendezNotification,
  sendSubscriptionNotification,
  syncAudiencePreferences,
};
