/**
 * Notification Service Client — REZ Marketing Service
 *
 * Provides typed methods for sending notification events to the
 * REZ Notification Service (rez-notification-events).
 *
 * Uses internal service token authentication via x-internal-service header.
 */
export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';
export interface NotificationEvent {
    eventId: string;
    eventType: string;
    userId?: string;
    userIds?: string[];
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
/**
 * Send a campaign notification to the notification service.
 * Used when a marketing campaign is created or launched.
 */
export declare function sendCampaignNotification(payload: CampaignNotificationPayload): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Send a voucher notification to the notification service.
 * Used when a voucher is generated and needs to be delivered to a user via SMS/Email.
 */
export declare function sendVoucherNotification(payload: VoucherNotificationPayload): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Send a broadcast notification to the notification service.
 * Used for sending marketing messages to audience segments.
 */
export declare function sendBroadcastNotification(payload: BroadcastNotificationPayload): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Sync notification preferences for an audience segment.
 * Called when audience segment is updated.
 */
export declare function syncAudiencePreferences(merchantId: string, segmentId: string, userIds: string[]): Promise<{
    success: boolean;
    synced?: number;
    error?: string;
}>;
export declare const notificationService: {
    sendCampaignNotification: typeof sendCampaignNotification;
    sendVoucherNotification: typeof sendVoucherNotification;
    sendBroadcastNotification: typeof sendBroadcastNotification;
    syncAudiencePreferences: typeof syncAudiencePreferences;
};
//# sourceMappingURL=notificationService.d.ts.map