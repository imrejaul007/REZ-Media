import mongoose, { Document, Types } from 'mongoose';
/**
 * AdCampaign — ad placement campaign for rez-ads-service.
 *
 * Canonical reference: @rez/shared-types CampaignStatus
 * Uses subset: draft, pending_review, active, paused, rejected, completed (6 of 12 canonical values)
 * (Excludes: scheduled, sending, sent, expired, failed, cancelled — not part of ads approval/execution workflow)
 *
 * Note: AdCampaign status values align with the ads review workflow
 * (draft → pending_review → active/rejected/paused → completed).
 * This is different from MarketingCampaign which uses a different subset for bulk messaging.
 */
export interface IAdCampaign extends Document {
    _id: Types.ObjectId;
    merchantId: Types.ObjectId;
    storeId: Types.ObjectId;
    title: string;
    headline: string;
    description: string;
    ctaText: string;
    ctaUrl?: string;
    imageUrl: string;
    placement: 'home_banner' | 'explore_feed' | 'store_listing' | 'search_result';
    targetSegment: 'all' | 'new' | 'loyal' | 'lapsed' | 'nearby';
    targetLocation?: {
        city?: string;
        radiusKm?: number;
    };
    targetInterests?: string[];
    bidType: 'CPC' | 'CPM';
    bidAmount: number;
    dailyBudget: number;
    totalBudget: number;
    totalSpent: number;
    startDate: Date;
    endDate?: Date;
    frequencyCapDays?: number;
    status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed';
    rejectionReason?: string;
    impressions: number;
    clicks: number;
    ctr: number;
    reviewedBy?: Types.ObjectId;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const AdCampaign: mongoose.Model<IAdCampaign, {}, {}, {}, mongoose.Document<unknown, {}, IAdCampaign, {}, {}> & IAdCampaign & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default AdCampaign;
//# sourceMappingURL=AdCampaign.d.ts.map