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
const AdInteractionSchema = new mongoose_1.Schema({
    campaignId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'AdCampaign',
        required: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['impression', 'click', 'conversion'],
        required: true,
        index: true,
    },
    ip: {
        type: String,
        trim: true,
    },
    userAgent: {
        type: String,
        trim: true,
    },
    orderId: {
        type: String,
        trim: true,
        sparse: true,
        index: true,
    },
    isFraud: {
        type: Boolean,
        default: false,
        index: true,
    },
    fraudReason: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
// Compound indexes for efficient queries
AdInteractionSchema.index({ campaignId: 1, type: 1, createdAt: -1 });
AdInteractionSchema.index({ userId: 1, campaignId: 1, createdAt: -1 });
AdInteractionSchema.index({ orderId: 1, campaignId: 1 });
const AdInteraction = mongoose_1.default.model('AdInteraction', AdInteractionSchema);
exports.default = AdInteraction;
//# sourceMappingURL=AdInteraction.js.map