import { z } from 'zod';

// Types
export interface BlendResult {
  productId: string;
  finalScore: number;
  contributions: {
    semantic?: number;
    geo?: number;
    trending?: number;
    local?: number;
    sponsored?: number;
  };
  rank: number;
  blendedFrom: string[]; // Which rankers contributed
}

export interface BlendingStrategy {
  name: string;
  weights: {
    semantic?: number;
    geo?: number;
    trending?: number;
    local?: number;
    sponsored?: number;
  };
  normalization: 'minmax' | 'zscore' | 'rank' | 'none';
  combination: 'weighted_sum' | 'reciprocal_rank' | 'geometric_mean';
}

export interface RankerInput {
  rankerId: string;
  results: Array<{ productId: string; score: number }>;
}

export interface BlendingOptions {
  strategy?: BlendingStrategy;
  customWeights?: Partial<BlendingStrategy['weights']>;
  includeAllProducts?: boolean; // Include products from any ranker
  tieBreaker?: 'semantic' | 'trending' | 'random';
  limit?: number;
}

// Default strategies
export const STRATEGIES: Record<string, BlendingStrategy> = {
  relevance_balanced: {
    name: 'relevance_balanced',
    weights: { semantic: 0.35, trending: 0.25, geo: 0.2, local: 0.1, sponsored: 0.1 },
    normalization: 'rank',
    combination: 'weighted_sum',
  },
  geo_focused: {
    name: 'geo_focused',
    weights: { geo: 0.4, semantic: 0.25, trending: 0.15, local: 0.1, sponsored: 0.1 },
    normalization: 'rank',
    combination: 'weighted_sum',
  },
  trending_aware: {
    name: 'trending_aware',
    weights: { trending: 0.4, semantic: 0.25, geo: 0.15, local: 0.1, sponsored: 0.1 },
    normalization: 'rank',
    combination: 'weighted_sum',
  },
  sponsored_priority: {
    name: 'sponsored_priority',
    weights: { sponsored: 0.35, semantic: 0.25, trending: 0.2, geo: 0.1, local: 0.1 },
    normalization: 'minmax',
    combination: 'weighted_sum',
  },
  quality_focused: {
    name: 'quality_focused',
    weights: { semantic: 0.3, local: 0.3, trending: 0.2, geo: 0.1, sponsored: 0.1 },
    normalization: 'zscore',
    combination: 'geometric_mean',
  },
};

// Zod schemas
export const BlendingStrategySchema = z.object({
  name: z.string(),
  weights: z.object({
    semantic: z.number().min(0).max(1).optional(),
    geo: z.number().min(0).max(1).optional(),
    trending: z.number().min(0).max(1).optional(),
    local: z.number().min(0).max(1).optional(),
    sponsored: z.number().min(0).max(1).optional(),
  }),
  normalization: z.enum(['minmax', 'zscore', 'rank', 'none']),
  combination: z.enum(['weighted_sum', 'reciprocal_rank', 'geometric_mean']),
});

export const BlendingOptionsSchema = z.object({
  strategy: BlendingStrategySchema.optional(),
  customWeights: z.object({
    semantic: z.number().min(0).max(1).optional(),
    geo: z.number().min(0).max(1).optional(),
    trending: z.number().min(0).max(1).optional(),
    local: z.number().min(0).max(1).optional(),
    sponsored: z.number().min(0).max(1).optional(),
  }).optional(),
  includeAllProducts: z.boolean().default(true),
  tieBreaker: z.enum(['semantic', 'trending', 'random']).default('trending'),
  limit: z.number().positive().max(100).default(20),
});

/**
 * RecommendationBlend - Blends results from multiple rankers
 *
 * Architecture:
 * - Supports multiple blending strategies
 * - Normalizes scores across different rankers
 * - Supports multiple combination methods
 * - Provides transparency into scoring contributions
 */
export class RecommendationBlend {
  private rankerOutputs: Map<string, Map<string, number>>;
  private activeStrategy: BlendingStrategy;

  constructor(defaultStrategy: string = 'relevance_balanced') {
    this.rankerOutputs = new Map();
    this.activeStrategy = STRATEGIES[defaultStrategy] || STRATEGIES.relevie_balanced;
  }

  /**
   * Register results from a ranker
   */
  registerRankerResults(rankerId: string, results: Array<{ productId: string; score: number }>): void {
    const scoreMap = new Map<string, number>();

    for (const result of results) {
      scoreMap.set(result.productId, result.score);
    }

    this.rankerOutputs.set(rankerId, scoreMap);
  }

  /**
   * Set the blending strategy
   */
  setStrategy(strategy: BlendingStrategy | string): void {
    if (typeof strategy === 'string') {
      const namedStrategy = STRATEGIES[strategy];
      if (!namedStrategy) {
        throw new Error(`Unknown strategy: ${strategy}. Available: ${Object.keys(STRATEGIES).join(', ')}`);
      }
      this.activeStrategy = namedStrategy;
    } else {
      this.activeStrategy = BlendingStrategySchema.parse(strategy);
    }
  }

  /**
   * Blend results from all registered rankers
   */
  blend(options: BlendingOptions = {}): BlendResult[] {
    const opts = BlendingOptionsSchema.parse(options);

    // Apply custom weights if provided
    const strategy = opts.customWeights
      ? { ...this.activeStrategy, weights: { ...this.activeStrategy.weights, ...opts.customWeights } }
      : this.activeStrategy;

    // Get all product IDs
    const allProductIds = this.getAllProductIds(opts.includeAllProducts);

    // Normalize scores for each ranker
    const normalizedScores = this.normalizeAllScores(allProductIds, strategy.normalization);

    // Calculate blended scores
    const blendedResults = this.calculateBlendedScores(
      allProductIds,
      normalizedScores,
      strategy
    );

    // Sort and limit
    blendedResults.sort((a, b) => b.finalScore - a.finalScore);
    const limited = blendedResults.slice(0, opts.limit);

    // Assign ranks
    return limited.map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
  }

  /**
   * Blend with explicit ranker inputs
   */
  blendWithInputs(
    inputs: RankerInput[],
    options: BlendingOptions = {}
  ): BlendResult[] {
    // Register all inputs
    for (const input of inputs) {
      this.registerRankerResults(input.rankerId, input.results);
    }

    return this.blend(options);
  }

  /**
   * Get all product IDs across rankers
   */
  private getAllProductIds(includeAll: boolean): Set<string> {
    const allIds = new Set<string>();

    for (const scores of this.rankerOutputs.values()) {
      for (const productId of scores.keys()) {
        allIds.add(productId);
      }
    }

    return allIds;
  }

  /**
   * Normalize scores using specified method
   */
  private normalizeAllScores(
    productIds: Set<string>,
    method: BlendingStrategy['normalization']
  ): Map<string, Map<string, number>> {
    const normalized = new Map<string, Map<string, number>>();

    for (const [rankerId, scores] of this.rankerOutputs) {
      const normalizedRanker = new Map<string, number>();

      if (method === 'none') {
        for (const productId of productIds) {
          normalizedRanker.set(productId, scores.get(productId) ?? 0);
        }
      } else if (method === 'minmax') {
        const values = Array.from(scores.values());
        const min = Math.min(...values, 0);
        const max = Math.max(...values, 1);
        const range = max - min || 1;

        for (const productId of productIds) {
          const score = scores.get(productId) ?? 0;
          normalizedRanker.set(productId, (score - min) / range);
        }
      } else if (method === 'zscore') {
        const values = Array.from(scores.values());
        const mean = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length || 1);
        const std = Math.sqrt(variance) || 1;

        for (const productId of productIds) {
          const score = scores.get(productId) ?? 0;
          normalizedRanker.set(productId, (score - mean) / std);
        }
      } else if (method === 'rank') {
        // Sort by score and assign normalized ranks
        const sorted = Array.from(scores.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id], rank) => ({ id, rank }));

        const maxRank = productIds.size || 1;

        for (const productId of productIds) {
          const entry = sorted.find(e => e.id === productId);
          const rank = entry ? entry.rank + 1 : productIds.size;
          normalizedRanker.set(productId, 1 - rank / maxRank);
        }
      }

      normalized.set(rankerId, normalizedRanker);
    }

    return normalized;
  }

  /**
   * Calculate blended scores
   */
  private calculateBlendedScores(
    productIds: Set<string>,
    normalizedScores: Map<string, Map<string, number>>,
    strategy: BlendingStrategy
  ): BlendResult[] {
    const results: BlendResult[] = [];

    for (const productId of productIds) {
      const contributions: BlendResult['contributions'] = {};
      let finalScore = 0;
      let totalWeight = 0;
      const blendedFrom: string[] = [];

      for (const [rankerId, scores] of normalizedScores) {
        const score = scores.get(productId) ?? 0;
        const weight = strategy.weights[rankerId as keyof typeof strategy.weights];

        if (weight !== undefined && weight > 0) {
          contributions[rankerId as keyof typeof contributions] = score;
          totalWeight += weight;
          blendedFrom.push(rankerId);

          if (strategy.combination === 'weighted_sum') {
            finalScore += score * weight;
          }
        }
      }

      // Normalize by total weight for weighted sum
      if (strategy.combination === 'weighted_sum') {
        finalScore = totalWeight > 0 ? finalScore / totalWeight : 0;
      } else if (strategy.combination === 'reciprocal_rank') {
        finalScore = this.calculateReciprocalRank(productId, normalizedScores, strategy.weights);
      } else if (strategy.combination === 'geometric_mean') {
        finalScore = this.calculateGeometricMean(productId, normalizedScores, strategy.weights);
      }

      results.push({
        productId,
        finalScore: Math.round(finalScore * 10000) / 10000,
        contributions,
        rank: 0,
        blendedFrom,
      });
    }

    return results;
  }

  /**
   * Calculate reciprocal rank fusion
   */
  private calculateReciprocalRank(
    productId: string,
    normalizedScores: Map<string, Map<string, number>>,
    weights: BlendingStrategy['weights']
  ): number {
    let score = 0;

    for (const [rankerId, scores] of normalizedScores) {
      const weight = weights[rankerId as keyof typeof weights];
      if (weight !== undefined && weight > 0) {
        const rank = this.getRank(productId, rankerId);
        score += weight / (60 + rank); // RRF formula with k=60
      }
    }

    return score;
  }

  /**
   * Calculate geometric mean
   */
  private calculateGeometricMean(
    productId: string,
    normalizedScores: Map<string, Map<string, number>>,
    weights: BlendingStrategy['weights']
  ): number {
    let product = 1;
    let count = 0;

    for (const [rankerId, scores] of normalizedScores) {
      const weight = weights[rankerId as keyof typeof weights];
      if (weight !== undefined && weight > 0) {
        const score = scores.get(productId) ?? 0;
        if (score > 0) {
          product *= Math.pow(score, weight);
          count += weight;
        }
      }
    }

    return count > 0 ? Math.pow(product, 1 / count) : 0;
  }

  /**
   * Get rank for a product in a specific ranker
   */
  private getRank(productId: string, rankerId: string): number {
    const scores = this.rankerOutputs.get(rankerId);
    if (!scores) return Infinity;

    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);

    const index = sorted.findIndex(([id]) => id === productId);
    return index >= 0 ? index + 1 : Infinity;
  }

  /**
   * Clear registered ranker outputs
   */
  clearRankers(): void {
    this.rankerOutputs.clear();
  }

  /**
   * Get available strategies
   */
  getStrategies(): string[] {
    return Object.keys(STRATEGIES);
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy(): BlendingStrategy {
    return this.activeStrategy;
  }

  /**
   * Create a custom strategy
   */
  createCustomStrategy(
    name: string,
    weights: BlendingStrategy['weights'],
    normalization: BlendingStrategy['normalization'] = 'rank',
    combination: BlendingStrategy['combination'] = 'weighted_sum'
  ): BlendingStrategy {
    const strategy: BlendingStrategy = {
      name,
      weights,
      normalization,
      combination,
    };

    BlendingStrategySchema.parse(strategy);
    return strategy;
  }

  /**
   * Debug: Get raw scores for a product
   */
  getProductScores(productId: string): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const [rankerId, rankerScores] of this.rankerOutputs) {
      scores[rankerId] = rankerScores.get(productId) ?? 0;
    }

    return scores;
  }
}

// Factory function
export function createRecommendationBlend(defaultStrategy?: string): RecommendationBlend {
  return new RecommendationBlend(defaultStrategy);
}

// Export strategies for external use
export { STRATEGIES };
