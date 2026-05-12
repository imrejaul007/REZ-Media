/**
 * BillingTransaction Model - MongoDB schema for billing transactions
 * Records all billing operations for audit and reconciliation
 */

import mongoose, { Document, Schema } from 'mongoose';
import { IBillingTransaction, BillingStatus } from '../types';

export interface BillingTransactionDocument extends Omit<IBillingTransaction, 'processedAt' | 'createdAt'>, Document {
  processedAt?: Date;
  createdAt: Date;
}

const BillingTransactionSchema = new Schema<BillingTransactionDocument>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
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
      enum: Object.values(BillingStatus),
      default: BillingStatus.PENDING,
      index: true,
    },
    processedAt: {
      type: Date,
      sparse: true,
    },
    failureReason: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'billing_transactions',
  }
);

// Compound indexes
BillingTransactionSchema.index({ userId: 1, createdAt: -1 });
BillingTransactionSchema.index({ sessionId: 1, status: 1 });
BillingTransactionSchema.index({ status: 1, createdAt: -1 });
BillingTransactionSchema.index({ userId: 1, status: 1 });

// Static method to create transaction for session
BillingTransactionSchema.statics.createForSession = async function (
  session: { sessionId: string; callerId: string; totalCost: number }
): Promise<BillingTransactionDocument> {
  const { v4: uuidv4 } = await import('uuid');

  const transaction = new this({
    transactionId: uuidv4(),
    sessionId: session.sessionId,
    userId: session.callerId,
    amount: session.totalCost,
    status: BillingStatus.PENDING,
  });

  await transaction.save();
  return transaction;
};

// Static method to find pending transactions
BillingTransactionSchema.statics.getPending = function (limit = 100): Promise<BillingTransactionDocument[]> {
  return this.find({ status: BillingStatus.PENDING })
    .sort({ createdAt: 1 })
    .limit(limit)
    .exec();
};

// Static method to mark as processed
BillingTransactionSchema.statics.markProcessed = async function (
  transactionId: string,
  processedAt: Date = new Date()
): Promise<BillingTransactionDocument | null> {
  return this.findOneAndUpdate(
    { transactionId, status: BillingStatus.PENDING },
    {
      status: BillingStatus.PROCESSED,
      processedAt,
    },
    { new: true }
  ).exec();
};

// Static method to mark as failed
BillingTransactionSchema.statics.markFailed = async function (
  transactionId: string,
  failureReason: string
): Promise<BillingTransactionDocument | null> {
  return this.findOneAndUpdate(
    { transactionId, status: BillingStatus.PENDING },
    {
      status: BillingStatus.FAILED,
      failureReason,
    },
    { new: true }
  ).exec();
};

// Static method to get user transaction history
BillingTransactionSchema.statics.getUserHistory = function (
  userId: string,
  options: { limit?: number; skip?: number; status?: BillingStatus }
): Promise<{ transactions: BillingTransactionDocument[]; total: number }> {
  const { limit = 50, skip = 0, status } = options;

  const query: Record<string, unknown> = { userId };
  if (status) {
    query.status = status;
  }

  return Promise.all([
    this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    this.countDocuments(query).exec(),
  ]).then(([transactions, total]) => ({ transactions, total }));
};

// Static method to get transactions by session
BillingTransactionSchema.statics.getBySession = function (
  sessionId: string
): Promise<BillingTransactionDocument[]> {
  return this.find({ sessionId }).sort({ createdAt: -1 }).exec();
};

// Static method to check for duplicate (idempotency)
BillingTransactionSchema.statics.checkDuplicate = async function (
  sessionId: string
): Promise<BillingTransactionDocument | null> {
  return this.findOne({ sessionId, status: BillingStatus.PROCESSED }).exec();
};

// Instance method to get summary
BillingTransactionSchema.methods.getSummary = function (): Record<string, unknown> {
  return {
    transactionId: this.transactionId,
    sessionId: this.sessionId,
    userId: this.userId,
    amount: this.amount,
    currency: this.currency,
    status: this.status,
    processedAt: this.processedAt,
    createdAt: this.createdAt,
  };
};

export const BillingTransaction = mongoose.model<BillingTransactionDocument>(
  'BillingTransaction',
  BillingTransactionSchema
);

export default BillingTransaction;
