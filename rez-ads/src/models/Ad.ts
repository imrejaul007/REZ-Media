import mongoose, { Schema, Document } from 'mongoose';
import { AdStatus, Ad } from '../types/index.js';

const CreativeSchema = new Schema({
  headline: { type: String, maxlength: 255 },
  description: { type: String, maxlength: 2000 },
  imageUrl: String,
  videoUrl: String,
  callToAction: {
    type: String,
    enum: ['learn_more', 'shop_now', 'sign_up', 'download', 'book_now', 'contact'],
  },
  destinationUrl: { type: String, required: false },
  ctaText: { type: String, maxlength: 30 },
}, { _id: false });

const AdSchema = new Schema<Ad & Document>({
  adId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  campaignId: {
    type: String,
    required: true,
    index: true,
  },
  advertiserId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 255,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'carousel'],
    required: true,
  },
  creative: {
    type: CreativeSchema,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(AdStatus),
    default: AdStatus.DRAFT,
    index: true,
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  rejectionReason: String,
}, {
  timestamps: true,
});

// Indexes
AdSchema.index({ campaignId: 1, status: 1 });
AdSchema.index({ advertiserId: 1, status: 1 });
AdSchema.index({ approvalStatus: 1, status: 1 });
AdSchema.index({ createdAt: -1 });

// Virtual for full creative URL
AdSchema.virtual('creativeUrl').get(function() {
  if (this.creative.imageUrl) return this.creative.imageUrl;
  if (this.creative.videoUrl) return this.creative.videoUrl;
  return null;
});

// Methods
AdSchema.methods.isActive = function(): boolean {
  return this.status === AdStatus.APPROVED && this.approvalStatus === 'approved';
};

AdSchema.methods.approve = function(): void {
  this.approvalStatus = 'approved';
  this.status = AdStatus.APPROVED;
};

AdSchema.methods.reject = function(reason: string): void {
  this.approvalStatus = 'rejected';
  this.status = AdStatus.REJECTED;
  this.rejectionReason = reason;
};

AdSchema.methods.pause = function(): void {
  if (this.status === AdStatus.APPROVED) {
    this.status = AdStatus.PAUSED;
  }
};

AdSchema.methods.resume = function(): void {
  if (this.status === AdStatus.PAUSED) {
    this.status = AdStatus.APPROVED;
  }
};

// Statics
AdSchema.statics.findActiveByCampaign = async function(campaignId: string): Promise<Ad[]> {
  return this.find({
    campaignId,
    status: AdStatus.APPROVED,
    approvalStatus: 'approved',
  }).exec();
};

AdSchema.statics.findByAdvertiser = async function(advertiserId: string): Promise<Ad[]> {
  return this.find({ advertiserId }).sort({ createdAt: -1 }).exec();
};

// Ensure virtuals are included in JSON output
AdSchema.set('toJSON', { virtuals: true });
AdSchema.set('toObject', { virtuals: true });

export const AdModel = mongoose.model<Ad & Document>('Ad', AdSchema);
