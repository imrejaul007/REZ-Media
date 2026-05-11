import { Schema, model, Document, Types } from 'mongoose';

/**
 * RendezOffer — Social and Contextual Offers for the REZ Marketing Platform.
 *
 * Supports offer categories:
 *   - couple: Romantic experiences for pairs (dinner, spa, date nights)
 *   - group: Social gatherings (friend meetups, party packages, group outings)
 *   - context: Time/occasion-based offers (Friday deals, Valentine's, weekends)
 *
 * Offer types:
 *   - percentage: Percentage discount (value = percentage, maxDiscount caps amount)
 *   - fixed: Fixed amount discount (value = amount in smallest currency unit)
 *   - bogo: Buy-one-get-one offer
 *   - bundle: Package deal (multiple items/services at special price)
 *   - experience: Non-monetary experience (priority booking, exclusive access)
 *
 * Context triggers:
 *   - day_of_week: Monday, Tuesday, ..., Sunday
 *   - time_of_day: morning, afternoon, evening, night
 *   - occasion: Valentine's, Anniversary, Birthday, Weekend, Holiday, etc.
 *   - weather: sunny, rainy, cloudy, etc.
 *   - location: city, area, pincode
 *   - user_behavior: recent_purchase, lapsed_user, high_value, etc.
 */

export type RendezOfferCategory = 'couple' | 'group' | 'context';
export type RendezOfferType = 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'experience';
export type RendezOfferStatus = 'active' | 'scheduled' | 'expired' | 'cancelled' | 'paused';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type OccasionType =
  | 'valentines'
  | 'anniversary'
  | 'birthday'
  | 'weekend'
  | 'holiday'
  | 'new_year'
  | 'christmas'
  | 'diwali'
  | 'summer'
  | 'monsoon'
  | 'custom';

export interface IContextTrigger {
  dayOfWeek?: DayOfWeek[];
  timeOfDay?: TimeOfDay[];
  occasion?: {
    type: OccasionType;
    startDate?: Date;
    endDate?: Date;
    customName?: string;
  }[];
  minPartySize?: number;
  maxPartySize?: number;
}

export interface IOfferBenefits {
  discount?: {
    type: 'percentage' | 'fixed';
    value: number;
    maxDiscount?: number;
  };
  bundle?: {
    items: string[];
    packagePrice: number;
  };
  experience?: {
    type: 'priority_booking' | 'exclusive_access' | 'complimentary' | 'upgrade';
    description: string;
  };
  bogo?: {
    buyQuantity: number;
    getQuantity: number;
    getItem: string;
  };
}

export interface IOfferTemplate {
  name: string;
  category: RendezOfferCategory;
  type: RendezOfferType;
  title: string;
  description: string;
  benefits: IOfferBenefits;
  imageUrls?: string[];
  ctaText?: string;
  ctaUrl?: string;
  validDays?: DayOfWeek[];
  validTimeStart?: string; // HH:mm format
  validTimeEnd?: string;   // HH:mm format
}

export interface IRendezOfferStats {
  views: number;
  bookings: number;
  conversions: number;
  shares: number;
  revenue: number; // in smallest currency unit
  redemptions: number;
}

export interface IRendezOffer extends Document {
  merchantId: Types.ObjectId;
  name: string;
  category: RendezOfferCategory;
  type: RendezOfferType;
  title: string;
  description: string;
  benefits: IOfferBenefits;

  // Media
  imageUrls?: string[];
  videoUrl?: string;

  // Call to action
  ctaText?: string;
  ctaUrl?: string;

  // Pricing and availability
  originalPrice?: number;    // in smallest currency unit
  offerPrice?: number;      // in smallest currency unit
  minPartySize?: number;    // minimum people required
  maxPartySize?: number;    // maximum people allowed

  // Context triggers
  contextTrigger?: IContextTrigger;

  // Validity
  validFrom: Date;
  validUntil: Date;
  status: RendezOfferStatus;
  isRecurring?: boolean;    // auto-renews after expiry

  // Template reference
  templateId?: string;
  templateName?: string;

  // Targeting
  targetAudience?: {
    segments?: string[];
    locations?: {
      city?: string;
      areas?: string[];
      pincodes?: string[];
    };
    interests?: string[];
  };

  // Stats
  stats: IRendezOfferStats;

  // Booking info
  bookingSlots?: {
    day: DayOfWeek;
    startTime: string; // HH:mm
    endTime: string;   // HH:mm
    capacity?: number;
  }[];

  // Sharing
  shareable: boolean;
  shareUrl?: string;
  shareMessage?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  tags?: string[];

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema Definitions ─────────────────────────────────────────────────────────

const ContextTriggerSchema = new Schema<IContextTrigger>(
  {
    dayOfWeek: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    }],
    timeOfDay: [{
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
    }],
    occasion: [{
      type: {
        type: String,
        enum: ['valentines', 'anniversary', 'birthday', 'weekend', 'holiday', 'new_year', 'christmas', 'diwali', 'summer', 'monsoon', 'custom'],
        required: true,
      },
      startDate: Date,
      endDate: Date,
      customName: String,
    }],
    minPartySize: { type: Number, min: 1 },
    maxPartySize: { type: Number, min: 1 },
  },
  { _id: false },
);

const OfferBenefitsSchema = new Schema<IOfferBenefits>(
  {
    discount: {
      type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
      },
      value: { type: Number, required: true, min: 0 },
      maxDiscount: { type: Number, min: 0 },
    },
    bundle: {
      items: { type: [String], required: true },
      packagePrice: { type: Number, required: true, min: 0 },
    },
    experience: {
      type: {
        type: String,
        enum: ['priority_booking', 'exclusive_access', 'complimentary', 'upgrade'],
        required: true,
      },
      description: { type: String, required: true },
    },
    bogo: {
      buyQuantity: { type: Number, required: true, min: 1 },
      getQuantity: { type: Number, required: true, min: 1 },
      getItem: { type: String, required: true },
    },
  },
  { _id: false },
);

const BookingSlotSchema = new Schema(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },   // HH:mm
    capacity: { type: Number, min: 1 },
  },
  { _id: false },
);

const RendezOfferStatsSchema = new Schema<IRendezOfferStats>(
  {
    views: { type: Number, default: 0 },
    bookings: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    redemptions: { type: Number, default: 0 },
  },
  { _id: false },
);

const RendezOfferSchema = new Schema<IRendezOffer>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: ['couple', 'group', 'context'],
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'bogo', 'bundle', 'experience'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    benefits: {
      type: OfferBenefitsSchema,
      required: true,
    },
    imageUrls: [String],
    videoUrl: String,
    ctaText: { type: String, maxlength: 50 },
    ctaUrl: String,
    originalPrice: { type: Number, min: 0 },
    offerPrice: { type: Number, min: 0 },
    minPartySize: { type: Number, min: 1, default: 1 },
    maxPartySize: { type: Number, min: 1 },
    contextTrigger: { type: ContextTriggerSchema },
    validFrom: { type: Date, required: true, index: true },
    validUntil: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'scheduled', 'expired', 'cancelled', 'paused'],
      default: 'active',
      index: true,
    },
    isRecurring: { type: Boolean, default: false },
    templateId: String,
    templateName: String,
    targetAudience: {
      segments: [String],
      locations: {
        city: String,
        areas: [String],
        pincodes: [String],
      },
      interests: [String],
    },
    stats: { type: RendezOfferStatsSchema, default: () => ({}) },
    bookingSlots: [BookingSlotSchema],
    shareable: { type: Boolean, default: true },
    shareUrl: String,
    shareMessage: String,
    metadata: { type: Schema.Types.Mixed },
    tags: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
  },
  { timestamps: true },
);

// ── Indexes ────────────────────────────────────────────────────────────────────

RendezOfferSchema.index({ merchantId: 1, status: 1, category: 1, createdAt: -1 });
RendezOfferSchema.index({ status: 1, validFrom: 1, validUntil: 1 });
RendezOfferSchema.index({ category: 1, status: 1, validUntil: 1 });
RendezOfferSchema.index({ 'contextTrigger.occasion.type': 1, status: 1 });
RendezOfferSchema.index({ tags: 1, status: 1 });
RendezOfferSchema.index({ merchantId: 1, templateName: 1 });

// ── Pre-save Hook ─────────────────────────────────────────────────────────────

RendezOfferSchema.pre('save', function (next) {
  // Auto-expire offers that have passed their validity
  if (this.validUntil && this.validUntil < new Date() && this.status === 'active') {
    if (this.isRecurring) {
      // Extend validity for recurring offers
      const nextPeriod = new Date(this.validUntil);
      nextPeriod.setDate(nextPeriod.getDate() + 7); // Weekly recurrence
      this.validUntil = nextPeriod;
    } else {
      this.status = 'expired';
    }
  }
  next();
});

export const RendezOffer = model<IRendezOffer>('RendezOffer', RendezOfferSchema);
export default RendezOffer;
