import mongoose, { Schema, Document } from 'mongoose';

export interface IBudgetTrackerDocument extends Document {
  campaignId: string;
  date: Date;
  totalSpent: number;
  totalImpressions: number;
  totalBids: number;
  totalWins: number;
  avgBidPrice: number;
  avgWinPrice: number;
}

const BudgetTrackerSchema = new Schema<IBudgetTrackerDocument>({
  campaignId: { type: String, required: true, index: true },
  date: { type: Date, required: true },
  totalSpent: { type: Number, default: 0 },
  totalImpressions: { type: Number, default: 0 },
  totalBids: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  avgBidPrice: { type: Number, default: 0 },
  avgWinPrice: { type: Number, default: 0 },
}, { timestamps: true });

BudgetTrackerSchema.index({ campaignId: 1, date: -1 });

export const BudgetTrackerModel = mongoose.model<IBudgetTrackerDocument>('BudgetTracker', BudgetTrackerSchema);
