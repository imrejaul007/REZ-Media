import { IAudienceFilter } from '../models/MarketingCampaign';
export interface AudienceRecord {
    userId: string;
    phone?: string;
    email?: string;
    firstName?: string;
    pushTokens?: string[];
    hasAppInstalled?: boolean;
    smsOptIn?: boolean;
    pushOptIn?: boolean;
    emailOptIn?: boolean;
    whatsappOptIn?: boolean;
}
export declare class AudienceBuilder {
    /**
     * Estimate audience size without loading full data.
     * Used by the UI to show "~1,200 customers will receive this" before launch.
     * Uses a count query rather than loading IDs into memory.
     */
    estimate(merchantId: string, filter: IAudienceFilter): Promise<number>;
    /**
     * Resolve full audience as paginated batches using a cursor-based approach.
     * Streams user IDs in batches from MongoDB — never loads the full set into memory.
     */
    buildAudience(merchantId: string, filter: IAudienceFilter, channel: string): AsyncGenerator<AudienceRecord[]>;
    /**
     * Count distinct user IDs matching the filter without loading into memory.
     */
    private countUserIds;
    /**
     * Stream user IDs in batches using MongoDB cursor pagination.
     * Yields arrays of up to BATCH_SIZE ObjectIds at a time — O(1) memory.
     */
    private resolveUserIdsBatched;
    private resolveUserIds;
    private countSnapshotSegment;
    private resolveSnapshotSegmentBatched;
    private resolveSnapshotSegment;
    /**
     * MRS-H7: Apply a date filter to the 'all' segment so that only customers
     * with recent activity (updated within 90 days) are included. This prevents
     * campaigns from broadcasting to lapsed/inactive users who should not receive
     * notifications. Other segments already have their own implicit date semantics.
     */
    private buildSegmentDateFilter;
    private countLocation;
    private resolveLocationBatched;
    private resolveLocation;
    private getLocationUserIds;
    private countInterest;
    private resolveInterestBatched;
    private resolveInterest;
    private getInterestUserIds;
    private countBirthday;
    private resolveBirthdayBatched;
    private resolveBirthday;
    private getBirthdayUserIds;
    private countPurchaseHistory;
    private resolvePurchaseHistoryBatched;
    private resolvePurchaseHistory;
    private getPurchaseHistoryUserIds;
    private countInstitution;
    private resolveInstitutionBatched;
    private resolveInstitution;
    private getInstitutionUserIds;
    private countKeyword;
    private resolveKeywordBatched;
    private resolveKeyword;
    private getKeywordUserIds;
    private countCustom;
    private resolveCustomBatched;
    private resolveCustom;
    private getCustomUserIds;
    /** Recursively removes any key that begins with '$' at any nesting depth to prevent operator injection. */
    private sanitizeMongoFilter;
    private intersectWithMerchantCustomers;
    /**
     * Batched intersection — streams matching userIds from the merchant snapshot
     * using a MongoDB cursor with O(BATCH_SIZE) memory overhead per batch (MRS-H6).
     */
    private intersectMerchantCustomersBatched;
    private countIntersectWithMerchantCustomers;
}
export declare const audienceBuilder: AudienceBuilder;
export default audienceBuilder;
//# sourceMappingURL=AudienceBuilder.d.ts.map