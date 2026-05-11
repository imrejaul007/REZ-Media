import { z } from 'zod';

// Types
export interface TrendingScore {
  productId: string;
  score: number;
  rank: number;
  velocity: number;       // Rate of change
  viewCount: number;
  purchaseCount: number;
  wishlistCount: number;
  timeWindow: 'hour' | 'day' | 'week' | 'month';
}

export interface TrendingOptions {
  timeWindow?: 'hour' | 'day' | 'week' | 'month';
  decayBase?: number;     // Base for time-based decay
  weights?: {
    views?: number;
    purchases?: number;
    wishlists?: number;
    velocity?: number;
  };
  limit?: number;
}

export interface TrendingProduct {
  productId: string;
  views: number;
  purchases: number;
  wishlists: number;
  timestamp: Date;
}

// Zod schemas
export const TrendingOptionsSchema = z.object({
  timeWindow: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  decayBase: z.number().positive().max(1).default(0.95),
  weights: z.object({
    views: z.number().min(0).max(1).default(0.2),
    purchases: z.number().min(0).max(1).default(0.5),
    wishlists: z.number().min(0).max(1).default(0.2),
    velocity: z.number().min(0).max(1).default(0.1),
  }).default({ views: 0.2, purchases: 0.5, wishlists: 0.2, velocity: 0.1 }),
  limit: z.number().positive().max(100).default(20),
});

/**
 * TrendingRanker - Ranks products based on trending metrics
 *
 * Architecture:
 * - Time-decay algorithm for recency weighting
 * - Velocity calculation for trending direction
 * - Composite scoring from views, purchases, wishlists
 */
export class TrendingRanker {
  private productMetrics: Map<string, TrendingProduct[]>;
  private currentScores: Map<string, TrendingScore>;
  private timeWindowHours: Record<string, number>;

  constructor() {
    this.productMetrics = new Map();
    this.currentScores = new Map();
    this.timeWindowHours = {
      hour: 1,
      day: 24,
      week: 24 * 7,
      month: 24 * 30,
    };
  }

  /**
   * Record a view event
   */
  recordView(productId: string, timestamp: Date = new Date()): void {
    this.recordEvent(productId, 'views', timestamp);
  }

  /**
   * Record a purchase event
   */
  recordPurchase(productId: string, timestamp: Date = new Date()): void {
    this.recordEvent(productId, 'purchases', timestamp);
  }

  /**
   * Record a wishlist event
   */
  recordWishlist(productId: string, timestamp: Date = new Date()): void {
    this.recordEvent(productId, 'wishlists', timestamp);
  }

  /**
   * Record an event for a product
   */
  private recordEvent(
    productId: string,
    type: 'views' | 'purchases' | 'wishlists',
    timestamp: Date
  ): void {
    if (!this.productMetrics.has(productId)) {
      this.productMetrics.set(productId, []);
    }

    const metrics = this.productMetrics.get(productId)!;
    metrics.push({
      productId,
      views: type === 'views' ? 1 : 0,
      purchases: type === 'purchases' ? 1 : 0,
      wishlists: type === 'wishlists' ? 1 : 0,
      timestamp,
    });

    // Cleanup old metrics
    this.cleanupOldMetrics(productId);
  }

  /**
   * Get trending products
   */
  getTrending(options: TrendingOptions = {}): TrendingScore[] {
    const opts = TrendingOptionsSchema.parse(options);
    const windowHours = this.timeWindowHours[opts.timeWindow];
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const scores: TrendingScore[] = [];

    for (const [productId, metrics] of this.productMetrics) {
      const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);

      if (recentMetrics.length === 0) continue;

      const views = recentMetrics.reduce((sum, m) => sum + m.views, 0);
      const purchases = recentMetrics.reduce((sum, m) => sum + m.purchases, 0);
      const wishlists = recentMetrics.reduce((sum, m) => sum + m.wishlists, 0);

      // Calculate time-decayed score
      const decayScore = this.calculateDecayScore(recentMetrics, opts.decayBase, opts.timeWindow);

      // Calculate velocity (rate of change)
      const velocity = this.calculateVelocity(recentMetrics, opts.timeWindow);

      // Calculate composite score
      const compositeScore = this.calculateCompositeScore(
        views,
        purchases,
        wishlists,
        velocity,
        opts.weights
      );

      scores.push({
        productId,
        score: Math.round(compositeScore * 10000) / 10000,
        rank: 0,
        velocity,
        viewCount: views,
        purchaseCount: purchases,
        wishlistCount: wishlists,
        timeWindow: opts.timeWindow,
      });
    }

    // Sort by score descending and assign ranks
    scores.sort((a, b) => b.score - a.score);

    return scores.map((s, i) => ({ ...s, rank: i + 1 })).slice(0, opts.limit);
  }

  /**
   * Get trending products with time series data
   */
  getTrendingTimeSeries(
    productId: string,
    intervals: number = 24,
    timeWindow: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Array<{ timestamp: Date; score: number }> {
    const metrics = this.productMetrics.get(productId);
    if (!metrics) return [];

    const windowHours = this.timeWindowHours[timeWindow];
    const intervalMs = (windowHours * 60 * 60 * 1000) / intervals;
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
    const series: Array<{ timestamp: Date; score: number }> = [];

    for (let i = 0; i < intervals; i++) {
      const intervalStart = new Date(cutoffTime.getTime() + i * intervalMs);
      const intervalEnd = new Date(intervalStart.getTime() + intervalMs);

      const intervalMetrics = recentMetrics.filter(
        m => m.timestamp >= intervalStart && m.timestamp < intervalEnd
      );

      const views = intervalMetrics.reduce((sum, m) => sum + m.views, 0);
      const purchases = intervalMetrics.reduce((sum, m) => sum + m.purchases, 0);
      const wishlists = intervalMetrics.reduce((sum, m) => sum + m.wishlists, 0);

      series.push({
        timestamp: intervalStart,
        score: views * 1 + purchases * 5 + wishlists * 3,
      });
    }

    return series;
  }

  /**
   * Calculate time-decayed score
   */
  private calculateDecayScore(
    metrics: TrendingProduct[],
    decayBase: number,
    timeWindow: string
  ): number {
    const now = Date.now();
    const windowHours = this.timeWindowHours[timeWindow];
    const windowMs = windowHours * 60 * 60 * 1000;

    let score = 0;

    for (const metric of metrics) {
      const ageMs = now - metric.timestamp.getTime();
      const ageHours = ageMs / (60 * 60 * 1000);
      const decay = Math.pow(decayBase, ageHours);

      const metricScore =
        metric.views * 1 +
        metric.purchases * 5 +
        metric.wishlists * 3;

      score += metricScore * decay;
    }

    // Normalize by window
    return score / windowMs;
  }

  /**
   * Calculate velocity (rate of change)
   */
  private calculateVelocity(
    metrics: TrendingProduct[],
    timeWindow: string
  ): number {
    if (metrics.length < 2) return 0;

    // Split metrics into halves
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const score1 = this.getTotalScore(firstHalf);
    const score2 = this.getTotalScore(secondHalf);

    // Velocity is the rate of change
    if (score1 === 0) return score2 > 0 ? 1 : 0;
    return (score2 - score1) / score1;
  }

  /**
   * Get total score for a set of metrics
   */
  private getTotalScore(metrics: TrendingProduct[]): number {
    return metrics.reduce(
      (sum, m) => sum + m.views * 1 + m.purchases * 5 + m.wishlists * 3,
      0
    );
  }

  /**
   * Calculate composite score
   */
  private calculateCompositeScore(
    views: number,
    purchases: number,
    wishlists: number,
    velocity: number,
    weights: NonNullable<TrendingOptions['weights']>
  ): number {
    const totalWeight = weights.views + weights.purchases + weights.wishlists + weights.velocity;

    // Normalize counts (using log scale for large numbers)
    const logViews = Math.log1p(views);
    const logPurchases = Math.log1p(purchases);
    const logWishlists = Math.log1p(wishlists);

    // Normalize velocity to 0-1 range
    const normalizedVelocity = Math.max(-1, Math.min(1, velocity));

    return (
      (logViews * weights.views +
        logPurchases * weights.purchases +
        logWishlists * weights.wishlists +
        normalizedVelocity * weights.velocity) / totalWeight
    );
  }

  /**
   * Cleanup metrics older than the retention window
   */
  private cleanupOldMetrics(productId: string): void {
    const metrics = this.productMetrics.get(productId);
    if (!metrics) return;

    const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Keep 30 days
    this.productMetrics.set(
      productId,
      metrics.filter(m => m.timestamp >= cutoffTime)
    );
  }

  /**
   * Get product count with tracking
   */
  getProductCount(): number {
    return this.productMetrics.size;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.productMetrics.clear();
    this.currentScores.clear();
  }

  /**
   * Get aggregated stats
   */
  getStats(): {
    totalProducts: number;
    totalEvents: number;
    eventsByType: { views: number; purchases: number; wishlists: number };
  } {
    let totalEvents = 0;
    let views = 0;
    let purchases = 0;
    let wishlists = 0;

    for (const metrics of this.productMetrics.values()) {
      totalEvents += metrics.length;
      for (const m of metrics) {
        views += m.views;
        purchases += m.purchases;
        wishlists += m.wishlists;
      }
    }

    return {
      totalProducts: this.productMetrics.size,
      totalEvents,
      eventsByType: { views, purchases, wishlists },
    };
  }
}

// Factory function
export function createTrendingRanker(): TrendingRanker {
  return new TrendingRanker();
}
