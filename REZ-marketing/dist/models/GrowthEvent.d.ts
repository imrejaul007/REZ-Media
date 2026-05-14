import { Document, Types } from 'mongoose';
/**
 * GrowthEvent — Unified event schema for the Growth Stack.
 *
 * Tracks events from all growth services:
 *   - marketing: campaign_created, voucher_issued, conversion
 *   - ads: ad_impression, ad_click
 *   - notification: notification_sent, notification_opened
 *
 * Provides a single source of truth for cross-service analytics,
 * ROAS calculation, and conversion funnel analysis.
 */
export type GrowthEventType = 'campaign_created' | 'ad_impression' | 'ad_click' | 'notification_sent' | 'notification_opened' | 'voucher_issued' | 'conversion';
export type SourceService = 'marketing' | 'ads' | 'notification' | 'analytics';
export interface IEventMetadata {
    campaignId?: string;
    campaignName?: string;
    campaignObjective?: string;
    adId?: string;
    adName?: string;
    adGroupId?: string;
    adGroupName?: string;
    keywordId?: string;
    keyword?: string;
    bidAmount?: number;
    qualityScore?: number;
    notificationId?: string;
    notificationType?: string;
    notificationChannel?: string;
    voucherId?: string;
    voucherCode?: string;
    voucherType?: 'discount' | 'cashback' | 'free_item';
    discountValue?: number;
    minOrderValue?: number;
    validUntil?: Date;
    orderId?: string;
    orderValue?: number;
    items?: Array<{
        productId: string;
        quantity: number;
        price: number;
    }>;
    couponCode?: string;
    attributedTo?: {
        campaignId?: string;
        adId?: string;
        notificationId?: string;
    };
}
export interface IGrowthEvent {
    _id?: Types.ObjectId;
    eventType: GrowthEventType;
    sourceService: SourceService;
    userId?: string;
    merchantId?: string;
    sessionId?: string;
    metadata: IEventMetadata;
    timestamp: Date;
}
export declare const GrowthEvent: import("mongoose").Model<IGrowthEvent, {}, {}, {}, Document<unknown, {}, IGrowthEvent, {}, {}> & IGrowthEvent & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=GrowthEvent.d.ts.map