import { Schema, model, Document, Types } from 'mongoose';

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
  value: number;                    // percentage (0-100), fixed amount, or free_delivery flag
  minOrderValue: number;            // minimum order value to apply voucher
  maxDiscount?: number;             // maximum discount cap (for percentage type)
  maxUses?: number;                 // total redemption limit
  usedCount: number;                // current redemption count
  validFrom: Date;
  validUntil: Date;
  status: VoucherStatus;
  applicableTo: ApplicableTo;
  applicableIds?: string[];         // category/product/store IDs if not 'all'
  metadata?: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VoucherSchema = new Schema<IVoucher>(
  {
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
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'MerchantUser',
    },
  },
  { timestamps: true },
);

// Compound indexes for common queries
VoucherSchema.index({ code: 1, status: 1 });
VoucherSchema.index({ status: 1, validUntil: 1 });
VoucherSchema.index({ merchantId: 1, status: 1 });

export const Voucher = model<IVoucher>('Voucher', VoucherSchema);
export default Voucher;
