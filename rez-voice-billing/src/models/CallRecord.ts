/**
 * CallRecord Model - MongoDB schema for aggregated call records
 * Stores daily aggregated call statistics per user
 */

import mongoose, { Document, Schema } from 'mongoose';
import { ICallRecord } from '../types';

export interface CallRecordDocument extends Omit<ICallRecord, 'date' | 'createdAt' | 'updatedAt'>, Document {
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CallRecordSchema = new Schema<CallRecordDocument>(
  {
    recordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBillableDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    outboundCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    inboundCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    missedCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    failedCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    peakHour: {
      type: Number,
      min: 0,
      max: 23,
    },
  },
  {
    timestamps: true,
    collection: 'call_records',
  }
);

// Compound indexes
CallRecordSchema.index({ userId: 1, date: -1 });
CallRecordSchema.index({ userId: 1, date: 1 }, { unique: true });
CallRecordSchema.index({ date: -1, totalCost: -1 });

// Static method to get or create daily record for user
CallRecordSchema.statics.getOrCreateDailyRecord = async function (
  userId: string,
  date: Date = new Date()
): Promise<CallRecordDocument> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  let record = await this.findOne({
    userId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  }).exec();

  if (!record) {
    const { v4: uuidv4 } = await import('uuid');
    record = new this({
      recordId: uuidv4(),
      userId,
      date: startOfDay,
    });
    await record.save();
  }

  return record;
};

// Static method to update daily stats from session
CallRecordSchema.statics.updateFromSession = async function (
  userId: string,
  sessionData: {
    duration: number;
    billableDuration: number;
    cost: number;
    callType: string;
    status: string;
    hour: number;
  }
): Promise<void> {
  const record = await this.getOrCreateDailyRecord(userId);

  record.totalCalls += 1;
  record.totalDuration += sessionData.duration;
  record.totalBillableDuration += sessionData.billableDuration;
  record.totalCost += sessionData.cost;

  if (sessionData.callType === 'outbound') {
    record.outboundCalls += 1;
  } else {
    record.inboundCalls += 1;
  }

  if (sessionData.status === 'missed') {
    record.missedCalls += 1;
  } else if (sessionData.status === 'failed') {
    record.failedCalls += 1;
  }

  record.averageDuration = Math.round(record.totalDuration / record.totalCalls);

  // Update peak hour if this hour has more calls
  // For simplicity, track which hour had most sessions starting
  record.peakHour = sessionData.hour;

  await record.save();
};

// Static method to get user stats for a date range
CallRecordSchema.statics.getUserStats = async function (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CallRecordDocument[]> {
  return this.find({
    userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .sort({ date: -1 })
    .exec();
};

// Static method to get aggregate stats for period
CallRecordSchema.statics.getAggregateStats = async function (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCalls: number;
  totalDuration: number;
  totalCost: number;
  averageDuration: number;
  outboundCalls: number;
  inboundCalls: number;
  missedCalls: number;
  failedCalls: number;
}> {
  const result = await this.aggregate([
    {
      $match: {
        userId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: '$userId',
        totalCalls: { $sum: '$totalCalls' },
        totalDuration: { $sum: '$totalDuration' },
        totalBillableDuration: { $sum: '$totalBillableDuration' },
        totalCost: { $sum: '$totalCost' },
        outboundCalls: { $sum: '$outboundCalls' },
        inboundCalls: { $sum: '$inboundCalls' },
        missedCalls: { $sum: '$missedCalls' },
        failedCalls: { $sum: '$failedCalls' },
      },
    },
    {
      $project: {
        _id: 0,
        totalCalls: 1,
        totalDuration: 1,
        totalBillableDuration: 1,
        totalCost: { $round: ['$totalCost', 4] },
        averageDuration: {
          $cond: [{ $eq: ['$totalCalls', 0] }, 0, { $round: [{ $divide: ['$totalDuration', '$totalCalls'] }, 0] }],
        },
        outboundCalls: 1,
        inboundCalls: 1,
        missedCalls: 1,
        failedCalls: 1,
      },
    },
  ]).exec();

  return (
    result[0] || {
      totalCalls: 0,
      totalDuration: 0,
      totalCost: 0,
      averageDuration: 0,
      outboundCalls: 0,
      inboundCalls: 0,
      missedCalls: 0,
      failedCalls: 0,
    }
  );
};

// Static method to get top calling destinations
CallRecordSchema.statics.getTopDestinations = async function (
  userId: string,
  startDate: Date,
  endDate: Date,
  limit = 10
): Promise<Array<{ destination: string; count: number; totalDuration: number }>> {
  const sessions = await mongoose.connection
    .collection('call_sessions')
    .aggregate([
      {
        $match: {
          callerId: userId,
          status: 'ended',
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: '$calleePhone',
          count: { $sum: 1 },
          totalDuration: { $sum: '$actualDuration' },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          _id: 0,
          destination: '$_id',
          count: 1,
          totalDuration: 1,
        },
      },
    ])
    .toArray();

  return sessions;
};

// Static method to get daily trend
CallRecordSchema.statics.getDailyTrend = async function (
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: string; calls: number; duration: number; cost: number }>> {
  return this.aggregate([
    {
      $match: {
        userId,
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        },
        calls: { $sum: '$totalCalls' },
        duration: { $sum: '$totalDuration' },
        cost: { $sum: '$totalCost' },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        calls: 1,
        duration: 1,
        cost: { $round: ['$cost', 4] },
      },
    },
  ]).exec();
};

export const CallRecord = mongoose.model<CallRecordDocument>('CallRecord', CallRecordSchema);

export default CallRecord;
