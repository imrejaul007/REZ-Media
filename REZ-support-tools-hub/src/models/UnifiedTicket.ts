import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IUnifiedTicket,
  Platform,
  TicketStatus,
  TicketPriority,
  IComment,
  IAttachment,
  IRequester,
  IAssignee,
} from '../types';

const AttachmentSchema = new Schema<IAttachment>(
  {
    id: { type: String, required: true },
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
  },
  { _id: false }
);

const CommentSchema = new Schema<IComment>(
  {
    id: { type: String, required: true },
    ticketId: { type: String, required: true, index: true },
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
    },
    platformCommentId: { type: String, required: true },
    author: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String },
      type: {
        type: String,
        enum: ['agent', 'customer', 'system'],
        required: true,
      },
    },
    body: { type: String, required: true },
    htmlBody: { type: String },
    attachments: [AttachmentSchema],
    isPublic: { type: Boolean, default: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const RequesterSchema = new Schema<IRequester>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    avatar: { type: String },
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
    },
    platformContactId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const AssigneeSchema = new Schema<IAssignee>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    avatar: { type: String },
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
    },
    platformAgentId: { type: String, required: true },
    group: { type: String },
  },
  { _id: false }
);

const ExternalUrlSchema = new Schema(
  {
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
    },
    url: { type: String, required: true },
  },
  { _id: false }
);

const UnifiedTicketSchema = new Schema<IUnifiedTicket>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
      index: true,
    },
    platformTicketId: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'on_hold', 'solved', 'closed'] as TicketStatus[],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'] as TicketPriority[],
      default: 'normal',
      index: true,
    },
    requester: {
      type: RequesterSchema,
      required: true,
    },
    assignee: {
      type: AssigneeSchema,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    comments: {
      type: [CommentSchema],
      default: [],
    },
    lastSyncedAt: {
      type: Date,
    },
    slaDeadline: {
      type: Date,
    },
    satisfaction: {
      type: String,
      enum: ['good', 'bad'],
    },
    linkedRezTicketId: {
      type: String,
      index: true,
    },
    externalUrls: [ExternalUrlSchema],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    collection: 'unified_tickets',
  }
);

// Compound indexes for efficient queries
UnifiedTicketSchema.index({ platform: 1, platformTicketId: 1 }, { unique: true });
UnifiedTicketSchema.index({ status: 1, platform: 1 });
UnifiedTicketSchema.index({ priority: 1, status: 1 });
UnifiedTicketSchema.index({ 'requester.email': 1 });
UnifiedTicketSchema.index({ createdAt: -1 });
UnifiedTicketSchema.index({ updatedAt: -1 });
UnifiedTicketSchema.index({ linkedRezTicketId: 1 });
UnifiedTicketSchema.index({ isDeleted: 1, platform: 1 });

// Virtual for external URL
UnifiedTicketSchema.virtual('url').get(function () {
  const externalUrl = this.externalUrls.find((u) => u.platform === this.platform);
  return externalUrl?.url;
});

// Method to add a comment
UnifiedTicketSchema.methods.addComment = function (comment: IComment) {
  this.comments.push(comment);
  this.version += 1;
  return this;
};

// Method to update status
UnifiedTicketSchema.methods.updateStatus = function (status: TicketStatus) {
  this.status = status;
  this.version += 1;
  return this;
};

// Static method to find by platform and ID
UnifiedTicketSchema.statics.findByPlatformId = function (
  platform: Platform,
  platformTicketId: string
) {
  return this.findOne({ platform, platformTicketId, isDeleted: false });
};

// Static method to find open tickets by platform
UnifiedTicketSchema.statics.findOpenByPlatform = function (platform: Platform) {
  return this.find({
    platform,
    isDeleted: false,
    status: { $in: ['open', 'pending', 'on_hold'] },
  });
};

// Static method to find tickets needing sync
UnifiedTicketSchema.statics.findNeedingSync = function (maxAgeMinutes: number) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return this.find({
    isDeleted: false,
    $or: [
      { lastSyncedAt: { $lt: cutoff } },
      { lastSyncedAt: { $exists: false } },
    ],
  });
};

// Ensure virtuals are included in JSON output
UnifiedTicketSchema.set('toJSON', { virtuals: true });
UnifiedTicketSchema.set('toObject', { virtuals: true });

export interface IUnifiedTicketDocument extends IUnifiedTicket, Document {}

export const UnifiedTicket: Model<IUnifiedTicketDocument> = mongoose.model<IUnifiedTicketDocument>(
  'UnifiedTicket',
  UnifiedTicketSchema
);

export default UnifiedTicket;
