"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrowthEvent = void 0;
const mongoose_1 = require("mongoose");
const GrowthEventSchema = new mongoose_1.Schema({
    eventType: {
        type: String,
        required: true,
        enum: [
            'campaign_created',
            'ad_impression',
            'ad_click',
            'notification_sent',
            'notification_opened',
            'voucher_issued',
            'conversion',
        ],
        index: true,
    },
    sourceService: {
        type: String,
        required: true,
        enum: ['marketing', 'ads', 'notification', 'analytics'],
        index: true,
    },
    userId: { type: String, index: true },
    merchantId: { type: String, index: true },
    sessionId: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
}, {
    timestamps: true,
    collection: 'growth_events',
});
// Compound indexes for common query patterns
GrowthEventSchema.index({ merchantId: 1, eventType: 1, timestamp: -1 });
GrowthEventSchema.index({ userId: 1, timestamp: -1 });
GrowthEventSchema.index({ eventType: 1, timestamp: -1 });
// TTL index for automatic data retention (90 days default)
GrowthEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
exports.GrowthEvent = (0, mongoose_1.model)('GrowthEvent', GrowthEventSchema);
//# sourceMappingURL=GrowthEvent.js.map