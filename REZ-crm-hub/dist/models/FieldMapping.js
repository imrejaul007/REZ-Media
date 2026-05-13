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
exports.FieldMapping = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../types/index.js");
const FieldMappingSchema = new mongoose_1.Schema({
    provider: {
        type: String,
        enum: Object.values(index_js_1.CRMProvider),
        required: true,
    },
    entityType: {
        type: String,
        enum: ['contact', 'deal'],
        required: true,
    },
    crmToUnified: {
        type: Map,
        of: String,
        required: true,
    },
    unifiedToCrm: {
        type: Map,
        of: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    collection: 'field_mappings',
});
// Compound index
FieldMappingSchema.index({ provider: 1, entityType: 1 }, { unique: true });
// Static methods
FieldMappingSchema.statics.findByProviderAndType = function (provider, entityType) {
    return this.findOne({ provider, entityType, isActive: true });
};
FieldMappingSchema.statics.upsertMapping = async function (provider, entityType, crmToUnified, unifiedToCrm) {
    const mapping = await this.findOneAndUpdate({ provider, entityType }, {
        $set: {
            crmToUnified,
            unifiedToCrm,
            isActive: true,
        },
    }, { upsert: true, new: true });
    return mapping;
};
// Instance methods
FieldMappingSchema.methods.convertToUnified = function (crmData) {
    const unified = {};
    const mapping = this.crmToUnified;
    for (const [crmField, unifiedField] of mapping.entries()) {
        if (crmData[crmField] !== undefined) {
            unified[unifiedField] = crmData[crmField];
        }
    }
    return unified;
};
FieldMappingSchema.methods.convertFromUnified = function (unifiedData) {
    const crmData = {};
    const mapping = this.unifiedToCrm;
    for (const [unifiedField, crmField] of mapping.entries()) {
        if (unifiedData[unifiedField] !== undefined) {
            crmData[crmField] = unifiedData[unifiedField];
        }
    }
    return crmData;
};
exports.FieldMapping = mongoose_1.default.model('FieldMapping', FieldMappingSchema);
exports.default = exports.FieldMapping;
//# sourceMappingURL=FieldMapping.js.map