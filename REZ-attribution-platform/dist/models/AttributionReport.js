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
exports.AttributionReport = exports.AttributionModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var AttributionModel;
(function (AttributionModel) {
    AttributionModel["FIRST_TOUCH"] = "first_touch";
    AttributionModel["LAST_TOUCH"] = "last_touch";
    AttributionModel["LINEAR"] = "linear";
    AttributionModel["TIME_DECAY"] = "time_decay";
    AttributionModel["POSITION_BASED"] = "position_based";
})(AttributionModel || (exports.AttributionModel = AttributionModel = {}));
const ChannelAttributionSchema = new mongoose_1.Schema({
    channel: String,
    touchpoints: Number,
    conversions: Number,
    attributedValue: Number,
    attributionPercentage: Number
}, { _id: false });
const CampaignAttributionSchema = new mongoose_1.Schema({
    campaignId: String,
    campaignName: String,
    touchpoints: Number,
    conversions: Number,
    attributedValue: Number,
    attributionPercentage: Number,
    channelBreakdown: [ChannelAttributionSchema]
}, { _id: false });
const TouchpointContributionSchema = new mongoose_1.Schema({
    touchpointId: String,
    touchpointType: String,
    channel: String,
    campaignId: String,
    timestamp: Date,
    contribution: Number,
    contributionPercentage: Number
}, { _id: false });
const FunnelStageSchema = new mongoose_1.Schema({
    stage: String,
    count: Number,
    dropoffRate: Number
}, { _id: false });
const AttributionReportSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    reportType: {
        type: String,
        enum: ['single_conversion', 'campaign', 'merchant', 'channel', 'custom'],
        required: true,
        index: true
    },
    attributionModel: {
        type: String,
        enum: Object.values(AttributionModel),
        required: true,
        index: true
    },
    entityId: {
        type: String,
        index: true
    },
    entityType: {
        type: String,
        enum: ['campaign', 'merchant', 'user', 'custom']
    },
    startDate: {
        type: Date,
        required: true,
        index: true
    },
    endDate: {
        type: Date,
        required: true,
        index: true
    },
    lookbackDays: {
        type: Number,
        required: true
    },
    totalTouchpoints: {
        type: Number,
        default: 0
    },
    totalConversions: {
        type: Number,
        default: 0
    },
    totalValue: {
        type: Number,
        default: 0
    },
    conversionRate: {
        type: Number,
        default: 0
    },
    channelAttribution: [ChannelAttributionSchema],
    campaignAttribution: [CampaignAttributionSchema],
    touchpointContributions: [TouchpointContributionSchema],
    firstTouchContribution: Number,
    lastTouchContribution: Number,
    middleTouchContribution: Number,
    funnelData: [FunnelStageSchema],
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    generatedAt: {
        type: Date,
        required: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'attribution_reports'
});
// Compound indexes for common queries
AttributionReportSchema.index({ reportType: 1, attributionModel: 1, generatedAt: -1 });
AttributionReportSchema.index({ entityId: 1, entityType: 1, generatedAt: -1 });
exports.AttributionReport = mongoose_1.default.model('AttributionReport', AttributionReportSchema);
//# sourceMappingURL=AttributionReport.js.map