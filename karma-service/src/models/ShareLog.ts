// @ts-nocheck
// @ts-ignore
/**
 * ShareLog Model — tracks individual share events and awards bonus karma
 */
import mongoose, { Schema, Document, Model } from 'mongoose';

export type SharePlatform = 'twitter' | 'facebook' | 'whatsapp' | 'instagram' | 'linkedin' | 'copy_link';

export interface IShareLog {
  _id: mongoose.Types.ObjectId;
  shareId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  platform: SharePlatform;
  sharedAt: Date;
  karmaAwarded: number;
  bonusRejected: boolean;
  rejectionReason?: string;
}

export interface ShareLogDocument extends Omit<IShareLog, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const ShareLogSchema = new Schema<ShareLogDocument>(
  {
    shareId: { type: Schema.Types.ObjectId, ref: 'SocialShare', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: {
      type: String,
      enum: ['twitter', 'facebook', 'whatsapp', 'instagram', 'linkedin', 'copy_link'] as SharePlatform[],
      required: true,
    },
    sharedAt: { type: Date, default: Date.now },
    karmaAwarded: { type: Number, default: 0 },
    bonusRejected: { type: Boolean, default: false },
    rejectionReason: { type: String },
  },
  {
    timestamps: false,
    collection: 'share_logs',
  },
);

// Compound index for daily share limit queries
ShareLogSchema.index({ userId: 1, sharedAt: -1 });

// Unique constraint: one share per platform per shareId
ShareLogSchema.index({ shareId: 1, platform: 1 }, { unique: true });

export const ShareLog: Model<ShareLogDocument> =
  mongoose.models.ShareLog ||
  mongoose.model<ShareLogDocument>('ShareLog', ShareLogSchema);
