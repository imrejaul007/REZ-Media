"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingCampaign = void 0;
const mongoose_1 = require("mongoose");
const AudienceFilterSchema = new mongoose_1.Schema({
    segment: {
        type: String,
        enum: ['all', 'recent', 'lapsed', 'high_value', 'stamp_card', 'location', 'interest', 'birthday', 'purchase_history', 'institution', 'keyword', 'custom'],
        required: true,
    },
    location: {
        city: String,
        area: String,
        pincode: String,
        radiusKm: Number,
        coordinates: { type: [Number], index: '2dsphere' },
    },
    interests: [String],
    birthday: { daysAhead: Number },
    purchaseHistory: {
        categoryIds: [String],
        productKeywords: [String],
        withinDays: Number,
        minOrderCount: Number,
    },
    institution: {
        name: String,
        type: { type: String, enum: ['college', 'school', 'office', 'hospital'] },
        area: String,
    },
    keyword: {
        terms: [String],
        withinDays: Number,
    },
    customFilter: {
        interests: [String],
        location: String,
        ageRange: {
            min: Number,
            max: Number,
        },
        institutions: [String],
    },
    estimatedCount: Number,
}, { _id: false });
// Recursively check for any $ key at any nesting depth to prevent MongoDB operator injection
function hasDollarKey(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj))
        return false;
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$'))
            return true;
        const val = obj[key];
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
            if (hasDollarKey(val))
                return true;
        }
    }
    return false;
}
// SECURITY: Block MongoDB operator injection in customFilter using a pre-validate hook.
// This replaces the previous .path('customFilter').validate() call which returned undefined
// on subdocument schemas in Mongoose 8, causing the service to crash on startup.
AudienceFilterSchema.pre('validate', function () {
    const value = this.customFilter;
    if (!value)
        return;
    if (hasDollarKey(value)) {
        throw new Error('MongoDB operators (keys starting with "$") are not allowed in customFilter at any nesting depth.');
    }
});
const CampaignStatsSchema = new mongoose_1.Schema({
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    deduped: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
}, { _id: false });
const MarketingCampaignSchema = new mongoose_1.Schema({
    merchantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    objective: {
        type: String,
        enum: ['awareness', 'engagement', 'sales', 'win_back'],
        required: true,
    },
    channel: {
        type: String,
        enum: ['whatsapp', 'push', 'sms', 'email', 'in_app'],
        required: true,
    },
    message: { type: String, required: true, maxlength: 4096 },
    templateName: String,
    imageUrl: String,
    ctaUrl: String,
    ctaText: String,
    audience: { type: AudienceFilterSchema, required: true },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
        default: 'draft',
        index: true,
    },
    scheduledAt: Date,
    sentAt: Date,
    audienceEstimatedCountUpdatedAt: { type: Date, default: Date.now }, // BE-MKT-003: Timestamp when estimate was refreshed
    stats: { type: CampaignStatsSchema, default: () => ({}) },
    errorMessage: String,
    dailyBudget: { type: Number, default: null }, // in paise; null = unlimited
    totalSpent: { type: Number, default: 0 }, // cumulative spend in paise
    attributionWindowDays: { type: Number, default: 7 },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MerchantUser' },
}, { timestamps: true });
// List queries
MarketingCampaignSchema.index({ merchantId: 1, status: 1, createdAt: -1 });
// Scheduled campaign picker
MarketingCampaignSchema.index({ status: 1, scheduledAt: 1 });
exports.MarketingCampaign = (0, mongoose_1.model)('MarketingCampaign', MarketingCampaignSchema);
exports.default = exports.MarketingCampaign;
//# sourceMappingURL=MarketingCampaign.js.map