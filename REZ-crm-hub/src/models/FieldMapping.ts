import mongoose, { Schema, Document, Model } from 'mongoose';
import { FieldMapping as IFieldMapping, CRMProvider } from '../types/index.js';

export interface IFieldMappingDocument extends Omit<IFieldMapping, '_id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const FieldMappingSchema = new Schema<IFieldMappingDocument>(
  {
    provider: {
      type: String,
      enum: Object.values(CRMProvider),
      required: true,
    },
    entityType: {
      type: String,
      enum: ['contact', 'deal'],
      required: true,
    },
    crmToUnified: {
      type: Map,
      of: String,
      required: true,
    },
    unifiedToCrm: {
      type: Map,
      of: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'field_mappings',
  }
);

// Compound index
FieldMappingSchema.index({ provider: 1, entityType: 1 }, { unique: true });

// Static methods
FieldMappingSchema.statics.findByProviderAndType = function (
  provider: CRMProvider,
  entityType: 'contact' | 'deal'
): Promise<IFieldMappingDocument | null> {
  return this.findOne({ provider, entityType, isActive: true });
};

FieldMappingSchema.statics.upsertMapping = async function (
  provider: CRMProvider,
  entityType: 'contact' | 'deal',
  crmToUnified: Record<string, string>,
  unifiedToCrm: Record<string, string>
): Promise<IFieldMappingDocument> {
  const mapping = await this.findOneAndUpdate(
    { provider, entityType },
    {
      $set: {
        crmToUnified,
        unifiedToCrm,
        isActive: true,
      },
    },
    { upsert: true, new: true }
  );
  return mapping;
};

// Instance methods
FieldMappingSchema.methods.convertToUnified = function (
  crmData: Record<string, unknown>
): Record<string, unknown> {
  const unified: Record<string, unknown> = {};
  const mapping = this.crmToUnified as Map<string, string>;

  for (const [crmField, unifiedField] of mapping.entries()) {
    if (crmData[crmField] !== undefined) {
      unified[unifiedField] = crmData[crmField];
    }
  }

  return unified;
};

FieldMappingSchema.methods.convertFromUnified = function (
  unifiedData: Record<string, unknown>
): Record<string, unknown> {
  const crmData: Record<string, unknown> = {};
  const mapping = this.unifiedToCrm as Map<string, string>;

  for (const [unifiedField, crmField] of mapping.entries()) {
    if (unifiedData[unifiedField] !== undefined) {
      crmData[crmField] = unifiedData[unifiedField];
    }
  }

  return crmData;
};

export const FieldMapping: Model<IFieldMappingDocument> = mongoose.model<IFieldMappingDocument>(
  'FieldMapping',
  FieldMappingSchema
);

export default FieldMapping;
