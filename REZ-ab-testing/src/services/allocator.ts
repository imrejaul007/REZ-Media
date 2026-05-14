import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IVariant } from '../types';

/**
 * Allocation result containing selected variant and bucket info
 */
export interface AllocationResult {
  variantId: string;
  variantName: string;
  bucket: number;
  hash: string;
  inExperiment: boolean;
  reason?: string;
}

/**
 * Bandit arm statistics for multi-armed bandit
 */
interface BanditArm {
  variantId: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
}

/**
 * Traffic Allocator Service
 * Handles traffic splitting using consistent hashing and multi-armed bandits
 */
export class Allocator {
  private static readonly BUCKET_COUNT = 10000;

  /**
   * Generate a deterministic bucket for a user/experiment combination
   * Uses MurmurHash3-like algorithm for consistent hashing
   */
  static generateBucket(experimentId: string, userId: string): number {
    const input = `${experimentId}:${userId}`;
    const hash = createHash('sha256').update(input).digest('hex');

    // Take first 8 characters and convert to number
    const hashNum = parseInt(hash.substring(0, 8), 16);

    // Map to bucket range [0, BUCKET_COUNT)
    return hashNum % Allocator.BUCKET_COUNT;
  }

  /**
   * Determine which variant a user should see
   * Returns null if user is not in experiment (outside traffic allocation)
   */
  static allocate(
    experimentId: string,
    userId: string,
    variants: IVariant[],
    trafficAllocation: number
  ): AllocationResult {
    // Check if user is in experiment based on traffic allocation
    const bucket = this.generateBucket(experimentId, userId);
    const bucketThreshold = (trafficAllocation / 100) * Allocator.BUCKET_COUNT;

    if (bucket >= bucketThreshold) {
      return {
        variantId: '',
        variantName: '',
        bucket,
        hash: `${experimentId}:${userId}`,
        inExperiment: false,
        reason: 'User outside traffic allocation',
      };
    }

    // Sort variants by weight (cumulative distribution)
    const sortedVariants = [...variants].sort((a, b) => b.weight - a.weight);

    // Find variant based on cumulative weights
    let cumulativeWeight = 0;
    const userBucket = bucket / Allocator.BUCKET_COUNT * 100;

    for (const variant of sortedVariants) {
      cumulativeWeight += variant.weight;
      if (userBucket < cumulativeWeight) {
        return {
          variantId: variant.id,
          variantName: variant.name,
          bucket,
          hash: `${experimentId}:${userId}`,
          inExperiment: true,
        };
      }
    }

    // Fallback to last variant (shouldn't happen if weights sum to 100)
    const lastVariant = sortedVariants[sortedVariants.length - 1];
    return {
      variantId: lastVariant.id,
      variantName: lastVariant.name,
      bucket,
      hash: `${experimentId}:${userId}`,
      inExperiment: true,
    };
  }

  /**
   * Generate a new session ID
   */
  static generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Validate variant weights sum to 100%
   */
  static validateWeights(variants: IVariant[]): { valid: boolean; error?: string } {
    if (!variants || variants.length < 2) {
      return {
        valid: false,
        error: 'At least 2 variants are required',
      };
    }

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

    if (Math.abs(totalWeight - 100) > 0.01) {
      return {
        valid: false,
        error: `Variant weights must sum to 100%, got ${totalWeight}%`,
      };
    }

    // Ensure at least one control variant
    const hasControl = variants.some(v => v.isControl);
    if (!hasControl) {
      return {
        valid: false,
        error: 'At least one variant must be marked as control',
      };
    }

    return { valid: true };
  }

  /**
   * Normalize weights to sum to 100%
   */
  static normalizeWeights(variants: IVariant[]): IVariant[] {
    const total = variants.reduce((sum, v) => sum + v.weight, 0);

    if (total === 0) {
      // Equal distribution
      const weight = 100 / variants.length;
      return variants.map(v => ({ ...v, weight }));
    }

    return variants.map(v => ({
      ...v,
      weight: (v.weight / total) * 100,
    }));
  }

  /**
   * Multi-armed bandit allocation using Thompson Sampling
   * Returns updated variant weights based on observed performance
   */
  static thompsonSampling(arms: BanditArm[]): Map<string, number> {
    const newWeights = new Map<string, number>();
    const samples: { variantId: string; sample: number }[] = [];

    // Generate Thompson samples from Beta posterior
    for (const arm of arms) {
      // Beta posterior: alpha = conversions + 1, beta = impressions - conversions + 1
      const alpha = arm.conversions + 1;
      const beta = arm.impressions - arm.conversions + 1;

      const sample = this.sampleBeta(alpha, beta);
      samples.push({ variantId: arm.variantId, sample });
    }

    // Calculate new weights based on sampling frequency over many iterations
    const iterations = 10000;
    const counts = new Map<string, number>();

    for (let i = 0; i < iterations; i++) {
      // Generate new samples
      const iterSamples = arms.map(arm => {
        const alpha = arm.conversions + 1;
        const beta = arm.impressions - arm.conversions + 1;
        return {
          variantId: arm.variantId,
          sample: this.sampleBeta(alpha, beta),
        };
      });

      // Find winner
      const winner = iterSamples.reduce((best, current) =>
        current.sample > best.sample ? current : best
      );

      counts.set(winner.variantId, (counts.get(winner.variantId) || 0) + 1);
    }

    // Convert counts to weights
    for (const arm of arms) {
      const count = counts.get(arm.variantId) || 0;
      newWeights.set(arm.variantId, (count / iterations) * 100);
    }

    return newWeights;
  }

  /**
   * Epsilon-greedy bandit algorithm
   */
  static epsilonGreedy(
    arms: BanditArm[],
    epsilon: number = 0.1
  ): Map<string, number> {
    const newWeights = new Map<string, number>();

    // Find best performing arm
    const sortedArms = [...arms].sort((a, b) => b.conversionRate - a.conversionRate);
    const bestArm = sortedArms[0];

    for (const arm of arms) {
      if (Math.random() < epsilon) {
        // Explore: random weight
        newWeights.set(arm.variantId, 100 / arms.length);
      } else {
        // Exploit: give weight to best arm
        newWeights.set(arm.variantId, arm.variantId === bestArm.variantId ? 100 : 0);
      }
    }

    return newWeights;
  }

  /**
   * UCB1 (Upper Confidence Bound) bandit algorithm
   */
  static ucb1(arms: BanditArm[]): Map<string, number> {
    const newWeights = new Map<string, number>();
    const totalImpressions = arms.reduce((sum, a) => sum + a.impressions, 0);

    if (totalImpressions === 0) {
      // Equal distribution if no data
      return new Map(arms.map(a => [a.variantId, 100 / arms.length]));
    }

    const ucbScores = arms.map(arm => {
      if (arm.impressions === 0) return Infinity;

      const exploitation = arm.conversionRate;
      const exploration = Math.sqrt(2 * Math.log(totalImpressions) / arm.impressions);
      return exploitation + exploration;
    });

    const maxScore = Math.max(...ucbScores);

    // Calculate softmax probabilities
    const expScores = ucbScores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);

    arms.forEach((arm, i) => {
      newWeights.set(arm.variantId, (expScores[i] / sumExp) * 100);
    });

    return newWeights;
  }

  /**
   * Sample from Beta distribution using Gamma approximation
   */
  private static sampleBeta(alpha: number, beta: number): number {
    // Using Marsaglia and Tsang's method
    const gamma1 = this.sampleGamma(alpha);
    const gamma2 = this.sampleGamma(beta);
    return gamma1 / (gamma1 + gamma2);
  }

  /**
   * Sample from Gamma distribution
   */
  private static sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.randn();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Standard normal random sample
   */
  private static randn(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Re-balance weights when adding/removing variants
   */
  static rebalanceWeights(
    currentVariants: IVariant[],
    targetVariantId: string,
    targetWeight: number
  ): IVariant[] {
    const result: IVariant[] = [];
    const remainingWeight = 100 - targetWeight;

    // Find current weight of target variant
    const targetVariant = currentVariants.find(v => v.id === targetVariantId);
    if (!targetVariant) {
      throw new Error(`Variant ${targetVariantId} not found`);
    }

    // Calculate remaining variants
    const otherVariants = currentVariants.filter(v => v.id !== targetVariantId);
    const currentOtherWeight = otherVariants.reduce((sum, v) => sum + v.weight, 0);

    // Add/update target variant with new weight
    result.push({ ...targetVariant, weight: targetWeight });

    // Redistribute remaining weight proportionally
    for (const variant of otherVariants) {
      const proportionalWeight = currentOtherWeight > 0
        ? (variant.weight / currentOtherWeight) * remainingWeight
        : remainingWeight / otherVariants.length;

      result.push({ ...variant, weight: proportionalWeight });
    }

    // Normalize to ensure exactly 100%
    return this.normalizeWeights(result);
  }

  /**
   * Get experiment allocation summary
   */
  static getAllocationSummary(variants: IVariant[]): {
    controlWeight: number;
    treatmentWeight: number;
    variantCount: number;
    weightsBalanced: boolean;
  } {
    const controlWeight = variants
      .filter(v => v.isControl)
      .reduce((sum, v) => sum + v.weight, 0);

    const treatmentWeight = variants
      .filter(v => !v.isControl)
      .reduce((sum, v) => sum + v.weight, 0);

    return {
      controlWeight,
      treatmentWeight,
      variantCount: variants.length,
      weightsBalanced: Math.abs(controlWeight + treatmentWeight - 100) < 0.01,
    };
  }
}
