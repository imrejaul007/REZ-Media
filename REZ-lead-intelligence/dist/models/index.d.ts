/**
 * Lead Intelligence Service - Mongoose Models
 */
import mongoose, { Document } from 'mongoose';
import { RecommendedChannel, UrgencyLevel, LeadScore, CartItem } from '../types';
export interface ILeadScore extends Omit<LeadScore, 'signals'>, Document {
    signals: {
        recentSearches: number;
        abandonedCarts: number;
        viewedProducts: number;
        lastActiveHours: number;
        intentStrength: number;
        purchaseProbability: number;
    };
}
export interface IAbandonedSearch extends Document {
    userId: string;
    query: string;
    resultsShown: string[];
    notClicked: string[];
    timestamp: Date;
    intentDetected: string;
    urgencyLevel: UrgencyLevel;
    cartValue?: number;
    reEngaged: boolean;
    reEngagementAttempts: number;
}
export interface IAbandonedCart extends Document {
    userId: string;
    cartId: string;
    items: CartItem[];
    totalValue: number;
    abandonedAt: Date;
    lastReminderSent?: Date;
    reminderCount: number;
    recovered: boolean;
    recoveredAt?: Date;
    expiresAt: Date;
}
export interface IChannelPreference extends Document {
    userId: string;
    whatsapp: boolean;
    push: boolean;
    sms: boolean;
    email: boolean;
    lastWhatsapp?: Date;
    lastPush?: Date;
    lastSms?: Date;
    lastEmail?: Date;
}
export interface IEngagementAction extends Document {
    userId: string;
    channel: RecommendedChannel;
    actionType: string;
    message: string;
    sentAt: Date;
    delivered: boolean;
    opened?: boolean;
    clicked?: boolean;
    converted?: boolean;
    correlationId?: string;
}
export interface IUserActivityCache extends Document {
    userId: string;
    searches: Array<{
        query: string;
        timestamp: Date;
        resultsCount: number;
        clickedResults: string[];
        intentDetected?: string;
    }>;
    views: Array<{
        productId: string;
        productName?: string;
        category?: string;
        timestamp: Date;
        durationSeconds?: number;
        addedToCart: boolean;
    }>;
    cartActions: Array<{
        action: 'add' | 'remove' | 'update';
        productId: string;
        quantity?: number;
        timestamp: Date;
    }>;
    lastActive: Date;
    sessionCount: number;
    expiresAt: Date;
}
export declare const LeadScoreModel: mongoose.Model<ILeadScore, {}, {}, {}, mongoose.Document<unknown, {}, ILeadScore, {}, {}> & ILeadScore & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const AbandonedSearchModel: mongoose.Model<IAbandonedSearch, {}, {}, {}, mongoose.Document<unknown, {}, IAbandonedSearch, {}, {}> & IAbandonedSearch & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const AbandonedCartModel: mongoose.Model<IAbandonedCart, {}, {}, {}, mongoose.Document<unknown, {}, IAbandonedCart, {}, {}> & IAbandonedCart & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const ChannelPreferenceModel: mongoose.Model<IChannelPreference, {}, {}, {}, mongoose.Document<unknown, {}, IChannelPreference, {}, {}> & IChannelPreference & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const EngagementActionModel: mongoose.Model<IEngagementAction, {}, {}, {}, mongoose.Document<unknown, {}, IEngagementAction, {}, {}> & IEngagementAction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const UserActivityCacheModel: mongoose.Model<IUserActivityCache, {}, {}, {}, mongoose.Document<unknown, {}, IUserActivityCache, {}, {}> & IUserActivityCache & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
declare const _default: {
    LeadScoreModel: mongoose.Model<ILeadScore, {}, {}, {}, mongoose.Document<unknown, {}, ILeadScore, {}, {}> & ILeadScore & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AbandonedSearchModel: mongoose.Model<IAbandonedSearch, {}, {}, {}, mongoose.Document<unknown, {}, IAbandonedSearch, {}, {}> & IAbandonedSearch & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AbandonedCartModel: mongoose.Model<IAbandonedCart, {}, {}, {}, mongoose.Document<unknown, {}, IAbandonedCart, {}, {}> & IAbandonedCart & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    ChannelPreferenceModel: mongoose.Model<IChannelPreference, {}, {}, {}, mongoose.Document<unknown, {}, IChannelPreference, {}, {}> & IChannelPreference & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    EngagementActionModel: mongoose.Model<IEngagementAction, {}, {}, {}, mongoose.Document<unknown, {}, IEngagementAction, {}, {}> & IEngagementAction & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    UserActivityCacheModel: mongoose.Model<IUserActivityCache, {}, {}, {}, mongoose.Document<unknown, {}, IUserActivityCache, {}, {}> & IUserActivityCache & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map