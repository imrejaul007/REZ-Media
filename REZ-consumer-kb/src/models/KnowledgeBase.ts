import mongoose, { Document, Schema } from 'mongoose';

// Knowledge Base Entry Types
export interface IKnowledgeEntry {
  id: string;
  type: 'fact' | 'preference' | 'memory' | 'goal' | 'context' | 'intent';
  key: string;
  value: unknown;
  confidence: number;
  source: 'explicit' | 'inferred' | 'interaction' | 'transaction' | 'ml';
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface IConversationMemory {
  id: string;
  conversationId: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }[];
  summary?: string;
  keyInsights: string[];
  entities: {
    type: string;
    value: string;
    mentions: number;
  }[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  topics: string[];
  outcome?: string;
  createdAt: Date;
  lastAccessed: Date;
}

export interface IInteractionPattern {
  id: string;
  pattern: string;
  frequency: number;
  lastOccurrence: Date;
  context: string[];
  success: boolean;
}

export interface IIntentLink {
  service: string;
  intentId: string;
  confidence: number;
  linkedAt: Date;
  status: 'active' | 'resolved' | 'expired';
}

export interface IKnowledgeBase extends Document {
  consumerId: string;
  profileId: mongoose.Types.ObjectId;

  // Core Knowledge Sections
  explicit_prefs: Map<string, IKnowledgeEntry[]>;
  inferred_prefs: Map<string, IKnowledgeEntry[]>;
  memory: IKnowledgeEntry[];
  goals: IKnowledgeEntry[];
  context: IKnowledgeEntry[];

  // Conversation Memory
  conversations: IConversationMemory[];

  // Interaction Patterns
  interactionPatterns: IInteractionPattern[];

  // Intent Graph Links
  intentLinks: IIntentLink[];

  // Graph Data for ML
  preferenceVector: number[];
  behaviorVector: number[];

  // Metadata
  lastUpdated: Date;
  version: number;

  // Stats
  stats: {
    totalInteractions: number;
    totalConversations: number;
    explicitPrefsCount: number;
    inferredPrefsCount: number;
    goalsActive: number;
    goalsCompleted: number;
    lastInteractionAt?: Date;
  };
}

const KnowledgeEntrySchema = new Schema<IKnowledgeEntry>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['fact', 'preference', 'memory', 'goal', 'context', 'intent'],
      required: true,
    },
    key: { type: String, required: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    source: {
      type: String,
      enum: ['explicit', 'inferred', 'interaction', 'transaction', 'ml'],
      required: true,
    },
    tags: [{ type: String }],
    metadata: { type: Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date },
  },
  { _id: false, timestamps: true }
);

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const ConversationMemorySchema = new Schema<IConversationMemory>(
  {
    id: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    messages: [MessageSchema],
    summary: { type: String },
    keyInsights: [{ type: String }],
    entities: [
      {
        type: { type: String },
        value: { type: String },
        mentions: { type: Number, default: 1 },
        _id: false,
      },
    ],
    sentiment: { type: String, enum: ['positive', 'negative', 'neutral'] },
    topics: [{ type: String }],
    outcome: { type: String },
  },
  { timestamps: true }
);

const InteractionPatternSchema = new Schema<IInteractionPattern>(
  {
    id: { type: String, required: true },
    pattern: { type: String, required: true },
    frequency: { type: Number, default: 1 },
    lastOccurrence: { type: Date, default: Date.now },
    context: [{ type: String }],
    success: { type: Boolean, default: true },
  },
  { _id: false }
);

const IntentLinkSchema = new Schema<IIntentLink>(
  {
    service: { type: String, required: true },
    intentId: { type: String, required: true },
    confidence: { type: Number, default: 1.0 },
    linkedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'resolved', 'expired'],
      default: 'active',
    },
  },
  { _id: false }
);

const KnowledgeBaseStatsSchema = new Schema<IKnowledgeBase['stats']>(
  {
    totalInteractions: { type: Number, default: 0 },
    totalConversations: { type: Number, default: 0 },
    explicitPrefsCount: { type: Number, default: 0 },
    inferredPrefsCount: { type: Number, default: 0 },
    goalsActive: { type: Number, default: 0 },
    goalsCompleted: { type: Number, default: 0 },
    lastInteractionAt: { type: Date },
  },
  { _id: false }
);

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    consumerId: { type: String, required: true, unique: true, index: true },
    profileId: { type: Schema.Types.ObjectId, ref: 'ConsumerProfile', required: true },

    // Core Knowledge Sections - stored as arrays of entries
    explicit_prefs: {
      type: Map,
      of: [KnowledgeEntrySchema],
      default: () => new Map(),
    },
    inferred_prefs: {
      type: Map,
      of: [KnowledgeEntrySchema],
      default: () => new Map(),
    },
    memory: [KnowledgeEntrySchema],
    goals: [KnowledgeEntrySchema],
    context: [KnowledgeEntrySchema],

    // Conversation Memory
    conversations: [ConversationMemorySchema],

    // Interaction Patterns
    interactionPatterns: [InteractionPatternSchema],

    // Intent Graph Links
    intentLinks: [IntentLinkSchema],

    // ML Vectors
    preferenceVector: [{ type: Number }],
    behaviorVector: [{ type: Number }],

    // Metadata
    lastUpdated: { type: Date, default: Date.now },
    version: { type: Number, default: 1 },

    // Stats
    stats: { type: KnowledgeBaseSchema, default: () => ({}) },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    collection: 'knowledge_bases',
  }
);

// Indexes
KnowledgeBaseSchema.index({ 'stats.lastInteractionAt': -1 });
KnowledgeBaseSchema.index({ 'memory.tags': 1 });
KnowledgeBaseSchema.index({ 'goals.key': 1 });
KnowledgeBaseSchema.index({ 'intentLinks.intentId': 1 });
KnowledgeBaseSchema.index({ 'conversations.topics': 1 });

// Instance methods
KnowledgeBaseSchema.methods.addExplicitPreference = function (
  category: string,
  key: string,
  value: unknown,
  metadata?: Record<string, unknown>
): IKnowledgeEntry {
  const entry: IKnowledgeEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    type: 'preference',
    key,
    value,
    confidence: 1.0,
    source: 'explicit',
    tags: [category],
    metadata: metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!this.explicit_prefs.has(category)) {
    this.explicit_prefs.set(category, []);
  }
  this.explicit_prefs.get(category)!.push(entry);

  this.stats.explicitPrefsCount++;
  this.stats.lastInteractionAt = new Date();
  this.lastUpdated = new Date();

  return entry;
};

KnowledgeBaseSchema.methods.addInferredPreference = function (
  category: string,
  key: string,
  value: unknown,
  confidence: number,
  source: IKnowledgeEntry['source'],
  evidence?: string[]
): IKnowledgeEntry {
  const entry: IKnowledgeEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    type: 'preference',
    key,
    value,
    confidence,
    source,
    tags: [category],
    metadata: { evidence: evidence || [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!this.inferred_prefs.has(category)) {
    this.inferred_prefs.set(category, []);
  }
  this.inferred_prefs.get(category)!.push(entry);

  this.stats.inferredPrefsCount++;
  this.lastUpdated = new Date();

  return entry;
};

KnowledgeBaseSchema.methods.addMemory = function (
  key: string,
  value: unknown,
  importance: number,
  tags: string[],
  expiresAt?: Date
): IKnowledgeEntry {
  const entry: IKnowledgeEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    type: 'memory',
    key,
    value,
    confidence: importance,
    source: 'interaction',
    tags,
    metadata: {},
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  this.memory.push(entry);
  this.lastUpdated = new Date();

  return entry;
};

KnowledgeBaseSchema.methods.addGoal = function (
  key: string,
  value: unknown,
  priority: 'high' | 'medium' | 'low',
  targetDate?: Date
): IKnowledgeEntry {
  const entry: IKnowledgeEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    type: 'goal',
    key,
    value,
    confidence: 1.0,
    source: 'explicit',
    tags: [priority],
    metadata: { targetDate },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  this.goals.push(entry);
  this.stats.goalsActive++;
  this.lastUpdated = new Date();

  return entry;
};

KnowledgeBaseSchema.methods.addContext = function (
  key: string,
  value: unknown,
  metadata?: Record<string, unknown>
): IKnowledgeEntry {
  // Remove existing context with same key
  this.context = this.context.filter((c) => c.key !== key);

  const entry: IKnowledgeEntry = {
    id: new mongoose.Types.ObjectId().toString(),
    type: 'context',
    key,
    value,
    confidence: 1.0,
    source: 'interaction',
    tags: [],
    metadata: metadata || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  this.context.push(entry);
  this.lastUpdated = new Date();

  return entry;
};

KnowledgeBaseSchema.methods.addConversation = function (
  conversationId: string,
  messages: IConversationMemory['messages']
): IConversationMemory {
  const conversation: IConversationMemory = {
    id: new mongoose.Types.ObjectId().toString(),
    conversationId,
    messages,
    keyInsights: [],
    entities: [],
    topics: [],
    createdAt: new Date(),
    lastAccessed: new Date(),
  };

  this.conversations.push(conversation);
  this.stats.totalConversations++;
  this.stats.lastInteractionAt = new Date();
  this.lastUpdated = new Date();

  return conversation;
};

KnowledgeBaseSchema.methods.linkToIntentGraph = function (
  service: string,
  intentId: string,
  confidence: number = 1.0
): IIntentLink {
  const existing = this.intentLinks.find(
    (link) => link.service === service && link.intentId === intentId
  );

  if (existing) {
    existing.confidence = confidence;
    existing.status = 'active';
    return existing;
  }

  const link: IIntentLink = {
    service,
    intentId,
    confidence,
    linkedAt: new Date(),
    status: 'active',
  };

  this.intentLinks.push(link);
  this.lastUpdated = new Date();

  return link;
};

KnowledgeBaseSchema.methods.recordInteraction = function (): void {
  this.stats.totalInteractions++;
  this.stats.lastInteractionAt = new Date();
  this.lastUpdated = new Date();
};

KnowledgeBaseSchema.methods.getRelevantMemories = function (
  tags: string[],
  limit: number = 10
): IKnowledgeEntry[] {
  return this.memory
    .filter((m) => m.tags.some((tag) => tags.includes(tag)))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
};

KnowledgeBaseSchema.methods.cleanupExpiredEntries = function (): void {
  const now = new Date();
  this.memory = this.memory.filter(
    (m) => !m.expiresAt || m.expiresAt > now
  );
};

export const KnowledgeBase = mongoose.model<IKnowledgeBase>(
  'KnowledgeBase',
  KnowledgeBaseSchema
);
