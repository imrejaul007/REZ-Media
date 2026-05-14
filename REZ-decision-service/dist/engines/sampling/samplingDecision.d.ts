/**
 * SAMPLING DECISION ENGINE
 * Decides WHO gets coins, HOW MUCH, WHICH type, WHEN
 */
export interface SamplingDecision {
    eligible: boolean;
    reason: string;
    coinAmount: number;
    coinType: 'try' | 'brand';
    brandId?: string;
    timing: {
        sendNow: boolean;
        waitMinutes?: number;
        bestTime?: string;
    };
    priority: number;
}
export interface SamplingContext {
    userId: string;
    campaignId: string;
    merchantId?: string;
    location?: {
        lat: number;
        lng: number;
    };
    time?: Date;
}
export interface CampaignConfig {
    coinType: 'try' | 'brand';
    brandCoinId?: string;
    minCoins: number;
    maxCoins: number;
    targeting?: {
        segments?: string[];
        maxPerUser?: number;
        cooldownMinutes?: number;
    };
}
export declare class SamplingScoringEngine {
    /**
     * Calculate user's eligibility and score for a campaign
     */
    score(context: SamplingContext, config: CampaignConfig): Promise<{
        score: number;
        eligible: boolean;
        reason: string;
    }>;
    /**
     * Check if user is fatigued
     */
    private checkFatigue;
    /**
     * Get user affinity to merchant category (0-1)
     */
    private getUserAffinity;
    /**
     * Get user stage (NEW, WARM, HOT)
     */
    private getUserStage;
    /**
     * Get time score based on time of day
     */
    private getTimeScore;
    /**
     * Get merchant inventory level (0-1)
     */
    private getInventoryLevel;
}
export declare class CoinAllocationEngine {
    /**
     * Calculate optimal coin amount
     */
    calculate(config: CampaignConfig, score: number): number;
    /**
     * Determine coin type
     */
    determineCoinType(config: CampaignConfig, context: SamplingContext): 'try' | 'brand';
}
export declare class TimingEngine {
    /**
     * Decide when to send
     */
    decide(context: SamplingContext, score: number): {
        sendNow: boolean;
        waitMinutes?: number;
        bestTime?: string;
    };
    private getNextBestTime;
    private getBestTimeLabel;
}
export declare function makeSamplingDecision(context: SamplingContext, config: CampaignConfig): Promise<SamplingDecision>;
