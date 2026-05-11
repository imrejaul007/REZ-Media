import { z } from 'zod';

// Types
export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface GeoRankedResult {
  productId: string;
  distance: number; // in kilometers
  score: number;   // 0-1 normalized score
  finalScore: number;
}

export interface GeoRankingOptions {
  maxDistance?: number;     // km, default 50
  decayFunction?: 'linear' | 'exponential' | 'gaussian';
  decayFactor?: number;     // controls how quickly score drops with distance
  weights?: {
    distance?: number;
    relevance?: number;
  };
}

export interface ProductWithLocation {
  id: string;
  name: string;
  location: GeoLocation;
  locationName?: string;
  score?: number; // relevance score from other ranker
  metadata?: Record<string, unknown>;
}

// Zod schemas
export const GeoLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const GeoRankingOptionsSchema = z.object({
  maxDistance: z.number().positive().default(50),
  decayFunction: z.enum(['linear', 'exponential', 'gaussian']).default('exponential'),
  decayFactor: z.number().positive().default(0.1),
  weights: z.object({
    distance: z.number().min(0).max(1).default(0.3),
    relevance: z.number().min(0).max(1).default(0.7),
  }).default({ distance: 0.3, relevance: 0.7 }),
});

/**
 * GeoRanker - Ranks products based on geographic proximity
 *
 * Architecture:
 * - Uses Haversine formula for distance calculation
 * - Supports multiple decay functions (linear, exponential, gaussian)
 * - Blends distance score with relevance score
 */
export class GeoRanker {
  private products: Map<string, ProductWithLocation>;

  constructor() {
    this.products = new Map();
  }

  /**
   * Register a product with its location
   */
  registerProduct(product: ProductWithLocation): void {
    const validated = {
      id: product.id,
      name: product.name,
      location: GeoLocationSchema.parse(product.location),
      locationName: product.locationName,
      score: product.score ?? 0.5,
      metadata: product.metadata,
    };

    this.products.set(validated.id, validated);
  }

  /**
   * Register multiple products
   */
  registerProducts(products: ProductWithLocation[]): { success: number; failed: number } {
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
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(from: GeoLocation, to: GeoLocation): number {
    const R = 6371; // Earth's radius in kilometers

    const lat1Rad = this.toRadians(from.latitude);
    const lat2Rad = this.toRadians(to.latitude);
    const deltaLat = this.toRadians(to.latitude - from.latitude);
    const deltaLon = this.toRadians(to.longitude - from.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Rank products by distance from a location
   */
  rankByLocation(
    userLocation: GeoLocation,
    options: GeoRankingOptions = {}
  ): GeoRankedResult[] {
    const opts = GeoRankingOptionsSchema.parse(options);
    const validatedLocation = GeoLocationSchema.parse(userLocation);

    const results: GeoRankedResult[] = [];

    for (const [productId, product] of this.products) {
      const distance = this.calculateDistance(validatedLocation, product.location);

      if (distance <= opts.maxDistance) {
        const distanceScore = this.calculateDistanceScore(distance, opts);

        const finalScore = this.blendScores(
          distanceScore,
          product.score ?? 0.5,
          opts.weights
        );

        results.push({
          productId,
          distance: Math.round(distance * 100) / 100, // round to 2 decimal places
          score: distanceScore,
          finalScore,
        });
      }
    }

    // Sort by final score descending
    results.sort((a, b) => b.finalScore - a.finalScore);

    return results;
  }

  /**
   * Get products within radius
   */
  getProductsInRadius(
    center: GeoLocation,
    radiusKm: number
  ): Array<ProductWithLocation & { distance: number }> {
    const validatedCenter = GeoLocationSchema.parse(center);

    const results: Array<ProductWithLocation & { distance: number }> = [];

    for (const product of this.products.values()) {
      const distance = this.calculateDistance(validatedCenter, product.location);

      if (distance <= radiusKm) {
        results.push({
          ...product,
          distance: Math.round(distance * 100) / 100,
        });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Find nearest products
   */
  findNearest(
    userLocation: GeoLocation,
    limit: number = 10
  ): Array<ProductWithLocation & { distance: number }> {
    const validatedLocation = GeoLocationSchema.parse(userLocation);

    const results: Array<ProductWithLocation & { distance: number }> = [];

    for (const product of this.products.values()) {
      const distance = this.calculateDistance(validatedLocation, product.location);
      results.push({ ...product, distance });
    }

    return results
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);
  }

  /**
   * Calculate distance score based on decay function
   */
  private calculateDistanceScore(distance: number, options: GeoRankingOptions): number {
    const { decayFunction, decayFactor, maxDistance } = options;

    // Normalize distance to 0-1 range (1 = closest, 0 = maxDistance)
    const normalizedDistance = Math.max(0, 1 - distance / maxDistance);

    switch (decayFunction) {
      case 'linear':
        return normalizedDistance;

      case 'exponential':
        return Math.exp(-decayFactor * distance);

      case 'gaussian':
        const sigma = maxDistance / 3; // 3-sigma rule
        return Math.exp(-(distance * distance) / (2 * sigma * sigma));

      default:
        return normalizedDistance;
    }
  }

  /**
   * Blend distance score with relevance score
   */
  private blendScores(
    distanceScore: number,
    relevanceScore: number,
    weights: NonNullable<GeoRankingOptions['weights']>
  ): number {
    const totalWeight = weights.distance + weights.relevance;
    return (
      (distanceScore * weights.distance + relevanceScore * weights.relevance) / totalWeight
    );
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Remove a product from geo index
   */
  removeProduct(productId: string): boolean {
    return this.products.delete(productId);
  }

  /**
   * Update product score
   */
  updateProductScore(productId: string, score: number): boolean {
    const product = this.products.get(productId);
    if (product) {
      product.score = score;
      return true;
    }
    return false;
  }

  /**
   * Get registered product count
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
   * Get bounding box for all products
   */
  getBoundingBox(): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
    if (this.products.size === 0) return null;

    let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;

    for (const product of this.products.values()) {
      minLat = Math.min(minLat, product.location.latitude);
      maxLat = Math.max(maxLat, product.location.latitude);
      minLon = Math.min(minLon, product.location.longitude);
      maxLon = Math.max(maxLon, product.location.longitude);
    }

    return { minLat, maxLat, minLon, maxLon };
  }
}

/**
 * Haversine distance helper (exported for external use)
 */
export function haversineDistance(from: GeoLocation, to: GeoLocation): number {
  const R = 6371; // Earth's radius in km
  const dLat = (to.latitude - from.latitude) * Math.PI / 180;
  const dLon = (to.longitude - from.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(from.latitude * Math.PI / 180) *
    Math.cos(to.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Factory function
export function createGeoRanker(): GeoRanker {
  return new GeoRanker();
}
