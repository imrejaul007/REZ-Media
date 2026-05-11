/**
 * Simulation Engine
 *
 * What-if analysis before rule deployment
 */

import { BusinessRule } from '../models/BusinessRule';
import { evaluateRules, EvaluationContext } from './ruleEngine';
import { config } from '../config';

export interface SimulationParams {
  ruleId?: string;
  newRule?: Partial<BusinessRule>;
  scope: 'preview' | 'user_segment' | 'all';
  sampleSize?: number;
}

export interface SimulationResult {
  simulationId: string;
  ruleId: string;
  scope: string;

  // Financial impact
  projectedRevenue: number;
  projectedCost: number;
  projectedMargin: number;
  costPerOutcome: number;

  // Behavioral impact
  projectedConversionRate: number;
  projectedEngagement: number;
  projectedRetention: number;

  // User impact
  affectedUsers: number;
  positiveImpact: number;
  negativeImpact: number;

  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  warnings: string[];
  suggestions: string[];

  // Comparison
  currentRule?: any;
  newRule?: any;
  delta: {
    revenue: number;
    cost: number;
    margin: number;
  };
}

/**
 * Simulate a rule change
 */
export async function simulateRuleChange(params: SimulationParams): Promise<SimulationResult> {
  const {
    ruleId,
    newRule,
    scope,
    sampleSize = 1000
  } = params;

  // Get current rule
  const currentRule = ruleId
    ? await BusinessRule.findById(ruleId)
    : null;

  // Build new rule for comparison
  const simulatedRule = newRule
    ? { ...currentRule?.toObject(), ...newRule }
    : currentRule?.toObject();

  // Simulate impact
  const impact = calculateImpact(currentRule, simulatedRule, scope, sampleSize);

  // Assess risks
  const risks = assessRisks(currentRule, simulatedRule, impact);

  return {
    simulationId: generateId(),
    ruleId: ruleId || 'new',
    scope,
    ...impact,
    ...risks,
    currentRule,
    newRule: simulatedRule,
    delta: {
      revenue: impact.projectedRevenue - (impact.currentRevenue || 0),
      cost: impact.projectedCost - (impact.currentCost || 0),
      margin: impact.projectedMargin - (impact.currentMargin || 0)
    }
  });
}

/**
 * Calculate impact of rule change
 */
function calculateImpact(
  currentRule: BusinessRule | null,
  newRule: any,
  scope: string,
  sampleSize: number
): any {
  // Estimate affected users
  const affectedUsers = scope === 'preview'
    ? Math.min(100, sampleSize)
    : scope === 'user_segment'
    ? Math.min(sampleSize / 10, sampleSize)
    : sampleSize;

  // Calculate baseline metrics (from current rule)
  const currentRevenue = currentRule?.metadata?.estimatedRevenue || 0;
  const currentCost = currentRule?.metadata?.estimatedCost || 0;
  const currentMargin = currentRevenue - currentCost;

  // Estimate new metrics
  const rewardMultiplier = newRule?.actions?.[0]?.params?.amount || 1;
  const estimatedIncrease = rewardMultiplier > 1
    ? (rewardMultiplier - 1) * 0.1 // 10% increase per unit of reward
    : 0;

  const projectedRevenue = currentRevenue * (1 + estimatedIncrease);
  const projectedCost = currentCost * rewardMultiplier;
  const projectedMargin = projectedRevenue - projectedCost;

  // Behavioral estimates
  const conversionLift = rewardMultiplier > 1
    ? (rewardMultiplier - 1) * 5 // 5% lift per unit
    : -(1 - rewardMultiplier) * 5;

  return {
    affectedUsers,
    projectedRevenue,
    projectedCost,
    projectedMargin,
    currentRevenue,
    currentCost,
    currentMargin,
    costPerOutcome: projectedCost / Math.max(1, affectedUsers),
    projectedConversionRate: 0.05 * (1 + conversionLift), // 5% baseline
    projectedEngagement: 0.3 * (1 + conversionLift * 0.5),
    projectedRetention: 0.7 + (conversionLift * 0.02),
    positiveImpact: Math.round(affectedUsers * 0.8),
    negativeImpact: Math.round(affectedUsers * 0.1)
  };
}

/**
 * Assess risks of rule change
 */
function assessRisks(
  currentRule: BusinessRule | null,
  newRule: any,
  impact: any
): any {
  const warnings: string[] = [];
  const riskFactors: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

  // Check cost increase
  if (impact.projectedCost > impact.currentCost * 2) {
    warnings.push('Cost will more than double');
    riskFactors.push('Cost increase exceeds 100%');
    riskLevel = 'high';
  } else if (impact.projectedCost > impact.currentCost * 1.5) {
    warnings.push('Cost will increase by more than 50%');
    riskFactors.push('Significant cost increase');
    riskLevel = riskLevel === 'high' ? 'high' : 'medium';
  }

  // Check margin impact
  if (impact.projectedMargin < impact.currentMargin * 0.5) {
    warnings.push('Margin will decrease by more than 50%');
    riskFactors.push('Margin erosion');
    riskLevel = 'critical';
  }

  // Check negative impact ratio
  const negativeRatio = impact.negativeImpact / impact.affectedUsers;
  if (negativeRatio > 0.3) {
    warnings.push('More than 30% of users may have negative experience');
    riskFactors.push('High negative impact ratio');
    riskLevel = riskLevel === 'critical' ? 'critical' : 'high';
  }

  // Generate suggestions
  const suggestions: string[] = [];
  if (riskLevel === 'high' || riskLevel === 'critical') {
    suggestions.push('Consider gradual rollout (start with 10% traffic)');
    suggestions.push('Monitor key metrics daily');
    suggestions.push('Prepare rollback plan');
  }
  if (impact.projectedCost > impact.currentCost) {
    suggestions.push('Consider gradual increase instead of sudden change');
  }

  return {
    riskLevel,
    riskFactors,
    warnings,
    suggestions
  };
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Run A/B test simulation
 */
export async function simulateExperiment(params: {
  name: string;
  control: Partial<BusinessRule>;
  variants: Array<{
    id: string;
    name: string;
    rule: Partial<BusinessRule>;
    trafficAllocation: number;
  }>;
  durationDays: number;
}): Promise<any> {
  const results = params.variants.map(variant => ({
    variantId: variant.id,
    variantName: variant.name,
    trafficAllocation: variant.trafficAllocation,
    impact: simulateImpact(variant.rule)
  }));

  // Calculate statistical significance
  const controlResult = results.find(r => r.variantName === 'Control');
  const winningVariant = results.reduce((best, current) =>
    current.impact.projectedMargin > best.impact.projectedMargin ? current : best
  );

  return {
    experimentId: generateId(),
    name: params.name,
    durationDays: params.durationDays,
    results,
    winner: winningVariant.variantName,
    confidence: calculateConfidence(results),
    recommendations: generateRecommendations(results)
  };
}

/**
 * Simulate impact for a variant
 */
function simulateImpact(rule: Partial<BusinessRule>): any {
  const reward = rule?.actions?.[0]?.params?.amount || 1;
  return {
    projectedCost: reward * 100,
    projectedMargin: 100 - (reward * 100),
    conversionLift: reward > 1 ? (reward - 1) * 10 : 0
  };
}

/**
 * Calculate confidence level
 */
function calculateConfidence(results: any[]): number {
  // Simplified confidence calculation
  const margins = results.map(r => r.impact.projectedMargin);
  const maxDiff = Math.max(...margins) - Math.min(...margins);
  return Math.min(0.99, 0.5 + maxDiff / 100);
}

/**
 * Generate recommendations
 */
function generateRecommendations(results: any[]): string[] {
  const recommendations: string[] = [];

  const maxMargin = Math.max(...results.map(r => r.impact.projectedMargin));
  const bestVariant = results.find(r => r.impact.projectedMargin === maxMargin);

  recommendations.push(`Variant "${bestVariant?.variantName}" shows best margin`);
  recommendations.push('Consider running for at least 7 days for statistical significance');

  return recommendations;
}

export default {
  simulateRuleChange,
  simulateExperiment
};
