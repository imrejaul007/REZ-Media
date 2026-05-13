import mongoose, { Document, Schema } from 'mongoose';

export interface IDevice extends Document {
  fingerprintId: string;
  userId: string;
  // Fingerprint data
  fingerprintHash: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  canvasHash: string;
  webglHash: string;
  audioHash: string;
  // Network data
  ipAddress: string;
  country: string;
  city: string;
  isp: string;
  isProxy: boolean;
  isTor: boolean;
  // Trust metrics
  firstSeen: Date;
  lastSeen: Date;
  totalOrders: number;
  successfulOrders: number;
  returnedOrders: number;
  codOrders: number;
  codReturnRate: number;
  avgOrderValue: number;
  // Trust status
  isTrusted: boolean;
  trustScore: number;
  // Blacklist
  isBlacklisted: boolean;
  blacklistReason?: string;
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    fingerprintId: {
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
    fingerprintHash: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    screenResolution: {
      type: String,
    },
    timezone: {
      type: String,
    },
    language: {
      type: String,
    },
    platform: {
      type: String,
    },
    canvasHash: {
      type: String,
    },
    webglHash: {
      type: String,
    },
    audioHash: {
      type: String,
    },
    ipAddress: {
      type: String,
      index: true,
    },
    country: {
      type: String,
    },
    city: {
      type: String,
    },
    isp: {
      type: String,
    },
    isProxy: {
      type: Boolean,
      default: false,
    },
    isTor: {
      type: Boolean,
      default: false,
    },
    firstSeen: {
      type: Date,
      default: Date.now,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    successfulOrders: {
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
    isTrusted: {
      type: Boolean,
      default: false,
    },
    trustScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    isBlacklisted: {
      type: Boolean,
      default: false,
    },
    blacklistReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
DeviceSchema.index({ userId: 1, fingerprintId: 1 });
DeviceSchema.index({ ipAddress: 1, fingerprintHash: 1 });
DeviceSchema.index({ trustScore: 1 });
DeviceSchema.index({ isBlacklisted: 1 });

// Method to update device metrics after order
DeviceSchema.methods.recordOrder = async function (
  successful: boolean,
  isReturn: boolean,
  orderValue: number,
  isCOD: boolean
): Promise<void> {
  this.totalOrders += 1;
  this.lastSeen = new Date();

  if (successful && !isReturn) {
    this.successfulOrders += 1;
  }

  if (isReturn) {
    this.returnedOrders += 1;
  }

  if (isCOD) {
    this.codOrders += 1;
    if (this.codOrders > 0) {
      this.codReturnRate = this.returnedOrders / this.codOrders;
    }
  }

  // Update average order value
  this.avgOrderValue =
    (this.avgOrderValue * (this.totalOrders - 1) + orderValue) / this.totalOrders;

  // Update trust score
  this.recalculateTrustScore();
  await this.save();
};

// Method to recalculate trust score
DeviceSchema.methods.recalculateTrustScore = function (): void {
  let score = 50; // Base score

  // Increase score for good history
  if (this.totalOrders >= 5) score += 10;
  if (this.totalOrders >= 10) score += 10;
  if (this.successfulOrders / this.totalOrders >= 0.9) score += 15;

  // Decrease score for high return rate
  if (this.codReturnRate > 0.3) score -= 20;
  if (this.codReturnRate > 0.5) score -= 20;
  if (this.codReturnRate > 0.7) score -= 15;

  // Decrease score for suspicious indicators
  if (this.isProxy) score -= 25;
  if (this.isTor) score -= 30;

  // New device penalty
  const daysSinceFirstSeen =
    (Date.now() - this.firstSeen.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstSeen < 7) score -= 10;
  if (daysSinceFirstSeen < 1) score -= 10;

  // Clamp score
  this.trustScore = Math.max(0, Math.min(100, score));
  this.isTrusted = this.trustScore >= 70;
};

// Static method to find device by fingerprint
DeviceSchema.statics.findByFingerprint = async function (
  fingerprintHash: string,
  userId?: string
): Promise<IDevice | null> {
  const query: Record<string, string> = { fingerprintHash };
  if (userId) {
    query.userId = userId;
  }
  return this.findOne(query);
};

// Static method to find all devices for a user
DeviceSchema.statics.findByUser = async function (
  userId: string
): Promise<IDevice[]> {
  return this.find({ userId }).sort({ lastSeen: -1 });
};

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);
