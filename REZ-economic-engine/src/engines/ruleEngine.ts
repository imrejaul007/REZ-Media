/**
 * Rule Engine
 *
 * Core rule evaluation engine for REE
 */

import {
  BusinessRule,
  RuleCondition,
  RuleAction,
  ConflictStrategy
} from '../types';

/**
 * Context object for rule evaluation
 */
export interface EvaluationContext {
  user?: {
    id: string;
    tier?: string;
    karmaScore?: number;
    totalSpent?: number;
    [key: string]: any;
  };
  merchant?: {
    id: string;
    name?: string;
    tier?: string;
    category?: string;
    [key: string]: any;
  };
  store?: {
    id: string;
    name?: string;
    category?: string;
    [key: string]: any;
  };
  event?: {
    type: string;
    amount?: number;
    quantity?: number;
    [key: string]: any;
  };
  bill?: {
    amount: number;
    merchantName?: string;
    date?: Date;
    [key: string]: any;
  };
  transaction?: {
    id: string;
    amount: number;
    type: string;
    [key: string]: any;
  };
  location?: {
    lat: number;
    lng: number;
    city?: string;
    [key: string]: any;
  };
  device?: {
    id: string;
    fingerprint?: string;
    userAgent?: string;
    [key: string]: any;
  };
  timestamp?: Date;
  [key: string]: any;
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  ruleId: string;
  matched: boolean;
  score: number;
  actions: RuleAction[];
  calculatedValues: Record<string, number>;
}

/**
 * Get nested value from context object
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  return value;
}

/**
 * Evaluate a single condition against context
 */
export function evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
  const value = getNestedValue(context, condition.field);

  switch (condition.operator) {
    case 'eq':
      return value === condition.value;

    case 'ne':
      return value !== condition.value;

    case 'gt':
      return typeof value === 'number' && value > condition.value;

    case 'gte':
      return typeof value === 'number' && value >= condition.value;

    case 'lt':
      return typeof value === 'number' && value < condition.value;

    case 'lte':
      return typeof value === 'number' && value <= condition.value;

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);

    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);

    case 'between':
      return typeof value === 'number' &&
             value >= condition.value &&
             value <= condition.valueTo;

    case 'contains':
      return typeof value === 'string' && value.includes(condition.value);

    case 'regex':
      try {
        const regex = new RegExp(condition.value);
        return typeof value === 'string' && regex.test(value);
      } catch {
        return false;
      }

    case 'exists':
      return value !== undefined && value !== null;

    default:
      return false;
  }
}

/**
 * Evaluate all conditions against context
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  logic: 'AND' | 'OR',
  context: EvaluationContext
): boolean {
  if (conditions.length === 0) return true;

  if (logic === 'AND') {
    return conditions.every(c => evaluateCondition(c, context));
  } else {
    return conditions.some(c => evaluateCondition(c, context));
  }
}

/**
 * Evaluate a formula and return calculated value
 */
export function evaluateFormula(
  formula: string,
  context: EvaluationContext
): number {
  // Replace variables in formula with values from context
  let evaluatedFormula = formula;

  // Replace context values (e.g., "bill.amount * 0.10")
  for (const key of Object.keys(context)) {
    const regex = new RegExp(`\\b${key}\\.(\\w+)\\b`, 'g');
    evaluatedFormula = evaluatedFormula.replace(regex, (match, prop) => {
      const value = context[key]?.[prop];
      return typeof value === 'number' ? value.toString() : '0';
    });
  }

  // Also handle direct variable references
  const directRegex = /(\w+)\.(\w+)/g;
  evaluatedFormula = evaluatedFormula.replace(directRegex, (match, obj, prop) => {
    const value = context[obj]?.[prop];
    return typeof value === 'number' ? value.toString() : '0';
  });

  // Evaluate the math expression
  try {
    // Safely evaluate only math operations
    const sanitized = evaluatedFormula.replace(/[^0-9+\-*/().%\s]/g, '');
    // Using Function constructor for safe evaluation
    return Function(`"use strict"; return (${sanitized})`)();
  } catch {
    return 0;
  }
}

/**
 * Evaluate a single rule against context
 */
export function evaluateRule(
  rule: BusinessRule,
  context: EvaluationContext
): EvaluationResult {
  // Check if rule is active and effective
  const now = new Date();
  if (!rule.isActive) {
    return {
      ruleId: rule._id?.toString() || '',
      matched: false,
      score: 0,
      actions: [],
      calculatedValues: {}
    };
  }

  if (rule.effectiveFrom > now || (rule.effectiveTo && rule.effectiveTo < now)) {
    return {
      ruleId: rule._id?.toString() || '',
      matched: false,
      score: 0,
      actions: [],
      calculatedValues: {}
    };
  }

  // Evaluate conditions
  const matched = evaluateConditions(rule.conditions, rule.conditionLogic, context);

  if (!matched) {
    return {
      ruleId: rule._id?.toString() || '',
      matched: false,
      score: 0,
      actions: [],
      calculatedValues: {}
    };
  }

  // Calculate action values
  const calculatedValues: Record<string, number> = {};
  const evaluatedActions: RuleAction[] = rule.actions.map(action => {
    const evaluatedAction = { ...action };

    // Calculate formula-based values
    if (action.params.formula) {
      calculatedValues[`${action.actionType}_formula`] = evaluateFormula(
        action.params.formula,
        context
      );
    }

    // Calculate amount if formula-based
    if (action.params.amount === 'calculated' && action.params.formula) {
      evaluatedAction.params.amount = calculatedValues[`${action.actionType}_formula`];
    }

    return evaluatedAction;
  });

  return {
    ruleId: rule._id?.toString() || '',
    matched: true,
    score: rule.priority,
    actions: evaluatedActions,
    calculatedValues
  };
}

/**
 * Resolve conflicts between multiple matching rules
 */
export function resolveConflicts(
  results: EvaluationResult[],
  strategy: ConflictStrategy
): EvaluationResult[] {
  if (results.length <= 1) return results;

  switch (strategy) {
    case 'FIRST':
      // Return only the first (highest priority due to sorting)
      return results.slice(0, 1);

    case 'HIGHEST':
      // Return only the highest priority
      const highest = Math.max(...results.map(r => r.score));
      return results.filter(r => r.score === highest);

    case 'LOWEST':
      // Return only the lowest priority
      const lowest = Math.min(...results.map(r => r.score));
      return results.filter(r => r.score === lowest);

    case 'CUMULATIVE':
      // Return all - their values will be summed
      return results;

    case 'REJECT':
      // If multiple match, reject all (fraud prevention)
      if (results.length > 1) {
        return [];
      }
      return results;

    case 'AVERAGE':
      // Merge into single result with averaged values
      return [mergeResults(results, 'AVERAGE')];

    case 'WEIGHTED':
      // Weight by priority score
      return [mergeResults(results, 'WEIGHTED')];

    case 'CUSTOM':
      // Custom logic would go here
      return results;

    default:
      return results;
  }
}

/**
 * Merge multiple results into one
 */
function mergeResults(results: EvaluationResult[], method: 'AVERAGE' | 'WEIGHTED'): EvaluationResult {
  const totalWeight = method === 'WEIGHTED'
    ? results.reduce((sum, r) => sum + r.score, 0)
    : results.length;

  const mergedActions: RuleAction[] = [];
  const mergedCalculatedValues: Record<string, number> = {};

  for (const result of results) {
    mergedActions.push(...result.actions);

    for (const [key, value] of Object.entries(result.calculatedValues)) {
      if (typeof value === 'number') {
        if (method === 'AVERAGE') {
          mergedCalculatedValues[key] = (mergedCalculatedValues[key] || 0) + value / results.length;
        } else {
          // WEIGHTED
          mergedCalculatedValues[key] = (mergedCalculatedValues[key] || 0) +
            (value * result.score / totalWeight);
        }
      }
    }
  }

  return {
    ruleId: results.map(r => r.ruleId).join(','),
    matched: true,
    score: results.reduce((sum, r) => sum + r.score, 0),
    actions: mergedActions,
    calculatedValues: mergedCalculatedValues
  };
}

/**
 * Main rule engine - evaluate all rules for a context
 */
export async function evaluateRules(
  rules: BusinessRule[],
  context: EvaluationContext
): Promise<EvaluationResult[]> {
  // Sort rules by priority (descending)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // Evaluate each rule
  const results = sortedRules
    .map(rule => evaluateRule(rule, context))
    .filter(r => r.matched);

  if (results.length === 0) return [];

  // Group by category for conflict resolution
  const categoryGroups = new Map<string, EvaluationResult[]>();
  for (const result of results) {
    const rule = sortedRules.find(r => r._id?.toString() === result.ruleId);
    if (rule) {
      const category = rule.category;
      if (!categoryGroups.has(category)) {
        categoryGroups.set(category, []);
      }
      categoryGroups.get(category)!.push(result);
    }
  }

  // Resolve conflicts within each category
  const resolvedResults: EvaluationResult[] = [];
  for (const [_, categoryResults] of categoryGroups) {
    // Use first rule's strategy for this category
    const rule = sortedRules.find(r => r._id?.toString() === categoryResults[0].ruleId);
    const strategy = rule?.conflictStrategy || 'FIRST';
    const resolved = resolveConflicts(categoryResults, strategy);
    resolvedResults.push(...resolved);
  }

  // Sort final results by priority
  return resolvedResults.sort((a, b) => b.score - a.score);
}

export default {
  evaluateCondition,
  evaluateConditions,
  evaluateRule,
  evaluateRules,
  evaluateFormula,
  resolveConflicts
};
