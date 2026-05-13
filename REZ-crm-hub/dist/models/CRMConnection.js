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
exports.CRMConnection = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../types/index.js");
const OAuthTokensSchema = new mongoose_1.Schema({
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Number, required: true },
    tokenType: { type: String, default: 'Bearer' },
    scope: { type: String },
}, { _id: false });
const CRMConnectionSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: Object.values(index_js_1.CRMProvider),
        required: true,
        unique: true,
    },
    isConnected: {
        type: Boolean,
        default: false,
    },
    tokens: OAuthTokensSchema,
    accountInfo: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    lastSyncAt: {
        type: Date,
    },
    syncEnabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    collection: 'crm_connections',
});
// Instance methods
CRMConnectionSchema.methods.setTokens = function (tokens) {
    this.tokens = tokens;
    this.isConnected = true;
};
CRMConnectionSchema.methods.clearTokens = function () {
    this.tokens = undefined;
    this.isConnected = false;
};
CRMConnectionSchema.methods.isTokenExpired = function () {
    if (!this.tokens)
        return true;
    return Date.now() >= (this.tokens.expiresAt - 5 * 60 * 1000);
};
CRMConnectionSchema.methods.updateLastSync = function () {
    this.lastSyncAt = new Date();
};
// Static methods
CRMConnectionSchema.statics.findByProvider = function (provider) {
    return this.findOne({ provider });
};
CRMConnectionSchema.statics.findAllConnected = function () {
    return this.find({ isConnected: true, syncEnabled: true });
};
exports.CRMConnection = mongoose_1.default.model('CRMConnection', CRMConnectionSchema);
exports.default = exports.CRMConnection;
//# sourceMappingURL=CRMConnection.js.map