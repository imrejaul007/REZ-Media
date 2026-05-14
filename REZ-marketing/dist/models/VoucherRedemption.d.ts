import { Document, Types } from 'mongoose';
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
    discountApplied: number;
    orderValue: number;
    redeemedAt: Date;
}
export declare const VoucherRedemption: import("mongoose").Model<IVoucherRedemption, {}, {}, {}, Document<unknown, {}, IVoucherRedemption, {}, {}> & IVoucherRedemption & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default VoucherRedemption;
//# sourceMappingURL=VoucherRedemption.d.ts.map