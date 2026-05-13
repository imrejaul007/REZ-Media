import mongoose, { Schema, Model, Query } from 'mongoose';
import { CRMProvider } from '../types/index.js';

export interface ICRMDeal {
  externalId: string;
  provider: CRMProvider;
  title: string;
  amount?: number;
  currency: string;
  stage: string;
  probability?: number;
  closeDate?: Date;
  contactId?: string;
  companyName?: string;
  description?: string;
  customFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export type ICRMDealDocument = mongoose.HydratedDocument<ICRMDeal>;

interface ICRMDealModel extends Model<ICRMDeal> {
  findByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMDealDocument | null>;
  findByContactId(contactId: string, provider?: CRMProvider): Query<ICRMDealDocument[], ICRMDealDocument>;
  findByStage(stage: string, provider?: CRMProvider): Query<ICRMDealDocument[], ICRMDealDocument>;
}

const CRMDealSchema = new Schema<ICRMDeal, ICRMDealModel>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    stage: {
      type: String,
      required: true,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
    },
    closeDate: {
      type: Date,
    },
    contactId: {
      type: String,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'crm_deals',
  }
);

// Compound indexes for efficient queries
CRMDealSchema.index({ provider: 1, externalId: 1 }, { unique: true });
CRMDealSchema.index({ contactId: 1, provider: 1 });
CRMDealSchema.index({ stage: 1, provider: 1 });
CRMDealSchema.index({ amount: 1 });
CRMDealSchema.index({ closeDate: 1 });
CRMDealSchema.index({ createdAt: -1 });

// Static methods
CRMDealSchema.statics.findByExternalId = function (
  externalId: string,
  provider: CRMProvider
): Promise<ICRMDealDocument | null> {
  return this.findOne({ externalId, provider }) as Promise<ICRMDealDocument | null>;
};

CRMDealSchema.statics.findByContactId = function (
  contactId: string,
  provider?: CRMProvider
): Query<ICRMDealDocument[], ICRMDealDocument> {
  const query: Record<string, unknown> = { contactId };
  if (provider) {
    query.provider = provider;
  }
  return this.find(query) as Query<ICRMDealDocument[], ICRMDealDocument>;
};

CRMDealSchema.statics.findByStage = function (
  stage: string,
  provider?: CRMProvider
): Query<ICRMDealDocument[], ICRMDealDocument> {
  const query: Record<string, unknown> = { stage };
  if (provider) {
    query.provider = provider;
  }
  return this.find(query).sort({ amount: -1 }) as Query<ICRMDealDocument[], ICRMDealDocument>;
};

export const CRMDeal = mongoose.model<ICRMDeal, ICRMDealModel>(
  'CRMDeal',
  CRMDealSchema
);

export default CRMDeal;
