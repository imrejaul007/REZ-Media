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
exports.FeedbackModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FeedbackSchema = new mongoose_1.Schema({
    action_id: {
        type: String,
        required: true,
        index: true
    },
    outcome: {
        type: String,
        enum: ['approved', 'rejected', 'ignored', 'failed', 'edited'],
        required: true,
        index: true
    },
    latency_ms: {
        type: Number,
        default: null
    },
    confidence_score: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    feedback_type: {
        type: String,
        enum: ['explicit', 'implicit'],
        required: true
    },
    merchant_id: {
        type: String,
        required: true,
        index: true
    },
    event_type: {
        type: String,
        required: true,
        index: true
    },
    decision_made: {
        type: String,
        required: true
    },
    original_value: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined
    },
    edited_value: {
        type: mongoose_1.Schema.Types.Mixed,
        default: undefined
    },
    timestamp: {
        type: Number,
        required: true,
        index: true
    }
}, {
    timestamps: false,
    collection: 'feedback'
});
// Compound indexes for common queries
FeedbackSchema.index({ merchant_id: 1, event_type: 1, timestamp: -1 });
FeedbackSchema.index({ merchant_id: 1, outcome: 1, timestamp: -1 });
FeedbackSchema.index({ action_id: 1, timestamp: -1 });
// TTL index to auto-expire old feedback (optional, configurable)
FeedbackSchema.index({ timestamp: 1 }, { expireAfterSeconds: undefined });
exports.FeedbackModel = mongoose_1.default.model('Feedback', FeedbackSchema);
//# sourceMappingURL=feedback.js.map