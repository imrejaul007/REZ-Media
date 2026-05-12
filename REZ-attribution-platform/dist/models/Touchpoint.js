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
exports.Touchpoint = exports.Channel = exports.TouchpointType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var TouchpointType;
(function (TouchpointType) {
    TouchpointType["AD_VIEW"] = "ad_view";
    TouchpointType["STORE_VISIT"] = "store_visit";
    TouchpointType["WEBSITE_VISIT"] = "website_visit";
    TouchpointType["SEARCH"] = "search";
    TouchpointType["SOCIAL_ENGAGEMENT"] = "social_engagement";
    TouchpointType["EMAIL_OPEN"] = "email_open";
    TouchpointType["APP_OPEN"] = "app_open";
})(TouchpointType || (exports.TouchpointType = TouchpointType = {}));
var Channel;
(function (Channel) {
    Channel["DISPLAY"] = "display";
    Channel["SOCIAL"] = "social";
    Channel["SEARCH"] = "search";
    Channel["VIDEO"] = "video";
    Channel["AUDIO"] = "audio";
    Channel["OOH"] = "ooh";
    Channel["PRINT"] = "print";
    Channel["DIRECT"] = "direct";
    Channel["EMAIL"] = "email";
    Channel["REFERRAL"] = "referral";
})(Channel || (exports.Channel = Channel = {}));
const TouchpointSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: Object.values(TouchpointType),
        required: true,
        index: true
    },
    channel: {
        type: String,
        enum: Object.values(Channel),
        required: true,
        index: true
    },
    campaignId: {
        type: String,
        index: true
    },
    adId: {
        type: String,
        index: true
    },
    creativeId: {
        type: String
    },
    merchantId: {
        type: String,
        index: true
    },
    storeId: {
        type: String,
        index: true
    },
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    deviceFingerprint: String,
    ipAddress: String,
    userAgent: String,
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'touchpoints'
});
// Compound indexes for common queries
TouchpointSchema.index({ userId: 1, timestamp: -1 });
TouchpointSchema.index({ merchantId: 1, timestamp: -1 });
TouchpointSchema.index({ campaignId: 1, timestamp: -1 });
TouchpointSchema.index({ userId: 1, merchantId: 1, timestamp: -1 });
exports.Touchpoint = mongoose_1.default.model('Touchpoint', TouchpointSchema);
//# sourceMappingURL=Touchpoint.js.map