"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherRedemption = void 0;
const mongoose_1 = require("mongoose");
const VoucherRedemptionSchema = new mongoose_1.Schema({
    voucherId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Voucher',
        required: true,
        index: true,
    },
    voucherCode: {
        type: String,
        required: true,
        uppercase: true,
        index: true,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    orderId: {
        type: String,
        required: true,
        unique: true, // each order can only use voucher once
    },
    discountApplied: {
        type: Number,
        required: true,
        min: 0,
    },
    orderValue: {
        type: Number,
        required: true,
        min: 0,
    },
    redeemedAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: false });
// Compound index for user+voucher lookup (prevent same user using same voucher twice)
VoucherRedemptionSchema.index({ voucherId: 1, userId: 1 }, { unique: true });
exports.VoucherRedemption = (0, mongoose_1.model)('VoucherRedemption', VoucherRedemptionSchema);
exports.default = exports.VoucherRedemption;
//# sourceMappingURL=VoucherRedemption.js.map