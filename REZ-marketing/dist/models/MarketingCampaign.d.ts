import { Document, Types } from 'mongoose';
/**
 * MarketingCampaign — the core campaign document for rez-marketing-service.
 *
 * Supports all advanced targeting modes:
 *   - segment: pre-defined segments (all, recent, lapsed, high_value, stamp_card)
 *   - location: city/area/pincode filtering
 *   - interest: derived interest tags (coffee, electronics, fashion…)
 *   - birthday: users with upcoming birthday (N days ahead)
 *   - purchase_history: bought product/category in last N days
 *   - institution: college/workplace affiliation
 *   - keyword: users who searched a keyword in REZ app
 *   - custom: arbitrary MongoDB filter (power users)
 *
 * Canonical reference: @rez/shared-types CampaignChannel
 * Uses subset: whatsapp, push, sms, email, in_app (5 of 8 canonical values)
 * (Excludes: social, web, api — not applicable for marketing service)
 *
 * Canonical reference: @rez/shared-types CampaignStatus
 * Uses subset: draft, scheduled, sending, sent, failed, cancelled (6 of 12 canonical values)
 * (Excludes: pending_review, active, paused, completed, expired, rejected — not used in marketing workflow)
 *
 * Objectives: awareness | engagement | sales | win_back
 */
export type CampaignChannel = 'whatsapp' | 'push' | 'sms' | 'email' | 'in_app';
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type CampaignObjective = 'awareness' | 'engagement' | 'sales' | 'win_back';
export type AudienceSegmentType = 'all' | 'recent' | 'lapsed' | 'high_value' | 'stamp_card' | 'location' | 'interest' | 'birthday' | 'purchase_history' | 'institution' | 'keyword' | 'custom';
export interface IAudienceFilter {
    segment: AudienceSegmentType;
    location?: {
        city?: string;
        area?: string;
        pincode?: string;
        radiusKm?: number;
        coordinates?: [number, number];
    };
    interests?: string[];
    birthday?: {
        daysAhead: number;
    };
    purchaseHistory?: {
        categoryIds?: string[];
        productKeywords?: string[];
        withinDays: number;
        minOrderCount?: number;
    };
    institution?: {
        name?: string;
        type?: 'college' | 'school' | 'office' | 'hospital';
        area?: string;
    };
    keyword?: {
        terms: string[];
        withinDays?: number;
    };
    customFilter?: {
        interests?: string[];
        location?: string;
        ageRange?: {
            min?: number;
            max?: number;
        };
        institutions?: string[];
    };
    estimatedCount?: number;
}
export interface ICampaignStats {
    sent: number;
    delivered: number;
    failed: number;
    deduped: number;
    opened: number;
    clicked: number;
    converted: number;
}
export interface IMarketingCampaign extends Document {
    merchantId: Types.ObjectId;
    name: string;
    objective: CampaignObjective;
    channel: CampaignChannel;
    message: string;
    templateName?: string;
    imageUrl?: string;
    ctaUrl?: string;
    ctaText?: string;
    audience: IAudienceFilter;
    status: CampaignStatus;
    scheduledAt?: Date;
    sentAt?: Date;
    audienceEstimatedCountUpdatedAt?: Date;
    stats: ICampaignStats;
    errorMessage?: string;
    dailyBudget?: number;
    totalSpent?: number;
    attributionWindowDays: number;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const MarketingCampaign: import("mongoose").Model<IMarketingCampaign, {}, {}, {}, Document<unknown, {}, IMarketingCampaign, {}, {}> & IMarketingCampaign & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default MarketingCampaign;
//# sourceMappingURL=MarketingCampaign.d.ts.map