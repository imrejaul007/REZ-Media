import mongoose, { Schema, Document } from 'mongoose';
import { IAnalytics } from '../types/index.js';

export interface IAnalyticsDocument extends IAnalytics, Document {}

const AnalyticsSchema = new Schema<IAnalyticsDocument>({
  provider: {
    type: String,
    enum: ['google_adx', 'pubmatic', 'index_exchange'],
    required: true,
  },
  date: { type: Date, required: true },
  requests: { type: Number, default: 0 },
  bids: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  fillRate: { type: Number, default: 0 },
  avgBidPrice: { type: Number, default: 0 },
  avgWinPrice: { type: Number, default: 0 },
}, { timestamps: true });

AnalyticsSchema.index({ provider: 1, date: -1 });

export const AnalyticsModel = mongoose.model<IAnalyticsDocument>('Analytics', AnalyticsSchema);
