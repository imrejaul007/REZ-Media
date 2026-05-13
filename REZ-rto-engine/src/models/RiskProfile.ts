import mongoose, { Document, Schema } from 'mongoose';
import { RiskTier, FraudSignalType } from '../types';

export interface IRiskProfile extends Document {
  userId: string;
  overallRiskScore: number;
  riskTier: RiskTier;
  // Behavioral metrics
  totalOrders: number;
  completedOrders: number;
  returnedOrders: number;
  codOrders: number;
  codReturnRate: number;
  avgOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  // Fraud signals tracking
  fraudSignals: Array<{
    type: FraudSignalType;
    count: number;
    lastOccurrence: Date;
    resolved: boolean;
  }>;
  // Device trust
  trustedDevices: string[];
  deviceCount: number;
  // Address trust
  trustedAddresses: string[];
  addressCount: number;
  // Scores breakdown
  deviceScore: number;
  addressScore: number;
  behaviorScore: number;
  orderScore: number;
  // Metadata
  lastAnalyzed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RiskProfileSchema = new Schema<IRiskProfile>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    overallRiskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    riskTier: {
      type: String,
      enum: Object.values(RiskTier),
      default: RiskTier.LOW,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    completedOrders: {
      type: Number,
      default: 0,
    },
    returnedOrders: {
      type: Number,
      default: 0,
    },
    codOrders: {
      type: Number,
      default: 0,
    },
    codReturnRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    avgOrderValue: {
      type: Number,
      default: 0,
    },
    lastOrderDate: {
      type: Date,
    },
    firstOrderDate: {
      type: Date,
    },
    fraudSignals: [
      {
        type: {
          type: String,
          enum: Object.values(FraudSignalType),
          required: true,
        },
        count: {
          type: Number,
          default: 1,
        },
        lastOccurrence: {
          type: Date,
          default: Date.now,
        },
        resolved: {
          type: Boolean,
          default: false,
        },
      },
    ],
    trustedDevices: [
      {
        type: String,
      },
    ],
    deviceCount: {
      type: Number,
      default: 0,
    },
    trustedAddresses: [
      {
        type: String,
      },
    ],
    addressCount: {
      type: Number,
      default: 0,
    },
    deviceScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    addressScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    behaviorScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    orderScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    lastAnalyzed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
RiskProfileSchema.index({ riskTier: 1 });
RiskProfileSchema.index({ overallRiskScore: 1 });
RiskProfileSchema.index({ codReturnRate: 1 });
RiskProfileSchema.index({ lastAnalyzed: 1 });

// Method to update risk tier based on score
RiskProfileSchema.methods.updateRiskTier = function (score: number): RiskTier {
  if (score <= 30) {
    return RiskTier.LOW;
  } else if (score <= 60) {
    return RiskTier.MEDIUM;
  } else {
    return RiskTier.HIGH;
  }
};

// Method to add fraud signal
RiskProfileSchema.methods.addFraudSignal = async function (
  signalType: FraudSignalType
): Promise<void> {
  const existingSignal = this.fraudSignals.find(
    (s: any) => s.type === signalType
  );

  if (existingSignal) {
    existingSignal.count += 1;
    existingSignal.lastOccurrence = new Date();
    existingSignal.resolved = false;
  } else {
    this.fraudSignals.push({
      type: signalType,
      count: 1,
      lastOccurrence: new Date(),
      resolved: false,
    });
  }

  this.lastAnalyzed = new Date();
  await this.save();
};

// Method to resolve fraud signal
RiskProfileSchema.methods.resolveFraudSignal = async function (
  signalType: FraudSignalType
): Promise<void> {
  const signal = this.fraudSignals.find((s: any) => s.type === signalType);
  if (signal) {
    signal.resolved = true;
    this.lastAnalyzed = new Date();
    await this.save();
  }
};

export const RiskProfile = mongoose.model<IRiskProfile>(
  'RiskProfile',
  RiskProfileSchema
);
