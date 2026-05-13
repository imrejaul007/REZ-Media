import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import {
  CampaignStatus,
  CampaignTrigger,
  CallPriority,
  CampaignDocument,
  BusinessHours,
  CallingWindow,
  CampaignFilters,
  CampaignSchedule
} from '../types';

const businessHoursSchema = new Schema<BusinessHours>(
  {
    enabled: { type: Boolean, default: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    startHour: { type: Number, default: 9, min: 0, max: 23 },
    endHour: { type: Number, default: 21, min: 0, max: 23 }
  },
  { _id: false }
);

const callingWindowSchema = new Schema<CallingWindow>(
  {
    enabled: { type: Boolean, default: true },
    maxCallsPerHour: { type: Number, default: 60, min: 1 }
  },
  { _id: false }
);

const campaignFiltersSchema = new Schema<CampaignFilters>(
  {
    excludeDnc: { type: Boolean, default: true },
    minOrderValue: { type: Number },
    customerTags: [{ type: String }]
  },
  { _id: false }
);

const campaignScheduleSchema = new Schema<CampaignSchedule>(
  {
    startDate: { type: Date },
    endDate: { type: Date },
    cronExpression: { type: String }
  },
  { _id: false }
);

const statsSchema = new Schema(
  {
    totalCalls: { type: Number, default: 0 },
    completedCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    answeredCalls: { type: Number, default: 0 },
    transferredCalls: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0, min: 0, max: 100 }
  },
  { _id: false }
);

export interface ICampaign extends MongooseDocument, Omit<CampaignDocument, '_id'> {}

const campaignSchema = new Schema<ICampaign>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    trigger: {
      type: String,
      enum: Object.values(CampaignTrigger),
      required: true,
      index: true
    },
    templateId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true
    },
    priority: {
      type: String,
      enum: Object.values(CallPriority),
      default: CallPriority.MEDIUM
    },
    businessHours: {
      type: businessHoursSchema,
      default: () => ({
        enabled: true,
        timezone: 'Asia/Kolkata',
        startHour: 9,
        endHour: 21
      })
    },
    callingWindow: {
      type: callingWindowSchema,
      default: () => ({
        enabled: true,
        maxCallsPerHour: 60
      })
    },
    filters: {
      type: campaignFiltersSchema,
      default: () => ({
        excludeDnc: true
      })
    },
    schedule: {
      type: campaignScheduleSchema
    },
    stats: {
      type: statsSchema,
      default: () => ({
        totalCalls: 0,
        completedCalls: 0,
        failedCalls: 0,
        answeredCalls: 0,
        transferredCalls: 0,
        conversionRate: 0
      })
    }
  },
  {
    timestamps: true,
    collection: 'campaigns'
  }
);

// Compound indexes
campaignSchema.index({ status: 1, trigger: 1 });
campaignSchema.index({ trigger: 1, 'schedule.startDate': 1 });

// Methods
campaignSchema.methods.isActive = function (): boolean {
  return this.status === CampaignStatus.RUNNING || this.status === CampaignStatus.SCHEDULED;
};

campaignSchema.methods.isWithinBusinessHours = function (date: Date = new Date()): boolean {
  if (!this.businessHours.enabled) return true;

  // Get timezone from business hours
  const options: Intl.DateTimeFormatOptions = {
    timeZone: this.businessHours.timezone,
    hour: 'numeric',
    hour12: false
  };

  const hour = parseInt(new Intl.DateTimeFormat('en-US', options).format(date), 10);
  return hour >= this.businessHours.startHour && hour < this.businessHours.endHour;
};

campaignSchema.methods.updateStats = async function (): Promise<void> {
  const { CallModel } = await import('./Call');
  const { CallStatus } = await import('../types');

  const stats = await CallModel.aggregate([
    { $match: { campaignId: this._id } },
    {
      $group: {
        _id: null,
        totalCalls: { $sum: 1 },
        completedCalls: {
          $sum: { $cond: [{ $eq: ['$status', CallStatus.CONCLUDED] }, 1, 0] }
        },
        failedCalls: {
          $sum: { $cond: [{ $in: ['$status', [CallStatus.FAILED, CallStatus.CANCELLED]] }, 1, 0] }
        },
        answeredCalls: {
          $sum: { $cond: [{ $eq: ['$status', CallStatus.ANSWERED] }, 1, 0] }
        },
        transferredCalls: {
          $sum: { $cond: [{ $eq: ['$transferredToAgent', true] }, 1, 0] }
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const { totalCalls, completedCalls, answeredCalls, ...rest } = stats[0];
    const conversionRate = totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0;

    this.stats = {
      totalCalls,
      completedCalls,
      answeredCalls,
      ...rest,
      conversionRate
    };
    await this.save();
  }
};

// Static methods
campaignSchema.statics.findActiveCampaigns = function () {
  return this.find({
    status: { $in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] }
  }).sort({ priority: -1, createdAt: 1 });
};

campaignSchema.statics.findByTrigger = function (trigger: CampaignTrigger) {
  return this.find({
    trigger,
    status: { $in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED] }
  });
};

export const CampaignModel = mongoose.model<ICampaign>('Campaign', campaignSchema);
