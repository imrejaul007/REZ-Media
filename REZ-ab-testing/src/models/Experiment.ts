import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IExperiment,
  IConversionEvent,
  IImpressionEvent,
  ExperimentStatus,
  ExperimentType,
  PrimaryMetric,
} from '../types';

// Variant subdocument schema
const VariantSchema = new Schema<IVariant>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    weight: { type: Number, required: true, min: 0, max: 100 },
    isControl: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// Statistical settings subdocument schema
const StatisticalSettingsSchema = new Schema<IStatisticalSettings>(
  {
    confidenceLevel: { type: Number, required: true, enum: [0.9, 0.95, 0.99], default: 0.95 },
    minimumSampleSize: { type: Number, required: true, default: 1000 },
    testType: { type: String, enum: ['frequentist', 'bayesian'], default: 'frequentist' },
    sequentialTesting: { type: Boolean, default: false },
  },
  { _id: false }
);

// Auto-stop settings subdocument schema
const AutoStopSettingsSchema = new Schema<IAutoStopSettings>(
  {
    enabled: { type: Boolean, default: true },
    maxDuration: { type: Number, default: 30 }, // days
    maxImpressions: { type: Number, default: 100000 },
    stopOnSignificance: { type: Boolean, default: true },
  },
  { _id: false }
);

// Winner settings subdocument schema
const WinnerSettingsSchema = new Schema<IWinnerSettings>(
  {
    autoWinner: { type: Boolean, default: false },
    confidenceThreshold: { type: Number, default: 0.95 },
    holdoutPeriod: { type: Number, default: 7 }, // days
  },
  { _id: false }
);

// Main Experiment schema
const ExperimentSchema = new Schema<IExperiment>(
  {
    name: {
      type: String,
      required: [true, 'Experiment name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    type: {
      type: String,
      enum: Object.values(ExperimentType),
      default: 'ab',
    },
    status: {
      type: String,
      enum: Object.values(ExperimentStatus),
      default: 'draft',
    },
    variants: {
      type: [VariantSchema],
      required: true,
      validate: {
        validator: function (variants: IVariant[]) {
          return variants && variants.length >= 2;
        },
        message: 'Experiment must have at least 2 variants',
      },
    },
    primaryMetric: {
      type: String,
      enum: Object.values(PrimaryMetric),
      required: true,
    },
    secondaryMetrics: [{
      type: String,
      enum: Object.values(PrimaryMetric),
    }],
    targetingRules: {
      type: Schema.Types.Mixed,
    },
    trafficAllocation: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 100,
    },
    statisticalSettings: {
      type: StatisticalSettingsSchema,
      default: () => ({}),
    },
    autoStopSettings: {
      type: AutoStopSettingsSchema,
      default: () => ({}),
    },
    winnerSettings: {
      type: WinnerSettingsSchema,
      default: () => ({}),
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: String,
      required: true,
    },
    winnerId: {
      type: String,
    },
    winnerDetectedAt: {
      type: Date,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ExperimentSchema.index({ status: 1 });
ExperimentSchema.index({ createdBy: 1 });
ExperimentSchema.index({ tags: 1 });
ExperimentSchema.index({ 'variants.id': 1 });
ExperimentSchema.index({ startDate: 1, endDate: 1 });
ExperimentSchema.index({ name: 'text', description: 'text' });

// Pre-save hook to validate variant weights
ExperimentSchema.pre('save', function (next) {
  if (this.variants && this.variants.length > 0) {
    const totalWeight = this.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      next(new Error(`Variant weights must sum to 100%, got ${totalWeight}%`));
      return;
    }
  }
  next();
});

// Virtual for duration
ExperimentSchema.virtual('duration').get(function () {
  if (!this.startDate) return 0;
  const end = this.endDate || new Date();
  return Math.ceil((end.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
});

// Conversion Event Schema
const ConversionEventSchema = new Schema<IConversionEvent>(
  {
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: true,
      index: true,
    },
    variantId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound indexes for ConversionEvent
ConversionEventSchema.index({ experimentId: 1, variantId: 1 });
ConversionEventSchema.index({ experimentId: 1, userId: 1 });
ConversionEventSchema.index({ experimentId: 1, timestamp: -1 });

// Impression Event Schema
const ImpressionEventSchema = new Schema<IImpressionEvent>(
  {
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: true,
      index: true,
    },
    variantId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound indexes for ImpressionEvent
ImpressionEventSchema.index({ experimentId: 1, variantId: 1 });
ImpressionEventSchema.index({ experimentId: 1, userId: 1 });
ImpressionEventSchema.index({ experimentId: 1, timestamp: -1 });

// Define interfaces for Mongoose Documents
export interface IExperimentDocument extends Omit<IExperiment, '_id'>, Document {}
export interface IConversionEventDocument extends Omit<IConversionEvent, '_id'>, Document {}
export interface IImpressionEventDocument extends Omit<IImpressionEvent, '_id'>, Document {}

// Create and export models
export const Experiment = mongoose.model<IExperimentDocument>('Experiment', ExperimentSchema);
export const ConversionEvent = mongoose.model<IConversionEventDocument>('ConversionEvent', ConversionEventSchema);
export const ImpressionEvent = mongoose.model<IImpressionEventDocument>('ImpressionEvent', ImpressionEventSchema);

// Export schemas for testing
export const schemas = {
  Experiment: ExperimentSchema,
  ConversionEvent: ConversionEventSchema,
  ImpressionEvent: ImpressionEventSchema,
};
