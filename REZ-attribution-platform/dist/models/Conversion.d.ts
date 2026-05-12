import mongoose, { Document } from 'mongoose';
export declare enum ConversionType {
    PURCHASE = "purchase",
    SIGNUP = "signup",
    SUBSCRIPTION = "subscription",
    LEAD = "lead",
    DOWNLOAD = "download",
    APP_INSTALL = "app_install"
}
export declare enum ConversionStatus {
    PENDING = "pending",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    REFUNDED = "refunded"
}
export interface IConversion extends Document {
    id: string;
    userId: string;
    sessionId: string;
    type: ConversionType;
    status: ConversionStatus;
    merchantId: string;
    storeId?: string;
    orderId?: string;
    value?: number;
    currency?: string;
    items?: Array<{
        productId: string;
        name: string;
        quantity: number;
        price: number;
        category?: string;
    }>;
    location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    attributionData?: {
        touchpointIds: string[];
        attributionModel: string;
        attributedChannel: string;
        attributedCampaignId?: string;
    };
    metadata?: Record<string, unknown>;
    conversionTimestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Conversion: mongoose.Model<IConversion, {}, {}, {}, mongoose.Document<unknown, {}, IConversion, {}, {}> & IConversion & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Conversion.d.ts.map