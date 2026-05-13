import mongoose, { Schema, Model } from 'mongoose';
import { SyncStatus, SyncDirection, CRMProvider } from '../types/index.js';

export interface SyncError {
  externalId: string;
  error: string;
  timestamp: Date;
}

export interface ISyncHistory {
  provider: CRMProvider;
  entityType: 'contact' | 'deal';
  direction: SyncDirection;
  status: SyncStatus;
  startedAt: Date;
  completedAt?: Date;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  errors: SyncError[];
  details: Record<string, unknown>;
}

export interface ISyncHistoryMethods {
  markStarted(): void;
  markCompleted(successCount: number, errorCount: number): void;
  markFailed(error?: string): void;
  addError(externalId: string, error: string): void;
}

export type ISyncHistoryDocument = mongoose.HydratedDocument<ISyncHistory, ISyncHistoryMethods>;

interface ISyncHistoryModel extends Model<ISyncHistory, object, ISyncHistoryMethods> {
  findActiveSync(): Promise<ISyncHistoryDocument | null>;
  findRecent(provider?: CRMProvider, limit?: number): Promise<ISyncHistoryDocument[]>;
  cleanupOldRecords(daysToKeep?: number): Promise<number>;
}

const SyncErrorSchema = new Schema({
  externalId: { type: String, required: true },
  error: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const SyncHistorySchema = new Schema<ISyncHistory, ISyncHistoryModel, ISyncHistoryMethods>(
  {
    provider: {
      type: String,
      enum: Object.values(CRMProvider),
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['contact', 'deal'],
      required: true,
    },
    direction: {
      type: String,
      enum: Object.values(SyncDirection),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SyncStatus),
      default: SyncStatus.PENDING,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    totalRecords: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
    errors: [SyncErrorSchema],
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: false,
    collection: 'sync_history',
  }
);

// Indexes
SyncHistorySchema.index({ provider: 1, entityType: 1, startedAt: -1 });
SyncHistorySchema.index({ status: 1, startedAt: -1 });

// Virtual for duration
SyncHistorySchema.virtual('durationMs').get(function () {
  if (!this.completedAt) return null;
  return this.completedAt.getTime() - this.startedAt.getTime();
});

// Instance methods
SyncHistorySchema.methods.markStarted = function (): void {
  this.status = SyncStatus.IN_PROGRESS;
  this.startedAt = new Date();
};

SyncHistorySchema.methods.markCompleted = function (
  successCount: number,
  errorCount: number
): void {
  this.status = SyncStatus.COMPLETED;
  this.completedAt = new Date();
  this.successCount = successCount;
  this.errorCount = errorCount;
  this.totalRecords = successCount + errorCount;
};

SyncHistorySchema.methods.markFailed = function (error?: string): void {
  this.status = SyncStatus.FAILED;
  this.completedAt = new Date();
  if (error) {
    this.errors.push({ externalId: 'SYSTEM', error, timestamp: new Date() });
  }
};

SyncHistorySchema.methods.addError = function (externalId: string, error: string): void {
  this.errors.push({ externalId, error, timestamp: new Date() });
  this.errorCount = this.errors.length;
};

// Static methods
SyncHistorySchema.statics.findActiveSync = function (): Promise<ISyncHistoryDocument | null> {
  return this.findOne({ status: SyncStatus.IN_PROGRESS })
    .sort({ startedAt: -1 }) as Promise<ISyncHistoryDocument | null>;
};

SyncHistorySchema.statics.findRecent = function (
  provider?: CRMProvider,
  limit = 10
): Promise<ISyncHistoryDocument[]> {
  const query: Record<string, unknown> = {};
  if (provider) {
    query.provider = provider;
  }
  return this.find(query).sort({ startedAt: -1 }).limit(limit) as Promise<ISyncHistoryDocument[]>;
};

SyncHistorySchema.statics.cleanupOldRecords = async function (daysToKeep = 30): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  const result = await this.deleteMany({
    completedAt: { $lt: cutoff },
    status: { $ne: SyncStatus.IN_PROGRESS },
  });
  return result.deletedCount;
};

export const SyncHistory = mongoose.model<ISyncHistory, ISyncHistoryModel>(
  'SyncHistory',
  SyncHistorySchema
);

export default SyncHistory;
