import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  ISyncLog,
  Platform,
  SyncType,
  SyncStatus,
  SyncEntity,
} from '../types';

const SyncErrorSchema = new Schema(
  {
    itemId: { type: String, required: true },
    error: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const SyncLogSchema = new Schema<ISyncLog>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    syncType: {
      type: String,
      enum: ['full', 'incremental', 'webhook'] as SyncType[],
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
      index: true,
    },
    entity: {
      type: String,
      enum: ['tickets', 'contacts', 'conversations', 'comments'] as SyncEntity[],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'] as SyncStatus[],
      default: 'pending',
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
    duration: {
      type: Number,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    processedItems: {
      type: Number,
      default: 0,
    },
    failedItems: {
      type: Number,
      default: 0,
    },
    errors: {
      type: [SyncErrorSchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'sync_logs',
  }
);

// Compound indexes for efficient queries
SyncLogSchema.index({ platform: 1, status: 1 });
SyncLogSchema.index({ platform: 1, entity: 1, status: 1 });
SyncLogSchema.index({ startedAt: -1 });
SyncLogSchema.index({ completedAt: -1 });
SyncLogSchema.index({ status: 1, startedAt: 1 });

// Virtual for success rate
SyncLogSchema.virtual('successRate').get(function () {
  if (this.totalItems === 0) return 0;
  return ((this.totalItems - this.failedItems) / this.totalItems) * 100;
});

// Virtual for is complete
SyncLogSchema.virtual('isComplete').get(function () {
  return this.status === 'completed' || this.status === 'failed';
});

// Method to mark as in progress
SyncLogSchema.methods.markInProgress = function () {
  this.status = 'in_progress';
  return this;
};

// Method to mark as completed
SyncLogSchema.methods.markCompleted = function (processed: number, failed: number) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  this.processedItems = processed;
  this.failedItems = failed;
  return this;
};

// Method to mark as failed
SyncLogSchema.methods.markFailed = function (error: string, itemId?: string) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt.getTime() - this.startedAt.getTime();

  if (itemId) {
    this.errors.push({
      itemId,
      error,
      timestamp: new Date(),
    });
  }

  return this;
};

// Method to add error
SyncLogSchema.methods.addError = function (itemId: string, error: string) {
  this.errors.push({
    itemId,
    error,
    timestamp: new Date(),
  });
  this.failedItems += 1;
  return this;
};

// Method to increment processed count
SyncLogSchema.methods.incrementProcessed = function () {
  this.processedItems += 1;
  return this;
};

// Static method to find recent logs
SyncLogSchema.statics.findRecent = function (
  limit: number = 50,
  platform?: Platform
) {
  const query = platform ? { platform } : {};
  return this.find(query)
    .sort({ startedAt: -1 })
    .limit(limit);
};

// Static method to find active syncs
SyncLogSchema.statics.findActive = function () {
  return this.find({ status: 'in_progress' });
};

// Static method to find latest sync by platform and entity
SyncLogSchema.statics.findLatest = function (platform: Platform, entity: SyncEntity) {
  return this.findOne({ platform, entity })
    .sort({ startedAt: -1 });
};

// Static method to get sync statistics
SyncLogSchema.statics.getStats = async function (days: number = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await this.aggregate([
    {
      $match: {
        startedAt: { $gte: cutoff },
      },
    },
    {
      $group: {
        _id: {
          platform: '$platform',
          entity: '$entity',
          status: '$status',
        },
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        totalItems: { $sum: '$totalItems' },
        processedItems: { $sum: '$processedItems' },
        failedItems: { $sum: '$failedItems' },
      },
    },
    {
      $group: {
        _id: { platform: '$_id.platform', entity: '$_id.entity' },
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count',
          },
        },
        totalDuration: { $sum: '$totalDuration' },
        totalItems: { $sum: '$totalItems' },
        processedItems: { $sum: '$processedItems' },
        failedItems: { $sum: '$failedItems' },
      },
    },
  ]);

  return stats;
};

// Static method to clean old logs
SyncLogSchema.statics.cleanOldLogs = async function (retentionDays: number = 30) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    completedAt: { $lt: cutoff },
    status: { $in: ['completed', 'failed'] },
  });
  return result.deletedCount;
};

// Ensure virtuals are included in JSON output
SyncLogSchema.set('toJSON', { virtuals: true });
SyncLogSchema.set('toObject', { virtuals: true });

export interface ISyncLogDocument extends ISyncLog, Document {}

export const SyncLog: Model<ISyncLogDocument> = mongoose.model<ISyncLogDocument>(
  'SyncLog',
  SyncLogSchema
);

export default SyncLog;
