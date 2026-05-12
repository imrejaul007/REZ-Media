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
exports.Conversion = exports.ConversionStatus = exports.ConversionType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ConversionType;
(function (ConversionType) {
    ConversionType["PURCHASE"] = "purchase";
    ConversionType["SIGNUP"] = "signup";
    ConversionType["SUBSCRIPTION"] = "subscription";
    ConversionType["LEAD"] = "lead";
    ConversionType["DOWNLOAD"] = "download";
    ConversionType["APP_INSTALL"] = "app_install";
})(ConversionType || (exports.ConversionType = ConversionType = {}));
var ConversionStatus;
(function (ConversionStatus) {
    ConversionStatus["PENDING"] = "pending";
    ConversionStatus["COMPLETED"] = "completed";
    ConversionStatus["CANCELLED"] = "cancelled";
    ConversionStatus["REFUNDED"] = "refunded";
})(ConversionStatus || (exports.ConversionStatus = ConversionStatus = {}));
const ConversionSchema = new mongoose_1.Schema({
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
        enum: Object.values(ConversionType),
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(ConversionStatus),
        required: true,
        default: ConversionStatus.PENDING,
        index: true
    },
    merchantId: {
        type: String,
        required: true,
        index: true
    },
    storeId: {
        type: String,
        index: true
    },
    orderId: {
        type: String,
        index: true
    },
    value: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    items: [{
            productId: String,
            name: String,
            quantity: Number,
            price: Number,
            category: String
        }],
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    attributionData: {
        touchpointIds: [String],
        attributionModel: String,
        attributedChannel: String,
        attributedCampaignId: String
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    conversionTimestamp: {
        type: Date,
        required: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'conversions'
});
// Compound indexes for attribution queries
ConversionSchema.index({ userId: 1, conversionTimestamp: -1 });
ConversionSchema.index({ merchantId: 1, conversionTimestamp: -1 });
ConversionSchema.index({ status: 1, conversionTimestamp: -1 });
exports.Conversion = mongoose_1.default.model('Conversion', ConversionSchema);
//# sourceMappingURL=Conversion.js.map