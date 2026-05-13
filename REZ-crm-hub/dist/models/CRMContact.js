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
exports.CRMContact = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const index_js_1 = require("../types/index.js");
const PhoneSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['work', 'home', 'mobile', 'other'],
    },
    number: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
}, { _id: false });
const EmailSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['work', 'home', 'other'],
    },
    address: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
}, { _id: false });
const AddressSchema = new mongoose_1.Schema({
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
}, { _id: false });
const CRMContactSchema = new mongoose_1.Schema({
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
    email: {
        type: String,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
    },
    phone: PhoneSchema,
    phones: [PhoneSchema],
    emails: [EmailSchema],
    company: {
        type: String,
        trim: true,
    },
    jobTitle: {
        type: String,
        trim: true,
    },
    address: AddressSchema,
    tags: [{
            type: String,
            trim: true,
        }],
    notes: {
        type: String,
    },
    lifecycleStage: {
        type: String,
    },
    leadSource: {
        type: String,
    },
    customFields: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    syncStatus: {
        type: String,
        enum: Object.values(index_js_1.ContactSyncStatus),
        default: index_js_1.ContactSyncStatus.PENDING,
        index: true,
    },
    lastSyncedAt: {
        type: Date,
    },
    syncError: {
        type: String,
    },
    linkedRezUserId: {
        type: String,
        index: true,
        sparse: true,
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: true,
    collection: 'crm_contacts',
});
// Compound indexes for efficient queries
CRMContactSchema.index({ provider: 1, externalId: 1 }, { unique: true });
CRMContactSchema.index({ email: 1, provider: 1 });
CRMContactSchema.index({ linkedRezUserId: 1, provider: 1 });
CRMContactSchema.index({ syncStatus: 1, provider: 1 });
CRMContactSchema.index({ createdAt: -1 });
// Text index for search
CRMContactSchema.index({
    firstName: 'text',
    lastName: 'text',
    email: 'text',
    company: 'text',
});
// Pre-save middleware to set primary email
CRMContactSchema.pre('save', function (next) {
    if (this.email && (!this.emails || this.emails.length === 0)) {
        this.emails = [{ address: this.email, isPrimary: true }];
    }
    if (this.phone && (!this.phones || this.phones.length === 0)) {
        this.phones = [this.phone];
    }
    next();
});
// Instance methods
CRMContactSchema.methods.markSynced = async function () {
    this.syncStatus = index_js_1.ContactSyncStatus.SYNCED;
    this.lastSyncedAt = new Date();
    this.syncError = undefined;
    await this.save();
};
CRMContactSchema.methods.markSyncError = async function (error) {
    this.syncStatus = index_js_1.ContactSyncStatus.ERROR;
    this.syncError = error;
    await this.save();
};
// Static methods
CRMContactSchema.statics.findByExternalId = function (externalId, provider) {
    return this.findOne({ externalId, provider });
};
CRMContactSchema.statics.findPendingContacts = function (provider) {
    const query = { syncStatus: index_js_1.ContactSyncStatus.PENDING };
    if (provider) {
        query.provider = provider;
    }
    return this.find(query).sort({ updatedAt: 1 });
};
exports.CRMContact = mongoose_1.default.model('CRMContact', CRMContactSchema);
exports.default = exports.CRMContact;
//# sourceMappingURL=CRMContact.js.map