import { Document, Types } from 'mongoose';
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
    keyword: string;
    matchType: 'exact' | 'broad' | 'phrase';
    channel: 'search' | 'feed';
    bidAmount: number;
    bidType: 'cpc' | 'cpm';
    dailyBudget: number;
    totalBudget?: number;
    totalSpent: number;
    impressions: number;
    clicks: number;
    headline: string;
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
export declare const KeywordBid: import("mongoose").Model<IKeywordBid, {}, {}, {}, Document<unknown, {}, IKeywordBid, {}, {}> & IKeywordBid & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default KeywordBid;
//# sourceMappingURL=KeywordBid.d.ts.map