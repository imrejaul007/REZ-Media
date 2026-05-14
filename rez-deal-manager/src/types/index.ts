import mongoose, { Schema, Document } from 'mongoose';

export type DealType = 'pmp' | 'preferred' | 'guaranteed';
export type DealStatus = 'draft' | 'pending' | 'active' | 'paused' | 'ended';

export interface IDeal {
  dealId: string;
  name: string;
  type: DealType;
  advertiserId: string;
  publisherId: string;
  ssp: string;
  dealIdExternal?: string;
  floorPrice: number;
  status: DealStatus;
  budget?: number;
  impressions?: number;
  startDate: Date;
  endDate?: Date;
  targeting: {
    geo?: string[];
    screenTypes?: string[];
    screenIds?: string[];
  };
  pacing?: {
    daily: number;
    weekly: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IDealDocument extends IDeal, Document {}

const DealSchema = new Schema({
  dealId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['pmp', 'preferred', 'guaranteed'], required: true },
  advertiserId: { type: String, required: true },
  publisherId: { type: String, required: true },
  ssp: { type: String, required: true },
  dealIdExternal: String,
  floorPrice: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'pending', 'active', 'paused', 'ended'], default: 'draft' },
  budget: Number,
  impressions: Number,
  startDate: { type: Date, required: true },
  endDate: Date,
  targeting: {
    geo: [String],
    screenTypes: [String],
    screenIds: [String],
  },
  pacing: {
    daily: Number,
    weekly: Number,
  },
}, { timestamps: true });

DealSchema.index({ status: 1, advertiserId: 1 });
DealSchema.index({ publisherId: 1, status: 1 });

export const DealModel = mongoose.model<IDealDocument>('Deal', DealSchema);
