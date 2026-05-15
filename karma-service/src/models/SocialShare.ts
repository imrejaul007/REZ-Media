// @ts-nocheck
// @ts-ignore
/**
 * SocialShare Model — tracks shareable achievements and milestones
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

export type ShareType = 'badge' | 'milestone' | 'achievement' | 'streak' | 'level_up';

export interface ISocialShare {
  _id: mongoose.Types.ObjectId;
  shareId: string; // Unique shareable ID (nanoid)
  userId: mongoose.Types.ObjectId;
  type: ShareType;
  data: {
    title: string;
    description: string;
    image?: string;
    karmaEarned?: number;
    badgeId?: string;
    badgeName?: string;
    level?: string;
    streakDays?: number;
  };
  clickCount: number;
  createdAt: Date;
  expiresAt: Date;
}

export interface SocialShareDocument extends Omit<ISocialShare, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const SocialShareSchema = new Schema<SocialShareDocument>(
  {
    shareId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['badge', 'milestone', 'achievement', 'streak', 'level_up'] as ShareType[],
      required: true,
    },
    data: {
      title: { type: String, required: true },
      description: { type: String, required: true },
      image: { type: String },
      karmaEarned: { type: Number },
      badgeId: { type: String },
      badgeName: { type: String },
      level: { type: String },
      streakDays: { type: Number },
    },
    clickCount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'social_shares',
  },
);

// TTL index to auto-delete expired shares
SocialShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SocialShare: Model<SocialShareDocument> =
  mongoose.models.SocialShare ||
  mongoose.model<SocialShareDocument>('SocialShare', SocialShareSchema);
