"use strict";
/**
 * Lead Intelligence Service - Mongoose Models
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityCacheModel = exports.EngagementActionModel = exports.ChannelPreferenceModel = exports.AbandonedCartModel = exports.AbandonedSearchModel = exports.LeadScoreModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LeadScoreSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    temperature: {
        type: String,
        enum: ['hot', 'warm', 'cold'],
        required: true,
        index: true,
    },
    score: { type: Number, required: true, min: 0, max: 100 },
    signals: {
        recentSearches: { type: Number, default: 0 },
        abandonedCarts: { type: Number, default: 0 },
        viewedProducts: { type: Number, default: 0 },
        lastActiveHours: { type: Number, default: 0 },
        intentStrength: { type: Number, default: 0, min: 0, max: 1 },
        purchaseProbability: { type: Number, default: 0, min: 0, max: 1 },
    },
    recommendedChannel: {
        type: String,
        enum: ['whatsapp', 'push', 'sms', 'email'],
        required: true,
    },
    recommendedAction: { type: String, required: true },
    calculatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
}, {
    timestamps: true,
    collection: 'lead_scores',
});
// Indexes for efficient querying
LeadScoreSchema.index({ temperature: 1, score: -1 });
LeadScoreSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const AbandonedSearchSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    query: { type: String, required: true },
    resultsShown: [{ type: String }],
    notClicked: [{ type: String }],
    timestamp: { type: Date, default: Date.now, index: true },
    intentDetected: { type: String, default: '' },
    urgencyLevel: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low',
    },
    cartValue: { type: Number },
    reEngaged: { type: Boolean, default: false },
    reEngagementAttempts: { type: Number, default: 0 },
}, {
    timestamps: true,
    collection: 'abandoned_searches',
});
// Index for finding user's abandoned searches
AbandonedSearchSchema.index({ userId: 1, timestamp: -1 });
// TTL index - expire after 72 hours
AbandonedSearchSchema.index({ timestamp: 1 }, { expireAfterSeconds: 72 * 60 * 60 });
const CartItemSchema = new mongoose_1.Schema({
    productId: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    name: { type: String },
    category: { type: String },
}, { _id: false });
const AbandonedCartSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    cartId: { type: String, required: true, unique: true },
    items: [CartItemSchema],
    totalValue: { type: Number, required: true },
    abandonedAt: { type: Date, default: Date.now, index: true },
    lastReminderSent: { type: Date },
    reminderCount: { type: Number, default: 0 },
    recovered: { type: Boolean, default: false, index: true },
    recoveredAt: { type: Date },
    expiresAt: { type: Date, required: true },
}, {
    timestamps: true,
    collection: 'abandoned_carts',
});
// Compound indexes
AbandonedCartSchema.index({ userId: 1, abandonedAt: -1 });
AbandonedCartSchema.index({ recovered: 1, abandonedAt: 1 });
const ChannelPreferenceSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    whatsapp: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    lastWhatsapp: { type: Date },
    lastPush: { type: Date },
    lastSms: { type: Date },
    lastEmail: { type: Date },
}, {
    timestamps: true,
    collection: 'channel_preferences',
});
const EngagementActionSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    channel: {
        type: String,
        enum: ['whatsapp', 'push', 'sms', 'email'],
        required: true,
    },
    actionType: { type: String, required: true },
    message: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    delivered: { type: Boolean, default: false },
    opened: { type: Boolean },
    clicked: { type: Boolean },
    converted: { type: Boolean, index: true },
    correlationId: { type: String, index: true },
}, {
    timestamps: true,
    collection: 'engagement_actions',
});
// Compound indexes for analytics
EngagementActionSchema.index({ userId: 1, sentAt: -1 });
EngagementActionSchema.index({ channel: 1, converted: 1 });
const UserActivityCacheSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    searches: [
        {
            query: String,
            timestamp: Date,
            resultsCount: Number,
            clickedResults: [String],
            intentDetected: String,
        },
    ],
    views: [
        {
            productId: String,
            productName: String,
            category: String,
            timestamp: Date,
            durationSeconds: Number,
            addedToCart: Boolean,
        },
    ],
    cartActions: [
        {
            action: String,
            productId: String,
            quantity: Number,
            timestamp: Date,
        },
    ],
    lastActive: { type: Date, default: Date.now },
    sessionCount: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
}, {
    timestamps: true,
    collection: 'user_activity_cache',
});
// TTL index - expire after 24 hours
UserActivityCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// ============================================================================
// Export Models
// ============================================================================
exports.LeadScoreModel = mongoose_1.default.model('LeadScore', LeadScoreSchema);
exports.AbandonedSearchModel = mongoose_1.default.model('AbandonedSearch', AbandonedSearchSchema);
exports.AbandonedCartModel = mongoose_1.default.model('AbandonedCart', AbandonedCartSchema);
exports.ChannelPreferenceModel = mongoose_1.default.model('ChannelPreference', ChannelPreferenceSchema);
exports.EngagementActionModel = mongoose_1.default.model('EngagementAction', EngagementActionSchema);
exports.UserActivityCacheModel = mongoose_1.default.model('UserActivityCache', UserActivityCacheSchema);
exports.default = {
    LeadScoreModel: exports.LeadScoreModel,
    AbandonedSearchModel: exports.AbandonedSearchModel,
    AbandonedCartModel: exports.AbandonedCartModel,
    ChannelPreferenceModel: exports.ChannelPreferenceModel,
    EngagementActionModel: exports.EngagementActionModel,
    UserActivityCacheModel: exports.UserActivityCacheModel,
};
//# sourceMappingURL=index.js.map