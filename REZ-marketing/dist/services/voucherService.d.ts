import { IVoucher } from '../models/Voucher';
import { VoucherRedemption } from '../models/VoucherRedemption';
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
export declare class VoucherService {
    /**
     * Create a new voucher
     */
    create(data: CreateVoucherDTO): Promise<IVoucher>;
    /**
     * Get voucher by ID
     */
    getById(id: string): Promise<IVoucher | null>;
    /**
     * Get voucher by code (returns null if not found or not active)
     */
    getByCode(code: string): Promise<IVoucher | null>;
    /**
     * List vouchers with optional filters
     */
    list(filters?: VoucherFilters): Promise<{
        vouchers: IVoucher[];
        total: number;
    }>;
    /**
     * Update a voucher
     */
    update(id: string, data: UpdateVoucherDTO): Promise<IVoucher | null>;
    /**
     * Deactivate a voucher (cancel it)
     */
    deactivate(id: string): Promise<IVoucher | null>;
    /**
     * Delete a voucher (soft delete by setting status to cancelled)
     */
    delete(id: string): Promise<boolean>;
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
    validate(code: string, orderValue: number, userId: string): Promise<ValidationResult>;
    /**
     * Calculate the discount amount for a voucher
     */
    calculateDiscount(voucher: IVoucher, orderValue: number): number;
    /**
     * Redeem a voucher for an order
     *
     * Atomically:
     * 1. Validates the voucher
     * 2. Creates redemption record
     * 3. Increments usedCount
     * 4. Updates status to exhausted if maxUses reached
     */
    redeem(code: string, userId: string, orderId: string, orderValue: number, merchantId?: string): Promise<ValidationResult>;
    /**
     * Get redemption history for a voucher
     */
    getRedemptions(voucherIdOrCode: string, options?: {
        page?: number;
        limit?: number;
    }): Promise<{
        redemptions: typeof VoucherRedemption.prototype[];
        total: number;
    }>;
    /**
     * Get redemption history for a user
     */
    getUserRedemptions(userId: string, options?: {
        page?: number;
        limit?: number;
    }): Promise<{
        redemptions: typeof VoucherRedemption.prototype[];
        total: number;
    }>;
    /**
     * Mark expired vouchers (can be called by a cron job)
     */
    markExpiredVouchers(): Promise<number>;
    /**
     * Generate a unique voucher code
     */
    private generateCode;
}
export declare const voucherService: VoucherService;
//# sourceMappingURL=voucherService.d.ts.map