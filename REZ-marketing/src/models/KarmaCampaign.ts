import { Schema, model, Document, Types } from 'mongoose';

/**
 * KarmaCampaign — campaign document for REZ Marketing Platform's Karma system.
 *
 * Supports campaign types:
 *   - blood_donation: Blood donation camps and drives
 *   - food_distribution: Food distribution to underprivileged
 *   - tree_plantation: Tree planting and environmental initiatives
 *   - ngo_collaboration: Partnerships with NGOs for social causes
 *   - volunteer: Volunteer work opportunities
 *   - environment: General environmental conservation efforts
 *
 * Campaign statuses:
 *   - draft: Created but not published
 *   - active: Open for participation
 *   - completed: Campaign ended, participants verified
 *   - cancelled: Campaign cancelled by merchant
 *
 * Participation statuses:
 *   - registered: User registered for campaign
 *   - attended: User attended/participated in campaign
 *   - verified: Merchant verified user's participation
 *   - rewarded: Branded Coins rewards distributed
 */

export type KarmaCampaignType =
  | 'blood_donation'
  | 'food_distribution'
  | 'tree_plantation'
  | 'ngo_collaboration'
  | 'volunteer'
  | 'environment';

export type KarmaCampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type ParticipationStatus = 'registered' | 'attended' | 'verified' | 'rewarded';

/**
 * Location data for campaign
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
 * Campaign schedule
 */
export interface ISchedule {
  startDate: Date;
  endDate: Date;
  startTime?: string; // HH:mm format
  endTime?: string;   // HH:mm format
  isAllDay?: boolean;
}

/**
 * Reward configuration
 */
export interface IRewardConfig {
  coinsPerParticipant: number;     // Base coins for participation
  bonusCoinsForCompletion?: number; // Additional coins for completing all tasks
  maxTotalRewards?: number;       // Cap on total rewards distributed
  currentRewardPoolUsed?: number; // Track used rewards
}

/**
 * Badge configuration
 */
export interface IBadgeConfig {
  badgeName: string;
  badgeDescription?: string;
  badgeIcon?: string;
  earnAfterCount?: number; // Earn badge after N participations
}

/**
 * Campaign statistics
 */
export interface ICampaignStats {
  totalRegistrations: number;
  totalAttendances: number;
  totalVerifications: number;
  totalRewardsDistributed: number;
  totalCoinsAwarded: number;
  sharesCount: number;
  viewsCount: number;
}

/**
 * Social sharing configuration
 */
export interface ISharingConfig {
  autoShareOnCompletion: boolean;
  shareTextTemplates?: Record<string, string>; // platform -> template
  includeCampaignImage?: boolean;
  includeTrackingLink?: boolean;
}

/**
 * Karma campaign document interface
 */
export interface IKarmaCampaign extends Document {
  merchantId: Types.ObjectId;
  name: string;
  description: string;
  campaignType: KarmaCampaignType;
  status: KarmaCampaignStatus;

  // Campaign details
  imageUrl?: string;
  coverImageUrl?: string;
  objectives: string[];           // What the campaign aims to achieve
  requirements?: string[];       // Requirements for participation
  impactMetrics?: Record<string, string>; // e.g., { "meals_distributed": "100" }

  // Location and schedule
  location: ILocation;
  schedule: ISchedule;
  participantLimit?: number;     // Max participants allowed

  // Rewards and badges
  rewardConfig: IRewardConfig;
  badgeConfig?: IBadgeConfig;

  // Social sharing
  sharingConfig?: ISharingConfig;

  // Statistics
  stats: ICampaignStats;

  // Merchant goodwill tracking
  merchantGoodwill: {
    totalCampaignsOrganized: number;
    totalParticipantsImpacted: number;
    totalCoinsDistributed: number;
    goodwillScore: number;        // Calculated score based on campaigns
  };

  // Verification settings
  verificationSettings: {
    requirePhotoProof?: boolean;
    requireCheckIn?: boolean;
    verificationDeadlineHours?: number; // Hours after event to verify
    manualVerificationRequired?: boolean;
  };

  // Metadata
  createdBy?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  tags?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Participant document interface
 */
export interface IParticipant extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ParticipationStatus;

  // Participation details
  registeredAt: Date;
  checkInTime?: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationNotes?: string;

  // Proof
  proofPhotoUrl?: string;
  checkInLocation?: ILocation;

  // Rewards
  coinsEarned?: number;
  badgeEarned?: boolean;
  badgeEarnedAt?: Date;

  // Social sharing
  sharedOnSocial?: boolean;
  sharePlatform?: string;
  sharedAt?: Date;
  shareText?: string;

  // Feedback
  feedback?: string;
  feedbackRating?: number; // 1-5

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
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

// ── Schedule Schema ─────────────────────────────────────────────────────────────
const ScheduleSchema = new Schema<ISchedule>(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: String,
    endTime: String,
    isAllDay: { type: Boolean, default: false },
  },
  { _id: false },
);

// ── Reward Config Schema ─────────────────────────────────────────────────────────
const RewardConfigSchema = new Schema<IRewardConfig>(
  {
    coinsPerParticipant: { type: Number, required: true, min: 0 },
    bonusCoinsForCompletion: { type: Number, default: 0, min: 0 },
    maxTotalRewards: Number,
    currentRewardPoolUsed: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ── Badge Config Schema ──────────────────────────────────────────────────────────
const BadgeConfigSchema = new Schema<IBadgeConfig>(
  {
    badgeName: { type: String, required: true },
    badgeDescription: String,
    badgeIcon: String,
    earnAfterCount: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

// ── Campaign Stats Schema ────────────────────────────────────────────────────────
const CampaignStatsSchema = new Schema<ICampaignStats>(
  {
    totalRegistrations: { type: Number, default: 0 },
    totalAttendances: { type: Number, default: 0 },
    totalVerifications: { type: Number, default: 0 },
    totalRewardsDistributed: { type: Number, default: 0 },
    totalCoinsAwarded: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
  },
  { _id: false },
);

// ── Sharing Config Schema ───────────────────────────────────────────────────────
const SharingConfigSchema = new Schema<ISharingConfig>(
  {
    autoShareOnCompletion: { type: Boolean, default: true },
    shareTextTemplates: { type: Map, of: String },
    includeCampaignImage: { type: Boolean, default: true },
    includeTrackingLink: { type: Boolean, default: true },
  },
  { _id: false },
);

// ── Merchant Goodwill Schema ────────────────────────────────────────────────────
const MerchantGoodwillSchema = new Schema(
  {
    totalCampaignsOrganized: { type: Number, default: 0 },
    totalParticipantsImpacted: { type: Number, default: 0 },
    totalCoinsDistributed: { type: Number, default: 0 },
    goodwillScore: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ── Verification Settings Schema ────────────────────────────────────────────────
const VerificationSettingsSchema = new Schema(
  {
    requirePhotoProof: { type: Boolean, default: false },
    requireCheckIn: { type: Boolean, default: false },
    verificationDeadlineHours: { type: Number, default: 72 },
    manualVerificationRequired: { type: Boolean, default: false },
  },
  { _id: false },
);

// ── KarmaCampaign Schema ────────────────────────────────────────────────────────
const KarmaCampaignSchema = new Schema<IKarmaCampaign>(
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
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    campaignType: {
      type: String,
      enum: ['blood_donation', 'food_distribution', 'tree_plantation', 'ngo_collaboration', 'volunteer', 'environment'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    // Campaign details
    imageUrl: String,
    coverImageUrl: String,
    objectives: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    impactMetrics: { type: Map, of: String },

    // Location and schedule
    location: { type: LocationSchema, required: true },
    schedule: { type: ScheduleSchema, required: true },
    participantLimit: { type: Number, min: 1 },

    // Rewards and badges
    rewardConfig: { type: RewardConfigSchema, required: true },
    badgeConfig: { type: BadgeConfigSchema },

    // Social sharing
    sharingConfig: { type: SharingConfigSchema },

    // Statistics
    stats: { type: CampaignStatsSchema, default: () => ({}) },

    // Merchant goodwill tracking
    merchantGoodwill: { type: MerchantGoodwillSchema, default: () => ({}) },

    // Verification settings
    verificationSettings: { type: VerificationSettingsSchema, default: () => ({}) },

    // Metadata
    createdBy: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
    metadata: { type: Schema.Types.Mixed },
    tags: [String],
  },
  { timestamps: true },
);

// ── Indexes ─────────────────────────────────────────────────────────────────────
KarmaCampaignSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
KarmaCampaignSchema.index({ campaignType: 1, status: 1 });
KarmaCampaignSchema.index({ 'location.coordinates': '2dsphere' });
KarmaCampaignSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
KarmaCampaignSchema.index({ status: 1, 'schedule.endDate': 1 }); // For finding expired campaigns

// ── Participant Schema ──────────────────────────────────────────────────────────
const ParticipantSchema = new Schema<IParticipant>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'KarmaCampaign',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'verified', 'rewarded'],
      default: 'registered',
      index: true,
    },

    // Participation details
    registeredAt: { type: Date, default: Date.now },
    checkInTime: Date,
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'MerchantUser' },
    verificationNotes: String,

    // Proof
    proofPhotoUrl: String,
    checkInLocation: { type: LocationSchema },

    // Rewards
    coinsEarned: { type: Number, default: 0 },
    badgeEarned: { type: Boolean, default: false },
    badgeEarnedAt: Date,

    // Social sharing
    sharedOnSocial: { type: Boolean, default: false },
    sharePlatform: String,
    sharedAt: Date,
    shareText: String,

    // Feedback
    feedback: String,
    feedbackRating: { type: Number, min: 1, max: 5 },

    // Metadata
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

// Compound indexes for common queries
ParticipantSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
ParticipantSchema.index({ userId: 1, status: 1 });
ParticipantSchema.index({ campaignId: 1, status: 1 });

// ── Models ─────────────────────────────────────────────────────────────────────
export const KarmaCampaign = model<IKarmaCampaign>('KarmaCampaign', KarmaCampaignSchema);
export const Participant = model<IParticipant>('Participant', ParticipantSchema);

export default KarmaCampaign;
