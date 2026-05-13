import mongoose, { Schema, Model, Query } from 'mongoose';
import { CRMProvider, ContactSyncStatus, Phone, Email, Address } from '../types/index.js';

export interface ICRMContact {
  externalId: string;
  provider: CRMProvider;
  email?: string;
  firstName: string;
  lastName: string;
  phone?: Phone;
  phones: Phone[];
  emails: Email[];
  company?: string;
  jobTitle?: string;
  address?: Address;
  tags: string[];
  notes?: string;
  lifecycleStage?: string;
  leadSource?: string;
  customFields: Record<string, unknown>;
  syncStatus: ContactSyncStatus;
  lastSyncedAt?: Date;
  syncError?: string;
  linkedRezUserId?: string;
  metadata: Record<string, unknown>;
}

export interface ICRMContactMethods {
  markSynced(): Promise<void>;
  markSyncError(error: string): Promise<void>;
}

export type ICRMContactDocument = mongoose.HydratedDocument<ICRMContact, ICRMContactMethods>;

interface ICRMContactModel extends Model<ICRMContact, object, ICRMContactMethods> {
  findByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMContactDocument | null>;
  findPendingContacts(provider?: CRMProvider): Query<ICRMContactDocument[], ICRMContactDocument>;
}

const PhoneSchema = new Schema({
  type: {
    type: String,
    enum: ['work', 'home', 'mobile', 'other'],
  },
  number: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
}, { _id: false });

const EmailSchema = new Schema({
  type: {
    type: String,
    enum: ['work', 'home', 'other'],
  },
  address: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
}, { _id: false });

const AddressSchema = new Schema({
  street: String,
  city: String,
  state: String,
  postalCode: String,
  country: String,
}, { _id: false });

const CRMContactSchema = new Schema<ICRMContact, ICRMContactModel, ICRMContactMethods>(
  {
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(CRMProvider),
      required: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: PhoneSchema,
    phones: [PhoneSchema],
    emails: [EmailSchema],
    company: {
      type: String,
      trim: true,
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    address: AddressSchema,
    tags: [{
      type: String,
      trim: true,
    }],
    notes: {
      type: String,
    },
    lifecycleStage: {
      type: String,
    },
    leadSource: {
      type: String,
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    syncStatus: {
      type: String,
      enum: Object.values(ContactSyncStatus),
      default: ContactSyncStatus.PENDING,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
    },
    syncError: {
      type: String,
    },
    linkedRezUserId: {
      type: String,
      index: true,
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'crm_contacts',
  }
);

// Compound indexes for efficient queries
CRMContactSchema.index({ provider: 1, externalId: 1 }, { unique: true });
CRMContactSchema.index({ email: 1, provider: 1 });
CRMContactSchema.index({ linkedRezUserId: 1, provider: 1 });
CRMContactSchema.index({ syncStatus: 1, provider: 1 });
CRMContactSchema.index({ createdAt: -1 });

// Text index for search
CRMContactSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  company: 'text',
});

// Pre-save middleware to set primary email
CRMContactSchema.pre('save', function (next) {
  if (this.email && (!this.emails || this.emails.length === 0)) {
    this.emails = [{ address: this.email, isPrimary: true }];
  }
  if (this.phone && (!this.phones || this.phones.length === 0)) {
    this.phones = [this.phone];
  }
  next();
});

// Instance methods
CRMContactSchema.methods.markSynced = async function (): Promise<void> {
  this.syncStatus = ContactSyncStatus.SYNCED;
  this.lastSyncedAt = new Date();
  this.syncError = undefined;
  await this.save();
};

CRMContactSchema.methods.markSyncError = async function (error: string): Promise<void> {
  this.syncStatus = ContactSyncStatus.ERROR;
  this.syncError = error;
  await this.save();
};

// Static methods
CRMContactSchema.statics.findByExternalId = function (
  externalId: string,
  provider: CRMProvider
): Promise<ICRMContactDocument | null> {
  return this.findOne({ externalId, provider }) as Promise<ICRMContactDocument | null>;
};

CRMContactSchema.statics.findPendingContacts = function (
  provider?: CRMProvider
): Query<ICRMContactDocument[], ICRMContactDocument> {
  const query: Record<string, unknown> = { syncStatus: ContactSyncStatus.PENDING };
  if (provider) {
    query.provider = provider;
  }
  return this.find(query).sort({ updatedAt: 1 }) as Query<ICRMContactDocument[], ICRMContactDocument>;
};

export const CRMContact = mongoose.model<ICRMContact, ICRMContactModel>(
  'CRMContact',
  CRMContactSchema
);

export default CRMContact;
