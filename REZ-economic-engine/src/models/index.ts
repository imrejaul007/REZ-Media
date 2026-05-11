/**
 * Rule Version Model
 *
 * Stores historical versions of rules for audit trail
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IRuleVersion extends Document {
  ruleId: mongoose.Types.ObjectId;
  version: number;
  ruleSnapshot: Record<string, any>;
  effectiveFrom: Date;
  effectiveTo?: Date;
  changedBy: mongoose.Types.ObjectId;
  changeReason: string;
  transactionCount: number;
  totalPayout: number;
  createdAt: Date;
}

const RuleVersionSchema = new Schema({
  ruleId: {
    type: Schema.Types.ObjectId,
    ref: 'BusinessRule',
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  ruleSnapshot: {
    type: Schema.Types.Mixed,
    required: true
  },
  effectiveFrom: {
    type: Date,
    required: true
  },
  effectiveTo: {
    type: Date
  },
  changedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  changeReason: {
    type: String,
    required: true
  },
  transactionCount: {
    type: Number,
    default: 0
  },
  totalPayout: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

RuleVersionSchema.index({ ruleId: 1, version: 1 }, { unique: true });

export const RuleVersion = mongoose.model<IRuleVersion>('RuleVersion', RuleVersionSchema);
export default RuleVersion;
