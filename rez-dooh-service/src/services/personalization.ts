/**
 * DOOH Service - Personalization Engine
 *
 * Handles 1:1 personalization for targeted screens:
 * - User profile management
 * - Personalized ad selection
 * - Learning from user interactions
 * - Privacy-respecting data handling
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  UserProfile,
  AdCreative,
  AdDecision,
  AreaContext,
} from '../types';
import { ScreenManagementService } from './screenManagement';
import { AreaIntelligenceService } from './areaIntelligence';

// ============================================================================
// Types
// ============================================================================

interface PersonalizationConfig {
  max_profile_age_days: number;
  min_interactions_for_learn: number;
  personalization_decay_days: number;
  score_weights: {
    category_match: number;
    intent_match: number;
    income_match: number;
    age_match: number;
    area_boost: number;
    time_boost: number;
    recency_boost: number;
  };
}

const DEFAULT_CONFIG: PersonalizationConfig = {
  max_profile_age_days: 90,
  min_interactions_for_learn: 10,
  personalization_decay_days: 30,
  score_weights: {
    category_match: 0.25,
    intent_match: 0.20,
    income_match: 0.15,
    age_match: 0.10,
    area_boost: 0.15,
    time_boost: 0.10,
    recency_boost: 0.05,
  },
};

interface InteractionSignal {
  user_id: string;
  ad_id: string;
  action: 'view' | 'tap' | 'scan' | 'visit' | 'purchase';
  timestamp: Date;
  context: {
    screen_id: string;
    area_id: string;
    hour: number;
  };
}

interface LearnedPattern {
  category: string;
  affinity_score: number;
  interaction_count: number;
  last_interaction: Date;
}

interface UserLearnedProfile {
  user_id: string;
  patterns: LearnedPattern[];
  frequent_areas: { area_id: string; visits: number }[];
  preferred_times: { hour: number; score: number }[];
  last_updated: Date;
}

// ============================================================================
// Personalization Engine
// ============================================================================

export class PersonalizationService extends EventEmitter {
  private config: PersonalizationConfig;
  private userProfiles: Map<string, UserProfile> = new Map();
  private learnedProfiles: Map<string, UserLearnedProfile> = new Map();
  private creatives: Map<string, AdCreative> = new Map();
  private interactionHistory: InteractionSignal[] = [];
  private screenService: ScreenManagementService;
  private areaService: AreaIntelligenceService;

  constructor(
    screenService: ScreenManagementService,
    areaService: AreaIntelligenceService,
    config?: Partial<PersonalizationConfig>
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.screenService = screenService;
    this.areaService = areaService;
  }

  // -------------------------------------------------------------------------
  // User Profile Management
  // -------------------------------------------------------------------------

  /**
   * Create or update user profile
   */
  setUserProfile(userId: string, profile: Partial<UserProfile>): UserProfile {
    const existing = this.userProfiles.get(userId);
    const now = new Date();

    const fullProfile: UserProfile = {
      id: userId,
      preferences: profile.preferences || existing?.preferences || {
        categories: [],
        intents: [],
        preferred_time_slots: [],
      },
      demographics: profile.demographics || existing?.demographics || {
        age: 30,
        income_level: 'middle',
      },
      recent_activity: profile.recent_activity || existing?.recent_activity || {
        last_seen: now,
        frequent_areas: [],
      },
    };

    this.userProfiles.set(userId, fullProfile);
    this.emit('profileUpdated', { userId, profile: fullProfile });

    return fullProfile;
  }

  /**
   * Get user profile
   */
  getUserProfile(userId: string): UserProfile | undefined {
    const profile = this.userProfiles.get(userId);
    if (!profile) return undefined;

    // Check if profile is stale
    const age = Date.now() - new Date(profile.recent_activity.last_seen).getTime();
    const maxAge = this.config.max_profile_age_days * 24 * 60 * 60 * 1000;

    if (age > maxAge) {
      // Return with staleness indicator
      return profile;
    }

    return profile;
  }

  /**
   * Delete user profile
   */
  deleteUserProfile(userId: string): boolean {
    this.userProfiles.delete(userId);
    this.learnedProfiles.delete(userId);
    return true;
  }

  /**
   * Check if user has profile
   */
  hasUserProfile(userId: string): boolean {
    return this.userProfiles.has(userId);
  }

  // -------------------------------------------------------------------------
  // Creative Management
  // -------------------------------------------------------------------------

  /**
   * Add a creative for targeting
   */
  addCreative(creative: Omit<AdCreative, 'id' | 'created_at'>): AdCreative {
    const newCreative: AdCreative = {
      ...creative,
      id: `creative_${uuidv4()}`,
      created_at: new Date(),
    };
    this.creatives.set(newCreative.id, newCreative);
    return newCreative;
  }

  /**
   * Get creative by ID
   */
  getCreative(creativeId: string): AdCreative | undefined {
    return this.creatives.get(creativeId);
  }

  /**
   * Get all active creatives
   */
  getActiveCreatives(): AdCreative[] {
    return Array.from(this.creatives.values()).filter(c => c.status === 'active');
  }

  /**
   * Get creatives by merchant
   */
  getCreativesByMerchant(merchantId: string): AdCreative[] {
    return Array.from(this.creatives.values()).filter(c => c.merchant_id === merchantId);
  }

  // -------------------------------------------------------------------------
  // Personalized Ad Selection
  // -------------------------------------------------------------------------

  /**
   * Get personalized ad for a 1:1 screen and user
   */
  getPersonalizedAd(screenId: string, userId: string): AdDecision | null {
    const screen = this.screenService.getScreen(screenId);
    if (!screen || screen.status !== 'active') {
      return null;
    }

    // Get user profile
    const userProfile = this.getUserProfile(userId);
    if (!userProfile) {
      return null;
    }

    // Get area context
    const areaContext = this.areaService.getAreaContext(screen.location.area);

    // Score and select best creative
    const creatives = this.getActiveCreatives();
    if (creatives.length === 0) {
      return this.getDefaultAdDecision(screenId);
    }

    const scored = creatives.map(creative => {
      const score = this.scoreCreative(creative, userProfile, areaContext);
      const reasons = this.getScoreReasons(creative, userProfile, areaContext);
      return { creative, score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      screenId,
      adId: best.creative.id,
      merchantId: best.creative.merchant_id,
      type: 'personalized',
      score: best.score,
      reasons: best.reasons,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };
  }

  /**
   * Get recommendations for a user
   */
  getRecommendations(userId: string, limit: number = 10): AdCreative[] {
    const userProfile = this.getUserProfile(userId);
    if (!userProfile) {
      return [];
    }

    const creatives = this.getActiveCreatives();
    const scored = creatives.map(creative => {
      const score = this.scoreCreative(creative, userProfile, undefined);
      return { creative, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.creative);
  }

  // -------------------------------------------------------------------------
  // Scoring
  // -------------------------------------------------------------------------

  /**
   * Score a creative for a user
   */
  private scoreCreative(
    creative: AdCreative,
    userProfile: UserProfile,
    areaContext?: AreaContext | null
  ): number {
    const weights = this.config.score_weights;
    let score = 0;

    // 1. Category match
    const categoryScore = this.calculateCategoryScore(creative, userProfile);
    score += categoryScore * weights.category_match;

    // 2. Intent match
    const intentScore = this.calculateIntentScore(creative, userProfile);
    score += intentScore * weights.intent_match;

    // 3. Income level match
    const incomeScore = this.calculateIncomeScore(creative, userProfile);
    score += incomeScore * weights.income_match;

    // 4. Age match
    const ageScore = this.calculateAgeScore(creative, userProfile);
    score += ageScore * weights.age_match;

    // 5. Area boost
    if (areaContext) {
      const areaScore = this.calculateAreaScore(creative, userProfile, areaContext);
      score += areaScore * weights.area_boost;
    }

    // 6. Time boost
    const timeScore = this.calculateTimeScore(creative, userProfile);
    score += timeScore * weights.time_boost;

    // 7. Learned pattern boost
    const learnedScore = this.calculateLearnedScore(creative, userProfile.id);
    score += learnedScore * weights.recency_boost;

    return Math.round(score * 100) / 100;
  }

  private calculateCategoryScore(creative: AdCreative, userProfile: UserProfile): number {
    if (!creative.target_categories.length || !userProfile.preferences.categories.length) {
      return 0.5; // Neutral score
    }

    const userCategories = new Set(userProfile.preferences.categories.map(c => c.toLowerCase()));
    let matches = 0;

    for (const category of creative.target_categories) {
      if (userCategories.has(category.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / creative.target_categories.length, 1);
  }

  private calculateIntentScore(creative: AdCreative, userProfile: UserProfile): number {
    if (!creative.target_intents.length || !userProfile.preferences.intents.length) {
      return 0.5;
    }

    const userIntents = new Set(userProfile.preferences.intents.map(i => i.toLowerCase()));
    let matches = 0;

    for (const intent of creative.target_intents) {
      if (userIntents.has(intent.toLowerCase())) {
        matches++;
      }
    }

    return Math.min(matches / creative.target_intents.length, 1);
  }

  private calculateIncomeScore(creative: AdCreative, userProfile: UserProfile): number {
    if (!creative.target_income_levels?.length) {
      return 0.5; // No targeting = neutral
    }

    return creative.target_income_levels.includes(userProfile.demographics.income_level) ? 1 : 0;
  }

  private calculateAgeScore(creative: AdCreative, userProfile: UserProfile): number {
    if (!creative.target_age_ranges) {
      return 0.5; // No targeting = neutral
    }

    const userAge = userProfile.demographics.age;
    return creative.target_age_ranges.min <= userAge && userAge <= creative.target_age_ranges.max ? 1 : 0;
  }

  private calculateAreaScore(
    creative: AdCreative,
    userProfile: UserProfile,
    areaContext: AreaContext
  ): number {
    // Check if creative's categories match area's trending products
    const areaCategories = new Set(areaContext.top_intents.map(i => i.intent.toLowerCase()));
    let matches = 0;

    for (const category of creative.target_categories) {
      if (areaCategories.has(category.toLowerCase())) {
        matches++;
      }
    }

    return creative.target_categories.length > 0
      ? Math.min(matches / creative.target_categories.length, 1)
      : 0.5;
  }

  private calculateTimeScore(creative: AdCreative, userProfile: UserProfile): number {
    if (!userProfile.preferences.preferred_time_slots.length) {
      return 0.5;
    }

    const currentHour = new Date().getHours();
    const currentSlot = this.getTimeSlot(currentHour);
    const preferredSlots = new Set(userProfile.preferences.preferred_time_slots.map(s => s.toLowerCase()));

    return preferredSlots.has(currentSlot.toLowerCase()) ? 1 : 0.5;
  }

  private calculateLearnedScore(creative: AdCreative, userId: string): number {
    const learned = this.learnedProfiles.get(userId);
    if (!learned || learned.patterns.length === 0) {
      return 0.5;
    }

    const patternMap = new Map(learned.patterns.map(p => [p.category.toLowerCase(), p.affinity_score]));
    let totalScore = 0;
    let matchCount = 0;

    for (const category of creative.target_categories) {
      const score = patternMap.get(category.toLowerCase());
      if (score !== undefined) {
        totalScore += score;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalScore / matchCount : 0.5;
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private getScoreReasons(
    creative: AdCreative,
    userProfile: UserProfile,
    areaContext?: AreaContext | null
  ): string[] {
    const reasons: string[] = [];

    // Category match
    const categoryMatch = creative.target_categories.filter(c =>
      userProfile.preferences.categories.map(u => u.toLowerCase()).includes(c.toLowerCase())
    );
    if (categoryMatch.length > 0) {
      reasons.push(`Category match (${categoryMatch.length})`);
    }

    // Intent match
    const intentMatch = creative.target_intents.filter(i =>
      userProfile.preferences.intents.map(u => u.toLowerCase()).includes(i.toLowerCase())
    );
    if (intentMatch.length > 0) {
      reasons.push(`Intent match (${intentMatch.length})`);
    }

    // Income match
    if (creative.target_income_levels?.includes(userProfile.demographics.income_level)) {
      reasons.push(`Income level match (${userProfile.demographics.income_level})`);
    }

    // Age match
    if (creative.target_age_ranges) {
      if (creative.target_age_ranges.min <= userProfile.demographics.age &&
          userProfile.demographics.age <= creative.target_age_ranges.max) {
        reasons.push(`Age in target range`);
      }
    }

    // Time preference
    const currentSlot = this.getTimeSlot(new Date().getHours());
    if (userProfile.preferences.preferred_time_slots.map(s => s.toLowerCase()).includes(currentSlot.toLowerCase())) {
      reasons.push(`Preferred time slot (${currentSlot})`);
    }

    return reasons;
  }

  private getDefaultAdDecision(screenId: string): AdDecision {
    return {
      screenId,
      adId: 'personalized_default',
      merchantId: 'platform',
      type: 'personalized',
      score: 0,
      reasons: ['No personalized content available'],
      expiresAt: new Date(Date.now() + 60 * 1000), // 1 minute
    };
  }

  // -------------------------------------------------------------------------
  // Learning from Interactions
  // -------------------------------------------------------------------------

  /**
   * Record user interaction for learning
   */
  recordInteraction(signal: Omit<InteractionSignal, 'timestamp'>): void {
    const interaction: InteractionSignal = {
      ...signal,
      timestamp: new Date(),
    };

    this.interactionHistory.push(interaction);

    // Learn from positive interactions
    if (['tap', 'scan', 'visit', 'purchase'].includes(interaction.action)) {
      this.learnFromInteraction(interaction);
    }

    // Update user profile activity
    const profile = this.userProfiles.get(signal.user_id);
    if (profile) {
      profile.recent_activity.last_seen = new Date();

      // Update frequent areas
      const areaIndex = profile.recent_activity.frequent_areas.findIndex(
        a => a === signal.context.area_id
      );
      if (areaIndex >= 0) {
        // Already in list, bump to front
        profile.recent_activity.frequent_areas.splice(areaIndex, 1);
      }
      profile.recent_activity.frequent_areas.unshift(signal.context.area_id);
      profile.recent_activity.frequent_areas = profile.recent_activity.frequent_areas.slice(0, 10);

      this.userProfiles.set(signal.user_id, profile);
    }

    this.emit('interactionRecorded', interaction);
  }

  /**
   * Learn from user interaction
   */
  private learnFromInteraction(interaction: InteractionSignal): void {
    const creative = this.creatives.get(interaction.ad_id);
    if (!creative) return;

    let learned = this.learnedProfiles.get(interaction.user_id);
    if (!learned) {
      learned = {
        user_id: interaction.user_id,
        patterns: [],
        frequent_areas: [],
        preferred_times: [],
        last_updated: new Date(),
      };
    }

    // Update patterns
    for (const category of creative.target_categories) {
      const pattern = learned.patterns.find(p => p.category.toLowerCase() === category.toLowerCase());
      if (pattern) {
        // Update existing pattern
        pattern.interaction_count++;
        pattern.last_interaction = interaction.timestamp;
        // Calculate new affinity (exponential moving average)
        pattern.affinity_score = pattern.affinity_score * 0.7 + 0.3;
      } else {
        // Add new pattern
        learned.patterns.push({
          category,
          affinity_score: 0.3,
          interaction_count: 1,
          last_interaction: interaction.timestamp,
        });
      }
    }

    // Update frequent areas
    const areaIndex = learned.frequent_areas.findIndex(a => a.area_id === interaction.context.area_id);
    if (areaIndex >= 0) {
      learned.frequent_areas[areaIndex].visits++;
    } else {
      learned.frequent_areas.push({ area_id: interaction.context.area_id, visits: 1 });
    }
    learned.frequent_areas.sort((a, b) => b.visits - a.visits);
    learned.frequent_areas = learned.frequent_areas.slice(0, 10);

    // Update preferred times
    const hour = interaction.context.hour;
    const timeEntry = learned.preferred_times.find(t => t.hour === hour);
    if (timeEntry) {
      timeEntry.score = timeEntry.score * 0.8 + 0.2;
    } else {
      learned.preferred_times.push({ hour, score: 0.2 });
    }

    learned.last_updated = new Date();
    this.learnedProfiles.set(interaction.user_id, learned);
  }

  /**
   * Get learned profile for a user
   */
  getLearnedProfile(userId: string): UserLearnedProfile | undefined {
    return this.learnedProfiles.get(userId);
  }

  // -------------------------------------------------------------------------
  // Privacy
  // -------------------------------------------------------------------------

  /**
   * Anonymize user data (for GDPR compliance)
   */
  anonymizeUser(userId: string): void {
    this.userProfiles.delete(userId);
    this.learnedProfiles.delete(userId);

    // Anonymize interaction history
    this.interactionHistory = this.interactionHistory.map(interaction => {
      if (interaction.user_id === userId) {
        return {
          ...interaction,
          user_id: 'anonymized',
        };
      }
      return interaction;
    });

    this.emit('userAnonymized', { userId });
  }

  /**
   * Get all user IDs (for data export)
   */
  getAllUserIds(): string[] {
    return Array.from(this.userProfiles.keys());
  }

  /**
   * Get interaction history for a user
   */
  getUserInteractionHistory(userId: string, limit: number = 100): InteractionSignal[] {
    return this.interactionHistory
      .filter(i => i.user_id === userId)
      .slice(-limit);
  }

  // -------------------------------------------------------------------------
  // Statistics
  // -------------------------------------------------------------------------

  /**
   * Get service statistics
   */
  getStats(): {
    total_profiles: number;
    total_learned_profiles: number;
    total_creatives: number;
    total_interactions: number;
    active_creatives: number;
  } {
    return {
      total_profiles: this.userProfiles.size,
      total_learned_profiles: this.learnedProfiles.size,
      total_creatives: this.creatives.size,
      total_interactions: this.interactionHistory.length,
      active_creatives: this.getActiveCreatives().length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: PersonalizationService | null = null;

export function createPersonalizationService(
  screenService: ScreenManagementService,
  areaService: AreaIntelligenceService,
  config?: Partial<PersonalizationConfig>
): PersonalizationService {
  serviceInstance = new PersonalizationService(screenService, areaService, config);
  return serviceInstance;
}

export function getPersonalizationService(): PersonalizationService | null {
  return serviceInstance;
}
