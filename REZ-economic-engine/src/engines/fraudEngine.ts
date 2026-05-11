/**
 * Fraud Detection Engine
 *
 * Implements fraud detection rules
 */

import { config } from '../config';
import {
  FraudRule,
  FraudResult,
  ReZEvent
} from '../types';
import { DEFAULT_FRAUD_RULES, getActiveFraudRules } from '../config/fraudRules';
import { evaluateCondition, EvaluationContext } from './ruleEngine';

export interface FraudCheckContext extends EvaluationContext {
  event: ReZEvent;
  // Additional fraud-specific context
  scanHistory?: Array<{
    timestamp: Date;
    location?: { lat: number; lng: number };
    ip?: string;
  }>;
  billHistory?: Array<{
    timestamp: Date;
    billId: string;
    imageHash?: string;
  }>;
}

/**
 * Check velocity (rapid actions in time window)
 */
export function checkVelocity(
  count: number,
  windowSeconds: number,
  history: Array<{ timestamp: Date }>
): { isViolation: boolean; count: number; windowSeconds: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const recentActions = history.filter(
    h => now - h.timestamp.getTime() < windowMs
  );

  return {
    isViolation: recentActions.length >= count,
    count: recentActions.length,
    windowSeconds
  };
}

/**
 * Check impossible travel
 */
export function checkImpossibleTravel(
  location1: { lat: number; lng: number; timestamp: Date },
  location2: { lat: number; lng: number; timestamp: Date },
  maxDistanceKm: number,
  maxTimeHours: number
): { isViolation: boolean; distanceKm: number; timeHours: number } {
  // Haversine formula for distance
  const R = 6371; // Earth's radius in km
  const dLat = (location2.lat - location1.lat) * Math.PI / 180;
  const dLng = (location2.lng - location1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(location1.lat * Math.PI / 180) * Math.cos(location2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  const timeHours = (location2.timestamp.getTime() - location1.timestamp.getTime()) / (1000 * 60 * 60);

  return {
    isViolation: distance > maxDistanceKm && timeHours < maxTimeHours,
    distanceKm: Math.round(distance),
    timeHours: Math.round(timeHours * 100) / 100
  };
}

/**
 * Check duplicate pattern (same bill, same image)
 */
export function checkDuplicatePattern(
  currentItem: string,
  history: Array<{ item: string; timestamp: Date }>,
  windowSeconds: number
): { isViolation: boolean; matchCount: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const duplicates = history.filter(
    h => h.item === currentItem && now - h.timestamp.getTime() < windowMs
  );

  return {
    isViolation: duplicates.length >= 1, // Already includes current
    matchCount: duplicates.length
  };
}

/**
 * Check future dated bill
 */
export function checkFutureDate(date: Date): { isViolation: boolean; daysInFuture: number } {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const daysInFuture = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isViolation: daysInFuture > 0,
    daysInFuture
  };
}

/**
 * Evaluate a fraud rule against context
 */
export function evaluateFraudRule(
  rule: FraudRule,
  context: FraudCheckContext
): FraudResult {
  const reasons: string[] = [];
  let isFraud = false;

  switch (rule.detectionType) {
    case 'velocity': {
      const { count, windowSeconds } = rule.thresholds;
      if (count && windowSeconds && context.scanHistory) {
        const result = checkVelocity(count, windowSeconds, context.scanHistory);
        if (result.isViolation) {
          isFraud = true;
          reasons.push(`${rule.name}: ${result.count} actions in ${result.windowSeconds}s`);
        }
      }
      break;
    }

    case 'impossible_travel': {
      const { distanceKm } = rule.thresholds;
      const maxDistance = distanceKm || config.FRAUD.IMPOSSIBLE_TRAVEL_KM;
      const maxTime = config.FRAUD.IMPOSSIBLE_TRAVEL_HOURS;

      if (context.scanHistory && context.scanHistory.length >= 2) {
        const latest = context.scanHistory[context.scanHistory.length - 1];
        const previous = context.scanHistory[context.scanHistory.length - 2];

        if (latest.location && previous.location) {
          const result = checkImpossibleTravel(
            { ...previous.location, timestamp: previous.timestamp },
            { ...latest.location, timestamp: latest.timestamp },
            maxDistance,
            maxTime
          );

          if (result.isViolation) {
            isFraud = true;
            reasons.push(`${rule.name}: ${result.distanceKm}km in ${result.timeHours}h`);
          }
        }
      }
      break;
    }

    case 'pattern': {
      // Check for duplicate bills/images
      if (context.billHistory && rule.name.includes('Duplicate')) {
        const billId = context.event.data?.billId;
        const imageHash = context.event.data?.imageHash;

        if (billId) {
          const result = checkDuplicatePattern(
            billId,
            context.billHistory.map(h => ({ item: h.billId || h.item, timestamp: h.timestamp })),
            rule.thresholds.windowSeconds || 86400
          );

          if (result.isViolation) {
            isFraud = true;
            reasons.push(`${rule.name}: ${result.matchCount} duplicate(s) found`);
          }
        }
      }
      break;
    }

    case 'anomaly': {
      // Check for future dated bills
      if (rule.name.includes('Future') && context.bill?.date) {
        const result = checkFutureDate(new Date(context.bill.date));

        if (result.isViolation) {
          isFraud = true;
          reasons.push(`${rule.name}: Bill dated ${result.daysInFuture} days in future`);
        }
      }
      break;
    }

    case 'custom': {
      // Custom fraud detection logic would go here
      break;
    }
  }

  return {
    isFraud,
    riskScore: isFraud ? 1 : 0,
    triggeredRules: isFraud ? [rule.name] : [],
    action: isFraud ? rule.action.type : 'log',
    severity: rule.action.severity,
    reasons
  };
}

/**
 * Run all fraud checks against context
 */
export function runFraudChecks(
  context: FraudCheckContext,
  customRules?: FraudRule[]
): FraudResult {
  const rules = [...getActiveFraudRules(), ...(customRules || [])];
  const allResults: FraudResult[] = [];

  for (const rule of rules) {
    const result = evaluateFraudRule(rule, context);
    if (result.isFraud) {
      allResults.push(result);
    }
  }

  // If any fraud detected, return the most severe
  if (allResults.length > 0) {
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    allResults.sort((a, b) =>
      severityOrder.indexOf(a.severity || 'low') - severityOrder.indexOf(b.severity || 'low')
    );

    return {
      isFraud: true,
      riskScore: 1,
      triggeredRules: allResults.flatMap(r => r.triggeredRules),
      action: allResults[0].action,
      severity: allResults[0].severity,
      reasons: allResults.flatMap(r => r.reasons)
    };
  }

  return {
    isFraud: false,
    riskScore: 0,
    triggeredRules: [],
    action: 'log',
    reasons: []
  };
}

/**
 * Calculate risk score based on multiple factors
 */
export function calculateRiskScore(
  context: FraudCheckContext,
  fraudCheck: FraudResult
): number {
  let score = 0;

  // Base on fraud detection result
  if (fraudCheck.isFraud) {
    const severityWeights = { low: 0.3, medium: 0.5, high: 0.75, critical: 1.0 };
    score += severityWeights[fraudCheck.severity || 'low'] * 50;
  }

  // Check for bot user agent
  const userAgent = context.device?.userAgent || '';
  const botPatterns = /bot|crawl|spider|scraper/i;
  if (botPatterns.test(userAgent)) {
    score += 30;
  }

  // Check for suspicious device fingerprint
  if (!context.device?.fingerprint) {
    score += 10;
  }

  // Check for rapid location changes
  if (context.scanHistory && context.scanHistory.length >= 2) {
    const latest = context.scanHistory[context.scanHistory.length - 1];
    const previous = context.scanHistory[context.scanHistory.length - 2];

    if (latest.location && previous.location) {
      const { distanceKm } = checkImpossibleTravel(
        { ...previous.location, timestamp: previous.timestamp },
        { ...latest.location, timestamp: latest.timestamp },
        500,
        1
      );

      if (distanceKm > 100) {
        score += Math.min(20, distanceKm / 50);
      }
    }
  }

  return Math.min(100, score);
}

export default {
  checkVelocity,
  checkImpossibleTravel,
  checkDuplicatePattern,
  checkFutureDate,
  evaluateFraudRule,
  runFraudChecks,
  calculateRiskScore
};
