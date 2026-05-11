import * as crypto from 'crypto';
import { Voucher, IVoucher } from '../models/Voucher';
import { VoucherRedemption } from '../models/VoucherRedemption';
import { logger } from '../config/logger';
import { growthAnalytics } from './growthAnalytics';
import { offerStackingService } from './offerStackingService';

/**
 * Voucher types and their validation rules
 */
export type VoucherType = 'percentage' | 'fixed' | 'bogo' | 'free_delivery';
export type VoucherStatus = 'active' | 'exhausted' | 'expired' | 'cancelled';
export type ApplicableTo = 'all' | 'category' | 'product' | 'store';

export interface CreateVoucherDTO {
  code?: string;
  type: VoucherType;
  value: number;
  minOrderValue: number;
  maxDiscount?: number;
  maxUses?: number;
  validFrom: Date | string;
  validUntil: Date | string;
  applicableTo?: ApplicableTo;
  applicableIds?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: string;
  merchantId?: string;
  // Notification recipient fields (optional - notification sent if sendNotification is true)
  recipientUserId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  sendNotification?: boolean;
}

export interface UpdateVoucherDTO {
  type?: VoucherType;
  value?: number;
  minOrderValue?: number;
  maxDiscount?: number;
  maxUses?: number;
  validFrom?: Date | string;
  validUntil?: Date | string;
  applicableTo?: ApplicableTo;
  applicableIds?: string[];
  status?: VoucherStatus;
  metadata?: Record<string, unknown>;
}

export interface VoucherFilters {
  status?: VoucherStatus;
  type?: VoucherType;
  validFrom?: Date;
  validUntil?: Date;
  applicableTo?: ApplicableTo;
  applicableIds?: string[];
  createdBy?: string;
  page?: number;
  limit?: number;
}

export interface ValidationResult {
  valid: boolean;
  voucher?: IVoucher;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'EXPIRED' | 'NOT_YET_VALID' | 'MIN_ORDER_NOT_MET' | 'EXHAUSTED' | 'ALREADY_USED' | 'CANCELLED';
  discount?: number;
}

export interface VoucherResponse {
  voucher: IVoucher;
  discount: number;
}

export interface RedeemVoucherParams {
  code: string;
  userId: string;
  orderId: string;
  orderValue: number;
  merchantId?: string;
}

/**
 * VoucherService — complete CRUD + validation + redemption for vouchers/coupons.
 *
 * Features:
 * - Unique code generation (REZ prefix + 6 char alphanumeric)
 * - Atomic redemption to prevent race conditions
 * - User-specific usage tracking (one use per user per voucher by default)
 * - Automatic status updates (exhausted/expired)
 */
export class VoucherService {

  /**
   * Create a new voucher
   */
  async create(data: CreateVoucherDTO): Promise<IVoucher> {
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
    const existing = await Voucher.findOne({ code });
    if (existing) {
      throw new Error(`Voucher code "${code}" already exists`);
    }

    const voucher = new Voucher({
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
    logger.info('[VoucherService] Created voucher', { code, type: data.type, value: data.value });

    // Growth Analytics: track voucher_issued event
    if (data.merchantId) {
      // Map voucher type to growth event type
      const growthVoucherType: 'discount' | 'cashback' | 'free_item' =
        data.type === 'percentage' || data.type === 'fixed' ? 'discount' :
        data.type === 'free_delivery' ? 'free_item' : 'discount';

      growthAnalytics.trackEvent({
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
      }).catch((err) => logger.warn('[VoucherService] Growth analytics tracking failed', { error: err.message }));
    }

    return voucher;
  }

  /**
   * Get voucher by ID
   */
  async getById(id: string): Promise<IVoucher | null> {
    return Voucher.findById(id);
  }

  /**
   * Get voucher by code (returns null if not found or not active)
   */
  async getByCode(code: string): Promise<IVoucher | null> {
    return Voucher.findOne({ code: code.toUpperCase().trim(), status: 'active' });
  }

  /**
   * List vouchers with optional filters
   */
  async list(filters: VoucherFilters = {}): Promise<{ vouchers: IVoucher[]; total: number }> {
    const query: Record<string, unknown> = {};

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
      Voucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Voucher.countDocuments(query),
    ]);

    return { vouchers, total };
  }

  /**
   * Update a voucher
   */
  async update(id: string, data: UpdateVoucherDTO): Promise<IVoucher | null> {
    const updateData: Record<string, unknown> = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.minOrderValue !== undefined) updateData.minOrderValue = data.minOrderValue;
    if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount;
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.applicableTo !== undefined) updateData.applicableTo = data.applicableTo;
    if (data.applicableIds !== undefined) updateData.applicableIds = data.applicableIds;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    if (data.validFrom) {
      updateData.validFrom = new Date(data.validFrom);
    }
    if (data.validUntil) {
      updateData.validUntil = new Date(data.validUntil);
    }

    const voucher = await Voucher.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (voucher) {
      logger.info('[VoucherService] Updated voucher', { id, code: voucher.code });
    }

    return voucher;
  }

  /**
   * Deactivate a voucher (cancel it)
   */
  async deactivate(id: string): Promise<IVoucher | null> {
    const voucher = await Voucher.findByIdAndUpdate(
      id,
      { $set: { status: 'cancelled' } },
      { new: true },
    );

    if (voucher) {
      logger.info('[VoucherService] Deactivated voucher', { id, code: voucher.code });
    }

    return voucher;
  }

  /**
   * Delete a voucher (soft delete by setting status to cancelled)
   */
  async delete(id: string): Promise<boolean> {
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
  async validate(
    code: string,
    orderValue: number,
    userId: string,
  ): Promise<ValidationResult> {
    const voucher = await Voucher.findOne({ code: code.toUpperCase().trim() });

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
    const existingRedemption = await VoucherRedemption.findOne({
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
   * Validate and apply voucher with offer stacking rules.
   *
   * Uses offerStackingService.calculateStacking to:
   * - Check if percentage discounts can stack
   * - Check if BOGO conflicts exist
   * - Apply free delivery only if no other delivery discount
   * - Use priority-based application
   */
  async validateAndApplyVoucher(
    voucherCode: string,
    userId: string,
    cartAmount: number
  ): Promise<{ success: boolean; discount: number; message: string }> {
    // 1. Get voucher details
    const voucher = await Voucher.findOne({ code: voucherCode.toUpperCase().trim(), status: 'active' });
    if (!voucher) {
      return { success: false, discount: 0, message: 'Invalid voucher code' };
    }

    // 2. Check user eligibility (max uses per user)
    const usageCount = await VoucherRedemption.countDocuments({ voucherId: voucher._id, userId });
    if (voucher.maxUses && usageCount >= voucher.maxUses) {
      return { success: false, discount: 0, message: 'Already used this voucher' };
    }

    // 3. Apply offer stacking rules
    const stackingResult = await offerStackingService.calculateStacking({
      voucher,
      cartAmount,
      userId,
    });

    if (!stackingResult.canApply) {
      return {
        success: false,
        discount: 0,
        message: stackingResult.reason || 'Cannot apply voucher',
      };
    }

    // 4. Calculate final discount
    const discount = Math.min(
      stackingResult.finalDiscount,
      voucher.maxDiscount || Infinity
    );

    logger.info('[VoucherService] Applied voucher with stacking', {
      code: voucher.code,
      userId,
      cartAmount,
      discount,
      appliedOffers: stackingResult.appliedDiscounts.length,
    });

    return {
      success: true,
      discount,
      message: `Discount of ₹${discount} applied`,
    };
  }

  /**
   * Calculate the discount amount for a voucher
   */
  calculateDiscount(voucher: IVoucher, orderValue: number): number {
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
  async redeem(
    code: string,
    userId: string,
    orderId: string,
    orderValue: number,
    merchantId?: string,
  ): Promise<ValidationResult> {
    // Validate first
    const validation = await this.validate(code, orderValue, userId);

    if (!validation.valid || !validation.voucher) {
      return validation;
    }

    const voucher = validation.voucher;
    const discount = validation.discount || 0;

    // Create redemption record and increment counter atomically
    const session = await Voucher.startSession();
    session.startTransaction();

    try {
      // Create redemption record
      const redemption = new VoucherRedemption({
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
      const updateData: Record<string, unknown> = { usedCount: newUsedCount };

      // Check if voucher should be marked as exhausted
      if (voucher.maxUses && newUsedCount >= voucher.maxUses) {
        updateData.status = 'exhausted';
      }

      await Voucher.updateOne(
        { _id: voucher._id },
        { $set: updateData },
        { session },
      );

      await session.commitTransaction();
      logger.info('[VoucherService] Redeemed voucher', {
        code: voucher.code,
        userId,
        orderId,
        discount,
      });

      // Growth Analytics: track conversion event (voucher redemption = conversion)
      if (merchantId) {
        growthAnalytics.trackEvent({
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
        }).catch((err) => logger.warn('[VoucherService] Growth analytics conversion tracking failed', { error: err.message }));
      }

      return {
        valid: true,
        voucher: { ...voucher.toObject(), usedCount: newUsedCount, status: updateData.status as string || voucher.status } as IVoucher,
        discount,
      };
    } catch (error) {
      await session.abortTransaction();

      // Handle duplicate order redemption
      if ((error as Error).message.includes('duplicate') || (error as Error).message.includes('E11000')) {
        return {
          valid: false,
          voucher,
          error: 'This voucher has already been used for this order',
          errorCode: 'ALREADY_USED',
        };
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get redemption history for a voucher
   */
  async getRedemptions(
    voucherIdOrCode: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ redemptions: typeof VoucherRedemption.prototype[]; total: number }> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(voucherIdOrCode);
    const query = isObjectId
      ? { voucherId: voucherIdOrCode }
      : { voucherCode: voucherIdOrCode.toUpperCase() };

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [redemptions, total] = await Promise.all([
      VoucherRedemption.find(query).sort({ redeemedAt: -1 }).skip(skip).limit(limit),
      VoucherRedemption.countDocuments(query),
    ]);

    return { redemptions, total };
  }

  /**
   * Get redemption history for a user
   */
  async getUserRedemptions(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ redemptions: typeof VoucherRedemption.prototype[]; total: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const [redemptions, total] = await Promise.all([
      VoucherRedemption.find({ userId }).sort({ redeemedAt: -1 }).skip(skip).limit(limit),
      VoucherRedemption.countDocuments({ userId }),
    ]);

    return { redemptions, total };
  }

  /**
   * Mark expired vouchers (can be called by a cron job)
   */
  async markExpiredVouchers(): Promise<number> {
    const result = await Voucher.updateMany(
      {
        status: 'active',
        validUntil: { $lt: new Date() },
      },
      { $set: { status: 'expired' } },
    );

    if (result.modifiedCount > 0) {
      logger.info('[VoucherService] Marked expired vouchers', { count: result.modifiedCount });
    }

    return result.modifiedCount;
  }

  /**
   * Generate a unique voucher code
   */
  private generateCode(): string {
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

// Singleton instance
export const voucherService = new VoucherService();
