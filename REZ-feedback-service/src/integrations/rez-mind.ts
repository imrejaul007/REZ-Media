import { ActionFeedback, LearningInsight } from '../types';
import { logger } from '../utils/logger';

const REZ_MIND_URL = process.env.REZ_MIND_URL || 'http://localhost:4000';
const REZ_MIND_API_KEY = process.env.REZ_MIND_API_KEY || '';

interface MindResponse {
  success: boolean;
  recommendations?: any[];
  modelVersion?: string;
  insights?: any[];
}

interface AlertPayload {
  type: string;
  merchantId: string;
  eventType: string;
  metric: number;
  threshold: number;
}

class RezMindClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = REZ_MIND_URL;
    this.apiKey = REZ_MIND_API_KEY;
  }

  /**
   * Send feedback to ReZ Mind for model updates
   */
  async sendFeedback(feedback: ActionFeedback): Promise<MindResponse> {
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

      const data = await response.json() as MindResponse;
      logger.debug('Feedback sent to ReZ Mind', { actionId: feedback.action_id });

      return data;
    } catch (error) {
      logger.error('Failed to send feedback to ReZ Mind', {
        error: error instanceof Error ? error.message : 'Unknown error',
        actionId: feedback.action_id
      });
      throw error;
    }
  }

  /**
   * Send learning insights to ReZ Mind
   */
  async sendInsights(merchantId: string, insights: LearningInsight[]): Promise<void> {
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

      logger.debug('Insights sent to ReZ Mind', {
        merchantId,
        count: insights.length
      });
    } catch (error) {
      logger.error('Failed to send insights to ReZ Mind', {
        error: error instanceof Error ? error.message : 'Unknown error',
        merchantId
      });
    }
  }

  /**
   * Request updated recommendations from ReZ Mind
   */
  async getRecommendations(
    merchantId: string,
    eventType: string,
    context?: Record<string, any>
  ): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/recommendations/${merchantId}/${eventType}`,
        {
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
        }
      );

      if (!response.ok) {
        throw new Error(`ReZ Mind API error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      logger.error('Failed to get recommendations from ReZ Mind', {
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
  async sendAlert(alert: AlertPayload): Promise<void> {
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

      logger.info('Alert sent to ReZ Mind', {
        type: alert.type,
        merchantId: alert.merchantId
      });
    } catch (error) {
      logger.error('Failed to send alert to ReZ Mind', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Check if ReZ Mind is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Request model retraining
   */
  async requestRetraining(merchantId: string, reason: string): Promise<void> {
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

      logger.info('Retraining requested from ReZ Mind', { merchantId, reason });
    } catch (error) {
      logger.error('Failed to request retraining', {
        error: error instanceof Error ? error.message : 'Unknown error',
        merchantId
      });
    }
  }
}

export const rezMindClient = new RezMindClient();
