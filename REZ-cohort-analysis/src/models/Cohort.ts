import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';

// ============= Zod Schemas (Validation) =============

export const CohortPeriodSchema = z.enum(['daily', 'weekly', 'monthly']);
export type CohortPeriod = z.infer<typeof CohortPeriodSchema>;

export const CohortTypeSchema = z.enum(['retention', 'revenue', 'conversion']);
export type CohortType = z.infer<typeof CohortTypeSchema>;

export const SegmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  filters: z.record(z.unknown()).optional(),
});

export const CohortDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: CohortTypeSchema,
  period: CohortPeriodSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  segmentIds: z.array(z.string()).optional(),
  metrics: z.array(z.enum(['users', 'revenue', 'orders', 'conversions'])).default(['users']),
});

export const CohortDataPointSchema = z.object({
  periodIndex: z.number().int().min(0),
  periodLabel: z.string(),
  activeUsers: z.number().int().min(0),
  retainedUsers: z.number().int().min(0),
  retentionRate: z.number().min(0).max(100),
  revenue: z.number().min(0).optional(),
  averageRevenuePerUser: z.number().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
  conversionRate: z.number().min(0).max(100).optional(),
});

export const CohortRowSchema = z.object({
  cohortId: z.string(),
  cohortDate: z.string(),
  cohortLabel: z.string(),
  initialSize: z.number().int().min(1),
  dataPoints: z.array(CohortDataPointSchema),
});

export const CohortGridSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: CohortTypeSchema,
  period: CohortPeriodSchema,
  cohorts: z.array(CohortRowSchema),
  maxPeriods: z.number().int().min(1),
  generatedAt: z.string().datetime(),
  metadata: z.object({
    totalUsers: z.number().int().min(0),
    averageRetentionRate: z.number().min(0).max(100),
    averageRevenuePerUser: z.number().min(0).optional(),
    topPerformingCohort: z.string().optional(),
    worstPerformingCohort: z.string().optional(),
  }).optional(),
});

// ============= Mongoose Models =============

export interface ICohortDefinition extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: CohortType;
  period: CohortPeriod;
  startDate: Date;
  endDate: Date;
  segmentIds: string[];
  metrics: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CohortDefinitionSchemaMongoose = new Schema<ICohortDefinition>(
  {
    name: { type: String, required: true, maxlength: 100, index: true },
    type: { type: String, enum: ['retention', 'revenue', 'conversion'], required: true, index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    segmentIds: [{ type: String, index: true }],
    metrics: [{ type: String, enum: ['users', 'revenue', 'orders', 'conversions'] }],
  },
  { timestamps: true }
);

export interface IUserActivity extends Document {
  _id: mongoose.Types.ObjectId;
  userId: string;
  cohortDate: Date;
  activityDate: Date;
  period: CohortPeriod;
  segmentId?: string;
  revenue: number;
  orders: number;
  conversions: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const UserActivitySchema = new Schema<IUserActivity>(
  {
    userId: { type: String, required: true, index: true },
    cohortDate: { type: Date, required: true, index: true },
    activityDate: { type: Date, required: true, index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, index: true },
    segmentId: { type: String, index: true },
    revenue: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound indexes for cohort analysis queries
UserActivitySchema.index({ cohortDate: 1, activityDate: 1 });
UserActivitySchema.index({ cohortDate: 1, period: 1 });
UserActivitySchema.index({ segmentId: 1, cohortDate: 1, activityDate: 1 });

export interface IRetentionCurve extends Document {
  _id: mongoose.Types.ObjectId;
  cohortType: CohortType;
  period: CohortPeriod;
  cohortDate: Date;
  periodIndex: number;
  retentionRate: number;
  confidenceInterval: { lower: number; upper: number };
  sampleSize: number;
  segmentId?: string;
  createdAt: Date;
}

const RetentionCurveSchema = new Schema<IRetentionCurve>(
  {
    cohortType: { type: String, enum: ['retention', 'revenue', 'conversion'], required: true, index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, index: true },
    cohortDate: { type: Date, required: true, index: true },
    periodIndex: { type: Number, required: true },
    retentionRate: { type: Number, required: true },
    confidenceInterval: {
      lower: { type: Number, required: true },
      upper: { type: Number, required: true },
    },
    sampleSize: { type: Number, required: true },
    segmentId: { type: String, index: true },
  },
  { timestamps: true }
);

RetentionCurveSchema.index({ cohortType: 1, period: 1, periodIndex: 1, segmentId: 1 });

export interface ICohortExport extends Document {
  _id: mongoose.Types.ObjectId;
  cohortGridId: string;
  format: 'csv' | 'json' | 'xlsx';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  fileUrl?: string;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const CohortExportSchema = new Schema<ICohortExport>(
  {
    cohortGridId: { type: String, required: true, index: true },
    format: { type: String, enum: ['csv', 'json', 'xlsx'], required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    fileUrl: { type: String },
    expiresAt: { type: Date, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// ============= TypeScript Interfaces =============

export interface CohortRequest {
  name: string;
  type: CohortType;
  period: CohortPeriod;
  startDate: string;
  endDate: string;
  segmentIds?: string[];
  metrics?: string[];
  maxPeriods?: number;
}

export interface CohortFilter {
  startDate?: Date;
  endDate?: Date;
  segmentIds?: string[];
  cohortTypes?: CohortType[];
}

export interface TimeToConvertResult {
  medianDays: number;
  meanDays: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  distribution: Record<number, number>;
  totalUsers: number;
  convertedUsers: number;
  conversionRate: number;
}

export interface SegmentComparisonResult {
  segmentId: string;
  segmentName: string;
  averageRetentionRate: number;
  retentionRatesByPeriod: Record<number, number>;
  cohortSize: number;
  revenuePerUser: number;
  conversionRate: number;
}

export interface RetentionCurvePoint {
  periodIndex: number;
  retentionRate: number;
  lowerConfidence: number;
  upperConfidence: number;
  sampleSize: number;
}

// ============= Export Models =============

export const CohortDefinition = mongoose.model<ICohortDefinition>(
  'CohortDefinition',
  CohortDefinitionSchemaMongoose
);

export const UserActivity = mongoose.model<IUserActivity>('UserActivity', UserActivitySchema);

export const RetentionCurve = mongoose.model<IRetentionCurve>('RetentionCurve', RetentionCurveSchema);

export const CohortExport = mongoose.model<ICohortExport>('CohortExport', CohortExportSchema);

// ============= Validation Helper =============

export function validateCohortRequest(data: unknown): CohortRequest {
  return CohortDefinitionSchema.parse(data);
}

export function validateCohortGrid(data: unknown) {
  return CohortGridSchema.parse(data);
}
