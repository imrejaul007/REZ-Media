"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordBid = void 0;
const mongoose_1 = require("mongoose");
const KeywordBidSchema = new mongoose_1.Schema({
    merchantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Merchant', required: true, index: true },
    keyword: { type: String, required: true, trim: true, lowercase: true, index: true },
    matchType: { type: String, enum: ['exact', 'broad', 'phrase'], default: 'broad' },
    channel: { type: String, enum: ['search', 'feed'], default: 'search' },
    bidAmount: { type: Number, required: true, min: 0 },
    bidType: { type: String, enum: ['cpc', 'cpm'], default: 'cpc' },
    dailyBudget: { type: Number, required: true, min: 0 },
    totalBudget: Number,
    totalSpent: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    headline: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 200 },
    imageUrl: String,
    ctaUrl: String,
    ctaText: String,
    isActive: { type: Boolean, default: true, index: true },
    startDate: Date,
    endDate: Date,
}, { timestamps: true });
// Auction query: find all active bids for a keyword, sorted by bid amount desc
KeywordBidSchema.index({ keyword: 1, isActive: 1, bidAmount: -1 });
exports.KeywordBid = (0, mongoose_1.model)('KeywordBid', KeywordBidSchema);
exports.default = exports.KeywordBid;
//# sourceMappingURL=KeywordBid.js.map