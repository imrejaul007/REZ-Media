import mongoose, { Schema, Document } from 'mongoose';
import { IDeal } from '../types/index.js';

export interface IDealDocument extends IDeal, Document {}

const DealSchema = new Schema<IDealDocument>({
  name: { type: String, required: true },
  provider: {
    type: String,
    enum: ['google_adx', 'pubmatic', 'index_exchange'],
    required: true,
  },
  advertiserId: { type: String, required: true },
  floorPrice: { type: Number, required: true },
  status: { type: String, enum: ['active', 'paused', 'ended'], default: 'active' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  targeting: {
    locations: [String],
    screenTypes: [String],
    demographics: { type: Schema.Types.Mixed },
  },
}, { timestamps: true });

DealSchema.index({ provider: 1, status: 1 });
DealSchema.index({ advertiserId: 1 });

export const DealModel = mongoose.model<IDealDocument>('Deal', DealSchema);
