import {
  CODDecision,
  CODDecisionResult,
  RiskTier,
  DecisionRequest,
  RiskScoreResult,
} from '../types';
import { IOrderRisk, OrderRisk } from '../models/OrderRisk';
import { logger } from '../config/logger';

interface DecisionThresholds {
  blockThreshold: number; // Score above which to block
  partialAdvanceMinThreshold: number; // Score above which partial advance
  partialAdvancePercentage: (riskScore: number) => number;
  reviewThreshold: number; // Score above which to require review
}

const DEFAULT_THRESHOLDS: DecisionThresholds = {
  blockThreshold: 60, // HIGH risk tier
  partialAdvanceMinThreshold: 30, // MEDIUM risk tier
  partialAdvancePercentage: (riskScore: number) => {
    // Progressive partial advance: higher risk = higher advance required
    if (riskScore <= 35) return 10;
    if (riskScore <= 45) return 20;
    if (riskScore <= 55) return 30;
    return 40;
  },
  reviewThreshold: 75, // Very high risk needs manual review
};

export class CODDecisionService {
  private thresholds: DecisionThresholds = DEFAULT_THRESHOLDS;

  /**
   * Update decision thresholds
   */
  setThresholds(thresholds: Partial<DecisionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Make COD decision for an order
   */
  async makeDecision(
    request: DecisionRequest,
    riskAnalysis?: RiskScoreResult
  ): Promise<CODDecisionResult> {
    logger.info('Making COD decision', {
      orderId: request.orderId,
      userId: request.userId,
      orderValue: request.orderValue,
      codAmount: request.codAmount,
    });

    // Get existing risk analysis if not provided
    let riskScore: number;
    let riskTier: RiskTier;
    let codAmount = request.codAmount;

    if (riskAnalysis) {
      riskScore = riskAnalysis.riskScore;
      riskTier = riskAnalysis.riskTier;
    } else {
      const orderRisk = await OrderRisk.findOne({ orderId: request.orderId });
      if (!orderRisk) {
        // No risk analysis exists, default to review
        return this.createDecision(
          request,
          50,
          RiskTier.MEDIUM,
          CODDecision.REVIEW,
          'No risk analysis found - requires manual review',
          []
        );
      }
      riskScore = orderRisk.riskScore;
      riskTier = orderRisk.riskTier;
      codAmount = orderRisk.codAmount;
    }

    // Make decision based on risk score
    const decision = this.determineDecision(riskScore, riskTier);

    // Generate reason and conditions
    const { reason, conditions } = this.generateReasonAndConditions(
      decision,
      riskScore,
      riskTier,
      request.orderValue,
      codAmount
    );

    // Calculate partial advance if applicable
    let partialAdvanceAmount: number | undefined;
    let partialAdvancePercentage: number | undefined;

    if (decision === CODDecision.PARTIAL_ADVANCE) {
      partialAdvancePercentage = this.thresholds.partialAdvancePercentage(riskScore);
      partialAdvanceAmount = Math.round(
        request.orderValue * (partialAdvancePercentage / 100)
      );
    }

    // Update order risk record with decision
    await OrderRisk.findOneAndUpdate(
      { orderId: request.orderId },
      {
        codDecision: decision,
        codDecisionReason: reason,
        partialAdvanceAmount,
        partialAdvancePercentage,
        status: this.mapDecisionToStatus(decision),
        decisionExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      }
    );

    logger.info('COD decision made', {
      orderId: request.orderId,
      decision,
      reason,
      partialAdvanceAmount,
      partialAdvancePercentage,
    });

    return {
      orderId: request.orderId,
      userId: request.userId,
      decision,
      riskScore,
      riskTier,
      partialAdvanceAmount,
      partialAdvancePercentage,
      reason,
      conditions,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  /**
   * Determine COD decision based on risk score
   */
  private determineDecision(riskScore: number, riskTier: RiskTier): CODDecision {
    // CRITICAL: Block very high risk
    if (riskScore >= this.thresholds.reviewThreshold) {
      return CODDecision.REVIEW;
    }

    // HIGH: Block COD
    if (riskScore >= this.thresholds.blockThreshold) {
      return CODDecision.BLOCKED;
    }

    // MEDIUM: Partial advance
    if (riskScore >= this.thresholds.partialAdvanceMinThreshold) {
      return CODDecision.PARTIAL_ADVANCE;
    }

    // LOW: Full approval
    return CODDecision.APPROVED;
  }

  /**
   * Generate decision reason and conditions
   */
  private generateReasonAndConditions(
    decision: CODDecision,
    riskScore: number,
    riskTier: RiskTier,
    orderValue: number,
    codAmount: number
  ): { reason: string; conditions?: string[] } {
    const conditions: string[] = [];

    switch (decision) {
      case CODDecision.APPROVED:
        return {
          reason: `Low risk order (score: ${riskScore}). COD approved for full amount of ₹${codAmount.toLocaleString()}.`,
        };

      case CODDecision.PARTIAL_ADVANCE:
        const percentage = this.thresholds.partialAdvancePercentage(riskScore);
        const advanceAmount = Math.round(orderValue * (percentage / 100));
        const remainingCod = codAmount - advanceAmount;

        conditions.push(`Collect ₹${advanceAmount.toLocaleString()} (${percentage}%) as advance`);
        conditions.push(`Remaining ₹${remainingCod.toLocaleString()} on delivery`);
        conditions.push('Verify address and contact before shipping');
        conditions.push('Enable tracking alerts');

        return {
          reason: `Medium risk order (score: ${riskScore}). Partial advance of ${percentage}% required.`,
          conditions,
        };

      case CODDecision.BLOCKED:
        conditions.push('Request full advance payment');
        conditions.push('Offer prepaid option with discount');
        conditions.push('Consider blocking user temporarily');
        conditions.push('Flag for fraud investigation');

        return {
          reason: `High risk order (score: ${riskScore}). COD blocked due to risk factors.`,
          conditions,
        };

      case CODDecision.REVIEW:
        conditions.push('Manual review required');
        conditions.push('Verify customer identity');
        conditions.push('Confirm shipping address via phone');
        conditions.push('Check for other high-risk orders');
        conditions.push('Consider historical patterns');

        return {
          reason: `Very high risk order (score: ${riskScore}). Requires manual review before decision.`,
          conditions,
        };

      default:
        return {
          reason: 'Unable to determine decision. Manual review required.',
        };
    }
  }

  /**
   * Map decision to order status
   */
  private mapDecisionToStatus(
    decision: CODDecision
  ): 'APPROVED' | 'DECLINED' | 'PARTIAL' | 'PENDING' {
    switch (decision) {
      case CODDecision.APPROVED:
        return 'APPROVED';
      case CODDecision.BLOCKED:
        return 'DECLINED';
      case CODDecision.PARTIAL_ADVANCE:
        return 'PARTIAL';
      case CODDecision.REVIEW:
        return 'PENDING';
      default:
        return 'PENDING';
    }
  }

  /**
   * Get decision for an existing order
   */
  async getDecision(orderId: string): Promise<CODDecisionResult | null> {
    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return null;
    }

    // Check if decision has expired
    if (new Date() > orderRisk.decisionExpiresAt) {
      await OrderRisk.findOneAndUpdate(
        { orderId },
        { status: 'EXPIRED' }
      );
      return null;
    }

    return {
      orderId: orderRisk.orderId,
      userId: orderRisk.userId,
      decision: orderRisk.codDecision,
      riskScore: orderRisk.riskScore,
      riskTier: orderRisk.riskTier,
      partialAdvanceAmount: orderRisk.partialAdvanceAmount,
      partialAdvancePercentage: orderRisk.partialAdvancePercentage,
      reason: orderRisk.codDecisionReason,
      expiresAt: orderRisk.decisionExpiresAt,
    };
  }

  /**
   * Override decision for manual review
   */
  async overrideDecision(
    orderId: string,
    newDecision: CODDecision,
    overrideReason: string
  ): Promise<CODDecisionResult | null> {
    const orderRisk = await OrderRisk.findOne({ orderId });

    if (!orderRisk) {
      return null;
    }

    // Update decision
    orderRisk.codDecision = newDecision;
    orderRisk.codDecisionReason = `Manual override: ${overrideReason}`;
    orderRisk.status = this.mapDecisionToStatus(newDecision);
    orderRisk.decisionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await orderRisk.save();

    logger.info('COD decision overridden', {
      orderId,
      newDecision,
      overrideReason,
    });

    return {
      orderId: orderRisk.orderId,
      userId: orderRisk.userId,
      decision: newDecision,
      riskScore: orderRisk.riskScore,
      riskTier: orderRisk.riskTier,
      reason: orderRisk.codDecisionReason,
      expiresAt: orderRisk.decisionExpiresAt,
    };
  }
}

export const codDecisionService = new CODDecisionService();
