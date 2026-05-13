// Trigger Types
export type TriggerType = 'signup' | 'purchase' | 'churn_risk' | 'custom' | 'schedule';

// Action Types
export type ActionType = 'email' | 'SMS' | 'push' | 'delay' | 'condition' | 'webhook';

// Condition Operators
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';

// Journey Status
export type JourneyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

// Step Status
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

// Entry Status
export type EntryStatus = 'entered' | 'in_progress' | 'completed' | 'exited' | 'failed';

// Analytics Event Types
export type AnalyticsEventType = 'step_entered' | 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'action_sent' | 'action_failed';

// A/B Test Variants
export type ABVariant = 'A' | 'B' | 'C' | 'D';

// Condition Definition
export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string | number | string[] | number[];
}

// Action Configuration
export interface ActionConfig {
  type: ActionType;
  // Email config
  emailTemplate?: string;
  emailSubject?: string;
  emailFrom?: string;
  // SMS config
  smsTemplate?: string;
  smsFrom?: string;
  // Push config
  pushTitle?: string;
  pushBody?: string;
  pushData?: Record<string, unknown>;
  // Delay config
  delayDuration?: number; // milliseconds
  delayUnit?: 'seconds' | 'minutes' | 'hours' | 'days';
  // Webhook config
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  webhookHeaders?: Record<string, string>;
  webhookBody?: Record<string, unknown>;
  // Condition config
  conditions?: Condition[];
  trueSteps?: string[]; // Step IDs for true branch
  falseSteps?: string[]; // Step IDs for false branch
}

// Step Analytics
export interface StepAnalytics {
  stepId: string;
  entered: number;
  started: number;
  completed: number;
  failed: number;
  skipped: number;
  avgTimeToComplete: number; // milliseconds
  conversionRate: number; // percentage
  lastUpdated: Date;
}

// A/B Test Configuration
export interface ABTestConfig {
  enabled: boolean;
  variants: {
    variant: ABVariant;
    weight: number; // 0-100, should sum to 100
    stepIds: string[];
  }[];
}

// Journey Template
export interface JourneyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  journey: Omit<Journey, 'id' | 'name' | 'status' | 'createdAt' | 'updatedAt' | 'analytics' | 'entries'>;
}

// Trigger Configuration
export interface TriggerConfig {
  type: TriggerType;
  conditions?: Condition[];
  schedule?: {
    cron: string;
    timezone: string;
  };
  customEvent?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Analytics Summary
export interface JourneyAnalyticsSummary {
  journeyId: string;
  totalEntries: number;
  activeEntries: number;
  completedEntries: number;
  failedEntries: number;
  conversionRate: number;
  avgCompletionTime: number;
  stepAnalytics: StepAnalytics[];
  abTestResults?: {
    variant: ABVariant;
    entries: number;
    conversions: number;
    conversionRate: number;
  }[];
  lastUpdated: Date;
}

// Worker Event
export interface WorkerEvent {
  id: string;
  entryId: string;
  journeyId: string;
  stepId: string;
  action: 'process' | 'retry' | 'complete' | 'fail';
  timestamp: Date;
  data?: Record<string, unknown>;
}

// ==================== AI-Check Types ====================

/**
 * AI-Check types for intelligent journey decisions
 */
export type AICheckType =
  | 'lead_score'
  | 'purchase_probability'
  | 'churn_risk'
  | 'upsell_eligibility'
  | 'channel_preference'
  | 'custom';

/**
 * AI model options
 */
export type AIModel = 'gpt-4o' | 'claude';

/**
 * AI-Check node configuration
 */
export interface AICheckConfig {
  type: 'ai_check';
  checkType: AICheckType;
  model: AIModel;
  prompt?: string; // Custom prompt for 'custom' type
  threshold: number; // Pass if score >= threshold
  trueLabel: string; // Edge label for pass
  falseLabel: string; // Edge label for fail
  trueNextStepId?: string;
  falseNextStepId?: string;
  outputVariable?: string; // Store score in variable
}

/**
 * AI-Check result
 */
export interface AICheckResult {
  stepId: string;
  checkType: AICheckType;
  score: number; // 0-1 for probability, 0-100 for score types
  passed: boolean;
  reasoning: string;
  confidence: number;
  model: AIModel;
  evaluatedAt: Date;
  evaluationTimeMs: number;
  variables?: Record<string, unknown>; // Variables to store
}

/**
 * AI-Check evaluation context
 */
export interface AICheckContext {
  contactData: Record<string, unknown>;
  journeyData?: Record<string, unknown>;
  entryData?: Record<string, unknown>;
  historicalData?: {
    recentSearches?: string[];
    abandonedCarts?: Array<{ items: string[]; value: number }>;
    views?: string[];
    purchases?: Array<{ items: string[]; total: number; date: Date }>;
    supportTickets?: number;
    lastActivity?: Date;
    engagementScore?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * AI-Check step analytics
 */
export interface AICheckAnalytics {
  stepId: string;
  totalEvaluations: number;
  passCount: number;
  failCount: number;
  passRate: number;
  avgScore: number;
  avgEvaluationTimeMs: number;
  lastEvaluated?: Date;
}

/**
 * Built-in check type configurations
 */
export interface BuiltInCheckConfig {
  checkType: AICheckType;
  name: string;
  description: string;
  defaultThreshold: number;
  variableMapping: Record<string, string>; // Maps AI output to contact/journey variables
}

/**
 * Available built-in checks
 */
export const BUILT_IN_CHECKS: BuiltInCheckConfig[] = [
  {
    checkType: 'lead_score',
    name: 'Lead Score',
    description: 'Evaluates lead quality based on activity, engagement, and intent signals',
    defaultThreshold: 75,
    variableMapping: {
      score: 'lead_score',
      quality: 'lead_quality',
      signals: 'lead_signals',
    },
  },
  {
    checkType: 'purchase_probability',
    name: 'Purchase Probability',
    description: 'Predicts likelihood of purchase based on behavior and history',
    defaultThreshold: 0.6,
    variableMapping: {
      probability: 'purchase_probability',
      urgency: 'purchase_urgency',
      intent: 'purchase_intent',
    },
  },
  {
    checkType: 'churn_risk',
    name: 'Churn Risk',
    description: 'Identifies customers at risk of churning based on engagement patterns',
    defaultThreshold: 0.7,
    variableMapping: {
      risk: 'churn_risk',
      factors: 'churn_factors',
      recency: 'engagement_recency',
    },
  },
  {
    checkType: 'upsell_eligibility',
    name: 'Upsell Eligibility',
    description: 'Determines if customer is a good candidate for upselling',
    defaultThreshold: 0.5,
    variableMapping: {
      eligible: 'upsell_eligible',
      tier: 'customer_tier',
      cartValue: 'current_cart_value',
      potential: 'upsell_potential',
    },
  },
  {
    checkType: 'channel_preference',
    name: 'Channel Preference',
    description: 'Predicts optimal communication channel based on user behavior',
    defaultThreshold: 0.5,
    variableMapping: {
      preferred: 'preferred_channel',
      confidence: 'channel_confidence',
      fallback: 'fallback_channel',
    },
  },
];

/**
 * AI-Check test result for debugging
 */
export interface AICheckTestResult {
  checkType: AICheckType;
  model: AIModel;
  testData: AICheckContext;
  result: AICheckResult;
  rawResponse?: string;
}
