/**
 * Re-engagement Service for REZ Ads Service
 *
 * Handles scheduling and tracking of re-targeting notifications:
 * - Users who viewed an ad but didn't click (24h delay)
 * - Users who clicked but didn't convert (48h delay)
 *
 * Uses Redis for:
 * - Tracking scheduled notifications (dedup)
 * - Storing user-ad interaction state for conversion tracking
 * - Processing batches of users for re-engagement
 */
/**
 * Schedule re-target notification for user who viewed but didn't click
 * Called after an impression is recorded
 */
export declare function scheduleRetargetView(userId: string, adId: string, merchantId: string): Promise<void>;
/**
 * Schedule follow-up notification for user who clicked but didn't convert
 * Called after a click is recorded
 */
export declare function scheduleFollowupClick(userId: string, adId: string, merchantId: string): Promise<void>;
/**
 * Mark user as having converted (no longer eligible for re-engagement)
 * Called when an order attribution is recorded
 */
export declare function markUserConverted(userId: string, adId: string): Promise<void>;
/**
 * Process interaction to trigger re-engagement flows
 * Call this after recording an impression or click
 */
export declare function processInteractionForReengagement(userId: string, adId: string, interactionType: 'impression' | 'click'): Promise<void>;
/**
 * Check and update spend metrics, triggering alerts if needed
 * Call this after each impression/click that updates spend
 */
export declare function processSpendUpdate(merchantId: string, adId: string, adTitle: string, dailyBudget: number, totalBudget: number, totalSpent: number): Promise<void>;
/**
 * Check for engagement spikes in an ad
 * Call this periodically (e.g., every hour) via a scheduler
 */
export declare function checkEngagementSpikes(): Promise<void>;
/**
 * Start the re-engagement scheduler worker
 * Processes periodic tasks like engagement spike checks
 */
export declare function startReengagementScheduler(): Promise<void>;
/**
 * Stop the re-engagement scheduler
 */
export declare function stopReengagementScheduler(): Promise<void>;
//# sourceMappingURL=reEngagementService.d.ts.map