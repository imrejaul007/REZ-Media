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
exports.SyncHistory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../types/index.js");
const SyncErrorSchema = new mongoose_1.Schema({
    externalId: { type: String, required: true },
    error: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });
const SyncHistorySchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: Object.values(index_js_1.CRMProvider),
        required: true,
        index: true,
    },
    entityType: {
        type: String,
        enum: ['contact', 'deal'],
        required: true,
    },
    direction: {
        type: String,
        enum: Object.values(index_js_1.SyncDirection),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(index_js_1.SyncStatus),
        default: index_js_1.SyncStatus.PENDING,
        index: true,
    },
    startedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },
    completedAt: {
        type: Date,
    },
    totalRecords: {
        type: Number,
        default: 0,
    },
    successCount: {
        type: Number,
        default: 0,
    },
    errorCount: {
        type: Number,
        default: 0,
    },
    errors: [SyncErrorSchema],
    details: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: false,
    collection: 'sync_history',
});
// Indexes
SyncHistorySchema.index({ provider: 1, entityType: 1, startedAt: -1 });
SyncHistorySchema.index({ status: 1, startedAt: -1 });
// Virtual for duration
SyncHistorySchema.virtual('durationMs').get(function () {
    if (!this.completedAt)
        return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
});
// Instance methods
SyncHistorySchema.methods.markStarted = function () {
    this.status = index_js_1.SyncStatus.IN_PROGRESS;
    this.startedAt = new Date();
};
SyncHistorySchema.methods.markCompleted = function (successCount, errorCount) {
    this.status = index_js_1.SyncStatus.COMPLETED;
    this.completedAt = new Date();
    this.successCount = successCount;
    this.errorCount = errorCount;
    this.totalRecords = successCount + errorCount;
};
SyncHistorySchema.methods.markFailed = function (error) {
    this.status = index_js_1.SyncStatus.FAILED;
    this.completedAt = new Date();
    if (error) {
        this.errors.push({ externalId: 'SYSTEM', error, timestamp: new Date() });
    }
};
SyncHistorySchema.methods.addError = function (externalId, error) {
    this.errors.push({ externalId, error, timestamp: new Date() });
    this.errorCount = this.errors.length;
};
// Static methods
SyncHistorySchema.statics.findActiveSync = function () {
    return this.findOne({ status: index_js_1.SyncStatus.IN_PROGRESS })
        .sort({ startedAt: -1 });
};
SyncHistorySchema.statics.findRecent = function (provider, limit = 10) {
    const query = {};
    if (provider) {
        query.provider = provider;
    }
    return this.find(query).sort({ startedAt: -1 }).limit(limit);
};
SyncHistorySchema.statics.cleanupOldRecords = async function (daysToKeep = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const result = await this.deleteMany({
        completedAt: { $lt: cutoff },
        status: { $ne: index_js_1.SyncStatus.IN_PROGRESS },
    });
    return result.deletedCount;
};
exports.SyncHistory = mongoose_1.default.model('SyncHistory', SyncHistorySchema);
exports.default = exports.SyncHistory;
//# sourceMappingURL=SyncHistory.js.map