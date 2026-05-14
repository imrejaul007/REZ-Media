/**
 * Lead Intelligence Service
 * Core business logic for lead scoring, detection, and re-engagement
 */
import { LeadScore, AbandonedSearch, AbandonedCart, RecommendedChannel, ChannelScore, ReEngagementResult } from '../types';
export declare class LeadIntelligenceService {
    private rezMind;
    private marketing;
    private notifications;
    constructor();
    /**
     * Calculate comprehensive lead score for a user
     */
    getLeadScore(userId: string): Promise<LeadScore>;
    /**
     * Calculate signals from user activity
     */
    private calculateSignals;
    /**
     * Calculate intent strength based on search behavior
     */
    private calculateIntentStrength;
    /**
     * Predict purchase probability using ML model or heuristic fallback
     */
    private predictPurchaseProbability;
    /**
     * Heuristic-based purchase probability calculation
     */
    private heuristicPurchaseProbability;
    /**
     * Score recent searches (0-100)
     */
    private scoreRecentSearches;
    /**
     * Score abandoned carts (0-100)
     */
    private scoreAbandonedCarts;
    /**
     * Score viewed products (0-100)
     */
    private scoreViewedProducts;
    /**
     * Score last active hours (0-100, recent = higher)
     */
    private scoreLastActive;
    /**
     * Determine temperature based on score
     */
    private determineTemperature;
    /**
     * Save lead score to database
     */
    private saveLeadScore;
    /**
     * Detect all hot leads
     */
    detectHotLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
    /**
     * Detect all warm leads
     */
    detectWarmLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
    /**
     * Detect all cold leads
     */
    detectColdLeads(options?: {
        limit?: number;
        offset?: number;
    }): Promise<LeadScore[]>;
    /**
     * Track an abandoned cart
     */
    trackAbandonedCart(userId: string, cartId: string, items: AbandonedCart['items'], totalValue: number): Promise<AbandonedCart>;
    /**
     * Get all abandoned carts for a user
     */
    getAbandonedCarts(userId: string): Promise<AbandonedCart[]>;
    /**
     * Mark cart as recovered
     */
    markCartRecovered(cartId: string): Promise<void>;
    /**
     * Track an abandoned search
     */
    trackAbandonedSearch(userId: string, query: string, resultsShown: string[], notClicked: string[], intentDetected?: string, urgencyLevel?: AbandonedSearch['urgencyLevel']): Promise<AbandonedSearch>;
    /**
     * Get all abandoned searches for a user
     */
    getAbandonedSearches(userId: string): Promise<AbandonedSearch[]>;
    /**
     * Mark search as re-engaged
     */
    markSearchReEngaged(searchId: string): Promise<void>;
    /**
     * Get recommended channel for user
     */
    getRecommendedChannel(userId: string): Promise<RecommendedChannel>;
    /**
     * Get channel scores for user
     */
    getChannelScores(userId: string): Promise<ChannelScore[]>;
    /**
     * Trigger re-engagement for a user
     */
    triggerReEngagement(userId: string): Promise<ReEngagementResult>;
    /**
     * Generate personalized re-engagement message
     */
    private generateReEngagementMessage;
    /**
     * Get action type based on temperature
     */
    private getActionType;
    /**
     * Get minimum re-engagement interval based on temperature
     */
    private getMinIntervalForTemperature;
    /**
     * Update user activity cache
     */
    private updateUserActivityCache;
    /**
     * Track user activity
     */
    trackUserActivity(userId: string, activityType: 'search' | 'view' | 'cart', data: Record<string, unknown>): Promise<void>;
    /**
     * Process all hot leads for re-engagement
     */
    processHotLeadsBatch(): Promise<{
        processed: number;
        successful: number;
    }>;
    /**
     * Process abandoned carts for recovery
     */
    processAbandonedCartsBatch(): Promise<{
        processed: number;
        recovered: number;
    }>;
}
export declare const leadIntelligenceService: LeadIntelligenceService;
export default leadIntelligenceService;
//# sourceMappingURL=LeadIntelligenceService.d.ts.map