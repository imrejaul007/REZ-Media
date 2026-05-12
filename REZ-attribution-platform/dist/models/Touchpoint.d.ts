import mongoose, { Document } from 'mongoose';
export declare enum TouchpointType {
    AD_VIEW = "ad_view",
    STORE_VISIT = "store_visit",
    WEBSITE_VISIT = "website_visit",
    SEARCH = "search",
    SOCIAL_ENGAGEMENT = "social_engagement",
    EMAIL_OPEN = "email_open",
    APP_OPEN = "app_open"
}
export declare enum Channel {
    DISPLAY = "display",
    SOCIAL = "social",
    SEARCH = "search",
    VIDEO = "video",
    AUDIO = "audio",
    OOH = "ooh",// Out-of-home
    PRINT = "print",
    DIRECT = "direct",
    EMAIL = "email",
    REFERRAL = "referral"
}
export interface ITouchpoint extends Document {
    id: string;
    userId: string;
    sessionId: string;
    type: TouchpointType;
    channel: Channel;
    campaignId?: string;
    adId?: string;
    creativeId?: string;
    merchantId?: string;
    storeId?: string;
    location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Touchpoint: mongoose.Model<ITouchpoint, {}, {}, {}, mongoose.Document<unknown, {}, ITouchpoint, {}, {}> & ITouchpoint & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Touchpoint.d.ts.map