import mongoose, { Document, Schema } from 'mongoose';
import { RiskTier, CODDecision, FraudSignalType } from '../types';

export interface IOrderRisk extends Document {
  orderId: string;
  userId: string;
  // Risk scores
  riskScore: number;
  riskTier: RiskTier;
  deviceScore: number;
  addressScore: number;
  behaviorScore: number;
  orderScore: number;
  // COD decision
  codDecision: CODDecision;
  codDecisionReason: string;
  partialAdvanceAmount?: number;
  partialAdvancePercentage?: number;
  // Fraud signals for this order
  fraudSignals: Array<{
    type: FraudSignalType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    value: string | number | boolean;
  }>;
  // Order details
  orderValue: number;
  codAmount: number;
  itemCount: number;
  itemCategories: string[];
  isNewDevice: boolean;
  isNewAddress: boolean;
  isFirstCOD: boolean;
  // Device info
  deviceFingerprintId?: string;
  deviceIp?: string;
  deviceUserAgent?: string;
  // Address info
  shippingAddressHash: string;
  billingAddressHash?: string;
  addressQualityScore?: number;
  // Verification
  verificationChecks: Array<{
    checkType: string;
    passed: boolean;
    details: string;
  }>;
  verified: boolean;
  overallConfidence: number;
  // Decision expiry
  decisionExpiresAt: Date;
  // Metadata
  analyzedAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Status tracking
  status: 'PENDING' | 'VERIFIED' | 'DECLINED' | 'PARTIAL' | 'APPROVED' | 'EXPIRED';
}

const OrderRiskSchema = new Schema<IOrderRisk>(
  {
    orderId: {
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
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    riskTier: {
      type: String,
      enum: Object.values(RiskTier),
      required: true,
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
    codDecision: {
      type: String,
      enum: Object.values(CODDecision),
      required: true,
    },
    codDecisionReason: {
      type: String,
      required: true,
    },
    partialAdvanceAmount: {
      type: Number,
    },
    partialAdvancePercentage: {
      type: Number,
    },
    fraudSignals: [
      {
        type: {
          type: String,
          enum: Object.values(FraudSignalType),
          required: true,
        },
        severity: {
          type: String,
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        value: {
          type: Schema.Types.Mixed,
        },
      },
    ],
    orderValue: {
      type: Number,
      required: true,
    },
    codAmount: {
      type: Number,
      required: true,
    },
    itemCount: {
      type: Number,
      required: true,
    },
    itemCategories: [
      {
        type: String,
      },
    ],
    isNewDevice: {
      type: Boolean,
      default: false,
    },
    isNewAddress: {
      type: Boolean,
      default: false,
    },
    isFirstCOD: {
      type: Boolean,
      default: false,
    },
    deviceFingerprintId: {
      type: String,
      index: true,
    },
    deviceIp: {
      type: String,
    },
    deviceUserAgent: {
      type: String,
    },
    shippingAddressHash: {
      type: String,
      required: true,
    },
    billingAddressHash: {
      type: String,
    },
    addressQualityScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    verificationChecks: [
      {
        checkType: {
          type: String,
          required: true,
        },
        passed: {
          type: Boolean,
          required: true,
        },
        details: {
          type: String,
          required: true,
        },
      },
    ],
    verified: {
      type: Boolean,
      default: false,
    },
    overallConfidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    decisionExpiresAt: {
      type: Date,
      required: true,
    },
    analyzedAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'DECLINED', 'PARTIAL', 'APPROVED', 'EXPIRED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
OrderRiskSchema.index({ orderId: 1, userId: 1 });
OrderRiskSchema.index({ riskTier: 1, status: 1 });
OrderRiskSchema.index({ userId: 1, analyzedAt: -1 });
OrderRiskSchema.index({ decisionExpiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static method to get or create order risk
OrderRiskSchema.statics.findOrCreate = async function (
  orderId: string,
  userId: string
): Promise<IOrderRisk> {
  let orderRisk = await this.findOne({ orderId });

  if (!orderRisk) {
    orderRisk = await this.create({
      orderId,
      userId,
      riskScore: 0,
      riskTier: RiskTier.LOW,
      codDecision: CODDecision.REVIEW,
      codDecisionReason: 'Initial state',
      orderValue: 0,
      codAmount: 0,
      itemCount: 0,
      itemCategories: [],
      shippingAddressHash: '',
      decisionExpiresAt: new Date(),
      analyzedAt: new Date(),
    });
  }

  return orderRisk;
};

export const OrderRisk = mongoose.model<IOrderRisk>('OrderRisk', OrderRiskSchema);
