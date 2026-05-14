"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Voucher = void 0;
const mongoose_1 = require("mongoose");
const VoucherSchema = new mongoose_1.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'bogo', 'free_delivery'],
        required: true,
    },
    value: {
        type: Number,
        required: true,
        min: 0,
    },
    minOrderValue: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    maxDiscount: {
        type: Number,
        min: 0,
    },
    maxUses: {
        type: Number,
        min: 0,
    },
    usedCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    validFrom: {
        type: Date,
        required: true,
        index: true,
    },
    validUntil: {
        type: Date,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['active', 'exhausted', 'expired', 'cancelled'],
        default: 'active',
        index: true,
    },
    applicableTo: {
        type: String,
        enum: ['all', 'category', 'product', 'store'],
        default: 'all',
    },
    applicableIds: [String],
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'MerchantUser',
    },
}, { timestamps: true });
// Compound indexes for common queries
VoucherSchema.index({ code: 1, status: 1 });
VoucherSchema.index({ status: 1, validUntil: 1 });
VoucherSchema.index({ merchantId: 1, status: 1 });
exports.Voucher = (0, mongoose_1.model)('Voucher', VoucherSchema);
exports.default = exports.Voucher;
//# sourceMappingURL=Voucher.js.map