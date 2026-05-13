import {
  ConsumerProfile,
  IConsumerProfile,
  IExplicitPreference,
  IInferredPreference,
  IGoal,
  IMemory,
  IContext,
} from '../models/ConsumerProfile';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { rtuScoreService } from './rtuScore';

export interface CreateProfileInput {
  consumerId: string;
  email?: string;
  phone?: string;
}

export interface UpdateProfileInput {
  email?: string;
  phone?: string;
  status?: IConsumerProfile['status'];
}

export interface AddPreferenceInput {
  category: string;
  value: string;
  source: IExplicitPreference['source'];
  confidence?: number;
}

export interface AddGoalInput {
  type: IGoal['type'];
  description: string;
  priority: IGoal['priority'];
  targetDate?: Date;
}

export interface AddMemoryInput {
  type: IMemory['type'];
  content: Record<string, unknown>;
  importance: number;
  tags: string[];
  expiresAt?: Date;
}

export interface UpdateContextInput {
  currentLocation?: string;
  currentIntent?: string;
  sessionData?: Record<string, unknown>;
  deviceInfo?: IContext['deviceInfo'];
}

export class ProfileService {
  /**
   * Create a new consumer profile
   */
  async createProfile(input: CreateProfileInput): Promise<IConsumerProfile> {
    const existing = await ConsumerProfile.findOne({ consumerId: input.consumerId });
    if (existing) {
      throw new Error(`Profile already exists for consumer ${input.consumerId}`);
    }

    const profile = new ConsumerProfile({
      consumerId: input.consumerId,
      email: input.email,
      phone: input.phone,
      explicitPreferences: [],
      inferredPreferences: [],
      goals: [],
      memories: [],
      context: {
        sessionData: {},
        lastActive: new Date(),
      },
      rtoScore: {
        score: 0,
        riskLevel: 'low',
        factors: {
          orderCount: 0,
          returnRate: 0,
          codRate: 0,
          fraudSignals: 0,
          addressValidity: 100,
          deviceTrust: 100,
        },
        lastCalculated: new Date(),
      },
      status: 'active',
      lastInteraction: new Date(),
    });

    await profile.save();
    return profile;
  }

  /**
   * Get profile by consumer ID
   */
  async getProfile(consumerId: string): Promise<IConsumerProfile | null> {
    return ConsumerProfile.findOne({ consumerId });
  }

  /**
   * Get or create profile
   */
  async getOrCreateProfile(input: CreateProfileInput): Promise<IConsumerProfile> {
    let profile = await this.getProfile(input.consumerId);
    if (!profile) {
      profile = await this.createProfile(input);
    }
    return profile;
  }

  /**
   * Update profile
   */
  async updateProfile(consumerId: string, updates: UpdateProfileInput): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });

    if (updates.email !== undefined) profile.email = updates.email;
    if (updates.phone !== undefined) profile.phone = updates.phone;
    if (updates.status !== undefined) profile.status = updates.status;

    await profile.save();
    return profile;
  }

  /**
   * Add explicit preference
   */
  async addExplicitPreference(
    consumerId: string,
    input: AddPreferenceInput
  ): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });
    profile.addExplicitPreference(input.category, input.value, input.source);
    profile.lastInteraction = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Update inferred preference
   */
  async updateInferredPreference(
    consumerId: string,
    category: string,
    value: string,
    evidence: string,
    confidence: number
  ): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });
    profile.updateInferredPreference(category, value, evidence, confidence);
    profile.lastInteraction = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Add multiple inferred preferences from ML model
   */
  async batchUpdateInferredPreferences(
    consumerId: string,
    preferences: Array<{ category: string; value: string; evidence: string[]; confidence: number }>
  ): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });

    for (const pref of preferences) {
      profile.updateInferredPreference(pref.category, pref.value, pref.evidence.join('; '), pref.confidence);
    }

    profile.lastInteraction = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Get preferences by category
   */
  async getPreferencesByCategory(
    consumerId: string,
    category: string
  ): Promise<{ explicit: IExplicitPreference[]; inferred: IInferredPreference[] }> {
    const profile = await this.getProfile(consumerId);
    if (!profile) {
      return { explicit: [], inferred: [] };
    }

    return {
      explicit: profile.explicitPreferences.filter((p) => p.category === category),
      inferred: profile.inferredPreferences.filter((p) => p.category === category),
    };
  }

  /**
   * Get all preferences merged
   */
  async getAllPreferences(consumerId: string): Promise<Map<string, { value: string; confidence: number; source: string }[]>> {
    const profile = await this.getProfile(consumerId);
    const result = new Map<string, { value: string; confidence: number; source: string }[]>();

    if (!profile) return result;

    // Add explicit preferences
    for (const pref of profile.explicitPreferences) {
      if (!result.has(pref.category)) {
        result.set(pref.category, []);
      }
      result.get(pref.category)!.push({
        value: pref.value,
        confidence: pref.confidence,
        source: 'explicit',
      });
    }

    // Add inferred preferences
    for (const pref of profile.inferredPreferences) {
      if (!result.has(pref.category)) {
        result.set(pref.category, []);
      }
      const existing = result.get(pref.category)!.find((p) => p.value === pref.value);
      if (existing) {
        // Keep highest confidence
        if (pref.confidence > existing.confidence) {
          existing.confidence = pref.confidence;
          existing.source = 'inferred';
        }
      } else {
        result.get(pref.category)!.push({
          value: pref.value,
          confidence: pref.confidence,
          source: 'inferred',
        });
      }
    }

    return result;
  }

  /**
   * Add goal
   */
  async addGoal(consumerId: string, input: AddGoalInput): Promise<IGoal> {
    const profile = await this.getOrCreateProfile({ consumerId });
    const goal = profile.addGoal(input.type, input.description, input.priority, input.targetDate);
    profile.lastInteraction = new Date();
    await profile.save();
    return goal;
  }

  /**
   * Update goal status
   */
  async updateGoalStatus(
    consumerId: string,
    goalId: string,
    status: IGoal['status'],
    progress?: number
  ): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });
    const goal = profile.goals.find((g) => g.id === goalId);

    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    goal.status = status;
    if (progress !== undefined) {
      goal.progress = progress;
    }
    if (status === 'completed' && progress === undefined) {
      goal.progress = 100;
    }

    profile.lastInteraction = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Get active goals
   */
  async getActiveGoals(consumerId: string): Promise<IGoal[]> {
    const profile = await this.getProfile(consumerId);
    if (!profile) return [];
    return profile.goals.filter((g) => g.status === 'active');
  }

  /**
   * Add memory
   */
  async addMemory(consumerId: string, input: AddMemoryInput): Promise<IMemory> {
    const profile = await this.getOrCreateProfile({ consumerId });
    const memory = profile.addMemory(input.type, input.content, input.importance, input.tags, input.expiresAt);
    profile.lastInteraction = new Date();
    await profile.save();
    return memory;
  }

  /**
   * Get memories by type or tags
   */
  async getMemories(
    consumerId: string,
    options?: { type?: IMemory['type']; tags?: string[]; minImportance?: number }
  ): Promise<IMemory[]> {
    const profile = await this.getProfile(consumerId);
    if (!profile) return [];

    return profile.memories.filter((m) => {
      if (options?.type && m.type !== options.type) return false;
      if (options?.tags && options.tags.length > 0) {
        if (!m.tags.some((tag) => options.tags!.includes(tag))) return false;
      }
      if (options?.minImportance && m.importance < options.minImportance) return false;
      return true;
    }).sort((a, b) => b.importance - a.importance);
  }

  /**
   * Update context
   */
  async updateContext(consumerId: string, updates: UpdateContextInput): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });

    if (updates.currentLocation !== undefined) {
      profile.context.currentLocation = updates.currentLocation;
    }
    if (updates.currentIntent !== undefined) {
      profile.context.currentIntent = updates.currentIntent;
    }
    if (updates.sessionData !== undefined) {
      profile.context.sessionData = { ...profile.context.sessionData, ...updates.sessionData };
    }
    if (updates.deviceInfo !== undefined) {
      profile.context.deviceInfo = updates.deviceInfo;
    }
    profile.context.lastActive = new Date();
    profile.lastInteraction = new Date();

    await profile.save();
    return profile;
  }

  /**
   * Get context
   */
  async getContext(consumerId: string): Promise<IContext | null> {
    const profile = await this.getProfile(consumerId);
    return profile?.context || null;
  }

  /**
   * Calculate and update RTO score
   */
  async calculateRtoScore(consumerId: string): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });
    const newScore = await rtuScoreService.calculateScore(consumerId, profile);

    profile.rtoScore = newScore;
    profile.lastInteraction = new Date();
    await profile.save();
    return profile;
  }

  /**
   * Get RTO score
   */
  async getRtoScore(consumerId: string): Promise<IConsumerProfile['rtoScore'] | null> {
    const profile = await this.getProfile(consumerId);
    return profile?.rtoScore || null;
  }

  /**
   * Flag profile
   */
  async flagProfile(consumerId: string, reason: string): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });
    profile.status = 'flagged';
    if (!profile.flaggedReasons) {
      profile.flaggedReasons = [];
    }
    if (!profile.flaggedReasons.includes(reason)) {
      profile.flaggedReasons.push(reason);
    }
    await profile.save();
    return profile;
  }

  /**
   * Unflag profile
   */
  async unflagProfile(consumerId: string, reason?: string): Promise<IConsumerProfile> {
    const profile = await this.getOrCreateProfile({ consumerId });

    if (reason) {
      profile.flaggedReasons = (profile.flaggedReasons || []).filter((r) => r !== reason);
    } else {
      profile.flaggedReasons = [];
    }

    if ((profile.flaggedReasons || []).length === 0) {
      profile.status = 'active';
    }

    await profile.save();
    return profile;
  }

  /**
   * Search profiles
   */
  async searchProfiles(options: {
    status?: IConsumerProfile['status'];
    rtoRiskLevel?: 'low' | 'medium' | 'high';
    minInteractions?: number;
    hasEmail?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<IConsumerProfile[]> {
    const query: Record<string, unknown> = {};

    if (options.status) query.status = options.status;
    if (options.rtoRiskLevel) query['rtoScore.riskLevel'] = options.rtoRiskLevel;
    if (options.hasEmail !== undefined) {
      query.email = options.hasEmail ? { $exists: true, $ne: null } : null;
    }

    const profiles = await ConsumerProfile.find(query)
      .sort({ lastInteraction: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 20);

    if (options.minInteractions) {
      return profiles.filter((p) => {
        const interactionCount = p.explicitPreferences.length + p.inferredPreferences.length + p.goals.length;
        return interactionCount >= options.minInteractions!;
      });
    }

    return profiles;
  }

  /**
   * Delete profile
   */
  async deleteProfile(consumerId: string): Promise<boolean> {
    const result = await ConsumerProfile.deleteOne({ consumerId });
    return result.deletedCount > 0;
  }

  /**
   * Get profile summary
   */
  async getProfileSummary(consumerId: string): Promise<{
    consumerId: string;
    status: string;
    preferencesCount: number;
    goalsActive: number;
    memoriesCount: number;
    rtoScore: number;
    rtoRiskLevel: string;
    lastInteraction: Date;
  } | null> {
    const profile = await this.getProfile(consumerId);
    if (!profile) return null;

    return {
      consumerId: profile.consumerId,
      status: profile.status,
      preferencesCount: profile.explicitPreferences.length + profile.inferredPreferences.length,
      goalsActive: profile.goals.filter((g) => g.status === 'active').length,
      memoriesCount: profile.memories.length,
      rtoScore: profile.rtoScore.score,
      rtoRiskLevel: profile.rtoScore.riskLevel,
      lastInteraction: profile.lastInteraction,
    };
  }
}

export const profileService = new ProfileService();
