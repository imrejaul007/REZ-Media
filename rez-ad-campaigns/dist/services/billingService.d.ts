/**
 * BillingService — handles ad campaign billing on impression/click events.
 *
 * Charging logic:
 *   - CPM (cost per mille): charge bidAmount / 1000 per impression
 *   - CPC (cost per click): charge bidAmount per click
 *
 * Budget enforcement:
 *   - totalBudget: if totalSpent >= totalBudget → mark campaign 'completed'
 *   - dailyBudget: if daily spend >= dailyBudget → mark campaign 'paused'
 *     (a scheduled job should unpause daily-paused campaigns at midnight)
 *
 * This service is called from interactionRoutes.ts after recording the interaction.
 * The serve.ts routes use inline MongoDB aggregation pipelines for atomic billing;
 * this service provides the same logic for the legacy interaction endpoints.
 */
declare class BillingService {
    /**
     * Charge a campaign for an ad event (impression or click).
     *
     * Calculates the charge amount based on bidType, applies it to totalSpent,
     * then checks both total and daily budget limits.
     *
     * BAK-ADS-001/003 FIX: Accepts bidType ('CPC'|'CPM') instead of eventType.
     * The old signature accepted eventType ('click'|'impression') and compared it
     * against bidType ('CPC'|'CPM') — different enum values that never matched,
     * causing ALL charges to return 0. Now callers pass the campaign's bidType
     * directly, so calculateCharge can correctly match.
     *
     * @param campaignId - The AdCampaign _id
     * @param bidType    - 'CPC' or 'CPM' (from the campaign's bidType field)
     * @param eventType  - 'impression' or 'click' (the event that triggered billing)
     * @returns Object indicating whether the campaign was paused/completed, or null on error
     */
    chargeCampaign(campaignId: string, bidType: 'CPC' | 'CPM', eventType: 'impression' | 'click'): Promise<{
        charged: number;
        campaignStatus: string;
    } | null>;
    /**
     * Calculate the charge amount for a given event type and bid type.
     *
     * - CPC campaigns: charged bidAmount per click (impressions are free)
     * - CPM campaigns: charged bidAmount/1000 per impression (clicks are free)
     *
     * BAK-ADS-001/003 FIX: bidType is now passed directly by the caller (not read from
     * the campaign object internally) so the comparison is between two values of the same
     * type ('CPC' vs 'CPC', 'CPM' vs 'CPM'). Previously, eventType was passed by the caller
     * and compared against bidType internally — mismatched types always returned 0.
     */
    private calculateCharge;
    /**
     * Read the daily spend for a campaign from Redis.
     * Falls back to an in-memory Map if Redis is unavailable.
     *
     * Key format: `ads:daily:{campaignId}:{YYYY-MM-DD}`
     * The key is incremented atomically in `chargeCampaign` via `incrbyfloat`.
     */
    private getDailySpent;
}
export declare const billingService: BillingService;
export {};
//# sourceMappingURL=billingService.d.ts.map