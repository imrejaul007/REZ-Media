/**
 * BAK-ADS-006 FIX: Redis-backed click fraud detection.
 *
 * Previously used an in-memory Map<string, CampaignClickMap> which:
 * - Lost all fraud data on service restart
 * - Was isolated per-instance in multi-pod deployments (flagged on pod A = unknown on pod B)
 *
 * Now uses Redis sorted sets for time-bucketed click tracking:
 * - User clicks: `ads:fraud:user:{campaignId}:{userId}` (score = timestamp)
 * - IP clicks:    `ads:fraud:ip:{campaignId}:{ip}`    (score = timestamp)
 * - Each click is a unique member (clickId) so repeated rapid clicks are counted correctly
 * - TTL on each key ensures automatic expiration (no manual cleanup needed)
 *
 * This is persistent across restarts and shared across all service instances.
 */
declare class ClickFraudService {
    private cleanupInterval;
    constructor();
    /**
     * Graceful shutdown — clears the periodic cleanup interval.
     */
    shutdown(): void;
    /**
     * Detect if a click is fraudulent based on multiple signals.
     * Checks are performed against Redis data, so they are consistent across restarts and instances.
     */
    detectFraudulentClick(campaignId: string, userId: string, ip: string, userAgent: string): Promise<{
        isFraud: boolean;
        reason?: string;
    }>;
    /**
     * Record a click for fraud analysis in Redis.
     * Uses a unique clickId member so multiple clicks at the same millisecond are all tracked.
     */
    recordClick(campaignId: string, userId: string, ip: string, userAgent: string): Promise<void>;
    /**
     * Get click statistics for a campaign from Redis.
     */
    getClickStats(campaignId: string): Promise<{
        totalClicks: number;
        fraudClicks: number;
        fraudRate: number;
        uniqueUsers: number;
        uniqueIPs: number;
    }>;
    /**
     * Check if user clicked same campaign within rapid click threshold.
     * Uses Redis ZCOUNT to count clicks within the threshold window.
     */
    private checkRapidClick;
    /**
     * Check if IP has clicked same campaign too many times recently.
     * Uses Redis ZCOUNT to count clicks within the flood window.
     */
    private checkIPFlooding;
    /**
     * Check if user agent matches known bot patterns.
     */
    private isKnownBot;
    /**
     * Cleanup old entries from Redis sorted sets.
     * Keys have TTL so this is mostly a no-op, but it handles
     * entries older than RECORD_TTL within each sorted set.
     */
    private cleanup;
}
export declare const clickFraudService: ClickFraudService;
export {};
//# sourceMappingURL=clickFraudService.d.ts.map