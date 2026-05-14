"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningService = void 0;
const feedback_1 = require("../models/feedback");
const rez_mind_1 = require("../integrations/rez-mind");
const logger_1 = require("../utils/logger");
class LearningService {
    statsCache = new Map();
    CACHE_TTL = 60000; // 1 minute
    /**
     * Calculate feedback statistics for a merchant
     */
    async getStats(merchantId, period = '7d') {
        const cacheKey = `${merchantId}:${period}`;
        const cached = this.statsCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.stats;
        }
        const periodMs = this.parsePeriod(period);
        const startTime = Date.now() - periodMs;
        const feedbacks = await feedback_1.FeedbackModel.find({
            merchant_id: merchantId,
            timestamp: { $gte: startTime }
        });
        const stats = this.calculateStats(feedbacks);
        this.statsCache.set(cacheKey, { stats, timestamp: Date.now() });
        return stats;
    }
    /**
     * Parse period string to milliseconds
     */
    parsePeriod(period) {
        const units = {
            '1h': 3600000,
            '24h': 86400000,
            '7d': 604800000,
            '30d': 2592000000,
            '90d': 7776000000
        };
        return units[period] || units['7d'];
    }
    /**
     * Calculate statistics from feedback array
     */
    calculateStats(feedbacks) {
        if (feedbacks.length === 0) {
            return {
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
        }
        const outcomeCounts = {
            approved: 0,
            rejected: 0,
            ignored: 0,
            failed: 0,
            edited: 0
        };
        let totalLatency = 0;
        let latencyCount = 0;
        let explicitCount = 0;
        let implicitCount = 0;
        let confidenceSum = 0;
        for (const feedback of feedbacks) {
            outcomeCounts[feedback.outcome]++;
            confidenceSum += feedback.confidence_score;
            if (feedback.latency_ms != null) {
                totalLatency += feedback.latency_ms;
                latencyCount++;
            }
            if (feedback.feedback_type === 'explicit') {
                explicitCount++;
            }
            else {
                implicitCount++;
            }
        }
        // Calculate accuracy score based on positive outcomes
        const positiveOutcomes = outcomeCounts.approved + outcomeCounts.edited;
        const accuracyScore = positiveOutcomes / feedbacks.length;
        return {
            total_actions: feedbacks.length,
            approved_count: outcomeCounts.approved,
            rejected_count: outcomeCounts.rejected,
            ignored_count: outcomeCounts.ignored,
            failed_count: outcomeCounts.failed,
            edited_count: outcomeCounts.edited,
            avg_latency: latencyCount > 0 ? totalLatency / latencyCount : 0,
            accuracy_score: Math.round(accuracyScore * 1000) / 1000,
            explicit_count: explicitCount,
            implicit_count: implicitCount,
            last_updated: Date.now()
        };
    }
    /**
     * Analyze feedback patterns for a merchant
     */
    async analyzePatterns(merchantId, eventType) {
        const periodMs = 7 * 24 * 3600000; // 7 days
        const startTime = Date.now() - periodMs;
        const query = {
            merchant_id: merchantId,
            timestamp: { $gte: startTime }
        };
        if (eventType) {
            query.event_type = eventType;
        }
        const feedbacks = await feedback_1.FeedbackModel.find(query);
        // Group by event type
        const grouped = new Map();
        for (const feedback of feedbacks) {
            const existing = grouped.get(feedback.event_type) || [];
            existing.push(feedback);
            grouped.set(feedback.event_type, existing);
        }
        // Generate patterns
        const patterns = [];
        for (const [event, eventFeedbacks] of grouped) {
            const pattern = this.generatePattern(merchantId, event, eventFeedbacks, startTime);
            patterns.push(pattern);
        }
        return patterns;
    }
    /**
     * Generate a feedback pattern from feedback data
     */
    generatePattern(merchantId, eventType, feedbacks, periodStart) {
        const outcomeDistribution = {};
        let totalLatency = 0;
        let latencyCount = 0;
        let confidenceSum = 0;
        for (const feedback of feedbacks) {
            outcomeDistribution[feedback.outcome] = (outcomeDistribution[feedback.outcome] || 0) + 1;
            confidenceSum += feedback.confidence_score;
            if (feedback.latency_ms != null) {
                totalLatency += feedback.latency_ms;
                latencyCount++;
            }
        }
        // Determine trend by comparing first half to second half
        const midPoint = feedbacks.length / 2;
        const firstHalf = feedbacks.slice(0, Math.floor(midPoint));
        const secondHalf = feedbacks.slice(Math.floor(midPoint));
        const firstHalfAccuracy = this.calculateAccuracy(firstHalf);
        const secondHalfAccuracy = this.calculateAccuracy(secondHalf);
        let trend = 'stable';
        const change = secondHalfAccuracy - firstHalfAccuracy;
        if (change > 0.05)
            trend = 'improving';
        else if (change < -0.05)
            trend = 'degrading';
        return {
            merchant_id: merchantId,
            event_type: eventType,
            outcome_distribution: outcomeDistribution,
            avg_confidence: confidenceSum / feedbacks.length,
            avg_latency: latencyCount > 0 ? totalLatency / latencyCount : 0,
            trend,
            sample_size: feedbacks.length,
            period_start: periodStart,
            period_end: Date.now()
        };
    }
    /**
     * Calculate accuracy from feedback array
     */
    calculateAccuracy(feedbacks) {
        if (feedbacks.length === 0)
            return 0;
        const positive = feedbacks.filter(f => f.outcome === 'approved' || f.outcome === 'edited').length;
        return positive / feedbacks.length;
    }
    /**
     * Detect drift in agent performance
     */
    async detectDrift(merchantId, threshold = 0.1) {
        const detections = [];
        // Compare last 24h to previous 24h
        const now = Date.now();
        const recentStart = now - 24 * 3600000;
        const previousStart = now - 48 * 3600000;
        const recentStats = await this.getStatsFromDb(merchantId, recentStart, now);
        const previousStats = await this.getStatsFromDb(merchantId, previousStart, recentStart);
        if (previousStats.total > 0) {
            // Check accuracy drift
            const accuracyDrift = Math.abs(recentStats.accuracy - previousStats.accuracy);
            if (accuracyDrift > threshold) {
                detections.push({
                    merchant_id: merchantId,
                    metric_name: 'accuracy_score',
                    previous_value: previousStats.accuracy,
                    current_value: recentStats.accuracy,
                    change_percent: (accuracyDrift / previousStats.accuracy) * 100,
                    severity: this.getSeverity(accuracyDrift),
                    detected_at: now
                });
            }
            // Check latency drift
            if (previousStats.avgLatency > 0) {
                const latencyDrift = Math.abs(recentStats.avgLatency - previousStats.avgLatency) / previousStats.avgLatency;
                if (latencyDrift > threshold) {
                    detections.push({
                        merchant_id: merchantId,
                        metric_name: 'avg_latency',
                        previous_value: previousStats.avgLatency,
                        current_value: recentStats.avgLatency,
                        change_percent: latencyDrift * 100,
                        severity: this.getSeverity(latencyDrift),
                        detected_at: now
                    });
                }
            }
            // Check approval rate drift
            const recentApproval = recentStats.approved / recentStats.total;
            const previousApproval = previousStats.approved / previousStats.total;
            const approvalDrift = Math.abs(recentApproval - previousApproval);
            if (approvalDrift > threshold) {
                detections.push({
                    merchant_id: merchantId,
                    metric_name: 'approval_rate',
                    previous_value: previousApproval,
                    current_value: recentApproval,
                    change_percent: approvalDrift * 100,
                    severity: this.getSeverity(approvalDrift),
                    detected_at: now
                });
            }
        }
        return detections;
    }
    /**
     * Get stats from database for a specific time range
     */
    async getStatsFromDb(merchantId, startTime, endTime) {
        const feedbacks = await feedback_1.FeedbackModel.find({
            merchant_id: merchantId,
            timestamp: { $gte: startTime, $lte: endTime }
        });
        if (feedbacks.length === 0) {
            return { total: 0, approved: 0, accuracy: 0, avgLatency: 0 };
        }
        const approved = feedbacks.filter(f => f.outcome === 'approved' || f.outcome === 'edited').length;
        const latencies = feedbacks.filter(f => f.latency_ms !== null).map(f => f.latency_ms);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        return {
            total: feedbacks.length,
            approved,
            accuracy: approved / feedbacks.length,
            avgLatency
        };
    }
    /**
     * Get severity based on drift amount
     */
    getSeverity(drift) {
        if (drift < 0.05)
            return 'none';
        if (drift < 0.1)
            return 'mild';
        if (drift < 0.2)
            return 'moderate';
        return 'severe';
    }
    /**
     * Generate learning insights
     */
    async generateInsights(merchantId, minSeverity = 'low') {
        const insights = [];
        const severityOrder = ['low', 'medium', 'high', 'critical'];
        const minIndex = severityOrder.indexOf(minSeverity);
        // Get merchants to analyze
        let merchants;
        if (merchantId) {
            merchants = [merchantId];
        }
        else {
            merchants = await feedback_1.FeedbackModel.distinct('merchant_id');
        }
        for (const mid of merchants) {
            // Detect drift
            const drifts = await this.detectDrift(mid, 0.05);
            for (const drift of drifts) {
                if (severityOrder.indexOf(drift.severity) >= minIndex) {
                    insights.push({
                        merchant_id: mid,
                        insight_type: 'drift',
                        severity: drift.severity,
                        title: `${drift.metric_name} drift detected`,
                        description: `${drift.metric_name} changed by ${drift.change_percent.toFixed(1)}%`,
                        metrics: {
                            previous: drift.previous_value,
                            current: drift.current_value,
                            change_percent: drift.change_percent
                        },
                        recommendations: this.getRecommendations(drift),
                        generated_at: Date.now()
                    });
                }
            }
            // Analyze patterns for anomalies
            const patterns = await this.analyzePatterns(mid);
            for (const pattern of patterns) {
                // Check for high rejection rate
                const rejectionRate = (pattern.outcome_distribution['rejected'] || 0) / pattern.sample_size;
                if (rejectionRate > 0.3) {
                    insights.push({
                        merchant_id: mid,
                        insight_type: 'anomaly',
                        severity: rejectionRate > 0.5 ? 'high' : 'medium',
                        title: `High rejection rate for ${pattern.event_type}`,
                        description: `${(rejectionRate * 100).toFixed(1)}% of actions were rejected`,
                        metrics: {
                            rejection_rate: rejectionRate,
                            sample_size: pattern.sample_size,
                            avg_confidence: pattern.avg_confidence
                        },
                        recommendations: [
                            'Review decision criteria for this event type',
                            'Consider retraining model on recent data',
                            'Check for environmental changes affecting outcomes'
                        ],
                        generated_at: Date.now()
                    });
                }
                // Check for degrading trends
                if (pattern.trend === 'degrading' && pattern.sample_size > 10) {
                    insights.push({
                        merchant_id: mid,
                        insight_type: 'pattern',
                        severity: 'medium',
                        title: `Performance degrading for ${pattern.event_type}`,
                        description: `Accuracy is declining over the analysis period`,
                        metrics: {
                            avg_confidence: pattern.avg_confidence,
                            sample_size: pattern.sample_size,
                            avg_latency: pattern.avg_latency
                        },
                        recommendations: [
                            'Investigate root cause of performance decline',
                            'Update model with recent successful examples',
                            'Consider A/B testing alternative strategies'
                        ],
                        generated_at: Date.now()
                    });
                }
            }
            // Send insights to ReZ Mind for model updates
            if (insights.length > 0) {
                try {
                    await rez_mind_1.rezMindClient.sendInsights(mid, insights);
                }
                catch (error) {
                    logger_1.logger.error('Failed to send insights to ReZ Mind', { error, merchantId: mid });
                }
            }
        }
        return insights;
    }
    /**
     * Get recommendations based on drift type
     */
    getRecommendations(drift) {
        switch (drift.metric_name) {
            case 'accuracy_score':
                return [
                    'Review recent decision changes',
                    'Analyze recent feedback for patterns',
                    'Consider model retraining with latest data'
                ];
            case 'avg_latency':
                return [
                    'Check infrastructure for bottlenecks',
                    'Review processing pipeline efficiency',
                    'Consider scaling resources'
                ];
            case 'approval_rate':
                return [
                    'Review decision thresholds',
                    'Analyze recent policy changes',
                    'Check for environmental factors'
                ];
            default:
                return [
                    'Investigate underlying causes',
                    'Monitor trend over time',
                    'Consider targeted retraining'
                ];
        }
    }
}
exports.learningService = new LearningService();
//# sourceMappingURL=learning.js.map