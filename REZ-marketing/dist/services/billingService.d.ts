/**
 * BillingService — handles ad campaign billing on impression/click events.
 *
 * Uses Redis for atomic daily spend tracking to enforce daily budget caps accurately
 * across service restarts. Falls back gracefully if Redis is unavailable.
 */
export declare class BillingService {
    /**
     * Charge a campaign for a single interaction (impression or click).
     * - CPC: charged on click events
     * - CPM: charged on impression events
     *
     * Before charging, checks:
     * 1. Daily budget cap (via Redis counter)
     * 2. Total budget cap (via MongoDB totalSpent)
     *
     * Returns null if the campaign is paused/completed or budget is exhausted.
     * Logs and skips on Redis failure (graceful degradation).
     */
    chargeCampaign(campaignId: string, eventType: 'CPC' | 'CPM', count?: number): Promise<number | null>;
    /**
     * Read the daily spend for a campaign from Redis.
     * Falls back to 0 if Redis is unavailable.
     *
     * Key format: `ads:daily:{campaignId}:{YYYY-MM-DD}`
     */
    getDailySpent(campaignId: string): Promise<number>;
    /**
     * Check if a campaign can still serve impressions/clicks based on daily budget.
     */
    canServe(campaignId: string): Promise<boolean>;
}
//# sourceMappingURL=billingService.d.ts.map