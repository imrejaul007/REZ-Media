import mongoose, { Schema, Document } from 'mongoose';
import { ActionFeedback } from '../types';

export interface IFeedbackDocument extends ActionFeedback, Document {}

const FeedbackSchema = new Schema<IFeedbackDocument>(
  {
    action_id: {
      type: String,
      required: true,
      index: true
    },
    outcome: {
      type: String,
      enum: ['approved', 'rejected', 'ignored', 'failed', 'edited'],
      required: true,
      index: true
    },
    latency_ms: {
      type: Number,
      default: null
    },
    confidence_score: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    feedback_type: {
      type: String,
      enum: ['explicit', 'implicit'],
      required: true
    },
    merchant_id: {
      type: String,
      required: true,
      index: true
    },
    event_type: {
      type: String,
      required: true,
      index: true
    },
    decision_made: {
      type: String,
      required: true
    },
    original_value: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    edited_value: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    timestamp: {
      type: Number,
      required: true,
      index: true
    }
  },
  {
    timestamps: false,
    collection: 'feedback'
  }
);

// Compound indexes for common queries
FeedbackSchema.index({ merchant_id: 1, event_type: 1, timestamp: -1 });
FeedbackSchema.index({ merchant_id: 1, outcome: 1, timestamp: -1 });
FeedbackSchema.index({ action_id: 1, timestamp: -1 });

// TTL index to auto-expire old feedback (optional, configurable)
FeedbackSchema.index({ timestamp: 1 }, { expireAfterSeconds: undefined });

export const FeedbackModel = mongoose.model<IFeedbackDocument>('Feedback', FeedbackSchema);
