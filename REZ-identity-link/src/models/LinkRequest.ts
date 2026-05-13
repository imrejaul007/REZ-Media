/**
 * LinkRequest Model - Track account linking requests and OTP verification
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ILinkRequest extends Document {
  requestId: string;
  type: 'phone_link' | 'email_link' | 'device_link' | 'merge';
  identifier: {
    phone?: string;
    email?: string;
    deviceId?: string;
  };
  app: string;
  requestedUserId?: string; // User who initiated the request
  targetIdentityId?: string; // Identity to link to
  status: 'pending' | 'otp_sent' | 'otp_verified' | 'completed' | 'expired' | 'failed';
  otp?: {
    code: string;
    attempts: number;
    sentAt: Date;
    verifiedAt?: Date;
    expiresAt: Date;
  };
  verification?: {
    method: 'otp' | 'device_verify' | 'email_verify' | 'manual';
    verifiedAt: Date;
    verifiedBy: string;
  };
  metadata: Record<string, any>;
  completedAt?: Date;
  expiresAt: Date;
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const OTPSchema = new Schema({
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  sentAt: { type: Date, required: true },
  verifiedAt: { type: Date },
  expiresAt: { type: Date, required: true },
}, { _id: false });

const VerificationSchema = new Schema({
  method: { type: String, enum: ['otp', 'device_verify', 'email_verify', 'manual'], required: true },
  verifiedAt: { type: Date, required: true },
  verifiedBy: { type: String, required: true },
}, { _id: false });

const ErrorSchema = new Schema({
  code: { type: String, required: true },
  message: { type: String, required: true },
}, { _id: false });

const LinkRequestSchema = new Schema<ILinkRequest>({
  requestId: { type: String, required: true, unique: true, index: true },
  type: {
    type: String,
    enum: ['phone_link', 'email_link', 'device_link', 'merge'],
    required: true,
  },
  identifier: {
    phone: { type: String, sparse: true },
    email: { type: String, sparse: true },
    deviceId: { type: String, sparse: true },
  },
  app: { type: String, required: true, index: true },
  requestedUserId: { type: String, index: true },
  targetIdentityId: { type: String, index: true },
  status: {
    type: String,
    enum: ['pending', 'otp_sent', 'otp_verified', 'completed', 'expired', 'failed'],
    default: 'pending',
    index: true,
  },
  otp: { type: OTPSchema },
  verification: { type: VerificationSchema },
  metadata: { type: Schema.Types.Mixed, default: {} },
  completedAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true },
  error: { type: ErrorSchema },
}, { timestamps: true });

// Indexes for common queries
LinkRequestSchema.index({ 'identifier.phone': 1, status: 1 });
LinkRequestSchema.index({ 'identifier.email': 1, status: 1 });
LinkRequestSchema.index({ 'identifier.deviceId': 1, status: 1 });
LinkRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // Auto-delete after 24 hours

// TTL index to auto-expire old requests
LinkRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LinkRequest = mongoose.model<ILinkRequest>('LinkRequest', LinkRequestSchema);

/**
 * Link Request Service - Manage link requests
 */
export class LinkRequestService {

  /**
   * Create a new link request
   */
  async createRequest(options: {
    type: ILinkRequest['type'];
    identifier: { phone?: string; email?: string; deviceId?: string };
    app: string;
    requestedUserId?: string;
    targetIdentityId?: string;
    metadata?: Record<string, any>;
  }): Promise<ILinkRequest> {
    const requestId = `lr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request = new LinkRequest({
      requestId,
      type: options.type,
      identifier: options.identifier,
      app: options.app,
      requestedUserId: options.requestedUserId,
      targetIdentityId: options.targetIdentityId,
      status: 'pending',
      metadata: options.metadata || {},
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes default
    });

    await request.save();
    return request;
  }

  /**
   * Find request by ID
   */
  async findById(requestId: string): Promise<ILinkRequest | null> {
    return LinkRequest.findOne({ requestId });
  }

  /**
   * Find request by phone
   */
  async findByPhone(phone: string, status?: string): Promise<ILinkRequest | null> {
    const query: Record<string, any> = { 'identifier.phone': phone };
    if (status) query.status = status;
    return LinkRequest.findOne(query).sort({ createdAt: -1 });
  }

  /**
   * Find request by email
   */
  async findByEmail(email: string, status?: string): Promise<ILinkRequest | null> {
    const query: Record<string, any> = { 'identifier.email': email };
    if (status) query.status = status;
    return LinkRequest.findOne(query).sort({ createdAt: -1 });
  }

  /**
   * Update OTP for request
   */
  async updateOTP(
    requestId: string,
    otp: {
      code: string;
      sentAt: Date;
      expiresAt: Date;
    }
  ): Promise<ILinkRequest | null> {
    const request = await LinkRequest.findOne({ requestId });
    if (!request) return null;

    request.otp = {
      code: otp.code,
      attempts: 0,
      sentAt: otp.sentAt,
      expiresAt: otp.expiresAt,
    };
    request.status = 'otp_sent';
    request.expiresAt = otp.expiresAt;

    await request.save();
    return request;
  }

  /**
   * Verify OTP
   */
  async verifyOTP(requestId: string, code: string): Promise<{
    success: boolean;
    error?: string;
    request?: ILinkRequest;
  }> {
    const request = await LinkRequest.findOne({ requestId });
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    if (request.status === 'completed') {
      return { success: false, error: 'Request already completed' };
    }

    if (request.status === 'expired') {
      return { success: false, error: 'Request expired' };
    }

    if (!request.otp) {
      return { success: false, error: 'No OTP sent for this request' };
    }

    // Check if OTP expired
    if (new Date() > request.otp.expiresAt) {
      request.status = 'expired';
      await request.save();
      return { success: false, error: 'OTP expired' };
    }

    // Check attempts
    if (request.otp.attempts >= 3) {
      request.status = 'failed';
      request.error = {
        code: 'MAX_ATTEMPTS',
        message: 'Maximum OTP verification attempts exceeded',
      };
      await request.save();
      return { success: false, error: 'Maximum attempts exceeded' };
    }

    // Verify code
    if (request.otp.code !== code) {
      request.otp.attempts += 1;
      await request.save();
      return { success: false, error: 'Invalid OTP code' };
    }

    // Mark as verified
    request.otp.verifiedAt = new Date();
    request.status = 'otp_verified';
    request.verification = {
      method: 'otp',
      verifiedAt: new Date(),
      verifiedBy: 'system',
    };

    await request.save();
    return { success: true, request };
  }

  /**
   * Mark request as completed
   */
  async markCompleted(requestId: string, result?: Record<string, any>): Promise<ILinkRequest | null> {
    const request = await LinkRequest.findOne({ requestId });
    if (!request) return null;

    request.status = 'completed';
    request.completedAt = new Date();
    if (result) {
      request.metadata = { ...request.metadata, ...result };
    }

    await request.save();
    return request;
  }

  /**
   * Mark request as failed
   */
  async markFailed(requestId: string, errorCode: string, errorMessage: string): Promise<ILinkRequest | null> {
    const request = await LinkRequest.findOne({ requestId });
    if (!request) return null;

    request.status = 'failed';
    request.error = { code: errorCode, message: errorMessage };

    await request.save();
    return request;
  }

  /**
   * Expire old pending requests
   */
  async expireOldRequests(): Promise<number> {
    const result = await LinkRequest.updateMany(
      {
        status: { $in: ['pending', 'otp_sent'] },
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: 'expired' },
      }
    );
    return result.modifiedCount;
  }

  /**
   * Get request statistics
   */
  async getStats(app?: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    expired: number;
    failed: number;
    otpSent: number;
  }> {
    const match: Record<string, any> = {};
    if (app) match.app = app;

    const stats = await LinkRequest.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: 0,
      completed: 0,
      expired: 0,
      failed: 0,
      otpSent: 0,
    };

    for (const stat of stats) {
      result.total += stat.count;
      switch (stat._id) {
        case 'pending':
          result.pending = stat.count;
          break;
        case 'completed':
          result.completed = stat.count;
          break;
        case 'expired':
          result.expired = stat.count;
          break;
        case 'failed':
          result.failed = stat.count;
          break;
        case 'otp_sent':
          result.otpSent = stat.count;
          break;
      }
    }

    return result;
  }
}

export const linkRequestService = new LinkRequestService();
