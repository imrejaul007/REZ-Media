"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rezMindClient = void 0;
const logger_1 = require("../utils/logger");
const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4000';
const REZ_MIND_API_KEY = process.env.REZ_MIND_API_KEY || '';
class RezMindClient {
    baseUrl;
    apiKey;
    constructor() {
        this.baseUrl = REZ_MIND_URL;
        this.apiKey = REZ_MIND_API_KEY;
    }
    /**
     * Send feedback to ReZ Mind for model updates
     */
    async sendFeedback(feedback) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Service': 'rez-feedback-service'
                },
                body: JSON.stringify({
                    action_id: feedback.action_id,
                    outcome: feedback.outcome,
                    confidence_score: feedback.confidence_score,
                    feedback_type: feedback.feedback_type,
                    merchant_id: feedback.merchant_id,
                    event_type: feedback.event_type,
                    decision_made: feedback.decision_made,
                    latency_ms: feedback.latency_ms,
                    original_value: feedback.original_value,
                    edited_value: feedback.edited_value,
                    timestamp: feedback.timestamp
                })
            });
            if (!response.ok) {
                throw new Error(`ReZ Mind API error: ${response.status}`);
            }
            const data = await response.json();
            logger_1.logger.debug('Feedback sent to ReZ Mind', { actionId: feedback.action_id });
            return data;
        }
        catch (error) {
            logger_1.logger.error('Failed to send feedback to ReZ Mind', {
                error: error instanceof Error ? error.message : 'Unknown error',
                actionId: feedback.action_id
            });
            throw error;
        }
    }
    /**
     * Send learning insights to ReZ Mind
     */
    async sendInsights(merchantId, insights) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/insights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Service': 'rez-feedback-service'
                },
                body: JSON.stringify({
                    merchant_id: merchantId,
                    insights,
                    source: 'feedback-service',
                    timestamp: Date.now()
                })
            });
            if (!response.ok) {
                throw new Error(`ReZ Mind API error: ${response.status}`);
            }
            logger_1.logger.debug('Insights sent to ReZ Mind', {
                merchantId,
                count: insights.length
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send insights to ReZ Mind', {
                error: error instanceof Error ? error.message : 'Unknown error',
                merchantId
            });
        }
    }
    /**
     * Request updated recommendations from ReZ Mind
     */
    async getRecommendations(merchantId, eventType, context) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/recommendations/${merchantId}/${eventType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Service': 'rez-feedback-service'
                },
                body: JSON.stringify({
                    context: context || {},
                    timestamp: Date.now()
                })
            });
            if (!response.ok) {
                throw new Error(`ReZ Mind API error: ${response.status}`);
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            logger_1.logger.error('Failed to get recommendations from ReZ Mind', {
                error: error instanceof Error ? error.message : 'Unknown error',
                merchantId,
                eventType
            });
            throw error;
        }
    }
    /**
     * Send alert to ReZ Mind
     */
    async sendAlert(alert) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/alerts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Service': 'rez-feedback-service'
                },
                body: JSON.stringify({
                    ...alert,
                    source: 'feedback-service',
                    timestamp: Date.now()
                })
            });
            if (!response.ok) {
                throw new Error(`ReZ Mind API error: ${response.status}`);
            }
            logger_1.logger.info('Alert sent to ReZ Mind', {
                type: alert.type,
                merchantId: alert.merchantId
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send alert to ReZ Mind', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    /**
     * Check if ReZ Mind is available
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * Request model retraining
     */
    async requestRetraining(merchantId, reason) {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/training/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'X-Service': 'rez-feedback-service'
                },
                body: JSON.stringify({
                    merchant_id: merchantId,
                    reason,
                    source: 'feedback-service',
                    timestamp: Date.now()
                })
            });
            if (!response.ok) {
                throw new Error(`ReZ Mind API error: ${response.status}`);
            }
            logger_1.logger.info('Retraining requested from ReZ Mind', { merchantId, reason });
        }
        catch (error) {
            logger_1.logger.error('Failed to request retraining', {
                error: error instanceof Error ? error.message : 'Unknown error',
                merchantId
            });
        }
    }
}
exports.rezMindClient = new RezMindClient();
//# sourceMappingURL=rez-mind.js.map