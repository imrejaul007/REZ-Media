import { ActionFeedback, LearningInsight } from '../types';
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
declare class RezMindClient {
    private baseUrl;
    private apiKey;
    constructor();
    /**
     * Send feedback to ReZ Mind for model updates
     */
    sendFeedback(feedback: ActionFeedback): Promise<MindResponse>;
    /**
     * Send learning insights to ReZ Mind
     */
    sendInsights(merchantId: string, insights: LearningInsight[]): Promise<void>;
    /**
     * Request updated recommendations from ReZ Mind
     */
    getRecommendations(merchantId: string, eventType: string, context?: Record<string, any>): Promise<any>;
    /**
     * Send alert to ReZ Mind
     */
    sendAlert(alert: AlertPayload): Promise<void>;
    /**
     * Check if ReZ Mind is available
     */
    healthCheck(): Promise<boolean>;
    /**
     * Request model retraining
     */
    requestRetraining(merchantId: string, reason: string): Promise<void>;
}
export declare const rezMindClient: RezMindClient;
export {};
//# sourceMappingURL=rez-mind.d.ts.map