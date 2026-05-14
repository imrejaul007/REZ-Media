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
exports.voucherService = exports.VoucherService = void 0;
const crypto = __importStar(require("crypto"));
const Voucher_1 = require("../models/Voucher");
const VoucherRedemption_1 = require("../models/VoucherRedemption");
const logger_1 = require("../config/logger");
const growthAnalytics_1 = require("./growthAnalytics");
/**
 * VoucherService — complete CRUD + validation + redemption for vouchers/coupons.
 *
 * Features:
 * - Unique code generation (REZ prefix + 6 char alphanumeric)
 * - Atomic redemption to prevent race conditions
 * - User-specific usage tracking (one use per user per voucher by default)
 * - Automatic status updates (exhausted/expired)
 */
class VoucherService {
    /**
     * Create a new voucher
     */
    async create(data) {
        // Generate unique code if not provided
        const code = data.code?.trim().toUpperCase() || this.generateCode();
        // Validate dates
        const validFrom = new Date(data.validFrom);
        const validUntil = new Date(data.validUntil);
        if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
            throw new Error('Invalid date format for validFrom or validUntil');
        }
        if (validUntil <= validFrom) {
            throw new Error('validUntil must be after validFrom');
        }
        // Validate value based on type
        if (data.type === 'percentage' && (data.value <= 0 || data.value > 100)) {
            throw new Error('Percentage value must be between 0 and 100');
        }
        // Check for duplicate code
        const existing = await Voucher_1.Voucher.findOne({ code });
        if (existing) {
            throw new Error(`Voucher code "${code}" already exists`);
        }
        const voucher = new Voucher_1.Voucher({
            code,
            type: data.type,
            value: data.value,
            minOrderValue: data.minOrderValue || 0,
            maxDiscount: data.maxDiscount,
            maxUses: data.maxUses,
            usedCount: 0,
            validFrom,
            validUntil,
            status: 'active',
            applicableTo: data.applicableTo || 'all',
            applicableIds: data.applicableIds,
            metadata: data.metadata,
            createdBy: data.createdBy,
        });
        await voucher.save();
        logger_1.logger.info('[VoucherService] Created voucher', { code, type: data.type, value: data.value });
        // Growth Analytics: track voucher_issued event
        if (data.merchantId) {
            // Map voucher type to growth event type
            const growthVoucherType = data.type === 'percentage' || data.type === 'fixed' ? 'discount' :
                data.type === 'free_delivery' ? 'free_item' : 'discount';
            growthAnalytics_1.growthAnalytics.trackEvent({
                eventType: 'voucher_issued',
                sourceService: 'marketing',
                merchantId: data.merchantId,
                metadata: {
                    voucherId: String(voucher._id),
                    voucherCode: voucher.code,
                    voucherType: growthVoucherType,
                    discountValue: data.value,
                    minOrderValue: data.minOrderValue,
                    validUntil: voucher.validUntil,
                },
            }).catch((err) => logger_1.logger.warn('[VoucherService] Growth analytics tracking failed', { error: err.message }));
        }
        return voucher;
    }
    /**
     * Get voucher by ID
     */
    async getById(id) {
        return Voucher_1.Voucher.findById(id);
    }
    /**
     * Get voucher by code (returns null if not found or not active)
     */
    async getByCode(code) {
        return Voucher_1.Voucher.findOne({ code: code.toUpperCase().trim(), status: 'active' });
    }
    /**
     * List vouchers with optional filters
     */
    async list(filters = {}) {
        const query = {};
        if (filters.status) {
            query.status = filters.status;
        }
        if (filters.type) {
            query.type = filters.type;
        }
        if (filters.applicableTo) {
            query.applicableTo = filters.applicableTo;
        }
        if (filters.applicableIds?.length) {
            query.applicableIds = { $in: filters.applicableIds };
        }
        if (filters.createdBy) {
            query.createdBy = filters.createdBy;
        }
        if (filters.validFrom) {
            query.validFrom = { $lte: filters.validFrom };
        }
        if (filters.validUntil) {
            query.validUntil = { $gte: filters.validUntil };
        }
        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(100, Math.max(1, filters.limit || 20));
        const skip = (page - 1) * limit;
        const [vouchers, total] = await Promise.all([
            Voucher_1.Voucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Voucher_1.Voucher.countDocuments(query),
        ]);
        return { vouchers, total };
    }
    /**
     * Update a voucher
     */
    async update(id, data) {
        const updateData = {};
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.value !== undefined)
            updateData.value = data.value;
        if (data.minOrderValue !== undefined)
            updateData.minOrderValue = data.minOrderValue;
        if (data.maxDiscount !== undefined)
            updateData.maxDiscount = data.maxDiscount;
        if (data.maxUses !== undefined)
            updateData.maxUses = data.maxUses;
        if (data.applicableTo !== undefined)
            updateData.applicableTo = data.applicableTo;
        if (data.applicableIds !== undefined)
            updateData.applicableIds = data.applicableIds;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.metadata !== undefined)
            updateData.metadata = data.metadata;
        if (data.validFrom) {
            updateData.validFrom = new Date(data.validFrom);
        }
        if (data.validUntil) {
            updateData.validUntil = new Date(data.validUntil);
        }
        const voucher = await Voucher_1.Voucher.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
        if (voucher) {
            logger_1.logger.info('[VoucherService] Updated voucher', { id, code: voucher.code });
        }
        return voucher;
    }
    /**
     * Deactivate a voucher (cancel it)
     */
    async deactivate(id) {
        const voucher = await Voucher_1.Voucher.findByIdAndUpdate(id, { $set: { status: 'cancelled' } }, { new: true });
        if (voucher) {
            logger_1.logger.info('[VoucherService] Deactivated voucher', { id, code: voucher.code });
        }
        return voucher;
    }
    /**
     * Delete a voucher (soft delete by setting status to cancelled)
     */
    async delete(id) {
        const voucher = await this.deactivate(id);
        return !!voucher;
    }
    /**
     * Validate a voucher code for a given order
     *
     * Checks:
     * 1. Voucher exists and is active
     * 2. Date range is valid (validFrom <= now <= validUntil)
     * 3. Minimum order value is met
     * 4. Max uses not exceeded
     * 5. User hasn't already used this voucher
     */
    async validate(code, orderValue, userId) {
        const voucher = await Voucher_1.Voucher.findOne({ code: code.toUpperCase().trim() });
        if (!voucher) {
            return { valid: false, error: 'Voucher not found', errorCode: 'NOT_FOUND' };
        }
        // Check status
        if (voucher.status === 'cancelled') {
            return { valid: false, voucher, error: 'Voucher has been cancelled', errorCode: 'CANCELLED' };
        }
        if (voucher.status === 'exhausted') {
            return { valid: false, voucher, error: 'Voucher usage limit reached', errorCode: 'EXHAUSTED' };
        }
        if (voucher.status === 'expired' || voucher.validUntil < new Date()) {
            return { valid: false, voucher, error: 'Voucher has expired', errorCode: 'EXPIRED' };
        }
        // Check validFrom
        if (voucher.validFrom > new Date()) {
            return { valid: false, voucher, error: 'Voucher is not yet valid', errorCode: 'NOT_YET_VALID' };
        }
        // Check min order value
        if (orderValue < voucher.minOrderValue) {
            return {
                valid: false,
                voucher,
                error: `Minimum order value of ${voucher.minOrderValue} not met`,
                errorCode: 'MIN_ORDER_NOT_MET',
            };
        }
        // Check max uses
        if (voucher.maxUses && voucher.usedCount >= voucher.maxUses) {
            return { valid: false, voucher, error: 'Voucher usage limit reached', errorCode: 'EXHAUSTED' };
        }
        // Check if user already used this voucher
        const existingRedemption = await VoucherRedemption_1.VoucherRedemption.findOne({
            voucherId: voucher._id,
            userId,
        });
        if (existingRedemption) {
            return {
                valid: false,
                voucher,
                error: 'You have already used this voucher',
                errorCode: 'ALREADY_USED',
            };
        }
        // Calculate discount
        const discount = this.calculateDiscount(voucher, orderValue);
        return {
            valid: true,
            voucher,
            discount,
        };
    }
    /**
     * Calculate the discount amount for a voucher
     */
    calculateDiscount(voucher, orderValue) {
        switch (voucher.type) {
            case 'percentage': {
                let discount = (orderValue * voucher.value) / 100;
                // Apply max discount cap if set
                if (voucher.maxDiscount && discount > voucher.maxDiscount) {
                    discount = voucher.maxDiscount;
                }
                return Math.round(discount);
            }
            case 'fixed':
                // Discount cannot exceed order value
                return Math.min(voucher.value, orderValue);
            case 'bogo':
                // Buy-one-get-one: return the value of one item (treated as fixed discount)
                return voucher.value || orderValue;
            case 'free_delivery':
                // Free delivery: return 0 in discount, handled separately in order service
                return 0;
            default:
                return 0;
        }
    }
    /**
     * Redeem a voucher for an order
     *
     * Atomically:
     * 1. Validates the voucher
     * 2. Creates redemption record
     * 3. Increments usedCount
     * 4. Updates status to exhausted if maxUses reached
     */
    async redeem(code, userId, orderId, orderValue, merchantId) {
        // Validate first
        const validation = await this.validate(code, orderValue, userId);
        if (!validation.valid || !validation.voucher) {
            return validation;
        }
        const voucher = validation.voucher;
        const discount = validation.discount || 0;
        // Create redemption record and increment counter atomically
        const session = await Voucher_1.Voucher.startSession();
        session.startTransaction();
        try {
            // Create redemption record
            const redemption = new VoucherRedemption_1.VoucherRedemption({
                voucherId: voucher._id,
                voucherCode: voucher.code,
                userId,
                orderId,
                discountApplied: discount,
                orderValue,
                redeemedAt: new Date(),
            });
            await redemption.save({ session });
            // Increment used count
            const newUsedCount = voucher.usedCount + 1;
            const updateData = { usedCount: newUsedCount };
            // Check if voucher should be marked as exhausted
            if (voucher.maxUses && newUsedCount >= voucher.maxUses) {
                updateData.status = 'exhausted';
            }
            await Voucher_1.Voucher.updateOne({ _id: voucher._id }, { $set: updateData }, { session });
            await session.commitTransaction();
            logger_1.logger.info('[VoucherService] Redeemed voucher', {
                code: voucher.code,
                userId,
                orderId,
                discount,
            });
            // Growth Analytics: track conversion event (voucher redemption = conversion)
            if (merchantId) {
                growthAnalytics_1.growthAnalytics.trackEvent({
                    eventType: 'conversion',
                    sourceService: 'marketing',
                    userId,
                    merchantId,
                    metadata: {
                        orderId,
                        orderValue,
                        voucherId: String(voucher._id),
                        voucherCode: voucher.code,
                        discountValue: discount,
                    },
                    value: orderValue,
                }).catch((err) => logger_1.logger.warn('[VoucherService] Growth analytics conversion tracking failed', { error: err.message }));
            }
            return {
                valid: true,
                voucher: { ...voucher.toObject(), usedCount: newUsedCount, status: updateData.status || voucher.status },
                discount,
            };
        }
        catch (error) {
            await session.abortTransaction();
            // Handle duplicate order redemption
            if (error.message.includes('duplicate') || error.message.includes('E11000')) {
                return {
                    valid: false,
                    voucher,
                    error: 'This voucher has already been used for this order',
                    errorCode: 'ALREADY_USED',
                };
            }
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Get redemption history for a voucher
     */
    async getRedemptions(voucherIdOrCode, options = {}) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(voucherIdOrCode);
        const query = isObjectId
            ? { voucherId: voucherIdOrCode }
            : { voucherCode: voucherIdOrCode.toUpperCase() };
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(100, Math.max(1, options.limit || 20));
        const skip = (page - 1) * limit;
        const [redemptions, total] = await Promise.all([
            VoucherRedemption_1.VoucherRedemption.find(query).sort({ redeemedAt: -1 }).skip(skip).limit(limit),
            VoucherRedemption_1.VoucherRedemption.countDocuments(query),
        ]);
        return { redemptions, total };
    }
    /**
     * Get redemption history for a user
     */
    async getUserRedemptions(userId, options = {}) {
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(100, Math.max(1, options.limit || 20));
        const skip = (page - 1) * limit;
        const [redemptions, total] = await Promise.all([
            VoucherRedemption_1.VoucherRedemption.find({ userId }).sort({ redeemedAt: -1 }).skip(skip).limit(limit),
            VoucherRedemption_1.VoucherRedemption.countDocuments({ userId }),
        ]);
        return { redemptions, total };
    }
    /**
     * Mark expired vouchers (can be called by a cron job)
     */
    async markExpiredVouchers() {
        const result = await Voucher_1.Voucher.updateMany({
            status: 'active',
            validUntil: { $lt: new Date() },
        }, { $set: { status: 'expired' } });
        if (result.modifiedCount > 0) {
            logger_1.logger.info('[VoucherService] Marked expired vouchers', { count: result.modifiedCount });
        }
        return result.modifiedCount;
    }
    /**
     * Generate a unique voucher code
     */
    generateCode() {
        // Generate 6 character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'REZ';
        const randomBytes = crypto.randomBytes(4);
        for (let i = 0; i < 6; i++) {
            const index = randomBytes[i] % chars.length;
            code += chars[index];
        }
        return code;
    }
}
exports.VoucherService = VoucherService;
// Singleton instance
exports.voucherService = new VoucherService();
//# sourceMappingURL=voucherService.js.map