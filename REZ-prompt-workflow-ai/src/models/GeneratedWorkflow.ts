/**
 * Generated Workflow Model
 * MongoDB model for storing generated workflows
 */

import mongoose, { Schema, Document } from 'mongoose';
import type { Workflow, ValidationResponse } from '../types';

// Generation metadata interface
interface IGenerationMetadata {
  tokensUsed: number;
  model: string;
  generationTime: number;
  promptTokens: number;
  completionTokens: number;
}

// Imported to tracking interface
interface IImportedTo {
  journeyId: string;
  journeyServiceUrl: string;
  importedAt: Date;
}

// Validation result embedded interface
interface IValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string; code: string }>;
  warnings?: Array<{ field: string; message: string; code: string }>;
}

// Main document interface
export interface IGeneratedWorkflow extends Document {
  prompt: string;
  workflow: Workflow;
  confidence: number;
  generationMetadata: IGenerationMetadata;
  status: 'generated' | 'validated' | 'imported' | 'rejected';
  validationResult?: IValidationResult;
  importedTo?: IImportedTo;
  createdAt: Date;
  updatedAt: Date;
}

// Mongoose schema
const conditionSchema = new Schema(
  {
    field: {
      type: String,
      enum: ['opened', 'clicked', 'purchased', 'visited', 'cart_value', 'days_since_last_purchase', 'tag', 'segment'],
    },
    operator: {
      type: String,
      enum: ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains'],
    },
    value: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const positionSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const stepConfigSchema = new Schema(
  {
    template: { type: String },
    content: { type: String },
    subject: { type: String },
    duration: { type: String },
    durationMinutes: { type: Number },
    channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'push', 'in_app'] },
    templateId: { type: String },
    variables: { type: Map, of: String },
    url: { type: String },
    method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH'] },
    headers: { type: Map, of: String },
    body: { type: Map, of: Schema.Types.Mixed },
    conditions: [conditionSchema],
    conditionLogic: { type: String, enum: ['AND', 'OR'] },
    splits: [
      {
        name: { type: String },
        percentage: { type: Number, min: 0, max: 100 },
      },
    ],
    discount: { type: String },
    discountCode: { type: String },
    aiPrompt: { type: String },
    contentType: { type: String, enum: ['subject', 'body', 'image', 'video'] },
  },
  { _id: false }
);

const workflowStepSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['message', 'email', 'sms', 'whatsapp', 'push', 'webhook', 'condition', 'delay', 'end', 'split', 'ai_generated_content'],
      required: true,
    },
    config: stepConfigSchema,
    position: positionSchema,
    edges: [{ type: String }],
    label: { type: String },
  },
  { _id: false }
);

const workflowTriggerSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['abandoned_cart', 'signup', 'purchase', 'manual', 'schedule', 'inactivity', 'price_drop', 'back_in_stock', 'birthday', 'win_back'],
      required: true,
    },
    conditions: [conditionSchema],
    cron: { type: String },
    timezone: { type: String },
    days: { type: Number },
    cartValueMin: { type: Number },
    productIds: [{ type: String }],
    trackInventory: { type: Boolean },
  },
  { _id: false }
);

const workflowAnalyticsSchema = new Schema(
  {
    trackOpens: { type: Boolean, default: true },
    trackClicks: { type: Boolean, default: true },
    trackConversions: { type: Boolean, default: true },
    attributionWindow: {
      click: { type: Number },
      view: { type: Number },
    },
  },
  { _id: false }
);

const workflowSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    trigger: workflowTriggerSchema,
    steps: { type: [workflowStepSchema], required: true },
    analytics: workflowAnalyticsSchema,
    status: { type: String, enum: ['draft', 'active', 'paused', 'archived'], default: 'draft' },
    tags: [{ type: String }],
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { _id: false }
);

const generationMetadataSchema = new Schema(
  {
    tokensUsed: { type: Number, required: true },
    model: { type: String, required: true },
    generationTime: { type: Number, required: true },
    promptTokens: { type: Number },
    completionTokens: { type: Number },
  },
  { _id: false }
);

const importedToSchema = new Schema(
  {
    journeyId: { type: String, required: true },
    journeyServiceUrl: { type: String, required: true },
    importedAt: { type: Date, required: true },
  },
  { _id: false }
);

const validationErrorSchema = new Schema(
  {
    field: { type: String, required: true },
    message: { type: String, required: true },
    code: { type: String, required: true },
  },
  { _id: false }
);

const validationResultSchema = new Schema(
  {
    valid: { type: Boolean, required: true },
    errors: [validationErrorSchema],
    warnings: [validationErrorSchema],
  },
  { _id: false }
);

// Main schema
const generatedWorkflowSchema = new Schema<IGeneratedWorkflow>(
  {
    prompt: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    workflow: {
      type: workflowSchema,
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    generationMetadata: {
      type: generationMetadataSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['generated', 'validated', 'imported', 'rejected'],
      default: 'generated',
    },
    validationResult: validationResultSchema,
    importedTo: importedToSchema,
  },
  {
    timestamps: true,
    collection: 'generated_workflows',
  }
);

// Indexes
generatedWorkflowSchema.index({ prompt: 'text', 'workflow.name': 'text', 'workflow.description': 'text' });
generatedWorkflowSchema.index({ status: 1 });
generatedWorkflowSchema.index({ 'workflow.trigger.type': 1 });
generatedWorkflowSchema.index({ createdAt: -1 });
generatedWorkflowSchema.index({ 'workflow.tags': 1 });

// Virtual for toJSON
generatedWorkflowSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});

// Static methods
generatedWorkflowSchema.statics.findByStatus = function (
  status: IGeneratedWorkflow['status']
): Promise<IGeneratedWorkflow[]> {
  return this.find({ status }).sort({ createdAt: -1 });
};

generatedWorkflowSchema.statics.findByPrompt = function (prompt: string): Promise<IGeneratedWorkflow | null> {
  return this.findOne({ prompt }).sort({ createdAt: -1 });
};

generatedWorkflowSchema.statics.findByTriggerType = function (
  triggerType: string
): Promise<IGeneratedWorkflow[]> {
  return this.find({ 'workflow.trigger.type': triggerType }).sort({ createdAt: -1 });
};

generatedWorkflowSchema.statics.markAsImported = function (
  id: string,
  journeyId: string,
  journeyServiceUrl: string
): Promise<IGeneratedWorkflow | null> {
  return this.findByIdAndUpdate(
    id,
    {
      status: 'imported',
      importedTo: {
        journeyId,
        journeyServiceUrl,
        importedAt: new Date(),
      },
    },
    { new: true }
  );
};

generatedWorkflowSchema.statics.markAsValidated = function (
  id: string,
  validationResult: IValidationResult
): Promise<IGeneratedWorkflow | null> {
  return this.findByIdAndUpdate(
    id,
    {
      status: validationResult.valid ? 'validated' : 'rejected',
      validationResult,
    },
    { new: true }
  );
};

// Model
export const GeneratedWorkflow = mongoose.model<IGeneratedWorkflow>(
  'GeneratedWorkflow',
  generatedWorkflowSchema
);

export default GeneratedWorkflow;
