import { KnowledgeBase, IKnowledgeBase, IKnowledgeEntry } from '../models/KnowledgeBase';
import { ConsumerProfile } from '../models/ConsumerProfile';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface KBSearchOptions {
  tags?: string[];
  type?: IKnowledgeEntry['type'];
  source?: IKnowledgeEntry['source'];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface KBUpdateInput {
  explicit_prefs?: Record<string, { key: string; value: unknown; metadata?: Record<string, unknown> }[]>;
  inferred_prefs?: Record<string, { key: string; value: unknown; confidence: number; source: IKnowledgeEntry['source'] }[]>;
  memory?: { key: string; value: unknown; importance: number; tags: string[]; expiresAt?: Date }[];
  goals?: { key: string; value: unknown; priority: 'high' | 'medium' | 'low'; targetDate?: Date }[];
  context?: { key: string; value: unknown; metadata?: Record<string, unknown> }[];
}

export class KBService {
  /**
   * Create a new knowledge base for a consumer
   */
  async createKB(consumerId: string, profileId?: mongoose.Types.ObjectId): Promise<IKnowledgeBase> {
    const existingKB = await KnowledgeBase.findOne({ consumerId });
    if (existingKB) {
      throw new Error(`Knowledge base already exists for consumer ${consumerId}`);
    }

    // Get or create profile
    let profile;
    if (profileId) {
      profile = await ConsumerProfile.findById(profileId);
    } else {
      profile = await ConsumerProfile.findOne({ consumerId });
    }

    if (!profile) {
      profile = new ConsumerProfile({ consumerId });
      await profile.save();
    }

    const kb = new KnowledgeBase({
      consumerId,
      profileId: profile._id,
      explicit_prefs: new Map(),
      inferred_prefs: new Map(),
      memory: [],
      goals: [],
      context: [],
      conversations: [],
      interactionPatterns: [],
      intentLinks: [],
      version: 1,
    });

    // Link KB to profile
    profile.knowledgeBaseId = kb._id as mongoose.Types.ObjectId;
    await profile.save();

    await kb.save();
    return kb;
  }

  /**
   * Get knowledge base by consumer ID
   */
  async getKB(consumerId: string): Promise<IKnowledgeBase | null> {
    return KnowledgeBase.findOne({ consumerId });
  }

  /**
   * Get or create knowledge base
   */
  async getOrCreateKB(consumerId: string): Promise<IKnowledgeBase> {
    let kb = await this.getKB(consumerId);
    if (!kb) {
      kb = await this.createKB(consumerId);
    }
    return kb;
  }

  /**
   * Update knowledge base with partial data
   */
  async updateKB(consumerId: string, updates: KBUpdateInput): Promise<IKnowledgeBase> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const kb = await this.getOrCreateKB(consumerId);

      // Update explicit preferences
      if (updates.explicit_prefs) {
        for (const [category, prefs] of Object.entries(updates.explicit_prefs)) {
          for (const pref of prefs) {
            kb.addExplicitPreference(category, pref.key, pref.value, pref.metadata);
          }
        }
      }

      // Update inferred preferences
      if (updates.inferred_prefs) {
        for (const [category, prefs] of Object.entries(updates.inferred_prefs)) {
          for (const pref of prefs) {
            kb.addInferredPreference(
              category,
              pref.key,
              pref.value,
              pref.confidence,
              pref.source
            );
          }
        }
      }

      // Add memories
      if (updates.memory) {
        for (const mem of updates.memory) {
          kb.addMemory(mem.key, mem.value, mem.importance, mem.tags, mem.expiresAt);
        }
      }

      // Add goals
      if (updates.goals) {
        for (const goal of updates.goals) {
          kb.addGoal(goal.key, goal.value, goal.priority, goal.targetDate);
        }
      }

      // Update context
      if (updates.context) {
        for (const ctx of updates.context) {
          kb.addContext(ctx.key, ctx.value, ctx.metadata);
        }
      }

      kb.version++;
      kb.lastUpdated = new Date();
      await kb.save({ session });

      await session.commitTransaction();
      return kb;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Add explicit preference
   */
  async addExplicitPreference(
    consumerId: string,
    category: string,
    key: string,
    value: unknown,
    metadata?: Record<string, unknown>
  ): Promise<IKnowledgeEntry> {
    const kb = await this.getOrCreateKB(consumerId);
    const entry = kb.addExplicitPreference(category, key, value, metadata);
    await kb.save();
    return entry;
  }

  /**
   * Add inferred preference (learned from behavior)
   */
  async addInferredPreference(
    consumerId: string,
    category: string,
    key: string,
    value: unknown,
    confidence: number,
    source: IKnowledgeEntry['source'],
    evidence?: string[]
  ): Promise<IKnowledgeEntry> {
    const kb = await this.getOrCreateKB(consumerId);
    const entry = kb.addInferredPreference(category, key, value, confidence, source, evidence);
    await kb.save();
    return entry;
  }

  /**
   * Add memory entry
   */
  async addMemory(
    consumerId: string,
    key: string,
    value: unknown,
    importance: number,
    tags: string[],
    expiresAt?: Date
  ): Promise<IKnowledgeEntry> {
    const kb = await this.getOrCreateKB(consumerId);
    const entry = kb.addMemory(key, value, importance, tags, expiresAt);
    await kb.save();
    return entry;
  }

  /**
   * Add goal
   */
  async addGoal(
    consumerId: string,
    key: string,
    value: unknown,
    priority: 'high' | 'medium' | 'low',
    targetDate?: Date
  ): Promise<IKnowledgeEntry> {
    const kb = await this.getOrCreateKB(consumerId);
    const entry = kb.addGoal(key, value, priority, targetDate);
    await kb.save();
    return entry;
  }

  /**
   * Update context
   */
  async updateContext(
    consumerId: string,
    key: string,
    value: unknown,
    metadata?: Record<string, unknown>
  ): Promise<IKnowledgeEntry> {
    const kb = await this.getOrCreateKB(consumerId);
    const entry = kb.addContext(key, value, metadata);
    await kb.save();
    return entry;
  }

  /**
   * Add conversation memory
   */
  async addConversation(
    consumerId: string,
    conversationId: string,
    messages: { role: string; content: string; timestamp?: Date; metadata?: Record<string, unknown> }[]
  ): Promise<IKnowledgeBase['conversations'][0] | null> {
    const kb = await this.getKB(consumerId);
    if (!kb) return null;

    const formattedMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      timestamp: m.timestamp || new Date(),
      metadata: m.metadata,
    }));

    const conversation = kb.addConversation(conversationId, formattedMessages);
    await kb.save();
    return conversation;
  }

  /**
   * Search knowledge base
   */
  async searchKB(consumerId: string, options: KBSearchOptions): Promise<IKnowledgeEntry[]> {
    const kb = await this.getKB(consumerId);
    if (!kb) return [];

    let results: IKnowledgeEntry[] = [];

    // Search explicit prefs
    if (options.tags || options.type === 'preference') {
      if (options.source === 'explicit' || !options.source) {
        kb.explicit_prefs.forEach((entries) => {
          results.push(...entries);
        });
      }
    }

    // Search inferred prefs
    if (options.tags || options.type === 'preference') {
      if (options.source === 'inferred' || !options.source) {
        kb.inferred_prefs.forEach((entries) => {
          results.push(...entries);
        });
      }
    }

    // Search memory
    if (!options.source || options.source === 'interaction') {
      results.push(...kb.memory);
    }

    // Search goals
    if (options.type === 'goal') {
      results.push(...kb.goals);
    }

    // Search context
    if (options.type === 'context') {
      results.push(...kb.context);
    }

    // Apply filters
    results = results.filter((entry) => {
      if (options.tags && options.tags.length > 0) {
        if (!entry.tags.some((tag) => options.tags!.includes(tag))) {
          return false;
        }
      }
      if (options.type && entry.type !== options.type) return false;
      if (options.source && entry.source !== options.source) return false;
      if (options.minConfidence && entry.confidence < options.minConfidence) return false;
      return true;
    });

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get relevant memories for context
   */
  async getRelevantMemories(consumerId: string, tags: string[], limit: number = 10): Promise<IKnowledgeEntry[]> {
    const kb = await this.getKB(consumerId);
    if (!kb) return [];
    return kb.getRelevantMemories(tags, limit);
  }

  /**
   * Link to intent graph
   */
  async linkToIntentGraph(
    consumerId: string,
    service: string,
    intentId: string,
    confidence?: number
  ): Promise<void> {
    const kb = await this.getOrCreateKB(consumerId);
    kb.linkToIntentGraph(service, intentId, confidence);
    await kb.save();
  }

  /**
   * Get intent graph links
   */
  async getIntentLinks(consumerId: string): Promise<IKnowledgeBase['intentLinks']> {
    const kb = await this.getKB(consumerId);
    if (!kb) return [];
    return kb.intentLinks;
  }

  /**
   * Record interaction
   */
  async recordInteraction(consumerId: string): Promise<void> {
    const kb = await this.getOrCreateKB(consumerId);
    kb.recordInteraction();
    await kb.save();
  }

  /**
   * Delete knowledge base
   */
  async deleteKB(consumerId: string): Promise<boolean> {
    const result = await KnowledgeBase.deleteOne({ consumerId });
    return result.deletedCount > 0;
  }

  /**
   * Get KB stats
   */
  async getStats(consumerId: string): Promise<IKnowledgeBase['stats'] | null> {
    const kb = await this.getKB(consumerId);
    return kb?.stats || null;
  }

  /**
   * Merge two knowledge bases (e.g., for account linking)
   */
  async mergeKBs(sourceConsumerId: string, targetConsumerId: string): Promise<IKnowledgeBase> {
    const sourceKB = await this.getKB(sourceConsumerId);
    const targetKB = await this.getOrCreateKB(targetConsumerId);

    if (!sourceKB) {
      return targetKB;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Merge explicit prefs
      sourceKB.explicit_prefs.forEach((entries, category) => {
        if (!targetKB.explicit_prefs.has(category)) {
          targetKB.explicit_prefs.set(category, []);
        }
        const targetEntries = targetKB.explicit_prefs.get(category)!;
        for (const entry of entries) {
          if (!targetEntries.some((e) => e.key === entry.key && e.value === entry.value)) {
            targetEntries.push(entry);
          }
        }
      });

      // Merge inferred prefs (keep highest confidence)
      sourceKB.inferred_prefs.forEach((entries, category) => {
        if (!targetKB.inferred_prefs.has(category)) {
          targetKB.inferred_prefs.set(category, []);
        }
        const targetEntries = targetKB.inferred_prefs.get(category)!;
        for (const entry of entries) {
          const existing = targetEntries.find((e) => e.key === entry.key);
          if (!existing) {
            targetEntries.push(entry);
          } else if (entry.confidence > existing.confidence) {
            existing.confidence = entry.confidence;
            existing.evidence.push(...(entry.metadata.evidence as string[] || []));
          }
        }
      });

      // Merge memory (deduplicate by key)
      for (const mem of sourceKB.memory) {
        if (!targetKB.memory.some((m) => m.key === mem.key)) {
          targetKB.memory.push(mem);
        }
      }

      // Merge goals
      for (const goal of sourceKB.goals) {
        if (!targetKB.goals.some((g) => g.key === goal.key)) {
          targetKB.goals.push(goal);
        }
      }

      // Merge context (latest wins)
      for (const ctx of sourceKB.context) {
        const existing = targetKB.context.find((c) => c.key === ctx.key);
        if (existing) {
          existing.value = ctx.value;
          existing.updatedAt = ctx.updatedAt;
        } else {
          targetKB.context.push(ctx);
        }
      }

      // Merge intent links
      for (const link of sourceKB.intentLinks) {
        if (!targetKB.intentLinks.some((l) => l.service === link.service && l.intentId === link.intentId)) {
          targetKB.intentLinks.push(link);
        }
      }

      // Update stats
      targetKB.stats.totalInteractions += sourceKB.stats.totalInteractions;
      targetKB.stats.totalConversations += sourceKB.stats.totalConversations;
      targetKB.version++;

      await targetKB.save({ session });
      await session.commitTransaction();

      // Delete source KB
      await this.deleteKB(sourceConsumerId);

      return targetKB;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const kbService = new KBService();
