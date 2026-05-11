import { Schema, model, Document, Types } from 'mongoose';

/**
 * MarketingCampaign — the core campaign document for rez-marketing-service.
 *
 * Supports all advanced targeting modes:
 *   - segment: pre-defined segments (all, recent, lapsed, high_value, stamp_card)
 *   - location: city/area/pincode filtering
 *   - interest: derived interest tags (coffee, electronics, fashion…)
 *   - birthday: users with upcoming birthday (N days ahead)
 *   - purchase_history: bought product/category in last N days
 *   - institution: college/workplace affiliation
 *   - keyword: users who searched a keyword in REZ app
 *   - custom: arbitrary MongoDB filter (power users)
 *
 * Canonical reference: @rez/shared-types CampaignChannel
 * Uses subset: whatsapp, push, sms, email, in_app (5 of 8 canonical values)
 * (Excludes: social, web, api — not applicable for marketing service)
 *
 * Canonical reference: @rez/shared-types CampaignStatus
 * Uses subset: draft, scheduled, sending, sent, failed, cancelled (6 of 12 canonical values)
 * (Excludes: pending_review, active, paused, completed, expired, rejected — not used in marketing workflow)
 *
 * Objectives: awareness | engagement | sales | win_back
 */

// Canonical CampaignChannel — uses 5 of 8 canonical values
export type CampaignChannel = 'whatsapp' | 'push' | 'sms' | 'email' | 'in_app';
// Canonical CampaignStatus — uses 6 of 12 canonical values
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type CampaignObjective = 'awareness' | 'engagement' | 'sales' | 'win_back';
export type AudienceSegmentType =
  | 'all'
  | 'recent'
  | 'lapsed'
  | 'high_value'
  | 'stamp_card'
  | 'location'
  | 'interest'
  | 'birthday'
  | 'purchase_history'
  | 'institution'
  | 'keyword'
  | 'custom';

export interface IAudienceFilter {
  segment: AudienceSegmentType;

  // location targeting
  location?: {
    city?: string;
    area?: string;   // neighbourhood: 'BTM Layout', 'Koramangala'
    pincode?: string;
    radiusKm?: number;
    coordinates?: [number, number]; // [lng, lat] centre for radius search
  };

  // interest targeting (derived from purchase history by InterestEngine)
  interests?: string[]; // e.g. ['coffee', 'electronics', 'fast_food']

  // birthday targeting
  birthday?: {
    daysAhead: number; // 0 = today, 1 = tomorrow, 7 = this week
  };

  // purchase history targeting
  purchaseHistory?: {
    categoryIds?: string[];      // product categories
    productKeywords?: string[];  // keyword match on item names
    withinDays: number;          // purchased within last N days
    minOrderCount?: number;      // at least N orders
  };

  // institution targeting
  institution?: {
    name?: string;   // 'Oxford College'
    type?: 'college' | 'school' | 'office' | 'hospital';
    area?: string;
  };

  // keyword targeting (users who searched this in REZ app)
  keyword?: {
    terms: string[];
    withinDays?: number; // searched in last N days
  };

  // custom MongoDB filter (serialized, applied to User collection)
  // Only allows whitelisted keys to prevent MongoDB operator injection
  customFilter?: {
    interests?: string[];
    location?: string;
    ageRange?: { min?: number; max?: number };
    institutions?: string[];
  };

  // audience size estimate (cached at creation time)
  estimatedCount?: number;
}

export interface ICampaignStats {
  sent: number;
  delivered: number;
  failed: number;
  deduped: number;
  opened: number;     // tracked via tracking pixel / link click
  clicked: number;    // tracked via UTM link click
  converted: number;  // tracked via post-campaign order attribution
}

export interface IMarketingCampaign extends Document {
  merchantId: Types.ObjectId;
  name: string;
  objective: CampaignObjective;
  channel: CampaignChannel;
  message: string;
  templateName?: string;   // Meta WhatsApp pre-approved template name
  imageUrl?: string;       // media attachment for push/WhatsApp
  ctaUrl?: string;         // CTA button link
  ctaText?: string;        // CTA button label

  audience: IAudienceFilter;
  status: CampaignStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  audienceEstimatedCountUpdatedAt?: Date; // BE-MKT-003: Track freshness of audience estimate

  stats: ICampaignStats;
  errorMessage?: string;

  // P0-LOGIC-3: Daily budget cap — checked in execute() before each batch dispatch
  dailyBudget?: number;   // in paise; campaign stops when totalSpent >= dailyBudget
  totalSpent?: number;    // cumulative spend in paise, incremented per message

  // Attribution window (days after send to attribute conversions)
  attributionWindowDays: number;

  createdBy?: Types.ObjectId; // MerchantUser who created this
  createdAt: Date;
  updatedAt: Date;
}

const AudienceFilterSchema = new Schema<IAudienceFilter>(
  {
    segment: {
      type: String,
      enum: ['all', 'recent', 'lapsed', 'high_value', 'stamp_card', 'location', 'interest', 'birthday', 'purchase_history', 'institution', 'keyword', 'custom'],
      required: true,
    },
    location: {
      city: String,
      area: String,
      pincode: String,
      radiusKm: Number,
      coordinates: { type: [Number], index: '2dsphere' },
    },
    interests: [String],
    birthday: { daysAhead: Number },
    purchaseHistory: {
      categoryIds: [String],
      productKeywords: [String],
      withinDays: Number,
      minOrderCount: Number,
    },
    institution: {
      name: String,
      type: { type: String, enum: ['college', 'school', 'office', 'hospital'] },
      area: String,
    },
    keyword: {
      terms: [String],
      withinDays: Number,
    },
    customFilter: {
      interests: [String],
      location: String,
      ageRange: {
        min: Number,
        max: Number,
      },
      institutions: [String],
    },
    estimatedCount: Number,
  },
  { _id: false },
);

// Recursively check for any $ key at any nesting depth to prevent MongoDB operator injection
function hasDollarKey(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return false;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key.startsWith('$')) return true;
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (hasDollarKey(val)) return true;
    }
  }
  return false;
}

// SECURITY: Block MongoDB operator injection in customFilter using a pre-validate hook.
// This replaces the previous .path('customFilter').validate() call which returned undefined
// on subdocument schemas in Mongoose 8, causing the service to crash on startup.
AudienceFilterSchema.pre('validate', function () {
  const value = (this as unknown as { customFilter?: unknown }).customFilter;
  if (!value) return;
  if (hasDollarKey(value)) {
    throw new Error('MongoDB operators (keys starting with "$") are not allowed in customFilter at any nesting depth.');
  }
});

const CampaignStatsSchema = new Schema<ICampaignStats>(
  {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deduped: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
  },
  { _id: false },
);

const MarketingCampaignSchema = new Schema<IMarketingCampaign>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    objective: {
      type: String,
      enum: ['awareness', 'engagement', 'sales', 'win_back'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'push', 'sms', 'email', 'in_app'],
      required: true,
    },
    message: { type: String, required: true, maxlength: 4096 },
    templateName: String,
    imageUrl: String,
    ctaUrl: String,
    ctaText: String,
    audience: { type: AudienceFilterSchema, required: true },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    scheduledAt: Date,
    sentAt: Date,
    audienceEstimatedCountUpdatedAt: { type: Date, default: Date.now }, // BE-MKT-003: Timestamp when estimate was refreshed
    stats: { type: CampaignStatsSchema, default: () => ({}) },
    errorMessage: String,
    dailyBudget: { type: Number, default: null },  // in paise; null = unlimited
    totalSpent: { type: Number, default: 0 },       // cumulative spend in paise
    attributionWindowDays: { type: Number, default: 7 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
  },
  { timestamps: true },
);

// List queries
MarketingCampaignSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
// Scheduled campaign picker
MarketingCampaignSchema.index({ status: 1, scheduledAt: 1 });

export const MarketingCampaign = model<IMarketingCampaign>('MarketingCampaign', MarketingCampaignSchema);
export default MarketingCampaign;
