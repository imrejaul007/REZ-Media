import mongoose, { Schema, Document } from 'mongoose';

export interface IBidLogDocument extends Document {
  requestId: string;
  campaignId: string;
  exchange: string;
  impressionId: string;
  floor: number;
  bidPrice: number;
  winPrice?: number;
  won: boolean;
  spent: number;
  timestamp: Date;
  latency: number;
}

const BidLogSchema = new Schema<IBidLogDocument>({
  requestId: { type: String, required: true, index: true },
  campaignId: { type: String, required: true, index: true },
  exchange: { type: String, required: true },
  impressionId: { type: String, required: true },
  floor: { type: Number, required: true },
  bidPrice: { type: Number, required: true },
  winPrice: { type: Number },
  won: { type: Boolean, default: false },
  spent: { type: Number, default: 0 },
  timestamp: { type: Date, required: true },
  latency: { type: Number, required: true },
}, { timestamps: true });

BidLogSchema.index({ campaignId: 1, timestamp: -1 });
BidLogSchema.index({ exchange: 1, timestamp: -1 });

export const BidLogModel = mongoose.model<IBidLogDocument>('BidLog', BidLogSchema);
