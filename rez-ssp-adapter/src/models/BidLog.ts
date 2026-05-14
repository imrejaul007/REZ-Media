import mongoose, { Schema, Document } from 'mongoose';

export interface IBidLogDocument extends Document {
  requestId: string;
  provider: string;
  impressionId: string;
  floor: number;
  bidPrice?: number;
  won: boolean;
  revenue?: number;
  timestamp: Date;
  latency: number;
}

const BidLogSchema = new Schema<IBidLogDocument>({
  requestId: { type: String, required: true, index: true },
  provider: { type: String, required: true },
  impressionId: { type: String, required: true },
  floor: { type: Number, required: true },
  bidPrice: { type: Number },
  won: { type: Boolean, default: false },
  revenue: { type: Number, default: 0 },
  timestamp: { type: Date, required: true },
  latency: { type: Number, required: true },
}, { timestamps: true });

BidLogSchema.index({ provider: 1, timestamp: -1 });
BidLogSchema.index({ won: 1, timestamp: -1 });

export const BidLogModel = mongoose.model<IBidLogDocument>('BidLog', BidLogSchema);
