import { Schema, model, Document, Types } from 'mongoose';

/**
 * KeywordBid — REZ Search Ads.
 *
 * Merchants bid on keywords. When a REZ user searches that keyword,
 * the merchant's store/product appears as a "Sponsored" result.
 *
 * Billing model: CPC (cost per click) or CPM (cost per 1000 impressions).
 * Budget drawn from Merchant Wallet.
 */

export interface IKeywordBid extends Document {
  merchantId: Types.ObjectId;
  keyword: string;           // e.g. 'coffee', 'biryani', 'nike shoes'
  matchType: 'exact' | 'broad' | 'phrase';
  channel: 'search' | 'feed'; // where to show the ad
  bidAmount: number;          // ₹ per click (CPC) or per 1000 impressions (CPM)
  bidType: 'cpc' | 'cpm';
  dailyBudget: number;        // max ₹ to spend per day
  totalBudget?: number;       // lifetime cap (optional)
  totalSpent: number;
  impressions: number;
  clicks: number;

  // Ad creative
  headline: string;           // 'Best Coffee in BTM — Order Now'
  description?: string;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;

  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KeywordBidSchema = new Schema<IKeywordBid>(
  {
    merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    keyword: { type: String, required: true, trim: true, lowercase: true, index: true },
    matchType: { type: String, enum: ['exact', 'broad', 'phrase'], default: 'broad' },
    channel: { type: String, enum: ['search', 'feed'], default: 'search' },
    bidAmount: { type: Number, required: true, min: 0 },
    bidType: { type: String, enum: ['cpc', 'cpm'], default: 'cpc' },
    dailyBudget: { type: Number, required: true, min: 0 },
    totalBudget: Number,
    totalSpent: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    headline: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 200 },
    imageUrl: String,
    ctaUrl: String,
    ctaText: String,

    isActive: { type: Boolean, default: true, index: true },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true },
);

// Auction query: find all active bids for a keyword, sorted by bid amount desc
KeywordBidSchema.index({ keyword: 1, isActive: 1, bidAmount: -1 });

export const KeywordBid = model<IKeywordBid>('KeywordBid', KeywordBidSchema);
export default KeywordBid;
