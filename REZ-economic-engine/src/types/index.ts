/**
 * ReZ Economic Engine - Core Types
 *
 * Single source of truth for all business logic types
 * Canonical CoinType values must match: packages/shared-types/src/schemas/wallet.schema.ts
 */

// ============================================
// COIN TYPES
// ============================================

// Canonical coin types - must match @rez/shared-types COIN_TYPE (6 values)
export enum CoinType {
  REZ = 'rez',
  BRANDED = 'branded',
  CASHBACK = 'cashback',
  PROMO = 'promo',
  PRIVE = 'prive',
  REFERRAL = 'referral',
  // NOTE: 'loyalty' is NOT canonical - use PROMO or REZ for loyalty programs
}

export interface CoinExpiry {
  coinType: CoinType;
  expiresInDays: number;
}

export const COIN_EXPIRY_RULES: Record<CoinType, number> = {
  [CoinType.REZ]: 0,          // Never expires
  [CoinType.BRANDED]: 180,     // 6 months
  [CoinType.CASHBACK]: 365,    // 1 year
  [CoinType.PROMO]: 90,        // 3 months
  [CoinType.PRIVE]: 365,       // 1 year
  [CoinType.REFERRAL]: 180     // 6 months
};

// ============================================
// KARMA TYPES (300-900 Score System)
// ============================================

export interface KarmaComponents {
  base: number;           // Always 300
  impact: number;         // 0-250
  relativeRank: number;   // 0-180
  trust: number;         // 0-100
  momentum: number;      // 0-70
}

export interface KarmaTier {
  name: string;
  color: string;
  minScore: number;
  maxScore: number;
  benefits: string[];
}

export const KARMA_TIERS: KarmaTier[] = [
  { name: 'Starter', color: '#9CA3AF', minScore: 300, maxScore: 499, benefits: [] },
  { name: 'Active', color: '#10B981', minScore: 500, maxScore: 649, benefits: ['Basic rewards'] },
  { name: 'Performer', color: '#3B82F6', minScore: 650, maxScore: 749, benefits: ['Enhanced rewards'] },
  { name: 'Leader', color: '#8B5CF6', minScore: 750, maxScore: 819, benefits: ['Premium rewards', 'Early access'] },
  { name: 'Elite', color: '#F59E0B', minScore: 820, maxScore: 879, benefits: ['VIP rewards', 'Exclusive events'] },
  { name: 'Legend', color: '#EF4444', minScore: 880, maxScore: 899, benefits: ['Legendary perks'] },
  { name: 'Pinnacle', color: '#FFD700', minScore: 900, maxScore: 900, benefits: ['Invitation-only', 'Max prestige'] }
];

export interface KarmaScore {
  userId: string;
  total: number;           // 300-900
  components: KarmaComponents;
  tier: KarmaTier;
  percentile: number;
  dailyChange: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
}

// ============================================
// BUSINESS RULE TYPES
// ============================================

export type RuleType =
  | 'commission'
  | 'cashback'
  | 'reward'
  | 'karma'
  | 'loyalty'
  | 'fraud_check'
  | 'rate_limit';

export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'between'
  | 'contains'
  | 'regex'
  | 'exists';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
  valueTo?: any;
}

export type ActionType =
  | 'credit_coin'
  | 'debit_coin'
  | 'credit_karma'
  | 'set_karma_multiplier'
  | 'apply_cashback'
  | 'apply_commission'
  | 'apply_discount'
  | 'update_loyalty_tier'
  | 'trigger_webhook'
  | 'send_notification'
  | 'log_event'
  | 'fraud_alert';

export interface RuleAction {
  actionType: ActionType;
  order: number;
  params: {
    coinType?: CoinType;
    amount?: number | 'calculated';
    formula?: string;
    source?: string;
    expiresIn?: number;
    karmaPoints?: number | 'calculated';
    karmaMultiplier?: number;
    cashbackPercent?: number;
    maxCashback?: number;
    minAmount?: number;
    description?: string;
    tags?: string[];
    [key: string]: any;
  };
  postActions?: RuleAction[];
}

export type ConflictStrategy =
  | 'FIRST'
  | 'HIGHEST'
  | 'CUMULATIVE'
  | 'REJECT'
  | 'LOWEST'
  | 'AVERAGE'
  | 'WEIGHTED'
  | 'CUSTOM';

export interface BusinessRule {
  _id?: string;
  ruleType: RuleType;
  category: string;
  subCategory?: string;
  conditions: RuleCondition[];
  conditionLogic: 'AND' | 'OR';
  actions: RuleAction[];
  actionLogic: 'SEQUENTIAL' | 'PARALLEL';
  priority: number;
  conflictStrategy: ConflictStrategy;
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================
// FRAUD TYPES
// ============================================

export type FraudDetectionType =
  | 'velocity'
  | 'pattern'
  | 'impossible_travel'
  | 'anomaly'
  | 'custom';

export type FraudActionType =
  | 'block'
  | 'flag'
  | 'challenge'
  | 'notify'
  | 'log';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudThresholds {
  count?: number;
  windowSeconds?: number;
  distanceKm?: number;
  score?: number;
}

export interface FraudRule {
  _id?: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  detectionType: FraudDetectionType;
  thresholds: FraudThresholds;
  action: {
    type: FraudActionType;
    severity: FraudSeverity;
    cooldownSeconds?: number;
  };
  isActive: boolean;
  priority: number;
}

export interface FraudResult {
  isFraud: boolean;
  riskScore: number;
  triggeredRules: string[];
  action: FraudActionType;
  severity?: FraudSeverity;
  reasons: string[];
}

// ============================================
// EVENT TYPES
// ============================================

export type ReZEventType =
  | 'qr.scanned'
  | 'qr.verified'
  | 'qr.fraud_detected'
  | 'transaction.completed'
  | 'transaction.refunded'
  | 'transaction.failed'
  | 'reward.earned'
  | 'reward.redeemed'
  | 'reward.expired'
  | 'karma.earned'
  | 'karma.converted'
  | 'cashback.applied'
  | 'commission.calculated';

export interface ReZEvent {
  _id?: string;
  eventId: string;
  eventType: ReZEventType;
  source: string;
  sourceId?: string;
  userId?: string;
  merchantId?: string;
  storeId?: string;
  transactionId?: string;
  data: Record<string, any>;
  metadata: {
    timestamp: Date;
    correlationId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processedAt?: Date;
  error?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  matched: boolean;
  actionsTriggered: RuleAction[];
  calculatedValues: Record<string, number>;
}

export interface RewardCalculationResult {
  coinType: CoinType;
  baseAmount: number;
  karmaMultiplier: number;
  finalAmount: number;
}

export interface CashbackCalculationResult {
  billAmount: number;
  cashbackPercent: number;
  cashbackAmount: number;
  maxCashback?: number;
}

export interface KarmaCalculationResult {
  karmaEarned: number;
  newKarmaTotal: number;
  tier: KarmaTier;
  conversionRate: number;
  rewardMultiplier: number;
}
