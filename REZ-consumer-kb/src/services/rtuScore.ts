import { IConsumerProfile, IRtoScore } from '../models/ConsumerProfile';

export interface RtoFactors {
  orderCount: number;
  returnRate: number;
  codRate: number;
  fraudSignals: number;
  addressValidity: number;
  deviceTrust: number;
}

export interface RtoThresholds {
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
}

export interface OrderHistory {
  orderId: string;
  status: 'completed' | 'returned' | 'cancelled';
  paymentMethod: 'cod' | 'prepaid';
  createdAt: Date;
  deliveredAt?: Date;
  returnedAt?: Date;
}

export interface FraudSignals {
  multipleFailedPayments: boolean;
  addressMismatch: boolean;
  phoneVerificationFailed: boolean;
  emailVerificationFailed: boolean;
  suspiciousDeviceChange: boolean;
  velocityExceeded: boolean;
}

const DEFAULT_THRESHOLDS: RtoThresholds = {
  lowRisk: 30,
  mediumRisk: 60,
  highRisk: 100,
};

export class RtoScoreService {
  private thresholds: RtoThresholds;

  // Factor weights for score calculation
  private readonly WEIGHTS = {
    orderCount: 0.1,
    returnRate: 0.3,
    codRate: 0.2,
    fraudSignals: 0.25,
    addressValidity: 0.1,
    deviceTrust: 0.05,
  };

  constructor(thresholds?: Partial<RtoThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Calculate RTO score for a consumer
   */
  async calculateScore(consumerId: string, profile: IConsumerProfile): Promise<IRtoScore> {
    const factors = await this.getFactors(consumerId, profile);
    const score = this.calculateScoreFromFactors(factors);
    const riskLevel = this.determineRiskLevel(score);

    return {
      score,
      riskLevel,
      factors,
      lastCalculated: new Date(),
    };
  }

  /**
   * Get all factors for RTO calculation
   */
  async getFactors(consumerId: string, profile: IConsumerProfile): Promise<RtoFactors> {
    // These would typically come from other services
    // For now, use profile data and placeholders

    const orderCount = profile.rtoScore.factors.orderCount;
    const returnRate = profile.rtoScore.factors.returnRate;
    const codRate = profile.rtoScore.factors.codRate;
    const fraudSignals = profile.rtoScore.factors.fraudSignals;
    const addressValidity = profile.rtoScore.factors.addressValidity;
    const deviceTrust = profile.rtoScore.factors.deviceTrust;

    return {
      orderCount,
      returnRate,
      codRate,
      fraudSignals,
      addressValidity,
      deviceTrust,
    };
  }

  /**
   * Update factors from external services
   */
  async updateFactors(consumerId: string, factors: Partial<RtoFactors>): Promise<void> {
    // This would update the profile with new factors
    // Implementation would call profileService to update
  }

  /**
   * Calculate score from factors (0-100)
   */
  private calculateScoreFromFactors(factors: RtoFactors): number {
    let score = 0;

    // Order count factor (more orders = more data = lower risk)
    const orderCountScore = this.normalizeOrderCount(factors.orderCount);
    score += orderCountScore * this.WEIGHTS.orderCount;

    // Return rate factor (higher return rate = higher risk)
    const returnRateScore = factors.returnRate * 100;
    score += returnRateScore * this.WEIGHTS.returnRate;

    // COD rate factor (higher COD = higher risk)
    const codRateScore = factors.codRate * 100;
    score += codRateScore * this.WEIGHTS.codRate;

    // Fraud signals factor (more signals = higher risk)
    const fraudScore = Math.min(100, factors.fraudSignals * 20);
    score += fraudScore * this.WEIGHTS.fraudSignals;

    // Address validity factor (lower validity = higher risk)
    const addressScore = (100 - factors.addressValidity);
    score += addressScore * this.WEIGHTS.addressValidity;

    // Device trust factor (lower trust = higher risk)
    const deviceScore = (100 - factors.deviceTrust);
    score += deviceScore * this.WEIGHTS.deviceTrust;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Normalize order count to 0-100 scale
   * New users (0 orders) = 100 risk (no data)
   * 1-5 orders = 80-60 risk
   * 5-20 orders = 60-30 risk
   * 20+ orders = 30-0 risk
   */
  private normalizeOrderCount(orderCount: number): number {
    if (orderCount === 0) return 100;
    if (orderCount <= 5) return 100 - (orderCount * 8);
    if (orderCount <= 20) return 60 - ((orderCount - 5) * 2.5);
    return Math.max(0, 30 - ((orderCount - 20) * 1.5));
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score <= this.thresholds.lowRisk) return 'low';
    if (score <= this.thresholds.mediumRisk) return 'medium';
    return 'high';
  }

  /**
   * Analyze order history for return patterns
   */
  analyzeOrderHistory(orders: OrderHistory[]): {
    totalOrders: number;
    returnRate: number;
    codRate: number;
    avgReturnTime: number;
    commonReturnReasons: string[];
  } {
    if (orders.length === 0) {
      return {
        totalOrders: 0,
        returnRate: 0,
        codRate: 0,
        avgReturnTime: 0,
        commonReturnReasons: [],
      };
    }

    const completedOrders = orders.filter((o) => o.status === 'completed');
    const returnedOrders = orders.filter((o) => o.status === 'returned');
    const codOrders = orders.filter((o) => o.paymentMethod === 'cod');

    const returnRate = orders.length > 0 ? returnedOrders.length / orders.length : 0;
    const codRate = orders.length > 0 ? codOrders.length / orders.length : 0;

    // Calculate average return time
    let totalReturnTime = 0;
    let returnCount = 0;
    for (const order of returnedOrders) {
      if (order.deliveredAt && order.returnedAt) {
        totalReturnTime += order.returnedAt.getTime() - order.deliveredAt.getTime();
        returnCount++;
      }
    }
    const avgReturnTime = returnCount > 0 ? totalReturnTime / returnCount / (1000 * 60 * 60 * 24) : 0; // in days

    return {
      totalOrders: orders.length,
      returnRate,
      codRate,
      avgReturnTime,
      commonReturnReasons: this.extractReturnReasons(returnedOrders),
    };
  }

  /**
   * Extract common return reasons from orders
   */
  private extractReturnReasons(orders: OrderHistory[]): string[] {
    // In real implementation, would extract from order data
    // For now, return placeholder
    return [];
  }

  /**
   * Evaluate fraud signals
   */
  evaluateFraudSignals(signals: FraudSignals): number {
    let score = 0;

    if (signals.multipleFailedPayments) score += 25;
    if (signals.addressMismatch) score += 20;
    if (signals.phoneVerificationFailed) score += 15;
    if (signals.emailVerificationFailed) score += 10;
    if (signals.suspiciousDeviceChange) score += 15;
    if (signals.velocityExceeded) score += 15;

    return Math.min(100, score);
  }

  /**
   * Get recommended actions based on RTO score
   */
  getRecommendations(riskLevel: 'low' | 'medium' | 'high', factors: RtoFactors): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'high') {
      recommendations.push('Enable COD verification call before order confirmation');
      recommendations.push('Request address verification');
      recommendations.push('Consider limiting first order value');
      recommendations.push('Enable additional fraud checks');

      if (factors.codRate > 0.5) {
        recommendations.push('High COD rate detected - consider offering prepaid discount');
      }
      if (factors.returnRate > 0.3) {
        recommendations.push('High return rate - review product quality and descriptions');
      }
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor order patterns');
      recommendations.push('Enable standard fraud checks');
      recommendations.push('Consider order value limits');

      if (factors.orderCount < 5) {
        recommendations.push('New customer - standard new user policies apply');
      }
    } else {
      recommendations.push('Standard processing');
      recommendations.push('Include in loyalty programs');
      recommendations.push('Positive feedback opportunities');
    }

    return recommendations;
  }

  /**
   * Calculate expected RTO probability
   */
  calculateExpectedRto(factors: RtoFactors): number {
    // Base probability from return rate
    let probability = factors.returnRate;

    // Adjust for COD rate
    probability += factors.codRate * 0.1;

    // Adjust for fraud signals
    probability += factors.fraudSignals * 0.05;

    // Adjust for address validity
    if (factors.addressValidity < 80) {
      probability += (100 - factors.addressValidity) * 0.002;
    }

    // Adjust for device trust
    if (factors.deviceTrust < 80) {
      probability += (100 - factors.deviceTrust) * 0.001;
    }

    return Math.min(1, Math.max(0, probability));
  }

  /**
   * Get segment for consumer
   */
  getSegment(
    riskLevel: 'low' | 'medium' | 'high',
    factors: RtoFactors
  ): 'premium' | 'standard' | 'risky' | 'flag' {
    if (riskLevel === 'high' || factors.fraudSignals > 2) {
      return 'flag';
    }
    if (riskLevel === 'medium' || factors.returnRate > 0.2) {
      return 'risky';
    }
    if (factors.orderCount > 10 && riskLevel === 'low') {
      return 'premium';
    }
    return 'standard';
  }
}

export const rtuScoreService = new RtoScoreService();
