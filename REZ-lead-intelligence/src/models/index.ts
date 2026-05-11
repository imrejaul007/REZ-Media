/**
 * Lead Intelligence Service - Mongoose Models
 */

import mongoose, { Schema, Document } from 'mongoose';
import {
  LeadTemperature,
  RecommendedChannel,
  UrgencyLevel,
  LeadScore,
  AbandonedSearch,
  AbandonedCart,
  CartItem,
  ChannelPreference,
  EngagementAction,
} from '../types';

// ============================================================================
// Lead Score Model
// ============================================================================

export interface ILeadScore extends Omit<LeadScore, 'signals'>, Document {
  signals: {
    recentSearches: number;
    abandonedCarts: number;
    viewedProducts: number;
    lastActiveHours: number;
    intentStrength: number;
    purchaseProbability: number;
  };
}

const LeadScoreSchema = new Schema<ILeadScore>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    temperature: {
      type: String,
      enum: ['hot', 'warm', 'cold'],
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    signals: {
      recentSearches: { type: Number, default: 0 },
      abandonedCarts: { type: Number, default: 0 },
      viewedProducts: { type: Number, default: 0 },
      lastActiveHours: { type: Number, default: 0 },
      intentStrength: { type: Number, default: 0, min: 0, max: 1 },
      purchaseProbability: { type: Number, default: 0, min: 0, max: 1 },
    },
    recommendedChannel: {
      type: String,
      enum: ['whatsapp', 'push', 'sms', 'email'],
      required: true,
    },
    recommendedAction: { type: String, required: true },
    calculatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'lead_scores',
  }
);

// Indexes for efficient querying
LeadScoreSchema.index({ temperature: 1, score: -1 });
LeadScoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================================================
// Abandoned Search Model
// ============================================================================

export interface IAbandonedSearch extends Document {
  userId: string;
  query: string;
  resultsShown: string[];
  notClicked: string[];
  timestamp: Date;
  intentDetected: string;
  urgencyLevel: UrgencyLevel;
  cartValue?: number;
  reEngaged: boolean;
  reEngagementAttempts: number;
}

const AbandonedSearchSchema = new Schema<IAbandonedSearch>(
  {
    userId: { type: String, required: true, index: true },
    query: { type: String, required: true },
    resultsShown: [{ type: String }],
    notClicked: [{ type: String }],
    timestamp: { type: Date, default: Date.now, index: true },
    intentDetected: { type: String, default: '' },
    urgencyLevel: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'low',
    },
    cartValue: { type: Number },
    reEngaged: { type: Boolean, default: false },
    reEngagementAttempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'abandoned_searches',
  }
);

// Index for finding user's abandoned searches
AbandonedSearchSchema.index({ userId: 1, timestamp: -1 });
// TTL index - expire after 72 hours
AbandonedSearchSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 72 * 60 * 60 }
);

// ============================================================================
// Abandoned Cart Model
// ============================================================================

export interface IAbandonedCart extends Document {
  userId: string;
  cartId: string;
  items: CartItem[];
  totalValue: number;
  abandonedAt: Date;
  lastReminderSent?: Date;
  reminderCount: number;
  recovered: boolean;
  recoveredAt?: Date;
  expiresAt: Date;
}

const CartItemSchema = new Schema<CartItem>(
  {
    productId: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    name: { type: String },
    category: { type: String },
  },
  { _id: false }
);

const AbandonedCartSchema = new Schema<IAbandonedCart>(
  {
    userId: { type: String, required: true, index: true },
    cartId: { type: String, required: true, unique: true },
    items: [CartItemSchema],
    totalValue: { type: Number, required: true },
    abandonedAt: { type: Date, default: Date.now, index: true },
    lastReminderSent: { type: Date },
    reminderCount: { type: Number, default: 0 },
    recovered: { type: Boolean, default: false, index: true },
    recoveredAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'abandoned_carts',
  }
);

// Compound indexes
AbandonedCartSchema.index({ userId: 1, abandonedAt: -1 });
AbandonedCartSchema.index({ recovered: 1, abandonedAt: 1 });

// ============================================================================
// Channel Preference Model
// ============================================================================

export interface IChannelPreference extends Document {
  userId: string;
  whatsapp: boolean;
  push: boolean;
  sms: boolean;
  email: boolean;
  lastWhatsapp?: Date;
  lastPush?: Date;
  lastSms?: Date;
  lastEmail?: Date;
}

const ChannelPreferenceSchema = new Schema<IChannelPreference>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    whatsapp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    lastWhatsapp: { type: Date },
    lastPush: { type: Date },
    lastSms: { type: Date },
    lastEmail: { type: Date },
  },
  {
    timestamps: true,
    collection: 'channel_preferences',
  }
);

// ============================================================================
// Engagement Action Model
// ============================================================================

export interface IEngagementAction extends Document {
  userId: string;
  channel: RecommendedChannel;
  actionType: string;
  message: string;
  sentAt: Date;
  delivered: boolean;
  opened?: boolean;
  clicked?: boolean;
  converted?: boolean;
  correlationId?: string;
}

const EngagementActionSchema = new Schema<IEngagementAction>(
  {
    userId: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ['whatsapp', 'push', 'sms', 'email'],
      required: true,
    },
    actionType: { type: String, required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    delivered: { type: Boolean, default: false },
    opened: { type: Boolean },
    clicked: { type: Boolean },
    converted: { type: Boolean, index: true },
    correlationId: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'engagement_actions',
  }
);

// Compound indexes for analytics
EngagementActionSchema.index({ userId: 1, sentAt: -1 });
EngagementActionSchema.index({ channel: 1, converted: 1 });

// ============================================================================
// User Activity Cache Model
// ============================================================================

export interface IUserActivityCache extends Document {
  userId: string;
  searches: Array<{
    query: string;
    timestamp: Date;
    resultsCount: number;
    clickedResults: string[];
    intentDetected?: string;
  }>;
  views: Array<{
    productId: string;
    productName?: string;
    category?: string;
    timestamp: Date;
    durationSeconds?: number;
    addedToCart: boolean;
  }>;
  cartActions: Array<{
    action: 'add' | 'remove' | 'update';
    productId: string;
    quantity?: number;
    timestamp: Date;
  }>;
  lastActive: Date;
  sessionCount: number;
  expiresAt: Date;
}

const UserActivityCacheSchema = new Schema<IUserActivityCache>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    searches: [
      {
        query: String,
        timestamp: Date,
        resultsCount: Number,
        clickedResults: [String],
        intentDetected: String,
      },
    ],
    views: [
      {
        productId: String,
        productName: String,
        category: String,
        timestamp: Date,
        durationSeconds: Number,
        addedToCart: Boolean,
      },
    ],
    cartActions: [
      {
        action: String,
        productId: String,
        quantity: Number,
        timestamp: Date,
      },
    ],
    lastActive: { type: Date, default: Date.now },
    sessionCount: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'user_activity_cache',
  }
);

// TTL index - expire after 24 hours
UserActivityCacheSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// ============================================================================
// Export Models
// ============================================================================

export const LeadScoreModel = mongoose.model<ILeadScore>('LeadScore', LeadScoreSchema);
export const AbandonedSearchModel = mongoose.model<IAbandonedSearch>('AbandonedSearch', AbandonedSearchSchema);
export const AbandonedCartModel = mongoose.model<IAbandonedCart>('AbandonedCart', AbandonedCartSchema);
export const ChannelPreferenceModel = mongoose.model<IChannelPreference>('ChannelPreference', ChannelPreferenceSchema);
export const EngagementActionModel = mongoose.model<IEngagementAction>('EngagementAction', EngagementActionSchema);
export const UserActivityCacheModel = mongoose.model<IUserActivityCache>('UserActivityCache', UserActivityCacheSchema);

export default {
  LeadScoreModel,
  AbandonedSearchModel,
  AbandonedCartModel,
  ChannelPreferenceModel,
  EngagementActionModel,
  UserActivityCacheModel,
};
