// @ts-nocheck
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdInteraction extends Document {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  userId: string;
  type: 'impression' | 'click' | 'conversion';
  ip?: string;
  userAgent?: string;
  orderId?: string; // For linking to orders (attribution)
  isFraud: boolean;
  fraudReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdInteractionSchema = new Schema<IAdInteraction>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'AdCampaign',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['impression', 'click', 'conversion'],
      required: true,
      index: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    orderId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    isFraud: {
      type: Boolean,
      default: false,
      index: true,
    },
    fraudReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient queries
AdInteractionSchema.index({ campaignId: 1, type: 1, createdAt: -1 });
AdInteractionSchema.index({ userId: 1, campaignId: 1, createdAt: -1 });
AdInteractionSchema.index({ orderId: 1, campaignId: 1 });

const AdInteraction = mongoose.model<IAdInteraction>('AdInteraction', AdInteractionSchema);

export default AdInteraction;
