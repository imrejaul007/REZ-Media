"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdCampaign = void 0;
const mongoose_1 = require("mongoose");
const AdCampaignSchema = new mongoose_1.Schema({
    merchantId: { type: mongoose_1.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true },
    bidType: { type: String, enum: ['CPC', 'CPM'], required: true },
    bidAmount: { type: Number, required: true, min: 0 },
    dailyBudget: { type: Number, default: 0 },
    totalBudget: { type: Number, required: true, min: 0 },
    totalSpent: { type: Number, default: 0, min: 0 },
    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'completed'],
        default: 'draft',
    },
}, { timestamps: true });
exports.AdCampaign = (0, mongoose_1.model)('AdCampaign', AdCampaignSchema);
//# sourceMappingURL=AdCampaign.js.map