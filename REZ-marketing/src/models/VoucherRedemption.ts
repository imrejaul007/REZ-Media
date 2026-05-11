import { Schema, model, Document, Types } from 'mongoose';

/**
 * VoucherRedemption — tracks individual voucher usage per user/order.
 *
 * Used to:
 *   - Prevent duplicate usage by same user
 *   - Audit trail for voucher redemptions
 *   - Attribution for campaign performance
 */

export interface IVoucherRedemption extends Document {
  voucherId: Types.ObjectId;
  voucherCode: string;
  userId: string;
  orderId: string;
  discountApplied: number;          // actual discount amount applied
  orderValue: number;              // order value at time of redemption
  redeemedAt: Date;
}

const VoucherRedemptionSchema = new Schema<IVoucherRedemption>(
  {
    voucherId: {
      type: Schema.Types.ObjectId,
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
      unique: true,               // each order can only use voucher once
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
  },
  { timestamps: false },  // we manually manage redeemedAt
);

// Compound index for user+voucher lookup (prevent same user using same voucher twice)
VoucherRedemptionSchema.index({ voucherId: 1, userId: 1 }, { unique: true });

export const VoucherRedemption = model<IVoucherRedemption>('VoucherRedemption', VoucherRedemptionSchema);
export default VoucherRedemption;
