/**
 * Business Rule MongoDB Model
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IRule extends Document {
  _id: string;
  ruleType: 'commission' | 'cashback' | 'reward' | 'karma' | 'fraud_check' | 'rate_limit';
  category: string;
  subCategory?: string;
  name: string;
  description?: string;
  conditions: Array<{ field: string; operator: string; value: any }>;
  conditionLogic: 'AND' | 'OR';
  actions: Array<{ actionType: string; params: Record<string, any>; order: number }>;
  actionLogic: 'SEQUENTIAL' | 'PARALLEL';
  priority: number;
  conflictStrategy: 'FIRST' | 'HIGHEST' | 'CUMULATIVE';
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  version: number;
}

const RuleSchema = new Schema<IRule>({
  ruleType: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  subCategory: String,
  name: { type: String, required: true },
  description: String,
  conditions: [{
    field: String,
    operator: String,
    value: Schema.Types.Mixed
  }],
  conditionLogic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
  actions: [{
    actionType: String,
    params: Schema.Types.Mixed,
    order: Number
  }],
  actionLogic: { type: String, enum: ['SEQUENTIAL', 'PARALLEL'], default: 'SEQUENTIAL' },
  priority: { type: Number, default: 0 },
  conflictStrategy: { type: String, enum: ['FIRST', 'HIGHEST', 'CUMULATIVE'], default: 'FIRST' },
  isActive: { type: Boolean, default: true, index: true },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: Date,
  createdBy: String,
  updatedBy: String,
  version: { type: Number, default: 1 }
}, { timestamps: true });

RuleSchema.index({ category: 1, isActive: 1 });
RuleSchema.index({ ruleType: 1, isActive: 1 });

export const Rule = mongoose.model<IRule>('Rule', RuleSchema);
export default Rule;
