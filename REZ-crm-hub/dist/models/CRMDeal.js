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
exports.CRMDeal = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../types/index.js");
const CRMDealSchema = new mongoose_1.Schema({
    externalId: {
        type: String,
        required: true,
        index: true,
    },
    provider: {
        type: String,
        enum: Object.values(index_js_1.CRMProvider),
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    amount: {
        type: Number,
        min: 0,
    },
    currency: {
        type: String,
        default: 'USD',
    },
    stage: {
        type: String,
        required: true,
    },
    probability: {
        type: Number,
        min: 0,
        max: 100,
    },
    closeDate: {
        type: Date,
    },
    contactId: {
        type: String,
        index: true,
    },
    companyName: {
        type: String,
        trim: true,
    },
    description: {
        type: String,
    },
    customFields: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    collection: 'crm_deals',
});
// Compound indexes for efficient queries
CRMDealSchema.index({ provider: 1, externalId: 1 }, { unique: true });
CRMDealSchema.index({ contactId: 1, provider: 1 });
CRMDealSchema.index({ stage: 1, provider: 1 });
CRMDealSchema.index({ amount: 1 });
CRMDealSchema.index({ closeDate: 1 });
CRMDealSchema.index({ createdAt: -1 });
// Static methods
CRMDealSchema.statics.findByExternalId = function (externalId, provider) {
    return this.findOne({ externalId, provider });
};
CRMDealSchema.statics.findByContactId = function (contactId, provider) {
    const query = { contactId };
    if (provider) {
        query.provider = provider;
    }
    return this.find(query);
};
CRMDealSchema.statics.findByStage = function (stage, provider) {
    const query = { stage };
    if (provider) {
        query.provider = provider;
    }
    return this.find(query).sort({ amount: -1 });
};
exports.CRMDeal = mongoose_1.default.model('CRMDeal', CRMDealSchema);
exports.default = exports.CRMDeal;
//# sourceMappingURL=CRMDeal.js.map