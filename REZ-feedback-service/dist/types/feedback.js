"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackSchema = void 0;
// Validation schemas
exports.FeedbackSchema = {
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
//# sourceMappingURL=feedback.js.map