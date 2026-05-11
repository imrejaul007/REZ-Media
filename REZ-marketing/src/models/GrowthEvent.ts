import { Schema, model, Document, Types } from 'mongoose';

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

// Canonical event types for the growth stack
export type GrowthEventType =
  | 'campaign_created'
  | 'ad_impression'
  | 'ad_click'
  | 'notification_sent'
  | 'notification_opened'
  | 'voucher_issued'
  | 'conversion';

// Source services that emit growth events
export type SourceService = 'marketing' | 'ads' | 'notification' | 'analytics';

// Event metadata structure for extensible event data
export interface IEventMetadata {
  // Campaign events
  campaignId?: string;
  campaignName?: string;
  campaignObjective?: string;

  // Ad events
  adId?: string;
  adName?: string;
  adGroupId?: string;
  adGroupName?: string;
  keywordId?: string;
  keyword?: string;
  bidAmount?: number;
  qualityScore?: number;

  // Notification events
  notificationId?: string;
  notificationType?: string;
  notificationChannel?: string;

  // Voucher events
  voucherId?: string;
  voucherCode?: string;
  voucherType?: 'discount' | 'cashback' | 'free_item';
  discountValue?: number;
  minOrderValue?: number;
  validUntil?: Date;

  // Conversion events
  orderId?: string;
  orderValue?: number;
  items?: Array<{ productId: string; quantity: number; price: number }>;
  couponCode?: string;

  // Funnel attribution
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

const GrowthEventSchema = new Schema<IGrowthEvent>(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        'campaign_created',
        'ad_impression',
        'ad_click',
        'notification_sent',
        'notification_opened',
        'voucher_issued',
        'conversion',
      ],
      index: true,
    },
    sourceService: {
      type: String,
      required: true,
      enum: ['marketing', 'ads', 'notification', 'analytics'],
      index: true,
    },
    userId: { type: String, index: true },
    merchantId: { type: String, index: true },
    sessionId: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: 'growth_events',
  }
);

// Compound indexes for common query patterns
GrowthEventSchema.index({ merchantId: 1, eventType: 1, timestamp: -1 });
GrowthEventSchema.index({ userId: 1, timestamp: -1 });
GrowthEventSchema.index({ eventType: 1, timestamp: -1 });

// TTL index for automatic data retention (90 days default)
GrowthEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const GrowthEvent = model<IGrowthEvent>('GrowthEvent', GrowthEventSchema);
