import mongoose, { Document } from 'mongoose';
import { Channel } from './Touchpoint';
export declare enum AttributionModel {
    FIRST_TOUCH = "first_touch",
    LAST_TOUCH = "last_touch",
    LINEAR = "linear",
    TIME_DECAY = "time_decay",
    POSITION_BASED = "position_based"
}
export interface IChannelAttribution {
    channel: Channel | string;
    touchpoints: number;
    conversions: number;
    attributedValue: number;
    attributionPercentage: number;
}
export interface ICampaignAttribution {
    campaignId: string;
    campaignName?: string;
    touchpoints: number;
    conversions: number;
    attributedValue: number;
    attributionPercentage: number;
    channelBreakdown: IChannelAttribution[];
}
export interface ITouchpointContribution {
    touchpointId: string;
    touchpointType: string;
    channel: string;
    campaignId?: string;
    timestamp: Date;
    contribution: number;
    contributionPercentage: number;
}
export interface IAttributionReport extends Document {
    id: string;
    reportType: 'single_conversion' | 'campaign' | 'merchant' | 'channel' | 'custom';
    attributionModel: AttributionModel;
    entityId?: string;
    entityType?: 'campaign' | 'merchant' | 'user' | 'custom';
    startDate: Date;
    endDate: Date;
    lookbackDays: number;
    totalTouchpoints: number;
    totalConversions: number;
    totalValue: number;
    conversionRate: number;
    channelAttribution: IChannelAttribution[];
    campaignAttribution: ICampaignAttribution[];
    touchpointContributions: ITouchpointContribution[];
    firstTouchContribution?: number;
    lastTouchContribution?: number;
    middleTouchContribution?: number;
    funnelData?: Array<{
        stage: string;
        count: number;
        dropoffRate: number;
    }>;
    metadata?: Record<string, unknown>;
    generatedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AttributionReport: mongoose.Model<IAttributionReport, {}, {}, {}, mongoose.Document<unknown, {}, IAttributionReport, {}, {}> & IAttributionReport & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AttributionReport.d.ts.map