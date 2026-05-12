import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInstagramConversation extends Document {
  threadId: string;
  instagramUserId: Types.ObjectId;
  participantIds: string[];
  participantUsernames: string[];
  lastMessageText: string;
  lastMessageAt: Date;
  lastMessageId: string;
  lastMessageFrom: string;
  unreadCount: number;
  status: 'active' | 'archived' | 'blocked';
  messageCount: number;
  averageResponseTime: number;
  lastRouteToOrchestratorAt?: Date;
  orchestratorThreadId?: string;
  context: {
    lastIntent?: string;
    lastTopic?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    conversationStage: 'new' | 'engaged' | 'qualified' | 'customer' | 'churned';
    tags: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const InstagramConversationSchema = new Schema<IInstagramConversation>(
  {
    threadId: {
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
    participantIds: [{
      type: String,
    }],
    participantUsernames: [{
      type: String,
    }],
    lastMessageText: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageId: {
      type: String,
    },
    lastMessageFrom: {
      type: String,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'blocked'],
      default: 'active',
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    averageResponseTime: {
      type: Number,
      default: 0,
    },
    lastRouteToOrchestratorAt: {
      type: Date,
    },
    orchestratorThreadId: {
      type: String,
    },
    context: {
      lastIntent: {
        type: String,
      },
      lastTopic: {
        type: String,
      },
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative'],
      },
      conversationStage: {
        type: String,
        enum: ['new', 'engaged', 'qualified', 'customer', 'churned'],
        default: 'new',
      },
      tags: [{
        type: String,
        index: true,
      }],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
InstagramConversationSchema.index({ instagramUserId: 1, lastMessageAt: -1 });
InstagramConversationSchema.index({ status: 1, lastMessageAt: -1 });
InstagramConversationSchema.index({ 'context.conversationStage': 1, lastMessageAt: -1 });
InstagramConversationSchema.index({ 'context.tags': 1, lastMessageAt: -1 });

// Virtual for participant count
InstagramConversationSchema.virtual('participantCount').get(function () {
  return this.participantIds.length;
});

// Static methods
InstagramConversationSchema.statics.findByThreadId = function (threadId: string) {
  return this.findOne({ threadId });
};

InstagramConversationSchema.statics.findActiveByUser = function (userId: Types.ObjectId) {
  return this.findOne({
    instagramUserId: userId,
    status: 'active',
  }).sort({ lastMessageAt: -1 });
};

InstagramConversationSchema.statics.incrementMessageCount = async function (threadId: string) {
  return this.findOneAndUpdate(
    { threadId },
    {
      $inc: { messageCount: 1, unreadCount: 1 },
      $set: { lastMessageAt: new Date() },
    },
    { new: true }
  );
};

InstagramConversationSchema.statics.markAsRead = async function (threadId: string) {
  return this.findOneAndUpdate(
    { threadId },
    { $set: { unreadCount: 0 } },
    { new: true }
  );
};

export const InstagramConversation = mongoose.model<IInstagramConversation>('InstagramConversation', InstagramConversationSchema);
