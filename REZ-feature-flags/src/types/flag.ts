import { z } from 'zod';

// Target rule for user targeting
export const TargetRuleSchema = z.object({
  attribute: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export type TargetRule = z.infer<typeof TargetRuleSchema>;

// Variation configuration
export const VariationSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.union([z.boolean(), z.string(), z.number(), z.record(z.unknown())]),
  weight: z.number().min(0).max(100).default(0),
});

export type Variation = z.infer<typeof VariationSchema>;

// Feature flag schema
export const FeatureFlagSchema = z.object({
  key: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  enabled: z.boolean().default(true),
  environment: z.enum(['development', 'staging', 'production']).default('production'),
  variations: z.array(VariationSchema).min(1),
  defaultVariation: z.string(),
  targeting: z.object({
    enabled: z.boolean().default(false),
    rules: z.array(z.object({
      id: z.string(),
      priority: z.number().min(0),
      conditions: z.array(z.object({
        attribute: z.string(),
        operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'regex']),
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
      })),
      variationId: z.string(),
    })).default([]),
  }).default({ enabled: false, rules: [] }),
  percentageRollout: z.object({
    enabled: z.boolean().default(false),
    percentage: z.number().min(0).max(100).default(0),
    seed: z.string().optional(),
  }).default({ enabled: false, percentage: 0 }),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

// User context for flag evaluation
export interface UserContext {
  id: string;
  attributes?: Record<string, unknown>;
}

// Flag evaluation result
export interface FlagEvaluation {
  flagKey: string;
  enabled: boolean;
  variation: Variation | null;
  reason: 'default' | 'percentage' | 'targeting' | 'disabled' | 'error';
  reasonDetails?: string;
}

// Analytics event
export interface FlagAnalyticsEvent {
  flagKey: string;
  userId: string;
  variationId: string | null;
  enabled: boolean;
  reason: string;
  timestamp: Date;
  environment: string;
  metadata?: Record<string, unknown>;
}

// Flag statistics
export interface FlagStats {
  flagKey: string;
  environment: string;
  totalEvaluations: number;
  enabledCount: number;
  disabledCount: number;
  variations: Record<string, number>;
  last24hEvaluations: number;
  last7dEvaluations: number;
}
