/**
 * Get campaign by ID with cache-aside pattern.
 * First checks Redis cache, falls back to MongoDB on cache miss.
 */
export declare function getCampaignById(campaignId: string, options?: {
    populate?: string[];
}): Promise<any | null>;
/**
 * Get multiple campaigns by IDs with caching.
 */
export declare function getCampaignsByIds(campaignIds: string[], options?: {
    populate?: string[];
}): Promise<any[]>;
/**
 * Invalidate campaign cache after updates.
 */
export declare function invalidateCampaignCache(campaignId: string): Promise<void>;
/**
 * Update campaign with automatic cache invalidation.
 */
export declare function updateCampaign(campaignId: string, updateData: Record<string, any>, options?: {
    populate?: string[];
}): Promise<any | null>;
//# sourceMappingURL=campaignService.d.ts.map