import { ITouchpoint, TouchpointType, Channel } from '../models/Touchpoint';
type LeanTouchpoint = Omit<ITouchpoint, 'save' | 'delete' | 'validate'>;
export interface CreateTouchpointDTO {
    userId: string;
    sessionId: string;
    type: TouchpointType;
    channel: Channel;
    campaignId?: string;
    adId?: string;
    creativeId?: string;
    merchantId?: string;
    storeId?: string;
    location?: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    deviceFingerprint?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    timestamp?: Date;
}
export interface TouchpointQueryOptions {
    userId?: string;
    merchantId?: string;
    campaignId?: string;
    storeId?: string;
    channel?: Channel;
    type?: TouchpointType;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    skip?: number;
}
export declare class TouchpointTracker {
    /**
     * Create a new touchpoint
     */
    createTouchpoint(data: CreateTouchpointDTO): Promise<ITouchpoint>;
    /**
     * Get touchpoints with filtering options
     */
    getTouchpoints(options: TouchpointQueryOptions): Promise<{
        touchpoints: LeanTouchpoint[];
        total: number;
    }>;
    /**
     * Get touchpoints for a user within a time window (for attribution)
     */
    getUserTouchpointsForAttribution(userId: string, conversionTimestamp: Date, lookbackDays: number): Promise<LeanTouchpoint[]>;
    /**
     * Get touchpoints by campaign
     */
    getCampaignTouchpoints(campaignId: string, startDate?: Date, endDate?: Date): Promise<LeanTouchpoint[]>;
    /**
     * Get touchpoints by merchant
     */
    getMerchantTouchpoints(merchantId: string, startDate?: Date, endDate?: Date): Promise<LeanTouchpoint[]>;
    /**
     * Get unique user count for a campaign
     */
    getCampaignUniqueUsers(campaignId: string, startDate?: Date, endDate?: Date): Promise<number>;
    /**
     * Get touchpoint statistics
     */
    getTouchpointStats(merchantId?: string, campaignId?: string, startDate?: Date, endDate?: Date): Promise<{
        total: number;
        byChannel: Record<string, number>;
        byType: Record<string, number>;
        uniqueUsers: number;
    }>;
    /**
     * Delete touchpoint by ID
     */
    deleteTouchpoint(touchpointId: string): Promise<boolean>;
    /**
     * Batch create touchpoints for efficiency
     */
    createTouchpointsBatch(data: CreateTouchpointDTO[]): Promise<ITouchpoint[]>;
}
export declare const touchpointTracker: TouchpointTracker;
export {};
//# sourceMappingURL=TouchpointTracker.d.ts.map