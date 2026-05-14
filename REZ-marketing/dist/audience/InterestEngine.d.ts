export declare class InterestEngine {
    private retryQueue;
    /**
     * Rebuild interest profile for a single user.
     * Queries their last 180 days of orders.
     */
    rebuildForUser(userId: string): Promise<void>;
    /**
     * Rebuild for all users who have placed orders in the last N days.
     * Used by interestSyncWorker for nightly bulk rebuild.
     * Returns { processed, errors } counts.
     *
     * BAK-MKT-008 FIX: Failed user rebuilds are now enqueued to a retry queue
     * (mkt-interest-retry) with up to 3 attempts and 30s backoff. After all
     * retries are exhausted, the job moves to the dead-letter queue (DLQ) for
     * manual inspection. Previously, failed rebuilds were silently skipped with
     * no retry and no DLQ, leaving user profiles stale indefinitely.
     */
    rebuildBatch(sinceDays?: number): Promise<{
        processed: number;
        errors: number;
        retried: number;
    }>;
    /**
     * Update location signals for a user from their order delivery address.
     * Called when a new order is placed.
     */
    updateLocationFromOrder(userId: string, address: {
        city?: string;
        area?: string;
        pincode?: string;
        coordinates?: [number, number];
    }): Promise<void>;
    /**
     * Record a keyword search from the REZ consumer app.
     * Called via API when user performs a search.
     */
    recordSearch(userId: string, term: string): Promise<void>;
}
export declare const interestEngine: InterestEngine;
export default interestEngine;
//# sourceMappingURL=InterestEngine.d.ts.map