import { IRiskProfile } from '../models/RiskProfile';
import { FraudSignalType, FraudSignal } from '../types';
import { logger } from '../config/logger';

interface BehaviorAnalysisResult {
  behaviorScore: number;
  signals: FraudSignal[];
  riskScore: number;
  factors: Array<{
    name: string;
    impact: number;
    description: string;
  }>;
  recommendations: string[];
}

interface OrderHistory {
  totalOrders: number;
  completedOrders: number;
  returnedOrders: number;
  codOrders: number;
  avgOrderValue: number;
  codReturnRate: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
}

export class BehaviorAnalysisService {
  private readonly THRESHOLDS = {
    NEW_USER_ORDERS: 0,
    LOW_ACTIVITY_ORDERS: 3,
    MEDIUM_ACTIVITY_ORDERS: 10,
    HIGH_ACTIVITY_ORDERS: 20,
    HIGH_RETURN_RATE: 0.3,
    VERY_HIGH_RETURN_RATE: 0.5,
    ABNORMALLY_HIGH_RETURN_RATE: 0.7,
    HIGH_VALUE_ORDER: 5000,
    VERY_HIGH_VALUE_ORDER: 15000,
    RAPID_ORDERING_HOURS: 24,
    MULTIPLE_ADDRESSES: 5,
  };

  /**
   * Analyze user behavior and order history
   */
  async analyzeBehavior(
    profile: IRiskProfile,
    orderHistory?: OrderHistory,
    currentOrderValue?: number
  ): Promise<BehaviorAnalysisResult> {
    const signals: FraudSignal[] = [];
    const factors: Array<{ name: string; impact: number; description: string }> = [];
    let behaviorScore = 100;
    let riskScore = 0;

    // Use profile data or order history
    const data = orderHistory || {
      totalOrders: profile.totalOrders,
      completedOrders: profile.completedOrders,
      returnedOrders: profile.returnedOrders,
      codOrders: profile.codOrders,
      avgOrderValue: profile.avgOrderValue,
      codReturnRate: profile.codReturnRate,
      lastOrderDate: profile.lastOrderDate,
      firstOrderDate: profile.firstOrderDate,
    };

    // 1. Analyze order frequency and pattern
    const frequencyAnalysis = this.analyzeOrderFrequency(data, signals);
    behaviorScore -= frequencyAnalysis.impact;
    riskScore += frequencyAnalysis.impact;
    factors.push(frequencyAnalysis);

    // 2. Analyze return behavior
    const returnAnalysis = this.analyzeReturnBehavior(data, signals);
    behaviorScore -= returnAnalysis.impact;
    riskScore += returnAnalysis.impact;
    factors.push(returnAnalysis);

    // 3. Analyze COD behavior
    const codAnalysis = this.analyzeCODBehavior(data, signals);
    behaviorScore -= codAnalysis.impact;
    riskScore += codAnalysis.impact;
    factors.push(codAnalysis);

    // 4. Analyze order value patterns
    if (currentOrderValue) {
      const valueAnalysis = this.analyzeOrderValue(
        data,
        currentOrderValue,
        signals
      );
      behaviorScore -= valueAnalysis.impact;
      riskScore += valueAnalysis.impact;
      factors.push(valueAnalysis);
    }

    // 5. Analyze account age and activity
    const ageAnalysis = this.analyzeAccountAge(data, signals);
    behaviorScore -= ageAnalysis.impact;
    riskScore += ageAnalysis.impact;
    factors.push(ageAnalysis);

    // 6. Check for rapid ordering (potential bot/fraud behavior)
    const rapidOrderingAnalysis = this.analyzeRapidOrdering(data, signals);
    behaviorScore -= rapidOrderingAnalysis.impact;
    riskScore += rapidOrderingAnalysis.impact;
    factors.push(rapidOrderingAnalysis);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      behaviorScore,
      signals,
      factors
    );

    // Calculate final scores
    behaviorScore = Math.max(0, Math.min(100, behaviorScore));
    riskScore = Math.min(100, riskScore);

    logger.info('Behavior analysis complete', {
      userId: profile.userId,
      behaviorScore,
      riskScore,
      signalsCount: signals.length,
      factorsCount: factors.length,
    });

    return {
      behaviorScore,
      signals,
      riskScore,
      factors,
      recommendations,
    };
  }

  private analyzeOrderFrequency(
    data: OrderHistory,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    if (data.totalOrders === 0) {
      impact = 30;
      description = 'New user with no order history';
      signals.push({
        type: FraudSignalType.FIRST_COD_ORDER,
        severity: 'MEDIUM',
        description: 'First order for this user',
        value: true,
      });
    } else if (data.totalOrders < this.THRESHOLDS.LOW_ACTIVITY_ORDERS) {
      impact = 15;
      description = 'Low activity user (< 3 orders)';
    } else if (data.totalOrders >= this.THRESHOLDS.HIGH_ACTIVITY_ORDERS) {
      impact = -10; // Negative impact = positive behavior
      description = 'Established customer (> 20 orders)';
    } else {
      impact = 0;
      description = 'Regular activity user';
    }

    return { name: 'order_frequency', impact, description };
  }

  private analyzeReturnBehavior(
    data: OrderHistory,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    if (data.returnedOrders === 0) {
      impact = -5; // No returns is slightly positive
      description = 'No return history';
    } else {
      const returnRate = data.totalOrders > 0
        ? data.returnedOrders / data.totalOrders
        : data.codReturnRate;

      if (returnRate >= this.THRESHOLDS.ABNORMALLY_HIGH_RETURN_RATE) {
        impact = 40;
        description = `Abnormally high return rate: ${(returnRate * 100).toFixed(1)}%`;
        signals.push({
          type: FraudSignalType.BEHAVIOR_ANOMALY,
          severity: 'CRITICAL',
          description: `Suspiciously high return rate: ${(returnRate * 100).toFixed(1)}%`,
          value: returnRate,
        });
      } else if (returnRate >= this.THRESHOLDS.VERY_HIGH_RETURN_RATE) {
        impact = 25;
        description = `Very high return rate: ${(returnRate * 100).toFixed(1)}%`;
        signals.push({
          type: FraudSignalType.BEHAVIOR_ANOMALY,
          severity: 'HIGH',
          description: `High return rate: ${(returnRate * 100).toFixed(1)}%`,
          value: returnRate,
        });
      } else if (returnRate >= this.THRESHOLDS.HIGH_RETURN_RATE) {
        impact = 15;
        description = `Moderately high return rate: ${(returnRate * 100).toFixed(1)}%`;
      } else {
        impact = 0;
        description = `Normal return rate: ${(returnRate * 100).toFixed(1)}%`;
      }
    }

    return { name: 'return_behavior', impact, description };
  }

  private analyzeCODBehavior(
    data: OrderHistory,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    const codRatio = data.totalOrders > 0
      ? data.codOrders / data.totalOrders
      : 0;
    const codReturnRate = data.codOrders > 0
      ? data.returnedOrders / data.codOrders
      : 0;

    // First COD order
    if (data.codOrders === 0 && data.totalOrders > 0) {
      impact = 10;
      description = 'First COD order (previously prepaid)';
      signals.push({
        type: FraudSignalType.FIRST_COD_ORDER,
        severity: 'LOW',
        description: 'User switching from prepaid to COD',
        value: true,
      });
    }
    // All orders are COD
    else if (codRatio >= 0.9 && data.totalOrders >= 5) {
      impact = 10;
      description = 'Predominantly COD user';
    }

    // High COD return rate
    if (codReturnRate >= this.THRESHOLDS.VERY_HIGH_RETURN_RATE) {
      impact += 20;
      description = `High COD return rate: ${(codReturnRate * 100).toFixed(1)}%`;
      signals.push({
        type: FraudSignalType.BEHAVIOR_ANOMALY,
        severity: 'HIGH',
        description: `High return rate on COD orders: ${(codReturnRate * 100).toFixed(1)}%`,
        value: codReturnRate,
      });
    }

    if (impact === 0) {
      description = 'Normal COD behavior';
    }

    return { name: 'cod_behavior', impact, description };
  }

  private analyzeOrderValue(
    data: OrderHistory,
    currentOrderValue: number,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    const avgValue = data.avgOrderValue || 0;

    // High value order for new user
    if (data.totalOrders === 0 && currentOrderValue >= this.THRESHOLDS.HIGH_VALUE_ORDER) {
      impact = 25;
      description = `High value (₹${currentOrderValue.toLocaleString()}) first order`;
      signals.push({
        type: FraudSignalType.HIGH_VALUE_ORDER,
        severity: 'HIGH',
        description: `First order is high value: ₹${currentOrderValue.toLocaleString()}`,
        value: currentOrderValue,
      });
    }
    // Order significantly higher than average
    else if (avgValue > 0 && currentOrderValue > avgValue * 3) {
      impact = 15;
      description = `Order value (₹${currentOrderValue.toLocaleString()}) 3x+ above average (₹${avgValue.toLocaleString()})`;
      signals.push({
        type: FraudSignalType.HIGH_VALUE_ORDER,
        severity: 'MEDIUM',
        description: `Abnormally high order value for this user`,
        value: currentOrderValue,
      });
    }
    // Very high value order
    else if (currentOrderValue >= this.THRESHOLDS.VERY_HIGH_VALUE_ORDER) {
      impact = 10;
      description = `Very high value order: ₹${currentOrderValue.toLocaleString()}`;
    }
    // Normal value
    else {
      description = `Normal order value: ₹${currentOrderValue.toLocaleString()}`;
    }

    return { name: 'order_value', impact, description };
  }

  private analyzeAccountAge(
    data: OrderHistory,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    if (!data.firstOrderDate) {
      impact = 20;
      description = 'Account age unknown';
    } else {
      const daysSinceFirstOrder = Math.floor(
        (Date.now() - new Date(data.firstOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceFirstOrder < 7) {
        impact = 15;
        description = `Very new account: ${daysSinceFirstOrder} days`;
      } else if (daysSinceFirstOrder < 30) {
        impact = 5;
        description = `New account: ${daysSinceFirstOrder} days`;
      } else if (daysSinceFirstOrder >= 180) {
        impact = -5;
        description = `Established account: ${Math.floor(daysSinceFirstOrder / 30)} months`;
      } else {
        description = `Account age: ${daysSinceFirstOrder} days`;
      }
    }

    return { name: 'account_age', impact, description };
  }

  private analyzeRapidOrdering(
    data: OrderHistory,
    signals: FraudSignal[]
  ): { name: string; impact: number; description: string } {
    let impact = 0;
    let description = '';

    if (data.lastOrderDate) {
      const hoursSinceLastOrder = Math.floor(
        (Date.now() - new Date(data.lastOrderDate).getTime()) / (1000 * 60 * 60)
      );

      if (hoursSinceLastOrder < this.THRESHOLDS.RAPID_ORDERING_HOURS && data.totalOrders > 1) {
        impact = 20;
        description = `Rapid ordering: ${hoursSinceLastOrder} hours since last order`;
        signals.push({
          type: FraudSignalType.RAPID_ORDERING,
          severity: 'HIGH',
          description: 'User placing multiple orders in short time frame',
          value: hoursSinceLastOrder,
        });
      } else {
        description = `Normal ordering interval: ${hoursSinceLastOrder} hours`;
      }
    } else {
      description = 'No previous order to compare';
    }

    return { name: 'ordering_pattern', impact, description };
  }

  private generateRecommendations(
    behaviorScore: number,
    signals: FraudSignal[],
    factors: Array<{ name: string; impact: number; description: string }>
  ): string[] {
    const recommendations: string[] = [];

    // Based on behavior score
    if (behaviorScore < 50) {
      recommendations.push('Require partial advance payment');
      recommendations.push('Manually review order before processing');
    }

    // Based on signals
    const criticalSignals = signals.filter((s) => s.severity === 'CRITICAL');
    if (criticalSignals.length > 0) {
      recommendations.push('BLOCK order - critical fraud signals detected');
    }

    const highSignals = signals.filter((s) => s.severity === 'HIGH');
    if (highSignals.length >= 2) {
      recommendations.push('Require ID verification');
    }

    // Based on factors
    const negativeFactors = factors.filter((f) => f.impact > 15);
    if (negativeFactors.length >= 2) {
      recommendations.push('Enable enhanced monitoring');
    }

    if (recommendations.length === 0) {
      recommendations.push('Proceed with standard COD processing');
    }

    return recommendations;
  }
}

export const behaviorAnalysisService = new BehaviorAnalysisService();
