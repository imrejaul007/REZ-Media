/**
 * Transaction Model - MongoDB Schema for Payment Transactions
 */

import mongoose, { Schema, Document } from 'mongoose';

// ============================================================================
// Enum Types
// ============================================================================

export enum TransactionType {
  WALLET_TOPUP = 'wallet_topup',
  AD_PAYMENT = 'ad_payment',
  PAYOUT = 'payout',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

// ============================================================================
// Interface
// ============================================================================

export interface IRefund {
  refundId: string;
  amount: number;
  status: string;
  reason?: string;
  createdAt: Date;
}

export interface ITransaction extends Document {
  transactionId: string;
  merchantId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayPayoutId?: string;
  refunds: IRefund[];
  metadata: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
}

// ============================================================================
// Schema
// ============================================================================

const RefundSchema = new Schema<IRefund>(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true },
    reason: { type: String },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      required: true,
      default: TransactionStatus.PENDING,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpayPayoutId: {
      type: String,
      index: true,
      sparse: true,
    },
    refunds: [RefundSchema],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    error: {
      code: String,
      message: String,
    },
    completedAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'transactions',
  }
);

// ============================================================================
// Indexes
// ============================================================================

// Compound indexes for common queries
TransactionSchema.index({ merchantId: 1, createdAt: -1 });
TransactionSchema.index({ merchantId: 1, type: 1, status: 1 });
TransactionSchema.index({ razorpayOrderId: 1, status: 1 });
TransactionSchema.index({ razorpayPaymentId: 1, status: 1 });
TransactionSchema.index({ createdAt: -1, status: 1 });

// ============================================================================
// Virtuals
// ============================================================================

TransactionSchema.virtual('isRefundable').get(function () {
  return (
    this.status === TransactionStatus.COMPLETED &&
    this.refunds.every((r: IRefund) => r.status !== 'failed')
  );
});

TransactionSchema.virtual('refundedAmount').get(function () {
  return this.refunds.reduce((sum: number, r: IRefund) => sum + r.amount, 0);
});

TransactionSchema.virtual('remainingAmount').get(function () {
  return this.amount - this.refundedAmount;
});

// ============================================================================
// Methods
// ============================================================================

TransactionSchema.methods.markCompleted = async function (paymentId?: string) {
  this.status = TransactionStatus.COMPLETED;
  this.completedAt = new Date();
  if (paymentId) {
    this.razorpayPaymentId = paymentId;
  }
  return this.save();
};

TransactionSchema.methods.markFailed = async function (errorCode: string, errorMessage: string) {
  this.status = TransactionStatus.FAILED;
  this.failedAt = new Date();
  this.error = { code: errorCode, message: errorMessage };
  return this.save();
};

TransactionSchema.methods.addRefund = async function (refund: IRefund) {
  this.refunds.push(refund);

  const totalRefunded = this.refundedAmount;
  if (totalRefunded >= this.amount) {
    this.status = TransactionStatus.REFUNDED;
  } else if (totalRefunded > 0) {
    this.status = TransactionStatus.PARTIALLY_REFUNDED;
  }

  return this.save();
};

// ============================================================================
// Static Methods
// ============================================================================

TransactionSchema.statics.findByMerchant = function (
  merchantId: string,
  options: { page?: number; limit?: number; type?: TransactionType; status?: TransactionStatus } = {}
) {
  const { page = 1, limit = 20, type, status } = options;
  const skip = (page - 1) * limit;

  const query: any = { merchantId };
  if (type) query.type = type;
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

TransactionSchema.statics.findByOrderId = function (orderId: string) {
  return this.findOne({ razorpayOrderId: orderId });
};

TransactionSchema.statics.findByPaymentId = function (paymentId: string) {
  return this.findOne({ razorpayPaymentId: paymentId });
};

TransactionSchema.statics.getMerchantSummary = async function (merchantId: string) {
  const result = await this.aggregate([
    { $match: { merchantId } },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        completedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', TransactionStatus.COMPLETED] }, 1, 0],
          },
        },
        failedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', TransactionStatus.FAILED] }, 1, 0],
          },
        },
      },
    },
  ]);

  return result.map((r) => ({
    type: r._id,
    totalAmount: r.totalAmount,
    count: r.count,
    completedCount: r.completedCount,
    failedCount: r.failedCount,
  }));
};

// ============================================================================
// Pre/Post Hooks
// ============================================================================

TransactionSchema.pre('save', function (next) {
  // Ensure amount is positive
  if (this.amount < 0) {
    next(new Error('Transaction amount cannot be negative'));
    return;
  }

  // Set currency if not provided
  if (!this.currency) {
    this.currency = 'INR';
  }

  next();
});

// ============================================================================
// Export
// ============================================================================

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
export default Transaction;
