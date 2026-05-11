export interface ActionFeedback {
  action_id: string;
  outcome: 'approved' | 'rejected' | 'ignored' | 'failed' | 'edited';
  latency_ms?: number | null;
  confidence_score: number;
  feedback_type: 'explicit' | 'implicit';

  // Context
  merchant_id: string;
  event_type: string;
  decision_made: string;

  // Edit tracking (if edited)
  original_value?: unknown;
  edited_value?: unknown;

  timestamp: number;
}

export interface FeedbackStats {
  total_actions: number;
  approved_count: number;
  rejected_count: number;
  ignored_count: number;
  failed_count: number;
  edited_count: number;
  avg_latency: number;
  accuracy_score: number;
  explicit_count: number;
  implicit_count: number;
  last_updated: number;
}

export interface LearningInsight {
  merchant_id: string;
  insight_type: 'pattern' | 'drift' | 'recommendation' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  metrics: Record<string, number>;
  recommendations: string[];
  generated_at: number;
}

export interface FeedbackPattern {
  merchant_id: string;
  event_type: string;
  outcome_distribution: Record<string, number>;
  avg_confidence: number;
  avg_latency: number;
  trend: 'improving' | 'stable' | 'degrading';
  sample_size: number;
  period_start: number;
  period_end: number;
}

export interface DriftDetection {
  merchant_id: string;
  metric_name: string;
  previous_value: number;
  current_value: number;
  change_percent: number;
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  detected_at: number;
}

// Validation schemas
export const FeedbackSchema = {
  action_id: { type: 'string', required: true },
  outcome: {
    type: 'enum',
    values: ['approved', 'rejected', 'ignored', 'failed', 'edited'],
    required: true
  },
  latency_ms: { type: 'number', required: false, nullable: true },
  confidence_score: { type: 'number', min: 0, max: 1, required: true },
  feedback_type: {
    type: 'enum',
    values: ['explicit', 'implicit'],
    required: true
  },
  merchant_id: { type: 'string', required: true },
  event_type: { type: 'string', required: true },
  decision_made: { type: 'string', required: true },
  original_value: { type: 'any', required: false },
  edited_value: { type: 'any', required: false },
  timestamp: { type: 'number', required: true }
};
