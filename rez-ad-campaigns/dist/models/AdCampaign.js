"use strict";
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
// @ts-nocheck
const mongoose_1 = __importStar(require("mongoose"));
const AdCampaignSchema = new mongoose_1.Schema({
    merchantId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Merchant',
        required: true,
        index: true,
    },
    storeId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
    },
    headline: {
        type: String,
        required: true,
        trim: true,
        maxlength: 90,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    ctaText: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
    },
    ctaUrl: {
        type: String,
        trim: true,
        // MED-28 FIX: Add Mongoose validator to prevent malicious URLs
        validate: {
            validator: function (v) {
                if (!v)
                    return true; // Allow empty/undefined
                // Reject javascript:, data:, and other dangerous protocols
                if (/^(javascript|data|vbscript):/i.test(v))
                    return false;
                // Require http:// or https://
                return /^https?:\/\/./.test(v);
            },
            message: 'ctaUrl must start with http:// or https:// and cannot use javascript:, data:, or vbscript: protocols',
        },
    },
    imageUrl: {
        type: String,
        required: true,
        trim: true,
    },
    placement: {
        type: String,
        enum: ['home_banner', 'explore_feed', 'store_listing', 'search_result'],
        required: true,
        index: true,
    },
    targetSegment: {
        type: String,
        enum: ['all', 'new', 'loyal', 'lapsed', 'nearby'],
        default: 'all',
    },
    targetLocation: {
        city: { type: String, trim: true },
        radiusKm: { type: Number, min: 0 },
    },
    targetInterests: [{ type: String, trim: true }],
    bidType: {
        type: String,
        enum: ['CPC', 'CPM'],
        required: true,
    },
    bidAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    dailyBudget: {
        type: Number,
        required: true,
        min: 0,
    },
    totalBudget: {
        type: Number,
        required: true,
        min: 0,
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0,
    },
    frequencyCapDays: {
        type: Number,
        default: 1,
        min: 1,
        // MED-29 FIX: Add frequencyCapDays field (was referenced but missing from model)
    },
    startDate: {
        type: Date,
        required: true,
        index: true,
    },
    endDate: {
        type: Date,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'pending_review', 'active', 'paused', 'rejected', 'completed'],
        default: 'draft',
        index: true,
    },
    rejectionReason: {
        type: String,
        trim: true,
    },
    impressions: {
        type: Number,
        default: 0,
        min: 0,
    },
    clicks: {
        type: Number,
        default: 0,
        min: 0,
    },
    reviewedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewedAt: {
        type: Date,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Compound indexes
AdCampaignSchema.index({ startDate: 1, endDate: 1 });
AdCampaignSchema.index({ merchantId: 1, status: 1 });
AdCampaignSchema.index({ status: 1, placement: 1, startDate: 1, endDate: 1 });
// Virtual: click-through rate
// BAK-MKT-012 FIX: Round CTR to 4 decimal places to avoid floating-point artifacts
AdCampaignSchema.virtual('ctr').get(function () {
    if (!this.impressions || this.impressions === 0)
        return 0;
    return Math.round((this.clicks / this.impressions) * 10000) / 100;
});
const AdCampaign = mongoose_1.default.model('AdCampaign', AdCampaignSchema);
exports.default = AdCampaign;
//# sourceMappingURL=AdCampaign.js.map