import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';
import {
  CallStatus,
  CallPriority,
  CampaignTrigger,
  ConversationState,
  CallDocument,
  CallContext,
  ConversationTurn
} from '../types';

const conversationTurnSchema = new Schema<ConversationTurn>(
  {
    timestamp: { type: Date, required: true, default: Date.now },
    speaker: { type: String, enum: ['ai', 'user'], required: true },
    transcript: { type: String, required: true },
    intent: { type: String },
    confidence: { type: Number, min: 0, max: 1 }
  },
  { _id: false }
);

const callContextSchema = new Schema<CallContext>(
  {
    customerName: { type: String },
    storeName: { type: String },
    itemCount: { type: Number },
    totalAmount: { type: String },
    orderId: { type: String },
    cartId: { type: String },
    appointmentTime: { type: String },
    trackingNumber: { type: String },
    estimatedDelivery: { type: String }
  },
  { _id: false }
);

export interface ICall extends MongooseDocument, Omit<CallDocument, '_id'> {}

const callSchema = new Schema<ICall>(
  {
    callSid: { type: String, unique: true, sparse: true },
    twilioCallSid: { type: String, sparse: true },
    to: {
      type: String,
      required: true,
      index: true
    },
    from: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.INITIATED,
      index: true
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true
    },
    trigger: {
      type: String,
      enum: Object.values(CampaignTrigger)
    },
    customerId: {
      type: String,
      index: true
    },
    cartId: {
      type: String,
      index: true
    },
    orderId: {
      type: String,
      index: true
    },
    priority: {
      type: String,
      enum: Object.values(CallPriority),
      default: CallPriority.MEDIUM
    },
    context: {
      type: callContextSchema,
      default: {}
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    conversationState: {
      type: String,
      enum: Object.values(ConversationState),
      default: ConversationState.GREETING
    },
    conversationHistory: {
      type: [conversationTurnSchema],
      default: []
    },
    duration: {
      type: Number
    },
    recordingUrl: {
      type: String
    },
    transcriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Transcript'
    },
    transferredToAgent: {
      type: Boolean,
      default: false
    },
    errorMessage: {
      type: String
    },
    scheduledAt: {
      type: Date,
      index: true
    },
    startedAt: {
      type: Date
    },
    answeredAt: {
      type: Date
    },
    concludedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'calls'
  }
);

// Indexes for efficient querying
callSchema.index({ status: 1, scheduledAt: 1 });
callSchema.index({ campaignId: 1, status: 1 });
callSchema.index({ customerId: 1, createdAt: -1 });
callSchema.index({ to: 1, createdAt: -1 });

// TTL index to auto-delete old completed calls after 90 days
callSchema.index({ concludedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Pre-save middleware to update attempts
callSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === CallStatus.ANSWERED && !this.answeredAt) {
      this.answeredAt = new Date();
    }
    if ([CallStatus.CONCLUDED, CallStatus.FAILED, CallStatus.CANCELLED].includes(this.status)) {
      this.concludedAt = new Date();
      if (this.startedAt) {
        this.duration = Math.floor((this.concludedAt.getTime() - this.startedAt.getTime()) / 1000);
      }
    }
  }
  next();
});

// Static method to find calls due for execution
callSchema.statics.findDueCalls = function (limit = 100) {
  return this.find({
    status: CallStatus.INITIATED,
    scheduledAt: { $lte: new Date() }
  })
    .sort({ priority: -1, scheduledAt: 1 })
    .limit(limit)
    .populate('campaignId');
};

export const CallModel = mongoose.model<ICall>('Call', callSchema);
