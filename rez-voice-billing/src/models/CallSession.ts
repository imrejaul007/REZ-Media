/**
 * CallSession Model - MongoDB schema for tracking individual call sessions
 * Each call creates one session record with billing information
 */

import mongoose, { Document, Schema } from 'mongoose';
import { ICallSession, CallStatus, CallType, BillingStatus } from '../types';

// Extend mongoose Document with our interface
export interface CallSessionDocument extends Omit<ICallSession, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'>, Document {
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CallSessionSchema = new Schema<CallSessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callerId: {
      type: String,
      required: true,
      index: true,
    },
    calleeId: {
      type: String,
      required: true,
      index: true,
    },
    callerPhone: {
      type: String,
      sparse: true,
    },
    calleePhone: {
      type: String,
      sparse: true,
    },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.INITIATED,
      index: true,
    },
    callType: {
      type: String,
      enum: Object.values(CallType),
      required: true,
    },
    startTime: {
      type: Date,
      sparse: true,
    },
    endTime: {
      type: Date,
      sparse: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    billableDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    onHoldDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratePerMinute: {
      type: Number,
      required: true,
      default: 0.05,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    billingStatus: {
      type: String,
      enum: Object.values(BillingStatus),
      default: BillingStatus.PENDING,
      index: true,
    },
    connectionId: {
      type: String,
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'call_sessions',
  }
);

// Compound indexes for common queries
CallSessionSchema.index({ callerId: 1, createdAt: -1 });
CallSessionSchema.index({ calleeId: 1, createdAt: -1 });
CallSessionSchema.index({ status: 1, billingStatus: 1 });
CallSessionSchema.index({ createdAt: -1, status: 1 });
CallSessionSchema.index({ callerId: 1, status: 1, billingStatus: 1 });

// TTL index to auto-delete old sessions (optional, configurable)
CallSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: undefined });

// Pre-save hook for calculating billable duration
CallSessionSchema.pre('save', function (next) {
  if (this.isModified('duration') || this.isModified('onHoldDuration')) {
    // Billable duration is actual duration (excluding on-hold)
    this.actualDuration = Math.max(0, this.duration - this.onHoldDuration);
  }

  if (this.isModified('actualDuration') || this.isModified('ratePerMinute')) {
    const billingConfig = {
      billingIntervalSeconds: 60,
      minimumChargeSeconds: 1,
      freeCallDurationSeconds: 0,
    };

    // Calculate billable duration with billing interval rounding
    const billableSeconds = Math.max(0, this.actualDuration - billingConfig.freeCallDurationSeconds);
    this.billableDuration = this.ceilToInterval(billableSeconds, billingConfig.billingIntervalSeconds);

    // Calculate total cost
    const minutes = this.billableDuration / 60;
    this.totalCost = Math.max(0, minutes * this.ratePerMinute);
  }

  next();
});

// Instance method to calculate cost
CallSessionSchema.methods.calculateCost = function (ratePerMinute: number, billableDuration: number): number {
  const minutes = billableDuration / 60;
  return Math.max(0, minutes * ratePerMinute);
};

// Instance method to get call summary
CallSessionSchema.methods.getSummary = function (): Record<string, unknown> {
  return {
    sessionId: this.sessionId,
    callerId: this.callerId,
    calleeId: this.calleeId,
    status: this.status,
    callType: this.callType,
    duration: this.duration,
    billableDuration: this.billableDuration,
    totalCost: this.totalCost,
    billingStatus: this.billingStatus,
    startTime: this.startTime,
    endTime: this.endTime,
  };
};

// Static method to find active sessions for a user
CallSessionSchema.statics.findActiveSessions = function (userId: string): Promise<CallSessionDocument[]> {
  return this.find({
    $or: [{ callerId: userId }, { calleeId: userId }],
    status: { $in: [CallStatus.ACTIVE, CallStatus.CONNECTING, CallStatus.ON_HOLD] },
  }).exec();
};

// Static method to get user's call history
CallSessionSchema.statics.getUserHistory = function (
  userId: string,
  options: { limit?: number; skip?: number; startDate?: Date; endDate?: Date }
): Promise<{ sessions: CallSessionDocument[]; total: number }> {
  const { limit = 50, skip = 0, startDate, endDate } = options;

  const query: Record<string, unknown> = {
    $or: [{ callerId: userId }, { calleeId: userId }],
  };

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) (query.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (query.createdAt as Record<string, Date>).$lte = endDate;
  }

  return Promise.all([
    this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
    this.countDocuments(query).exec(),
  ]).then(([sessions, total]) => ({ sessions, total }));
};

// Helper method to round up to billing interval
CallSessionSchema.methods.ceilToInterval = function (seconds: number, intervalSeconds: number): number {
  if (seconds <= 0) return 0;
  return Math.ceil(seconds / intervalSeconds) * intervalSeconds;
};

// Instance method to mark session as ended
CallSessionSchema.methods.markEnded = function (endTime: Date, duration: number): void {
  this.status = CallStatus.ENDED;
  this.endTime = endTime;
  this.duration = duration;
  this.actualDuration = Math.max(0, duration - this.onHoldDuration);
};

// Instance method to mark session as failed
CallSessionSchema.methods.markFailed = function (reason?: string): void {
  this.status = CallStatus.FAILED;
  this.endTime = new Date();
  if (reason) {
    this.metadata = { ...this.metadata, failureReason: reason };
  }
};

// Instance method to update billing status
CallSessionSchema.methods.updateBillingStatus = function (status: BillingStatus, transactionId?: string): void {
  this.billingStatus = status;
  if (transactionId) {
    this.metadata = { ...this.metadata, billingTransactionId: transactionId };
  }
};

// Static method to get sessions pending billing
CallSessionSchema.statics.getPendingBilling = function (limit = 100): Promise<CallSessionDocument[]> {
  return this.find({
    billingStatus: BillingStatus.PENDING,
    status: CallStatus.ENDED,
    totalCost: { $gt: 0 },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .exec();
};

// Static method to get session by sessionId
CallSessionSchema.statics.findBySessionId = function (sessionId: string): Promise<CallSessionDocument | null> {
  return this.findOne({ sessionId }).exec();
};

// Static method to check for duplicate session (idempotency)
CallSessionSchema.statics.checkDuplicate = async function (sessionId: string): Promise<boolean> {
  const existing = await this.findOne({ sessionId }).select('_id').lean().exec();
  return existing !== null;
};

export const CallSession = mongoose.model<CallSessionDocument>('CallSession', CallSessionSchema);

export default CallSession;
