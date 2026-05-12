import mongoose, { Document, Schema } from 'mongoose';

export enum TouchpointType {
  AD_VIEW = 'ad_view',
  STORE_VISIT = 'store_visit',
  WEBSITE_VISIT = 'website_visit',
  SEARCH = 'search',
  SOCIAL_ENGAGEMENT = 'social_engagement',
  EMAIL_OPEN = 'email_open',
  APP_OPEN = 'app_open'
}

export enum Channel {
  DISPLAY = 'display',
  SOCIAL = 'social',
  SEARCH = 'search',
  VIDEO = 'video',
  AUDIO = 'audio',
  OOH = 'ooh', // Out-of-home
  PRINT = 'print',
  DIRECT = 'direct',
  EMAIL = 'email',
  REFERRAL = 'referral'
}

export interface ITouchpoint extends Document {
  id: string;
  userId: string;
  sessionId: string;
  type: TouchpointType;
  channel: Channel;
  campaignId?: string;
  adId?: string;
  creativeId?: string;
  merchantId?: string;
  storeId?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TouchpointSchema = new Schema<ITouchpoint>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: Object.values(TouchpointType),
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: Object.values(Channel),
      required: true,
      index: true
    },
    campaignId: {
      type: String,
      index: true
    },
    adId: {
      type: String,
      index: true
    },
    creativeId: {
      type: String
    },
    merchantId: {
      type: String,
      index: true
    },
    storeId: {
      type: String,
      index: true
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    deviceFingerprint: String,
    ipAddress: String,
    userAgent: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'touchpoints'
  }
);

// Compound indexes for common queries
TouchpointSchema.index({ userId: 1, timestamp: -1 });
TouchpointSchema.index({ merchantId: 1, timestamp: -1 });
TouchpointSchema.index({ campaignId: 1, timestamp: -1 });
TouchpointSchema.index({ userId: 1, merchantId: 1, timestamp: -1 });

export const Touchpoint = mongoose.model<ITouchpoint>('Touchpoint', TouchpointSchema);
