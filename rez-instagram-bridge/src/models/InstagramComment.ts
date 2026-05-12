import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInstagramComment extends Document {
  commentId: string;
  mediaId: string;
  instagramUserId: Types.ObjectId;
  username: string;
  text: string;
  createdAt: Date;
  likeCount: number;
  replies: ICommentReply[];
  replyCount: number;
  status: 'pending' | 'replied' | 'hidden' | 'escalated';
  repliedAt?: Date;
  repliedBy?: string;
  replyText?: string;
  escalatedTo?: string;
  escalatedAt?: Date;
  intent?: string;
  confidence?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  containsQuestion: boolean;
  containsMention: boolean;
  containsHashtag: boolean;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS' | 'STORY';
  mediaUrl?: string;
  mediaCaption?: string;
  automationRule?: string;
  createdAt2: Date;
  updatedAt: Date;
}

interface ICommentReply {
  replyId: string;
  text: string;
  createdAt: Date;
  sentBy: 'automation' | 'human';
}

const InstagramCommentSchema = new Schema<IInstagramComment>(
  {
    commentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mediaId: {
      type: String,
      required: true,
      index: true,
    },
    instagramUserId: {
      type: Schema.Types.ObjectId,
      ref: 'InstagramUser',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
      index: true,
    },
    likeCount: {
      type: Number,
      default: 0,
    },
    replies: [{
      replyId: String,
      text: String,
      createdAt: Date,
      sentBy: {
        type: String,
        enum: ['automation', 'human'],
      },
    }],
    replyCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'replied', 'hidden', 'escalated'],
      default: 'pending',
      index: true,
    },
    repliedAt: {
      type: Date,
    },
    repliedBy: {
      type: String,
    },
    replyText: {
      type: String,
    },
    escalatedTo: {
      type: String,
    },
    escalatedAt: {
      type: Date,
    },
    intent: {
      type: String,
      index: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
    },
    containsQuestion: {
      type: Boolean,
      default: false,
    },
    containsMention: {
      type: Boolean,
      default: false,
    },
    containsHashtag: {
      type: Boolean,
      default: false,
    },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REELS', 'STORY'],
      default: 'IMAGE',
    },
    mediaUrl: {
      type: String,
    },
    mediaCaption: {
      type: String,
    },
    automationRule: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: 'createdAt2', updatedAt: 'updatedAt' },
  }
);

// Compound indexes
InstagramCommentSchema.index({ mediaId: 1, createdAt: -1 });
InstagramCommentSchema.index({ status: 1, createdAt: -1 });
InstagramCommentSchema.index({ intent: 1, confidence: -1 });
InstagramCommentSchema.index({ sentiment: 1, status: 1 });

// Pre-save hook to analyze comment
InstagramCommentSchema.pre('save', function (next) {
  if (this.isModified('text')) {
    this.containsQuestion = /\?|what|how|why|when|where|can you|could you|would you/i.test(this.text);
    this.containsMention = /@/.test(this.text);
    this.containsHashtag = /#/.test(this.text);
  }
  next();
});

// Static methods
InstagramCommentSchema.statics.findByCommentId = function (commentId: string) {
  return this.findOne({ commentId });
};

InstagramCommentSchema.statics.findPendingByMedia = function (mediaId: string) {
  return this.find({ mediaId, status: 'pending' }).sort({ createdAt: 1 });
};

InstagramCommentSchema.statics.markAsReplied = async function (commentId: string, replyText: string, sentBy: 'automation' | 'human') {
  return this.findOneAndUpdate(
    { commentId },
    {
      $set: {
        status: 'replied',
        repliedAt: new Date(),
        repliedBy: sentBy,
        replyText,
      },
      $push: {
        replies: {
          replyId: new mongoose.Types.ObjectId().toString(),
          text: replyText,
          createdAt: new Date(),
          sentBy,
        },
      },
      $inc: { replyCount: 1 },
    },
    { new: true }
  );
};

InstagramCommentSchema.statics.escalate = async function (commentId: string, escalateTo: string) {
  return this.findOneAndUpdate(
    { commentId },
    {
      $set: {
        status: 'escalated',
        escalatedTo,
        escalatedAt: new Date(),
      },
    },
    { new: true }
  );
};

export const InstagramComment = mongoose.model<IInstagramComment>('InstagramComment', InstagramCommentSchema);
