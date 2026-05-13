import mongoose, { Schema, Document, Model } from 'mongoose';
import {
  IUnifiedContact,
  Platform,
} from '../types';

const PlatformContactSchema = new Schema(
  {
    platform: {
      type: String,
      enum: ['zendesk', 'freshdesk', 'intercom', 'rez'] as Platform[],
      required: true,
    },
    platformContactId: {
      type: String,
      required: true,
    },
    externalUrl: {
      type: String,
    },
  },
  { _id: false }
);

const CompanySchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    domain: { type: String },
  },
  { _id: false }
);

const UnifiedContactSchema = new Schema<IUnifiedContact>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platforms: {
      type: [PlatformContactSchema],
      default: [],
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    phone: {
      type: String,
    },
    avatar: {
      type: String,
    },
    company: {
      type: CompanySchema,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    totalTickets: {
      type: Number,
      default: 0,
    },
    openTickets: {
      type: Number,
      default: 0,
    },
    solvedTickets: {
      type: Number,
      default: 0,
    },
    lastContactAt: {
      type: Date,
    },
    linkedRezUserId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastSyncedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'unified_contacts',
  }
);

// Compound indexes
UnifiedContactSchema.index({ email: 1, 'platforms.platform': 1 });
UnifiedContactSchema.index({ 'platforms.platform': 1, 'platforms.platformContactId': 1 });
UnifiedContactSchema.index({ linkedRezUserId: 1 });
UnifiedContactSchema.index({ company: 1 });
UnifiedContactSchema.index({ lastSyncedAt: 1 });
UnifiedContactSchema.index({ createdAt: -1 });

// Method to add a platform
UnifiedContactSchema.methods.addPlatform = function (
  platform: Platform,
  platformContactId: string,
  externalUrl?: string
) {
  const exists = this.platforms.some((p) => p.platform === platform);
  if (!exists) {
    this.platforms.push({ platform, platformContactId, externalUrl });
  }
  return this;
};

// Method to update ticket counts
UnifiedContactSchema.methods.updateTicketCounts = function (
  total: number,
  open: number,
  solved: number
) {
  this.totalTickets = total;
  this.openTickets = open;
  this.solvedTickets = solved;
  return this;
};

// Method to add tags
UnifiedContactSchema.methods.addTags = function (tags: string[]) {
  const newTags = tags.filter((tag) => !this.tags.includes(tag));
  this.tags.push(...newTags);
  return this;
};

// Static method to find by email across all platforms
UnifiedContactSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by platform contact ID
UnifiedContactSchema.statics.findByPlatformContactId = function (
  platform: Platform,
  platformContactId: string
) {
  return this.findOne({
    'platforms.platform': platform,
    'platforms.platformContactId': platformContactId,
  });
};

// Static method to find or create by email
UnifiedContactSchema.statics.findOrCreate = async function (
  email: string,
  defaults?: Partial<IUnifiedContact>
) {
  const normalizedEmail = email.toLowerCase();
  let contact = await this.findOne({ email: normalizedEmail });

  if (!contact) {
    const { v4: uuidv4 } = await import('uuid');
    contact = new this({
      id: uuidv4(),
      email: normalizedEmail,
      ...defaults,
    });
    await contact.save();
  }

  return contact;
};

// Static method to find contacts needing sync
UnifiedContactSchema.statics.findNeedingSync = function (maxAgeMinutes: number) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  return this.find({
    $or: [
      { lastSyncedAt: { $lt: cutoff } },
      { lastSyncedAt: { $exists: false } },
    ],
  });
};

// Static method to search contacts
UnifiedContactSchema.statics.search = function (
  query: string,
  limit: number = 20,
  offset: number = 0
) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ],
  })
    .limit(limit)
    .skip(offset)
    .sort({ updatedAt: -1 });
};

// Ensure virtuals are included in JSON output
UnifiedContactSchema.set('toJSON', { virtuals: true });
UnifiedContactSchema.set('toObject', { virtuals: true });

export interface IUnifiedContactDocument extends IUnifiedContact, Document {}

export const UnifiedContact: Model<IUnifiedContactDocument> = mongoose.model<IUnifiedContactDocument>(
  'UnifiedContact',
  UnifiedContactSchema
);

export default UnifiedContact;
