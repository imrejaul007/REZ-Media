import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInstagramSession extends Document {
  sessionId: string;
  instagramUserId: Types.ObjectId;
  rezUserId?: string;
  platform: 'instagram';
  platformUserId: string;
  username: string;
  email?: string;
  phone?: string;
  sessionToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  status: 'pending' | 'active' | 'completed' | 'expired' | 'failed';
  verificationCode?: string;
  verificationAttempts: number;
  lastVerificationAttempt?: Date;
  metadata: {
    source?: string;
    referrer?: string;
    userAgent?: string;
    ip?: string;
    location?: string;
  };
  linkContext?: {
    intent?: string;
    conversationId?: string;
    messageId?: string;
    mediaId?: string;
    commentId?: string;
  };
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isExpired(): boolean;
  canRetryVerification(maxAttempts?: number): boolean;
}

const InstagramSessionSchema = new Schema<IInstagramSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    instagramUserId: {
      type: Schema.Types.ObjectId,
      ref: 'InstagramUser',
      required: true,
      index: true,
    },
    rezUserId: {
      type: String,
      index: true,
    },
    platform: {
      type: String,
      enum: ['instagram'],
      default: 'instagram',
    },
    platformUserId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    phone: {
      type: String,
    },
    sessionToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    tokenExpiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'expired', 'failed'],
      default: 'pending',
      index: true,
    },
    verificationCode: {
      type: String,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
    },
    lastVerificationAttempt: {
      type: Date,
    },
    metadata: {
      source: String,
      referrer: String,
      userAgent: String,
      ip: String,
      location: String,
    },
    linkContext: {
      intent: String,
      conversationId: String,
      messageId: String,
      mediaId: String,
      commentId: String,
    },
    completedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
InstagramSessionSchema.index({ instagramUserId: 1, status: 1 });
InstagramSessionSchema.index({ rezUserId: 1, status: 1 });
InstagramSessionSchema.index({ status: 1, expiresAt: 1 });
InstagramSessionSchema.index({ verificationCode: 1, expiresAt: 1 });

// Instance methods
InstagramSessionSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

InstagramSessionSchema.methods.canRetryVerification = function (maxAttempts: number = 3): boolean {
  return this.verificationAttempts < maxAttempts && !this.isExpired();
};

// Static methods
InstagramSessionSchema.statics.findBySessionId = function (sessionId: string) {
  return this.findOne({ sessionId });
};

InstagramSessionSchema.statics.findByVerificationCode = function (code: string) {
  return this.findOne({
    verificationCode: code,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
};

InstagramSessionSchema.statics.findActiveByInstagramUser = function (instagramUserId: Types.ObjectId) {
  return this.findOne({
    instagramUserId,
    status: { $in: ['pending', 'active'] },
    expiresAt: { $gt: new Date() },
  });
};

InstagramSessionSchema.statics.findActiveByRezUser = function (rezUserId: string) {
  return this.findOne({
    rezUserId,
    status: { $in: ['pending', 'active'] },
    expiresAt: { $gt: new Date() },
  });
};

InstagramSessionSchema.statics.incrementVerificationAttempts = async function (sessionId: string) {
  return this.findOneAndUpdate(
    { sessionId },
    {
      $inc: { verificationAttempts: 1 },
      $set: { lastVerificationAttempt: new Date() },
    },
    { new: true }
  );
};

InstagramSessionSchema.statics.completeSession = async function (sessionId: string, rezUserId: string) {
  return this.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: 'completed',
        rezUserId,
        completedAt: new Date(),
      },
    },
    { new: true }
  );
};

InstagramSessionSchema.statics.expireSessions = async function (instagramUserId: Types.ObjectId) {
  return this.updateMany(
    {
      instagramUserId,
      status: { $in: ['pending', 'active'] },
    },
    {
      $set: { status: 'expired' },
    }
  );
};

export const InstagramSession = mongoose.model<IInstagramSession>('InstagramSession', InstagramSessionSchema);
