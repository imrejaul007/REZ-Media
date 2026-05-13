import mongoose, { Document, Schema } from 'mongoose';

// Preference Types
export interface IExplicitPreference {
  category: string;
  value: string;
  confidence: number;
  source: 'direct_input' | 'survey' | 'explicit_action';
  createdAt: Date;
  updatedAt: Date;
}

export interface IInferredPreference {
  category: string;
  value: string;
  confidence: number;
  evidence: string[];
  source: 'behavior' | 'interaction' | 'ml_inference';
  lastUpdated: Date;
}

export interface IGoal {
  id: string;
  type: 'purchase' | 'lifestyle' | 'service' | 'general';
  description: string;
  targetDate?: Date;
  status: 'active' | 'completed' | 'abandoned';
  progress?: number;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMemory {
  id: string;
  type: 'conversation' | 'interaction' | 'transaction' | 'preference' | 'context';
  content: Record<string, unknown>;
  importance: number;
  tags: string[];
  expiresAt?: Date;
  createdAt: Date;
}

export interface IContext {
  currentLocation?: string;
  currentIntent?: string;
  sessionData: Record<string, unknown>;
  lastActive: Date;
  deviceInfo?: {
    type: string;
    browser?: string;
    os?: string;
  };
}

export interface IRtoScore {
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: {
    orderCount: number;
    returnRate: number;
    codRate: number;
    fraudSignals: number;
    addressValidity: number;
    deviceTrust: number;
  };
  lastCalculated: Date;
}

export interface IConsumerProfile extends Document {
  consumerId: string;
  email?: string;
  phone?: string;

  // Knowledge Base Reference
  knowledgeBaseId: mongoose.Types.ObjectId;

  // Preferences
  explicitPreferences: IExplicitPreference[];
  inferredPreferences: IInferredPreference[];

  // Goals
  goals: IGoal[];

  // Memory
  memories: IMemory[];

  // Context
  context: IContext;

  // RTO Risk Score
  rtoScore: IRtoScore;

  // Status
  status: 'active' | 'inactive' | 'flagged';
  flaggedReasons?: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastInteraction: Date;
}

const ExplicitPreferenceSchema = new Schema<IExplicitPreference>(
  {
    category: { type: String, required: true, index: true },
    value: { type: String, required: true },
    confidence: { type: Number, default: 1.0, min: 0, max: 1 },
    source: {
      type: String,
      enum: ['direct_input', 'survey', 'explicit_action'],
      required: true,
    },
  },
  { timestamps: true }
);

const InferredPreferenceSchema = new Schema<IInferredPreference>(
  {
    category: { type: String, required: true, index: true },
    value: { type: String, required: true },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    evidence: [{ type: String }],
    source: {
      type: String,
      enum: ['behavior', 'interaction', 'ml_inference'],
      required: true,
    },
    lastUpdated: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GoalSchema = new Schema<IGoal>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['purchase', 'lifestyle', 'service', 'general'],
      required: true,
    },
    description: { type: String, required: true },
    targetDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
  },
  { timestamps: true }
);

const MemorySchema = new Schema<IMemory>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['conversation', 'interaction', 'transaction', 'preference', 'context'],
      required: true,
    },
    content: { type: Schema.Types.Mixed, required: true },
    importance: { type: Number, default: 0.5, min: 0, max: 1 },
    tags: [{ type: String }],
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

const ContextSchema = new Schema<IContext>(
  {
    currentLocation: { type: String },
    currentIntent: { type: String },
    sessionData: { type: Schema.Types.Mixed, default: {} },
    lastActive: { type: Date, default: Date.now },
    deviceInfo: {
      type: { type: String },
      browser: { type: String },
      os: { type: String },
    },
  },
  { _id: false }
);

const RtoScoreSchema = new Schema<IRtoScore>(
  {
    score: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    factors: {
      orderCount: { type: Number, default: 0 },
      returnRate: { type: Number, default: 0 },
      codRate: { type: Number, default: 0 },
      fraudSignals: { type: Number, default: 0 },
      addressValidity: { type: Number, default: 100 },
      deviceTrust: { type: Number, default: 100 },
    },
    lastCalculated: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ConsumerProfileSchema = new Schema<IConsumerProfile>(
  {
    consumerId: { type: String, required: true, unique: true, index: true },
    email: { type: String },
    phone: { type: String },
    knowledgeBaseId: { type: Schema.Types.ObjectId, ref: 'KnowledgeBase' },
    explicitPreferences: [ExplicitPreferenceSchema],
    inferredPreferences: [InferredPreferenceSchema],
    goals: [GoalSchema],
    memories: [MemorySchema],
    context: { type: ContextSchema, default: () => ({}) },
    rtoScore: { type: RtoScoreSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['active', 'inactive', 'flagged'],
      default: 'active',
    },
    flaggedReasons: [{ type: String }],
    lastInteraction: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'consumer_profiles',
  }
);

// Indexes
ConsumerProfileSchema.index({ email: 1 }, { sparse: true });
ConsumerProfileSchema.index({ phone: 1 }, { sparse: true });
ConsumerProfileSchema.index({ 'context.currentIntent': 1 });
ConsumerProfileSchema.index({ status: 1 });
ConsumerProfileSchema.index({ 'rtoScore.riskLevel': 1 });
ConsumerProfileSchema.index({ lastInteraction: -1 });

// Virtual for knowledge base
ConsumerProfileSchema.virtual('knowledgeBase', {
  ref: 'KnowledgeBase',
  localField: 'knowledgeBaseId',
  foreignField: '_id',
  justOne: true,
});

// Instance methods
ConsumerProfileSchema.methods.addExplicitPreference = function (
  category: string,
  value: string,
  source: IExplicitPreference['source']
): void {
  const existing = this.explicitPreferences.find(
    (p) => p.category === category && p.value === value
  );
  if (!existing) {
    this.explicitPreferences.push({
      category,
      value,
      confidence: 1.0,
      source,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
};

ConsumerProfileSchema.methods.updateInferredPreference = function (
  category: string,
  value: string,
  evidence: string,
  confidence: number
): void {
  const existing = this.inferredPreferences.find(
    (p) => p.category === category && p.value === value
  );
  if (existing) {
    existing.confidence = confidence;
    existing.evidence.push(evidence);
    existing.lastUpdated = new Date();
  } else {
    this.inferredPreferences.push({
      category,
      value,
      confidence,
      evidence: [evidence],
      source: 'behavior',
      lastUpdated: new Date(),
    });
  }
};

ConsumerProfileSchema.methods.addGoal = function (
  type: IGoal['type'],
  description: string,
  priority: IGoal['priority'],
  targetDate?: Date
): IGoal {
  const goal: IGoal = {
    id: new mongoose.Types.ObjectId().toString(),
    type,
    description,
    priority,
    status: 'active',
    progress: 0,
    targetDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  this.goals.push(goal);
  return goal;
};

ConsumerProfileSchema.methods.addMemory = function (
  type: IMemory['type'],
  content: Record<string, unknown>,
  importance: number,
  tags: string[],
  expiresAt?: Date
): IMemory {
  const memory: IMemory = {
    id: new mongoose.Types.ObjectId().toString(),
    type,
    content,
    importance,
    tags,
    expiresAt,
    createdAt: new Date(),
  };
  this.memories.push(memory);
  return memory;
};

export const ConsumerProfile = mongoose.model<IConsumerProfile>(
  'ConsumerProfile',
  ConsumerProfileSchema
);
