/**
 * AUTO-CAMPAIGN ENGINE
 * Phase 3 - AI Campaign Manager
 *
 * Automatically suggests and creates campaigns based on signals:
 * - High inventory signals from merchants
 * - Low conversion signals
 * - Dormant user signals
 * - Location-based signals
 * - Time-based signals (lunch/dinner)
 * - Event signals (festivals/seasonal)
 */
export type SignalType = 'inventory_excess' | 'dormant_users' | 'nearby_location' | 'time_based' | 'event';
export interface CampaignSignal {
    type: SignalType;
    merchantId?: string;
    userId?: string;
    location?: {
        lat: number;
        lng: number;
    };
    strength: number;
    recommendation: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}
export interface AutoCampaign {
    id: string;
    merchantId: string;
    type: SignalType;
    status: 'suggested' | 'approved' | 'active' | 'paused' | 'completed';
    suggestedCoins: number;
    suggestedBudget: number;
    suggestedTargeting: string[];
    reason: string;
    autoLaunch: boolean;
    targetUserIds?: string[];
    locationRadius?: number;
    startDate?: Date;
    endDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface SignalConfig {
    inventoryThreshold?: number;
    dormancyDays?: number;
    locationRadiusMeters?: number;
    minSignalStrength?: number;
    autoLaunchThreshold?: number;
}
export interface CampaignPerformance {
    campaignId: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    coinsSpent: number;
    revenue: number;
    roi: number;
}
export declare class SignalDetectionEngine {
    /**
     * Detect all signal types and return active signals
     */
    detectSignals(context: {
        merchantId?: string;
        userId?: string;
        location?: {
            lat: number;
            lng: number;
        };
        time?: Date;
    }): Promise<CampaignSignal[]>;
    /**
     * Detect high inventory signal
     */
    detectInventoryExcess(merchantId: string): Promise<CampaignSignal | null>;
    /**
     * Detect dormant users signal (users not active recently)
     */
    detectDormantUsers(merchantId: string): Promise<CampaignSignal | null>;
    /**
     * Detect nearby location signal (user near merchant)
     */
    detectNearbyLocation(userId: string, location: {
        lat: number;
        lng: number;
    }): Promise<CampaignSignal | null>;
    /**
     * Detect time-based signal (meal times, weekends)
     */
    detectTimeBased(time: Date): CampaignSignal | null;
    /**
     * Detect event/festival signal
     */
    detectEventSignal(time: Date): CampaignSignal | null;
    /**
     * Find merchants near a location
     */
    private findNearbyMerchants;
    /**
     * Calculate distance between two points (Haversine formula)
     */
    private calculateDistance;
    private toRad;
    /**
     * Get user's preference score for a merchant's category
     */
    private getUserPreferenceScore;
}
export declare class CampaignSuggestionEngine {
    /**
     * Generate campaign suggestions based on signals
     */
    suggestCampaigns(signals: CampaignSignal[], config?: SignalConfig): Promise<AutoCampaign[]>;
    /**
     * Group signals by merchant
     */
    private groupSignalsByMerchant;
    /**
     * Calculate combined signal strength
     */
    private calculateCombinedStrength;
    /**
     * Generate targeting criteria based on signals
     */
    private generateTargetingCriteria;
    /**
     * Calculate optimal coin amount and budget
     */
    private calculateOptimalSpend;
    /**
     * Get the strongest signal from a list
     */
    private getStrongestSignal;
    /**
     * Determine primary signal type
     */
    private determinePrimarySignalType;
    /**
     * Generate campaign reason
     */
    private generateCampaignReason;
    /**
     * Extract target user IDs from signals
     */
    private extractTargetUserIds;
    /**
     * Determine location radius for targeting
     */
    private determineLocationRadius;
    /**
     * Calculate campaign end date
     */
    private calculateEndDate;
}
export declare class AutoLaunchEngine {
    /**
     * Determine if campaign should auto-launch
     */
    shouldAutoLaunch(campaign: AutoCampaign, signals: CampaignSignal[]): boolean;
    /**
     * Check if signals represent a trusted pattern
     */
    private isTrustedPattern;
    /**
     * Execute auto-launch
     */
    launchCampaign(campaign: AutoCampaign): Promise<{
        success: boolean;
        campaignId: string;
        error?: string;
    }>;
    /**
     * Queue campaign for user distribution
     */
    private queueCampaignDistribution;
}
export declare class CampaignPerformanceTracker {
    /**
     * Record campaign impression
     */
    recordImpression(campaignId: string, userId: string): Promise<void>;
    /**
     * Record campaign conversion
     */
    recordConversion(campaignId: string, userId: string, coinsUsed: number, revenue: number): Promise<void>;
    /**
     * Get campaign performance metrics
     */
    getPerformance(campaignId: string): Promise<CampaignPerformance | null>;
    /**
     * Get top performing campaigns
     */
    getTopPerformingCampaigns(limit?: number): Promise<CampaignPerformance[]>;
}
export declare class AutoCampaignEngine {
    private signalDetection;
    private suggestion;
    private autoLaunch;
    private performance;
    constructor();
    /**
     * Main entry point: process signals and create campaigns
     */
    processSignals(context: {
        merchantId?: string;
        userId?: string;
        location?: {
            lat: number;
            lng: number;
        };
        time?: Date;
        config?: SignalConfig;
    }): Promise<{
        signals: CampaignSignal[];
        campaigns: AutoCampaign[];
        launched: AutoCampaign[];
        errors: string[];
    }>;
    /**
     * Store signals for historical analysis
     */
    private storeSignals;
    /**
     * Get active campaigns for a merchant
     */
    getMerchantCampaigns(merchantId: string): Promise<AutoCampaign[]>;
    /**
     * Get signal history
     */
    getSignalHistory(signalType: SignalType, startTime: Date, endTime: Date): Promise<CampaignSignal[]>;
    /**
     * Update campaign status
     */
    updateCampaignStatus(campaignId: string, status: AutoCampaign['status']): Promise<boolean>;
}
export declare const autoCampaignEngine: AutoCampaignEngine;
export declare const signalDetectionEngine: SignalDetectionEngine;
export declare const campaignSuggestionEngine: CampaignSuggestionEngine;
export declare const autoLaunchEngine: AutoLaunchEngine;
export declare const campaignPerformanceTracker: CampaignPerformanceTracker;
