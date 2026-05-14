"use strict";
/**
 * Notification Service Client — REZ Marketing Service
 *
 * Provides typed methods for sending notification events to the
 * REZ Notification Service (rez-notification-events).
 *
 * Uses internal service token authentication via x-internal-service header.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
exports.sendCampaignNotification = sendCampaignNotification;
exports.sendVoucherNotification = sendVoucherNotification;
exports.sendBroadcastNotification = sendBroadcastNotification;
exports.syncAudiencePreferences = syncAudiencePreferences;
const logger_1 = require("../config/logger");
// ── Configuration ─────────────────────────────────────────────────────────────
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3001';
function getInternalTokens() {
    try {
        const raw = process.env.INTERNAL_SERVICE_TOKENS_JSON;
        if (raw)
            return JSON.parse(raw);
    }
    catch {
        // ignore parse errors
    }
    const legacy = process.env.INTERNAL_SERVICE_TOKEN;
    if (legacy)
        return { 'rez-notification-events': legacy };
    return {};
}
// ── API Client ───────────────────────────────────────────────────────────────
/**
 * Send a campaign notification to the notification service.
 * Used when a marketing campaign is created or launched.
 */
async function sendCampaignNotification(payload) {
    const tokens = getInternalTokens();
    const serviceToken = tokens['rez-notification-events'];
    if (!serviceToken) {
        logger_1.logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
        return { success: false, error: 'Service auth not configured' };
    }
    const eventId = `campaign-${payload.campaignId}-${Date.now()}`;
    const event = {
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
            logger_1.logger.error('[NotificationClient] Campaign notification failed', {
                status: response.status,
                error: errorText,
                campaignId: payload.campaignId,
            });
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        const result = await response.json();
        logger_1.logger.info('[NotificationClient] Campaign notification sent', {
            campaignId: payload.campaignId,
            eventId,
        });
        return { success: true, eventId };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[NotificationClient] Campaign notification error', {
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
async function sendVoucherNotification(payload) {
    const tokens = getInternalTokens();
    const serviceToken = tokens['rez-notification-events'];
    if (!serviceToken) {
        logger_1.logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
        return { success: false, error: 'Service auth not configured' };
    }
    const eventId = `voucher-${payload.voucherId}-${Date.now()}`;
    // Determine preferred channel based on available contact info
    const channels = [];
    if (payload.recipientEmail)
        channels.push('email');
    if (payload.recipientPhone)
        channels.push('sms');
    if (channels.length === 0) {
        logger_1.logger.warn('[NotificationClient] No contact info for voucher notification', {
            voucherId: payload.voucherId,
        });
        return { success: false, error: 'No recipient contact info (email or phone) provided' };
    }
    const voucherTypeLabel = payload.voucherType === 'percentage'
        ? `${payload.voucherValue}% off`
        : payload.voucherType === 'fixed'
            ? `Rs. ${payload.voucherValue} off`
            : `${payload.voucherType} offer`;
    const event = {
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
            logger_1.logger.error('[NotificationClient] Voucher notification failed', {
                status: response.status,
                error: errorText,
                voucherId: payload.voucherId,
            });
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        const result = await response.json();
        logger_1.logger.info('[NotificationClient] Voucher notification sent', {
            voucherId: payload.voucherId,
            voucherCode: payload.voucherCode,
            eventId,
        });
        return { success: true, eventId };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[NotificationClient] Voucher notification error', {
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
async function sendBroadcastNotification(payload) {
    const tokens = getInternalTokens();
    const serviceToken = tokens['rez-notification-events'];
    if (!serviceToken) {
        logger_1.logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
        return { success: false, error: 'Service auth not configured' };
    }
    const eventId = `broadcast-${payload.broadcastId}-${Date.now()}`;
    if (!payload.targetUserIds || payload.targetUserIds.length === 0) {
        logger_1.logger.warn('[NotificationClient] No target users for broadcast notification', {
            broadcastId: payload.broadcastId,
        });
        return { success: false, error: 'No target users provided' };
    }
    const event = {
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
            logger_1.logger.error('[NotificationClient] Broadcast notification failed', {
                status: response.status,
                error: errorText,
                broadcastId: payload.broadcastId,
            });
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        const result = await response.json();
        logger_1.logger.info('[NotificationClient] Broadcast notification sent', {
            broadcastId: payload.broadcastId,
            targetUserCount: payload.targetUserIds.length,
            eventId,
        });
        return { success: true, eventId };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[NotificationClient] Broadcast notification error', {
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
async function syncAudiencePreferences(merchantId, segmentId, userIds) {
    const tokens = getInternalTokens();
    const serviceToken = tokens['rez-notification-events'];
    if (!serviceToken) {
        logger_1.logger.warn('[NotificationClient] No internal token for rez-notification-events — skipping');
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
            logger_1.logger.error('[NotificationClient] Audience sync failed', {
                status: response.status,
                error: errorText,
                segmentId,
            });
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        const result = (await response.json());
        logger_1.logger.info('[NotificationClient] Audience preferences synced', {
            segmentId,
            syncedCount: result.synced,
        });
        return { success: true, synced: result.synced };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('[NotificationClient] Audience sync error', {
            segmentId,
            error: message,
        });
        return { success: false, error: message };
    }
}
// ── Helpers ───────────────────────────────────────────────────────────────────
function generateVoucherEmailHtml(payload) {
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
// ── Singleton export ───────────────────────────────────────────────────────────
exports.notificationService = {
    sendCampaignNotification,
    sendVoucherNotification,
    sendBroadcastNotification,
    syncAudiencePreferences,
};
//# sourceMappingURL=notificationService.js.map