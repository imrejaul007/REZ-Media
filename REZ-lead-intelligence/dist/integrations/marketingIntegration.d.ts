/**
 * Marketing Service Integration (FIXED)
 * Connects Lead Intelligence to Marketing campaigns
 *
 * Features:
 * - Sync hot leads to WhatsApp campaigns
 * - Sync warm leads to push campaigns
 * - Sync cold leads to email campaigns
 * - Auto-trigger based on lead temperature
 * - Personalize offers based on lead score
 *
 * FIXES APPLIED (Agent 16):
 * - Added x-internal-token to all internal service calls
 * - Added retry logic with exponential backoff
 * - Added circuit breaker pattern
 * - Added timeouts to all service calls
 * - Added correlation IDs for tracing
 * - Added event persistence queue
 * - Standardized error handling
 */
import { LeadScore } from '../types';
declare const circuitState: {
    marketing: {
        failures: number;
        state: "CLOSED" | "OPEN" | "HALF_OPEN";
        lastFailure: number;
    };
    notification: {
        failures: number;
        state: "CLOSED" | "OPEN" | "HALF_OPEN";
        lastFailure: number;
    };
};
export interface CampaignResult {
    success: boolean;
    campaignId?: string;
    leadsProcessed: number;
    errors: string[];
}
export interface PersonalizedOffer {
    offerText: string;
    discount: number;
    coins: number;
    productRecommendation: string;
}
export interface SyncResult {
    hotLeads: CampaignResult;
    warmLeads: CampaignResult;
    coldLeads: CampaignResult;
    totalProcessed: number;
    totalErrors: number;
    timestamp: Date;
}
export interface CrossServiceError {
    service: string;
    message: string;
    statusCode?: number;
    retryable: boolean;
    correlationId?: string;
    originalError?: Error;
}
export declare class MarketingIntegration {
    private marketingClient;
    private notificationClient;
    constructor();
    /**
     * Get circuit breaker status for health checks
     */
    getCircuitBreakerStatus(): {
        marketing: typeof circuitState.marketing;
        notification: typeof circuitState.notification;
    };
    /**
     * Get queued events count
     */
    getQueuedEventsCount(): number;
    /**
     * Flush event queue to services
     */
    flushEventQueues(): Promise<void>;
    /**
     * Sync all leads to marketing campaigns
     * Creates separate campaigns for hot, warm, and cold leads
     */
    syncLeadsToMarketing(): Promise<SyncResult>;
    /**
     * Create campaign for a specific segment
     */
    createCampaignForSegment(segment: 'hot' | 'warm' | 'cold', leads: LeadScore[]): Promise<CampaignResult>;
    /**
     * Sync all lead data for personalization
     */
    private syncAllLeadData;
    /**
     * Get personalized offer for a lead based on their score
     */
    getPersonalizedOffer(userId: string): Promise<PersonalizedOffer>;
    /**
     * Trigger re-engagement based on lead temperature
     * Routes to appropriate channel: WhatsApp (hot), Push (warm), Email (cold)
     */
    triggerReEngagement(userId: string, reason: string): Promise<void>;
    /**
     * Send urgent WhatsApp message to hot lead
     */
    sendWhatsAppUrgent(userId: string, reason: string, offer?: PersonalizedOffer): Promise<boolean>;
    /**
     * Send push notification to warm lead
     */
    sendPushNotification(userId: string, reason: string, offer?: PersonalizedOffer): Promise<boolean>;
    /**
     * Send email discovery campaign to cold lead
     */
    sendEmailDiscovery(userId: string, reason: string, offer?: PersonalizedOffer): Promise<boolean>;
    /**
     * Get lead score for a user (convenience method)
     */
    getLeadScore(userId: string): Promise<LeadScore>;
    /**
     * Detect hot leads (convenience method)
     */
    detectHotLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
    /**
     * Detect warm leads (convenience method)
     */
    detectWarmLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
    /**
     * Detect cold leads (convenience method)
     */
    detectColdLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
}
export declare const marketingIntegration: MarketingIntegration;
export default marketingIntegration;
//# sourceMappingURL=marketingIntegration.d.ts.map