// @ts-nocheck
import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * AdCampaign — ad placement campaign for rez-ads-service.
 *
 * Canonical reference: @rez/shared-types CampaignStatus
 * Uses subset: draft, pending_review, active, paused, rejected, completed (6 of 12 canonical values)
 * (Excludes: scheduled, sending, sent, expired, failed, cancelled — not part of ads approval/execution workflow)
 *
 * Note: AdCampaign status values align with the ads review workflow
 * (draft → pending_review → active/rejected/paused → completed).
 * This is different from MarketingCampaign which uses a different subset for bulk messaging.
 */

export interface IAdCampaign extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  storeId: Types.ObjectId;
  title: string;
  headline: string;
  description: string;
  ctaText: string;
  ctaUrl?: string;
  imageUrl: string;
  placement: 'home_banner' | 'explore_feed' | 'store_listing' | 'search_result';
  // Targeting
  targetSegment: 'all' | 'new' | 'loyal' | 'lapsed' | 'nearby';
  targetLocation?: {
    city?: string;
    radiusKm?: number;
  };
  targetInterests?: string[];
  // Budget
  bidType: 'CPC' | 'CPM';
  bidAmount: number;
  dailyBudget: number;
  totalBudget: number;
  totalSpent: number;
  // Schedule
  startDate: Date;
  endDate?: Date;
  // Frequency cap (MED-29)
  frequencyCapDays?: number;
  // Canonical CampaignStatus — uses 6 of 12 canonical values (ads workflow)
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed';
  rejectionReason?: string;
  // Metrics
  impressions: number;
  clicks: number;
  ctr: number; // virtual
  // Admin
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  // DB-HEALTH-017: Soft delete field
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdCampaignSchema = new Schema<IAdCampaign>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    headline: {
      type: String,
      required: true,
      trim: true,
      maxlength: 90,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    ctaText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    ctaUrl: {
      type: String,
      trim: true,
      // MED-28 FIX: Add Mongoose validator to prevent malicious URLs
      validate: {
        validator: function (v: string) {
          if (!v) return true; // Allow empty/undefined
          // Reject javascript:, data:, and other dangerous protocols
          if (/^(javascript|data|vbscript):/i.test(v)) return false;
          // Require http:// or https://
          return /^https?:\/\/./.test(v);
        },
        message: 'ctaUrl must start with http:// or https:// and cannot use javascript:, data:, or vbscript: protocols',
      },
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    placement: {
      type: String,
      enum: ['home_banner', 'explore_feed', 'store_listing', 'search_result'],
      required: true,
      index: true,
    },
    targetSegment: {
      type: String,
      enum: ['all', 'new', 'loyal', 'lapsed', 'nearby'],
      default: 'all',
    },
    targetLocation: {
      city: { type: String, trim: true },
      radiusKm: { type: Number, min: 0 },
    },
    targetInterests: [{ type: String, trim: true }],
    bidType: {
      type: String,
      enum: ['CPC', 'CPM'],
      required: true,
    },
    bidAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    dailyBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    totalBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequencyCapDays: {
      type: Number,
      default: 1,
      min: 1,
      // MED-29 FIX: Add frequencyCapDays field (was referenced but missing from model)
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'active', 'paused', 'rejected', 'completed'],
      default: 'draft',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    // DB-HEALTH-017: Soft delete field
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes
AdCampaignSchema.index({ startDate: 1, endDate: 1 });
AdCampaignSchema.index({ merchantId: 1, status: 1 });
AdCampaignSchema.index({ status: 1, placement: 1, startDate: 1, endDate: 1 });

// DB-HEALTH-015: Enhanced compound index for campaign management
AdCampaignSchema.index({ merchantId: 1, status: 1, startDate: 1, endDate: 1 });

// DB-HEALTH-016: Index for bid type and budget sorting
AdCampaignSchema.index({ status: 1, bidType: 1, dailyBudget: -1 });

// DB-HEALTH-017: Soft delete index
AdCampaignSchema.index({ deletedAt: 1 });

// Virtual: click-through rate
// BAK-MKT-012 FIX: Round CTR to 4 decimal places to avoid floating-point artifacts
AdCampaignSchema.virtual('ctr').get(function () {
  if (!this.impressions || this.impressions === 0) return 0;
  return Math.round((this.clicks / this.impressions) * 10000) / 100;
});

const AdCampaign = mongoose.model<IAdCampaign>('AdCampaign', AdCampaignSchema);

export default AdCampaign;
