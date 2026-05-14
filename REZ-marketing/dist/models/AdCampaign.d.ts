import { Document, Types } from 'mongoose';
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
export declare const AdCampaign: import("mongoose").Model<IAdCampaign, {}, {}, {}, Document<unknown, {}, IAdCampaign, {}, {}> & IAdCampaign & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AdCampaign.d.ts.map