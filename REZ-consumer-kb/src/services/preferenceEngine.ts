import { profileService } from './profileService';
import { kbService } from './kbService';
import { IInferredPreference, IExplicitPreference } from '../models/ConsumerProfile';

export interface PreferenceSignal {
  consumerId: string;
  eventType: 'view' | 'click' | 'purchase' | 'cart_add' | 'cart_remove' | 'search' | 'wishlist' | 'review' | 'return';
  category: string;
  value: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface LearnedPreference {
  category: string;
  value: string;
  confidence: number;
  evidence: string[];
  source: 'behavior' | 'interaction' | 'ml_inference';
}

export interface PreferenceThresholds {
  viewWeight: number;
  clickWeight: number;
  purchaseWeight: number;
  cartAddWeight: number;
  searchWeight: number;
  wishlistWeight: number;
  decayRate: number;
  confidenceThreshold: number;
}

const DEFAULT_THRESHOLDS: PreferenceThresholds = {
  viewWeight: 0.1,
  clickWeight: 0.3,
  purchaseWeight: 1.0,
  cartAddWeight: 0.5,
  cartRemoveWeight: -0.3,
  searchWeight: 0.4,
  wishlistWeight: 0.6,
  reviewWeight: 0.7,
  returnWeight: -0.5,
  decayRate: 0.95,
  confidenceThreshold: 0.3,
};

export class PreferenceEngine {
  private thresholds: PreferenceThresholds;
  private interactionBuffer: Map<string, PreferenceSignal[]> = new Map();
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 60000; // 1 minute

  constructor(thresholds?: Partial<PreferenceThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

    // Periodic flush
    setInterval(() => this.flushBuffer(), this.FLUSH_INTERVAL);
  }

  /**
   * Record a preference signal (view, click, purchase, etc.)
   */
  async recordSignal(signal: PreferenceSignal): Promise<void> {
    const consumerId = signal.consumerId;

    if (!this.interactionBuffer.has(consumerId)) {
      this.interactionBuffer.set(consumerId, []);
    }

    const buffer = this.interactionBuffer.get(consumerId)!;
    buffer.push(signal);

    // Keep buffer size limited
    if (buffer.length > this.BUFFER_SIZE) {
      buffer.shift();
    }

    // Process immediately for high-value signals
    if (signal.eventType === 'purchase') {
      await this.processSignal(signal);
    }
  }

  /**
   * Process a single signal and update preferences
   */
  async processSignal(signal: PreferenceSignal): Promise<LearnedPreference | null> {
    const { consumerId, category, value, eventType, metadata } = signal;

    // Calculate weight based on event type
    let weight = this.getEventWeight(eventType);
    if (weight === 0) return null;

    // Apply recency boost if recent
    const hoursSinceEvent = (Date.now() - signal.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyBoost = Math.exp(-0.1 * hoursSinceEvent);
    weight *= recencyBoost;

    // Get existing preference
    const { inferred } = await profileService.getPreferencesByCategory(consumerId, category);
    const existing = inferred.find((p) => p.value === value);

    let newConfidence: number;
    let evidence: string[] = [];
    let source: LearnedPreference['source'] = 'behavior';

    if (existing) {
      // Update existing preference
      newConfidence = Math.min(1, existing.confidence + weight * 0.2);
      evidence = [...existing.evidence, this.formatEvidence(signal)];
      // Apply decay
      newConfidence *= this.thresholds.decayRate;
    } else {
      // New preference
      newConfidence = weight;
      evidence = [this.formatEvidence(signal)];
    }

    // Only update if confidence is above threshold
    if (newConfidence >= this.thresholds.confidenceThreshold) {
      await profileService.updateInferredPreference(
        consumerId,
        category,
        value,
        this.formatEvidence(signal),
        newConfidence
      );

      // Also update KB
      await kbService.addInferredPreference(
        consumerId,
        category,
        value,
        newConfidence,
        'behavior',
        evidence
      );

      return {
        category,
        value,
        confidence: newConfidence,
        evidence,
        source,
      };
    }

    return null;
  }

  /**
   * Batch process signals from buffer
   */
  async flushBuffer(): Promise<void> {
    for (const [consumerId, signals] of this.interactionBuffer.entries()) {
      // Group signals by category and value
      const grouped = new Map<string, PreferenceSignal[]>();

      for (const signal of signals) {
        const key = `${signal.category}:${signal.value}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(signal);
      }

      // Process grouped signals
      for (const [, groupSignals] of grouped.entries()) {
        if (groupSignals.length > 0) {
          // Use the most recent signal for processing
          const mostRecent = groupSignals.sort((a, b) =>
            b.timestamp.getTime() - a.timestamp.getTime()
          )[0];
          await this.processSignal(mostRecent);
        }
      }

      // Clear processed signals
      this.interactionBuffer.delete(consumerId);
    }
  }

  /**
   * Process interaction patterns and infer preferences
   */
  async analyzePatterns(consumerId: string): Promise<LearnedPreference[]> {
    const learnedPrefs: LearnedPreference[] = [];

    // Get recent signals from KB
    const memories = await kbService.getRelevantMemories(consumerId, ['interaction', 'behavior']);

    // Analyze patterns
    const categoryPatterns = new Map<string, Map<string, number>>();

    for (const mem of memories) {
      if (mem.metadata.interactions) {
        const interactions = mem.metadata.interactions as Array<{ category: string; value: string; weight: number }>;
        for (const interaction of interactions) {
          if (!categoryPatterns.has(interaction.category)) {
            categoryPatterns.set(interaction.category, new Map());
          }
          const valueMap = categoryPatterns.get(interaction.category)!;
          const current = valueMap.get(interaction.value) || 0;
          valueMap.set(interaction.value, current + interaction.weight);
        }
      }
    }

    // Extract high-confidence patterns
    for (const [category, valueMap] of categoryPatterns.entries()) {
      for (const [value, totalWeight] of valueMap.entries()) {
        if (totalWeight > 2) {
          const confidence = Math.min(1, totalWeight / 10);
          learnedPrefs.push({
            category,
            value,
            confidence,
            evidence: [`Pattern analysis: ${totalWeight} interactions`],
            source: 'ml_inference',
          });

          await profileService.updateInferredPreference(
            consumerId,
            category,
            value,
            `Pattern analysis: ${totalWeight} interactions`,
            confidence
          );
        }
      }
    }

    return learnedPrefs;
  }

  /**
   * Infer preferences from conversation context
   */
  async inferFromConversation(
    consumerId: string,
    conversationSummary: string,
    entities: Array<{ type: string; value: string }>
  ): Promise<LearnedPreference[]> {
    const learnedPrefs: LearnedPreference[] = [];

    // Look for preference signals in conversation
    const preferenceKeywords = [
      'prefer', 'like', 'love', 'hate', 'dislike', 'want', 'need',
      'looking for', 'interested in', 'usually', 'always', 'never'
    ];

    const sentences = conversationSummary.toLowerCase().split(/[.!?]+/);

    for (const entity of entities) {
      const entityLower = entity.value.toLowerCase();

      for (const sentence of sentences) {
        if (sentence.includes(entityLower)) {
          // Check for preference indicators
          for (const keyword of preferenceKeywords) {
            if (sentence.includes(keyword)) {
              const confidence = this.calculateTextConfidence(sentence, keyword);
              learnedPrefs.push({
                category: entity.type,
                value: entity.value,
                confidence,
                evidence: [sentence.trim()],
                source: 'interaction',
              });

              await profileService.updateInferredPreference(
                consumerId,
                entity.type,
                entity.value,
                sentence.trim(),
                confidence
              );
              break;
            }
          }
        }
      }
    }

    return learnedPrefs;
  }

  /**
   * Get recommendations based on inferred preferences
   */
  async getRecommendations(consumerId: string, category: string, limit: number = 10): Promise<string[]> {
    const { inferred } = await profileService.getPreferencesByCategory(consumerId, category);

    return inferred
      .filter((p) => p.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
      .map((p) => p.value);
  }

  /**
   * Get conflicting preferences (high confidence both ways)
   */
  async getConflictingPreferences(consumerId: string): Promise<Array<{ category: string; values: string[] }>> {
    const allPrefs = await profileService.getAllPreferences(consumerId);
    const conflicts: Array<{ category: string; values: string[] }> = [];

    for (const [category, prefs] of allPrefs.entries()) {
      const highConfidence = prefs.filter((p) => p.confidence > 0.7);
      if (highConfidence.length > 1) {
        conflicts.push({
          category,
          values: highConfidence.map((p) => p.value),
        });
      }
    }

    return conflicts;
  }

  private getEventWeight(eventType: string): number {
    const weights: Record<string, number> = {
      view: this.thresholds.viewWeight,
      click: this.thresholds.clickWeight,
      purchase: this.thresholds.purchaseWeight,
      cart_add: this.thresholds.cartAddWeight || 0.5,
      cart_remove: this.thresholds.cartRemoveWeight || -0.3,
      search: this.thresholds.searchWeight || 0.4,
      wishlist: this.thresholds.wishlistWeight || 0.6,
      review: this.thresholds.reviewWeight || 0.7,
      return: this.thresholds.returnWeight || -0.5,
    };
    return weights[eventType] || 0;
  }

  private formatEvidence(signal: PreferenceSignal): string {
    const time = signal.timestamp.toISOString();
    return `${signal.eventType}:${signal.category}:${signal.value}@${time}`;
  }

  private calculateTextConfidence(text: string, keyword: string): number {
    const keywordIndex = text.indexOf(keyword);
    const sentenceLength = text.split(' ').length;

    // Position factor (earlier = more confident)
    const positionFactor = 1 - (keywordIndex / text.length);

    // Length factor (moderate length is best)
    const lengthFactor = Math.min(1, 20 / sentenceLength);

    return Math.min(0.9, 0.3 + positionFactor * 0.3 + lengthFactor * 0.2);
  }
}

export const preferenceEngine = new PreferenceEngine();
