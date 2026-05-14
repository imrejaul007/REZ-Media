import { Document, Types } from 'mongoose';
/**
 * Voucher — promotional coupon/coupon document for rez-marketing-service.
 *
 * Supports voucher types:
 *   - percentage: percentage discount (value = percentage, maxDiscount caps the amount)
 *   - fixed: fixed amount discount (value = amount in smallest currency unit)
 *   - bogo: buy-one-get-one (value = free item value or 100 for free)
 *   - free_delivery: waive delivery fee
 *
 * Voucher status:
 *   - active: valid and can be used
 *   - exhausted: maxUses reached
 *   - expired: validUntil passed
 *   - cancelled: manually deactivated
 *
 * Applies to:
 *   - all: any order
 *   - category: specific category IDs
 *   - product: specific product IDs
 *   - store: specific store IDs
 */
export type VoucherType = 'percentage' | 'fixed' | 'bogo' | 'free_delivery';
export type VoucherStatus = 'active' | 'exhausted' | 'expired' | 'cancelled';
export type ApplicableTo = 'all' | 'category' | 'product' | 'store';
export interface IVoucher extends Document {
    code: string;
    type: VoucherType;
    value: number;
    minOrderValue: number;
    maxDiscount?: number;
    maxUses?: number;
    usedCount: number;
    validFrom: Date;
    validUntil: Date;
    status: VoucherStatus;
    applicableTo: ApplicableTo;
    applicableIds?: string[];
    metadata?: Record<string, unknown>;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Voucher: import("mongoose").Model<IVoucher, {}, {}, {}, Document<unknown, {}, IVoucher, {}, {}> & IVoucher & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default Voucher;
//# sourceMappingURL=Voucher.d.ts.map