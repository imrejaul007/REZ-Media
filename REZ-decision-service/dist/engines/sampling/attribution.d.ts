/**
 * ATTRIBUTION TRACKER
 * Phase 3: Full funnel tracking - Scan → Visit → Redeem → Purchase → Repeat
 * Credits campaigns accurately across multi-touch user journeys
 */
export declare const ATTRIBUTION_WEIGHTS: Record<AttributionEventType, number>;
export type AttributionModel = 'first-touch' | 'last-touch' | 'linear' | 'time-decay';
export type AttributionEventType = 'scan' | 'visit' | 'redeem' | 'purchase' | 'repeat';
export interface AttributionEvent {
    userId: string;
    campaignId: string;
    merchantId: string;
    event: AttributionEventType;
    timestamp: Date;
    value?: number;
    metadata?: Record<string, any>;
}
export interface AttributionResult {
    campaignId: string;
    userId: string;
    creditedCampaign: string;
    creditedAmount: number;
    weight: number;
    window: string;
}
export interface CampaignAttributionConfig {
    attributionModel: AttributionModel;
    windowDays: number;
    weights?: Partial<Record<AttributionEventType, number>>;
}
export interface AttributionQuery {
    userId: string;
    campaignId?: string;
    merchantId?: string;
    startDate?: Date;
    endDate?: Date;
    model?: AttributionModel;
}
export interface AttributionSummary {
    userId: string;
    totalEvents: number;
    campaigns: Record<string, CampaignAttributionSummary>;
    funnelStats: FunnelStats;
}
interface CampaignAttributionSummary {
    events: number;
    totalValue: number;
    attributedValue: number;
    firstTouch: Date | null;
    lastTouch: Date | null;
    touchpoints: AttributionEvent[];
}
interface FunnelStats {
    scans: number;
    visits: number;
    redeems: number;
    purchases: number;
    repeats: number;
    conversionRates: {
        scanToVisit: number;
        visitToRedeem: number;
        redeemToPurchase: number;
        purchaseToRepeat: number;
    };
}
export declare class AttributionTracker {
    /**
     * Track an attribution event
     * Stores in Redis with TTL for window management
     */
    trackEvent(event: AttributionEvent): Promise<{
        success: boolean;
        eventId: string;
        error?: string;
    }>;
    /**
     * Calculate attribution for a conversion event
     */
    calculateAttribution(userId: string, conversionCampaignId: string, conversionValue: number, conversionEvent: AttributionEventType, model?: AttributionModel): Promise<AttributionResult[]>;
    /**
     * First Touch Attribution - credit goes to first touchpoint
     */
    private calculateFirstTouchAttribution;
    /**
     * Last Touch Attribution - credit goes to most recent touchpoint
     */
    private calculateLastTouchAttribution;
    /**
     * Linear Attribution - split credit equally among all touchpoints
     */
    private calculateLinearAttribution;
    /**
     * Time Decay Attribution - recent touchpoints get more credit
     */
    private calculateTimeDecayAttribution;
    /**
     * Get all events for a user within the attribution window
     */
    getUserEventsInWindow(userId: string, campaignId?: string, windowDays?: number): Promise<AttributionEvent[]>;
    /**
     * Get attribution summary for a user
     */
    getAttributionSummary(userId: string, windowDays?: number): Promise<AttributionSummary>;
    /**
     * Get campaign attribution data
     */
    getCampaignAttribution(campaignId: string): Promise<{
        totalEvents: number;
        uniqueUsers: number;
        totalValue: number;
        attributedValue: number;
        eventBreakdown: Record<AttributionEventType, number>;
    }>;
    /**
     * Query attribution data with filters
     */
    queryAttribution(query: AttributionQuery): Promise<AttributionSummary[]>;
    /**
     * Calculate TTL based on window days
     */
    private calculateTTL;
    /**
     * Update campaign statistics
     */
    private updateCampaignStats;
    /**
     * Update funnel statistics for user
     */
    private updateFunnelStats;
    /**
     * Track attribution window for a user-campaign pair
     */
    private trackAttributionWindow;
    /**
     * Get all campaign keys for a user
     */
    private getUserCampaignKeys;
    /**
     * Clear expired attribution data (cleanup job)
     */
    clearExpiredData(): Promise<{
        cleared: number;
    }>;
    /**
     * Record a conversion and attribute it
     */
    recordConversion(userId: string, campaignId: string, merchantId: string, conversionType: 'redeem' | 'purchase' | 'repeat', value: number, model?: AttributionModel): Promise<AttributionResult[]>;
}
export declare const attributionTracker: AttributionTracker;
/**
 * Quick track scan event
 */
export declare function trackScan(userId: string, campaignId: string, merchantId: string, metadata?: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Quick track visit event
 */
export declare function trackVisit(userId: string, campaignId: string, merchantId: string, metadata?: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Quick track redeem event
 */
export declare function trackRedeem(userId: string, campaignId: string, merchantId: string, value?: number, metadata?: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Quick track purchase event
 */
export declare function trackPurchase(userId: string, campaignId: string, merchantId: string, amount: number, metadata?: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Quick track repeat customer event
 */
export declare function trackRepeat(userId: string, campaignId: string, merchantId: string, metadata?: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
    error?: string;
}>;
/**
 * Get attribution summary for a user
 */
export declare function getUserAttributionSummary(userId: string, windowDays?: number): Promise<AttributionSummary>;
/**
 * Calculate attribution for a conversion
 */
export declare function attributeConversion(userId: string, campaignId: string, conversionValue: number, model?: AttributionModel): Promise<AttributionResult[]>;
export {};
