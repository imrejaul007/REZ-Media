"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
describe('Feedback Types', () => {
    describe('ActionFeedback', () => {
        it('should accept valid explicit feedback', () => {
            const feedback = {
                action_id: 'action_123',
                outcome: 'approved',
                latency_ms: 150,
                confidence_score: 0.95,
                feedback_type: 'explicit',
                merchant_id: 'merchant_456',
                event_type: 'risk_decision',
                decision_made: 'approve',
                timestamp: Date.now()
            };
            expect(feedback.action_id).toBe('action_123');
            expect(feedback.outcome).toBe('approved');
            expect(feedback.feedback_type).toBe('explicit');
        });
        it('should accept valid implicit feedback', () => {
            const feedback = {
                action_id: 'action_456',
                outcome: 'rejected',
                latency_ms: null,
                confidence_score: 0.3,
                feedback_type: 'implicit',
                merchant_id: 'merchant_456',
                event_type: 'risk_decision',
                decision_made: 'reject',
                timestamp: Date.now()
            };
            expect(feedback.outcome).toBe('rejected');
            expect(feedback.feedback_type).toBe('implicit');
            expect(feedback.latency_ms).toBeNull();
        });
        it('should track edited feedback with original and edited values', () => {
            const feedback = {
                action_id: 'action_789',
                outcome: 'edited',
                latency_ms: 200,
                confidence_score: 0.7,
                feedback_type: 'explicit',
                merchant_id: 'merchant_456',
                event_type: 'risk_decision',
                decision_made: 'modify',
                original_value: { risk_score: 0.8 },
                edited_value: { risk_score: 0.5 },
                timestamp: Date.now()
            };
            expect(feedback.outcome).toBe('edited');
            expect(feedback.original_value).toEqual({ risk_score: 0.8 });
            expect(feedback.edited_value).toEqual({ risk_score: 0.5 });
        });
        it('should support all outcome types', () => {
            const outcomes = [
                'approved',
                'rejected',
                'ignored',
                'failed',
                'edited'
            ];
            for (const outcome of outcomes) {
                const feedback = {
                    action_id: `action_${outcome}`,
                    outcome,
                    latency_ms: 100,
                    confidence_score: 0.5,
                    feedback_type: 'implicit',
                    merchant_id: 'merchant_456',
                    event_type: 'risk_decision',
                    decision_made: 'test',
                    timestamp: Date.now()
                };
                expect(feedback.outcome).toBe(outcome);
            }
        });
    });
    describe('FeedbackStats', () => {
        it('should have all required fields', () => {
            const stats = {
                total_actions: 1000,
                approved_count: 750,
                rejected_count: 100,
                ignored_count: 50,
                failed_count: 20,
                edited_count: 80,
                avg_latency: 145.5,
                accuracy_score: 0.83,
                explicit_count: 200,
                implicit_count: 800,
                last_updated: Date.now()
            };
            expect(stats.total_actions).toBe(1000);
            expect(stats.accuracy_score).toBe(0.83);
            expect(stats.avg_latency).toBe(145.5);
        });
        it('should handle zero values', () => {
            const stats = {
                total_actions: 0,
                approved_count: 0,
                rejected_count: 0,
                ignored_count: 0,
                failed_count: 0,
                edited_count: 0,
                avg_latency: 0,
                accuracy_score: 0,
                explicit_count: 0,
                implicit_count: 0,
                last_updated: Date.now()
            };
            expect(stats.total_actions).toBe(0);
            expect(stats.accuracy_score).toBe(0);
        });
    });
    describe('LearningInsight', () => {
        it('should support all insight types', () => {
            const insightTypes = [
                'pattern',
                'drift',
                'recommendation',
                'anomaly'
            ];
            const severityLevels = [
                'low',
                'medium',
                'high',
                'critical'
            ];
            for (const type of insightTypes) {
                for (const severity of severityLevels) {
                    const insight = {
                        merchant_id: 'merchant_456',
                        insight_type: type,
                        severity,
                        title: `${type} insight`,
                        description: `Test ${severity} severity ${type}`,
                        metrics: { test: 1.0 },
                        recommendations: ['Test recommendation'],
                        generated_at: Date.now()
                    };
                    expect(insight.insight_type).toBe(type);
                    expect(insight.severity).toBe(severity);
                }
            }
        });
    });
});
//# sourceMappingURL=feedback.test.js.map