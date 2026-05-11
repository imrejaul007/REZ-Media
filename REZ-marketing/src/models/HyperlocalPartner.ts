import { Schema, model, Document, Types } from 'mongoose';

/**
 * HyperlocalPartner — Partner relationships for cross-brand promotions
 *
 * Supports partner types:
 *   - salon: Hair and beauty salons
 *   - gym: Fitness centers and gyms
 *   - cafe: Coffee shops and restaurants
 *   - retail: Retail stores
 *   - pharmacy: Pharmacies and health stores
 *   - grocery: Grocery and convenience stores
 *   - entertainment: Entertainment venues
 *   - service: Professional services
 *
 * Partnership statuses:
 *   - pending: Request sent, awaiting response
 *   - active: Active partnership
 *   - paused: Partnership paused by either party
 *   - rejected: Request rejected
 *   - expired: Partnership expired
 *   - cancelled: Partnership cancelled
 *
 * Business Categories for partner matching:
 *   - beauty_wellness: Salons, spas, wellness centers
 *   - fitness: Gyms, yoga studios, sports clubs
 *   - food_beverage: Cafes, restaurants, bakeries
 *   - health: Pharmacies, clinics, health stores
 *   - retail: Stores, boutiques, shopping
 *   - lifestyle: Entertainment, recreation
 */

/**
 * Partner category types
 */
export type PartnerType =
  | 'salon'
  | 'gym'
  | 'cafe'
  | 'retail'
  | 'pharmacy'
  | 'grocery'
  | 'entertainment'
  | 'service';

export type BusinessCategory =
  | 'beauty_wellness'
  | 'fitness'
  | 'food_beverage'
  | 'health'
  | 'retail'
  | 'lifestyle';

export type PartnershipStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'expired'
  | 'cancelled';

/**
 * Location data for partners
 */
export interface ILocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
}

/**
 * Partner profile for discovery
 */
export interface IPartnerProfile {
  businessName: string;
  businessCategory: BusinessCategory;
  partnerType: PartnerType;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  phone?: string;
  email?: string;
  tags?: string[]; // e.g., ['womens-salon', 'luxury', 'organic']
}

/**
 * Partnership request details
 */
export interface IPartnershipRequest {
  fromMerchantId: Types.ObjectId;
  toMerchantId: Types.ObjectId;
  requestedAt: Date;
  message?: string;
  proposedTerms?: IPartnershipTerms;
  respondedAt?: Date;
  responseNote?: string;
}

/**
 * Partnership terms for co-marketing
 */
export interface IPartnershipTerms {
  costSplitPercentage: number; // 0-100, percentage split
  rewardType: 'coins' | 'discount' | 'mixed';
  minOrderValue?: number; // Minimum order to qualify for cross-promotion
  maxRewardValue?: number; // Maximum reward value per transaction
  validityDays?: number; // How long the partnership terms are valid
  autoRenew?: boolean;
}

/**
 * Cross-promotion campaign
 */
export interface ICrossPromotion {
  campaignId?: Types.ObjectId;
  name: string;
  description?: string;
  type: 'cross_referral' | 'joint_offer' | 'bundle_deal' | 'loyalty_share';
  status: 'draft' | 'active' | 'completed' | 'cancelled';

  // Campaign dates
  startDate: Date;
  endDate: Date;

  // Partner contribution tracking
  partners: Array<{
    merchantId: Types.ObjectId;
    contributionPercentage: number;
    budgetAllocated?: number;
    budgetSpent?: number;
  }>;

  // Performance tracking
  metrics: {
    totalViews: number;
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    partnerRevenue: Record<string, number>; // merchantId -> revenue
  };

  // Offer details if applicable
  offerConfig?: {
    discountPercentage?: number;
    fixedDiscount?: number;
    bonusCoins?: number;
    description: string;
  };
}

/**
 * Referral tracking
 */
export interface IReferral {
  referrerMerchantId: Types.ObjectId;
  referredMerchantId: Types.ObjectId;
  referralCode: string;
  referredAt: Date;
  partnershipCreatedAt?: Date;
  rewardEarned: boolean;
  rewardType?: 'coins' | 'discount' | 'free_trial';
  rewardValue?: number;
  rewardClaimedAt?: Date;
}

/**
 * Partner statistics
 */
export interface IPartnerStats {
  totalReferrals: number;
  successfulReferrals: number;
  totalCrossPromotions: number;
  activeCrossPromotions: number;
  totalRevenueFromNetwork: number;
  totalCustomersBrought: number;
  totalCustomersSent: number;
  averagePartnerRating: number;
  totalPartnerships: number;
  activePartnerships: number;
}

/**
 * Hyperlocal partner document interface
 */
export interface IHyperlocalPartner extends Document {
  // Primary merchant owning this partner record
  merchantId: Types.ObjectId;

  // Partner profile
  profile: IPartnerProfile;
  location: ILocation;

  // Partner status
  status: 'active' | 'inactive' | 'suspended';

  // Categories for matching
  businessCategories: BusinessCategory[];
  partnerTypes: PartnerType[];

  // Target demographics
  targetDemographics?: {
    ageGroups?: string[];
    genders?: string[];
    incomeLevel?: 'low' | 'middle' | 'high' | 'all';
  };

  // Operating hours
  operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;

  // Partner statistics
  stats: IPartnerStats;

  // Network settings
  networkSettings: {
    discoverable: boolean; // Can be found by other merchants
    autoAcceptRequests: boolean;
    maxActivePartnerships: number;
    referralEnabled: boolean;
    crossPromoEnabled: boolean;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partnership document interface
 */
export interface IPartnership extends Document {
  // Partnership parties
  merchantA: Types.ObjectId;
  merchantB: Types.ObjectId;

  // Partnership details
  status: PartnershipStatus;
  request: IPartnershipRequest;
  terms: IPartnershipTerms;

  // Partnership metadata
  initiatedBy: Types.ObjectId; // Which merchant initiated
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;

  // Stats
  stats: {
    totalCrossPromotions: number;
    activeCrossPromotions: number;
    totalRevenueShared: number;
    totalCustomersExchanged: number;
    lastInteractionAt?: Date;
  };

  // History
  history: Array<{
    action: 'created' | 'updated' | 'paused' | 'resumed' | 'rejected' | 'cancelled' | 'expired';
    by?: Types.ObjectId;
    note?: string;
    timestamp: Date;
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

// ── Location Schema ─────────────────────────────────────────────────────────────
const LocationSchema = new Schema<ILocation>(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      index: '2dsphere',
    },
    address: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String,
  },
  { _id: false },
);

// ── Partner Profile Schema ──────────────────────────────────────────────────────
const PartnerProfileSchema = new Schema<IPartnerProfile>(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 200 },
    businessCategory: {
      type: String,
      enum: ['beauty_wellness', 'fitness', 'food_beverage', 'health', 'retail', 'lifestyle'],
      required: true,
    },
    partnerType: {
      type: String,
      enum: ['salon', 'gym', 'cafe', 'retail', 'pharmacy', 'grocery', 'entertainment', 'service'],
      required: true,
    },
    description: { type: String, maxlength: 1000 },
    logoUrl: String,
    coverImageUrl: String,
    website: String,
    phone: String,
    email: String,
    tags: [String],
  },
  { _id: false },
);

// ── Partnership Terms Schema ────────────────────────────────────────────────────
const PartnershipTermsSchema = new Schema<IPartnershipTerms>(
  {
    costSplitPercentage: { type: Number, required: true, min: 0, max: 100 },
    rewardType: { type: String, enum: ['coins', 'discount', 'mixed'], required: true },
    minOrderValue: { type: Number, min: 0 },
    maxRewardValue: { type: Number, min: 0 },
    validityDays: { type: Number, min: 1 },
    autoRenew: { type: Boolean, default: false },
  },
  { _id: false },
);

// ── Partnership Request Schema ─────────────────────────────────────────────────
const PartnershipRequestSchema = new Schema<IPartnershipRequest>(
  {
    fromMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    toMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    requestedAt: { type: Date, default: Date.now },
    message: { type: String, maxlength: 500 },
    proposedTerms: { type: PartnershipTermsSchema },
    respondedAt: Date,
    responseNote: { type: String, maxlength: 500 },
  },
  { _id: false },
);

// ── Cross Promotion Schema ──────────────────────────────────────────────────────
const CrossPromotionMetricsSchema = new Schema(
  {
    totalViews: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    totalConversions: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    partnerRevenue: { type: Map, of: Number, default: {} },
  },
  { _id: false },
);

const CrossPromotionPartnerSchema = new Schema(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    contributionPercentage: { type: Number, required: true, min: 0, max: 100 },
    budgetAllocated: { type: Number, min: 0 },
    budgetSpent: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const CrossPromotionOfferConfigSchema = new Schema(
  {
    discountPercentage: { type: Number, min: 0, max: 100 },
    fixedDiscount: { type: Number, min: 0 },
    bonusCoins: { type: Number, min: 0 },
    description: { type: String, required: true },
  },
  { _id: false },
);

const CrossPromotionSchema = new Schema<ICrossPromotion>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'MarketingCampaign' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    type: {
      type: String,
      enum: ['cross_referral', 'joint_offer', 'bundle_deal', 'loyalty_share'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    partners: [CrossPromotionPartnerSchema],
    metrics: { type: CrossPromotionMetricsSchema, default: () => ({}) },
    offerConfig: { type: CrossPromotionOfferConfigSchema },
  },
  { _id: false },
);

// ── Referral Schema ────────────────────────────────────────────────────────────
const ReferralSchema = new Schema<IReferral>(
  {
    referrerMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    referredMerchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
    referralCode: { type: String, required: true, unique: true },
    referredAt: { type: Date, default: Date.now },
    partnershipCreatedAt: Date,
    rewardEarned: { type: Boolean, default: false },
    rewardType: { type: String, enum: ['coins', 'discount', 'free_trial'] },
    rewardValue: { type: Number, min: 0 },
    rewardClaimedAt: Date,
  },
  { _id: false },
);

// ── Partner Stats Schema ────────────────────────────────────────────────────────
const PartnerStatsSchema = new Schema<IPartnerStats>(
  {
    totalReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    totalCrossPromotions: { type: Number, default: 0 },
    activeCrossPromotions: { type: Number, default: 0 },
    totalRevenueFromNetwork: { type: Number, default: 0 },
    totalCustomersBrought: { type: Number, default: 0 },
    totalCustomersSent: { type: Number, default: 0 },
    averagePartnerRating: { type: Number, default: 0, min: 0, max: 5 },
    totalPartnerships: { type: Number, default: 0 },
    activePartnerships: { type: Number, default: 0 },
  },
  { _id: false },
);

// ── Network Settings Schema ─────────────────────────────────────────────────────
const NetworkSettingsSchema = new Schema(
  {
    discoverable: { type: Boolean, default: true },
    autoAcceptRequests: { type: Boolean, default: false },
    maxActivePartnerships: { type: Number, default: 50, min: 1, max: 200 },
    referralEnabled: { type: Boolean, default: true },
    crossPromoEnabled: { type: Boolean, default: true },
  },
  { _id: false },
);

// ── HyperlocalPartner Schema ────────────────────────────────────────────────────
const HyperlocalPartnerSchema = new Schema<IHyperlocalPartner>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      unique: true,
      index: true,
    },
    profile: { type: PartnerProfileSchema, required: true },
    location: { type: LocationSchema, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
      index: true,
    },
    businessCategories: [{
      type: String,
      enum: ['beauty_wellness', 'fitness', 'food_beverage', 'health', 'retail', 'lifestyle'],
    }],
    partnerTypes: [{
      type: String,
      enum: ['salon', 'gym', 'cafe', 'retail', 'pharmacy', 'grocery', 'entertainment', 'service'],
    }],
    targetDemographics: {
      ageGroups: [String],
      genders: [String],
      incomeLevel: { type: String, enum: ['low', 'middle', 'high', 'all'] },
    },
    operatingHours: {
      type: Map,
      of: {
        open: String,
        close: String,
        closed: Boolean,
      },
    },
    stats: { type: PartnerStatsSchema, default: () => ({}) },
    networkSettings: { type: NetworkSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

// ── Partnership Schema ──────────────────────────────────────────────────────────
const PartnershipStatsSchema = new Schema(
  {
    totalCrossPromotions: { type: Number, default: 0 },
    activeCrossPromotions: { type: Number, default: 0 },
    totalRevenueShared: { type: Number, default: 0 },
    totalCustomersExchanged: { type: Number, default: 0 },
    lastInteractionAt: Date,
  },
  { _id: false },
);

const PartnershipHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'paused', 'resumed', 'rejected', 'cancelled', 'expired'],
      required: true,
    },
    by: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
    note: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PartnershipSchema = new Schema<IPartnership>(
  {
    merchantA: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    merchantB: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'paused', 'rejected', 'expired', 'cancelled'],
      default: 'pending',
      index: true,
    },
    request: { type: PartnershipRequestSchema, required: true },
    terms: { type: PartnershipTermsSchema, required: true },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
    stats: { type: PartnershipStatsSchema, default: () => ({}) },
    history: [PartnershipHistorySchema],
    expiresAt: Date,
  },
  { timestamps: true },
);

// ── CrossPromotion Schema (Top-level) ──────────────────────────────────────────
const CrossPromotionDocSchema = new Schema(
  {
    partnershipId: {
      type: Schema.Types.ObjectId,
      ref: 'Partnership',
      required: true,
      index: true,
    },
    campaignId: { type: Schema.Types.ObjectId, ref: 'MarketingCampaign' },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    type: {
      type: String,
      enum: ['cross_referral', 'joint_offer', 'bundle_deal', 'loyalty_share'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    partners: [CrossPromotionPartnerSchema],
    metrics: { type: CrossPromotionMetricsSchema, default: () => ({}) },
    offerConfig: { type: CrossPromotionOfferConfigSchema },
  },
  { timestamps: true },
);

// ── Referral Schema (Top-level) ─────────────────────────────────────────────────
const ReferralDocSchema = new Schema(
  {
    referrerMerchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    referredMerchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    referredAt: { type: Date, default: Date.now },
    partnershipCreatedAt: Date,
    rewardEarned: { type: Boolean, default: false },
    rewardType: { type: String, enum: ['coins', 'discount', 'free_trial'] },
    rewardValue: { type: Number, min: 0 },
    rewardClaimedAt: Date,
  },
  { timestamps: true },
);

// ── Indexes ─────────────────────────────────────────────────────────────────────
HyperlocalPartnerSchema.index({ merchantId: 1, status: 1 });
HyperlocalPartnerSchema.index({ 'location.coordinates': '2dsphere' });
HyperlocalPartnerSchema.index({ businessCategories: 1, status: 1 });
HyperlocalPartnerSchema.index({ partnerTypes: 1, status: 1 });
HyperlocalPartnerSchema.index({ 'networkSettings.discoverable': 1, status: 1 });
HyperlocalPartnerSchema.index({ 'profile.tags': 1 });

PartnershipSchema.index({ merchantA: 1, merchantB: 1 }, { unique: true });
PartnershipSchema.index({ merchantA: 1, status: 1 });
PartnershipSchema.index({ merchantB: 1, status: 1 });
PartnershipSchema.index({ status: 1, expiresAt: 1 });

CrossPromotionDocSchema.index({ partnershipId: 1, status: 1 });
CrossPromotionDocSchema.index({ status: 1, startDate: 1, endDate: 1 });

ReferralDocSchema.index({ referrerMerchantId: 1, referredAt: -1 });
ReferralDocSchema.index({ referralCode: 1 }, { unique: true });

// ── Pre-save Hooks ─────────────────────────────────────────────────────────────

// Normalize partnership to ensure merchantA < merchantB for consistent uniqueness
PartnershipSchema.pre('save', function (next) {
  const a = this.merchantA.toString();
  const b = this.merchantB.toString();
  if (a > b) {
    [this.merchantA, this.merchantB] = [this.merchantB, this.merchantA];
  }
  next();
});

// ── Models ─────────────────────────────────────────────────────────────────────
export const HyperlocalPartner = model<IHyperlocalPartner>('HyperlocalPartner', HyperlocalPartnerSchema);
export const Partnership = model<IPartnership>('Partnership', PartnershipSchema);
export const CrossPromotion = model('CrossPromotion', CrossPromotionDocSchema);
export const Referral = model('Referral', ReferralDocSchema);

export default HyperlocalPartner;
