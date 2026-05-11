/**
 * Default Fraud Detection Rules
 *
 * Built-in fraud rules consolidated from existing services
 */

import { FraudRule } from '../types';

export const DEFAULT_FRAUD_RULES: FraudRule[] = [
  // === RAPID SCANNING ===
  {
    name: 'Rapid Scanning Detection',
    description: 'Flag users scanning QR codes too rapidly',
    detectionType: 'velocity',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'qr.scanned' }
    ],
    thresholds: {
      count: 10,
      windowSeconds: 30,
    },
    action: {
      type: 'flag',
      severity: 'medium',
    },
    isActive: true,
    priority: 10,
  },

  // === IP FLOODING ===
  {
    name: 'IP Flooding Detection',
    description: 'Block IP addresses making too many requests',
    detectionType: 'velocity',
    conditions: [
      { field: 'event.eventType', operator: 'in', value: ['qr.scanned', 'transaction.completed'] }
    ],
    thresholds: {
      count: 10,
      windowSeconds: 3600, // 1 hour
    },
    action: {
      type: 'block',
      severity: 'high',
    },
    isActive: true,
    priority: 20,
  },

  // === IMPOSSIBLE TRAVEL ===
  {
    name: 'Impossible Travel Detection',
    description: 'Block users scanning in different cities within impossible timeframe',
    detectionType: 'impossible_travel',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'qr.scanned' }
    ],
    thresholds: {
      distanceKm: 500,
      windowSeconds: 3600, // 1 hour
    },
    action: {
      type: 'block',
      severity: 'critical',
    },
    isActive: true,
    priority: 30,
  },

  // === DUPLICATE BILL UPLOAD ===
  {
    name: 'Duplicate Bill Upload',
    description: 'Challenge users uploading the same bill twice',
    detectionType: 'pattern',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'bill.uploaded' }
    ],
    thresholds: {
      count: 2,
      windowSeconds: 86400, // 24 hours
    },
    action: {
      type: 'challenge',
      severity: 'high',
    },
    isActive: true,
    priority: 15,
  },

  // === DUPLICATE IMAGE ===
  {
    name: 'Duplicate Image Detection',
    description: 'Block users uploading identical bill images',
    detectionType: 'pattern',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'bill.uploaded' }
    ],
    thresholds: {
      count: 2,
      windowSeconds: 86400,
    },
    action: {
      type: 'block',
      severity: 'high',
    },
    isActive: true,
    priority: 25,
  },

  // === HIGH FREQUENCY UPLOADS ===
  {
    name: 'High Frequency Bill Uploads',
    description: 'Flag users uploading too many bills',
    detectionType: 'velocity',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'bill.uploaded' }
    ],
    thresholds: {
      count: 5,
      windowSeconds: 3600, // 1 hour
    },
    action: {
      type: 'flag',
      severity: 'medium',
    },
    isActive: true,
    priority: 12,
  },

  // === FUTURE DATED BILL ===
  {
    name: 'Future Dated Bill',
    description: 'Block bills with dates in the future',
    detectionType: 'anomaly',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'bill.uploaded' }
    ],
    thresholds: {
      // Date check happens in the validation logic
    },
    action: {
      type: 'block',
      severity: 'high',
    },
    isActive: true,
    priority: 35,
  },

  // === REFERRAL LOOP ===
  {
    name: 'Referral Loop Detection',
    description: 'Flag suspicious referral patterns',
    detectionType: 'pattern',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'referral.completed' }
    ],
    thresholds: {
      count: 5,
      windowSeconds: 604800, // 7 days
    },
    action: {
      type: 'flag',
      severity: 'medium',
    },
    isActive: true,
    priority: 18,
  },

  // === VELOCITY SPIKE ===
  {
    name: 'Velocity Spike Detection',
    description: 'Detect sudden spike in activity',
    detectionType: 'anomaly',
    conditions: [
      { field: 'event.eventType', operator: 'in', value: ['qr.scanned', 'transaction.completed'] }
    ],
    thresholds: {
      // Uses statistical anomaly detection
    },
    action: {
      type: 'flag',
      severity: 'medium',
    },
    isActive: true,
    priority: 14,
  },

  // === BOT PATTERN ===
  {
    name: 'Bot Pattern Detection',
    description: 'Detect automated/bot behavior via user agent',
    detectionType: 'pattern',
    conditions: [
      { field: 'event.eventType', operator: 'eq', value: 'qr.scanned' }
    ],
    thresholds: {
      score: 0.8, // ML score threshold
    },
    action: {
      type: 'flag',
      severity: 'medium',
    },
    isActive: true,
    priority: 16,
  },
];

/**
 * Get active fraud rules
 */
export function getActiveFraudRules(): FraudRule[] {
  return DEFAULT_FRAUD_RULES.filter(rule => rule.isActive);
}

/**
 * Get fraud rule by name
 */
export function getFraudRuleByName(name: string): FraudRule | undefined {
  return DEFAULT_FRAUD_RULES.find(rule => rule.name === name);
}

export default DEFAULT_FRAUD_RULES;
