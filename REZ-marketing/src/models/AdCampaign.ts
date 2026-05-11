import { Schema, model, Document, Types } from 'mongoose';

/**
 * AdCampaign — ad placement campaign with budget tracking.
 *
 * This is a lightweight model used by BillingService for campaign-level
 * spend accounting. It tracks CPC/CPM charges and enforces daily/total budgets.
 */

export interface IAdCampaign extends Document {
  _id: Types.ObjectId;
  merchantId: Types.ObjectId;
  title: string;
  bidType: 'CPC' | 'CPM';
  bidAmount: number;
  dailyBudget: number;
  totalBudget: number;
  totalSpent: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const AdCampaignSchema = new Schema<IAdCampaign>(
  {
    merchantId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    bidType: { type: String, enum: ['CPC', 'CPM'], required: true },
    bidAmount: { type: Number, required: true, min: 0 },
    dailyBudget: { type: Number, default: 0 },
    totalBudget: { type: Number, required: true, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed'],
      default: 'draft',
    },
  },
  { timestamps: true },
);

export const AdCampaign = model<IAdCampaign>('AdCampaign', AdCampaignSchema);
