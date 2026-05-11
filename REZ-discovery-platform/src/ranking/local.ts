import { z } from 'zod';

// Types
export interface LocalRankedResult {
  productId: string;
  localScore: number;
  factors: {
    localInventory: number;
    localReviews: number;
    localDelivery: number;
    localMerchant: number;
  };
  finalScore: number;
}

export interface LocalRankingOptions {
  weights?: {
    inventory?: number;
    reviews?: number;
    delivery?: number;
    merchant?: number;
  };
  boostNearbySellers?: boolean;
  maxDeliveryDistance?: number; // km
}

export interface ProductWithLocal {
  id: string;
  sellerLocation?: {
    city: string;
    state: string;
    country: string;
  };
  inventory?: {
    quantity: number;
    localWarehouse: boolean;
  };
  reviews?: {
    averageRating: number;
    reviewCount: number;
    localReviewCount: number;
  };
  delivery?: {
    estimatedDays: number;
    localDelivery: boolean;
  };
  sellerRating?: number;
  metadata?: Record<string, unknown>;
}

// Zod schemas
export const LocalRankingOptionsSchema = z.object({
  weights: z.object({
    inventory: z.number().min(0).max(1).default(0.25),
    reviews: z.number().min(0).max(1).default(0.3),
    delivery: z.number().min(0).max(1).default(0.25),
    merchant: z.number().min(0).max(1).default(0.2),
  }).default({ inventory: 0.25, reviews: 0.3, delivery: 0.25, merchant: 0.2 }),
  boostNearbySellers: z.boolean().default(true),
  maxDeliveryDistance: z.number().positive().default(500),
});

/**
 * LocalRanker - Ranks products based on local factors
 *
 * Factors:
 * - Local inventory availability
 * - Local reviews and ratings
 * - Local delivery options
 * - Local merchant reputation
 *
 * Supports city/state/country level locality
 */
export class LocalRanker {
  private products: Map<string, ProductWithLocal>;
  private localityContext: {
    city?: string;
    state?: string;
    country?: string;
  };

  constructor() {
    this.products = new Map();
    this.localityContext = {};
  }

  /**
   * Set the locality context for ranking
   */
  setLocality(city?: string, state?: string, country?: string): void {
    this.localityContext = { city, state, country };
  }

  /**
   * Register a product
   */
  registerProduct(product: ProductWithLocal): void {
    this.products.set(product.id, product);
  }

  /**
   * Register multiple products
   */
  registerProducts(products: ProductWithLocal[]): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        this.registerProduct(product);
        success++;
      } catch (error) {
        console.error(`Failed to register product ${product.id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Rank products by local factors
   */
  rank(
    baseScores: Map<string, number>,
    options: LocalRankingOptions = {}
  ): LocalRankedResult[] {
    const opts = LocalRankingOptionsSchema.parse(options);
    const results: LocalRankedResult[] = [];

    for (const [productId, baseScore] of baseScores) {
      const product = this.products.get(productId);
      if (!product) continue;

      const factors = this.calculateFactors(product, opts);

      // Normalize weights
      const weightSum = opts.weights.inventory + opts.weights.reviews +
        opts.weights.delivery + opts.weights.merchant;

      const localScore =
        (factors.localInventory * opts.weights.inventory +
          factors.localReviews * opts.weights.reviews +
          factors.localDelivery * opts.weights.delivery +
          factors.localMerchant * opts.weights.merchant) / weightSum;

      // Blend with base score
      const finalScore = baseScore * 0.7 + localScore * 0.3;

      results.push({
        productId,
        localScore: Math.round(localScore * 10000) / 10000,
        factors,
        finalScore: Math.round(finalScore * 10000) / 10000,
      });
    }

    // Sort by final score
    results.sort((a, b) => b.finalScore - a.finalScore);

    return results;
  }

  /**
   * Get products for a specific locality
   */
  getByLocality(
    city?: string,
    state?: string,
    country?: string
  ): ProductWithLocal[] {
    return Array.from(this.products.values()).filter(product => {
      if (!product.sellerLocation) return false;

      const loc = product.sellerLocation;
      if (city && loc.city?.toLowerCase() === city.toLowerCase()) return true;
      if (state && loc.state?.toLowerCase() === state.toLowerCase()) return true;
      if (country && loc.country?.toLowerCase() === country.toLowerCase()) return true;

      return false;
    });
  }

  /**
   * Calculate local factors for a product
   */
  private calculateFactors(
    product: ProductWithLocal,
    options: LocalRankingOptions
  ): LocalRankedResult['factors'] {
    return {
      localInventory: this.calculateInventoryScore(product, options),
      localReviews: this.calculateReviewScore(product),
      localDelivery: this.calculateDeliveryScore(product, options),
      localMerchant: this.calculateMerchantScore(product),
    };
  }

  /**
   * Calculate inventory availability score
   */
  private calculateInventoryScore(
    product: ProductWithLocal,
    options: LocalRankingOptions
  ): number {
    if (!product.inventory) return 0.5;

    const { quantity, localWarehouse } = product.inventory;

    // Base score from quantity
    let score = 0;
    if (quantity === 0) score = 0;
    else if (quantity < 5) score = 0.3;
    else if (quantity < 20) score = 0.6;
    else score = 1.0;

    // Boost for local warehouse
    if (localWarehouse) {
      score = score * 1.2;
    }

    return Math.min(1, score);
  }

  /**
   * Calculate review score
   */
  private calculateReviewScore(product: ProductWithLocal): number {
    if (!product.reviews) return 0.5;

    const { averageRating, reviewCount, localReviewCount } = product.reviews;

    // Normalize rating to 0-1
    const ratingScore = averageRating / 5;

    // Review count factor (log scale)
    const countScore = Math.min(1, Math.log1p(reviewCount) / 10);

    // Local review boost
    const localBoost = localReviewCount > 0 ? 1.2 : 1.0;
    const localReviewScore = Math.min(1, (localReviewCount / Math.max(1, reviewCount)) * localBoost);

    return (ratingScore * 0.6 + countScore * 0.2 + localReviewScore * 0.2);
  }

  /**
   * Calculate delivery score
   */
  private calculateDeliveryScore(
    product: ProductWithLocal,
    options: LocalRankingOptions
  ): number {
    if (!product.delivery) return 0.5;

    const { estimatedDays, localDelivery } = product.delivery;

    // Score based on delivery time
    let timeScore = 0;
    if (estimatedDays <= 1) timeScore = 1.0;
    else if (estimatedDays <= 3) timeScore = 0.8;
    else if (estimatedDays <= 7) timeScore = 0.5;
    else timeScore = 0.2;

    // Boost for local delivery
    if (localDelivery && options.boostNearbySellers) {
      timeScore = Math.min(1, timeScore * 1.3);
    }

    return timeScore;
  }

  /**
   * Calculate merchant score
   */
  private calculateMerchantScore(product: ProductWithLocal): number {
    if (!product.sellerRating) return 0.5;

    // Seller rating typically 0-5
    return product.sellerRating / 5;
  }

  /**
   * Check if product is local
   */
  isLocal(productId: string): boolean {
    const product = this.products.get(productId);
    if (!product || !product.sellerLocation) return false;

    const loc = product.sellerLocation;
    const context = this.localityContext;

    return (
      (context.city && loc.city?.toLowerCase() === context.city.toLowerCase()) ||
      (context.state && loc.state?.toLowerCase() === context.state.toLowerCase()) ||
      (context.country && loc.country?.toLowerCase() === context.country.toLowerCase())
    );
  }

  /**
   * Get product count
   */
  getProductCount(): number {
    return this.products.size;
  }

  /**
   * Clear all products
   */
  clear(): void {
    this.products.clear();
  }

  /**
   * Remove product
   */
  removeProduct(productId: string): boolean {
    return this.products.delete(productId);
  }

  /**
   * Get locality statistics
   */
  getLocalityStats(): {
    totalProducts: number;
    localProducts: number;
    byCountry: Record<string, number>;
    byState: Record<string, number>;
    byCity: Record<string, number>;
  } {
    const byCountry: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const byCity: Record<string, number> = {};
    let localProducts = 0;

    for (const product of this.products.values()) {
      if (product.sellerLocation) {
        const loc = product.sellerLocation;

        if (loc.country) {
          byCountry[loc.country] = (byCountry[loc.country] || 0) + 1;
        }
        if (loc.state) {
          byState[loc.state] = (byState[loc.state] || 0) + 1;
        }
        if (loc.city) {
          byCity[loc.city] = (byCity[loc.city] || 0) + 1;
        }

        if (this.isLocal(product.id)) {
          localProducts++;
        }
      }
    }

    return {
      totalProducts: this.products.size,
      localProducts,
      byCountry,
      byState,
      byCity,
    };
  }
}

// Factory function
export function createLocalRanker(): LocalRanker {
  return new LocalRanker();
}
