export interface ActionFeedback {
    action_id: string;
    outcome: 'approved' | 'rejected' | 'ignored' | 'failed' | 'edited';
    latency_ms?: number | null;
    confidence_score: number;
    feedback_type: 'explicit' | 'implicit';
    merchant_id: string;
    event_type: string;
    decision_made: string;
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
export declare const FeedbackSchema: {
    action_id: {
        type: string;
        required: boolean;
    };
    outcome: {
        type: string;
        values: string[];
        required: boolean;
    };
    latency_ms: {
        type: string;
        required: boolean;
        nullable: boolean;
    };
    confidence_score: {
        type: string;
        min: number;
        max: number;
        required: boolean;
    };
    feedback_type: {
        type: string;
        values: string[];
        required: boolean;
    };
    merchant_id: {
        type: string;
        required: boolean;
    };
    event_type: {
        type: string;
        required: boolean;
    };
    decision_made: {
        type: string;
        required: boolean;
    };
    original_value: {
        type: string;
        required: boolean;
    };
    edited_value: {
        type: string;
        required: boolean;
    };
    timestamp: {
        type: string;
        required: boolean;
    };
};
//# sourceMappingURL=feedback.d.ts.map