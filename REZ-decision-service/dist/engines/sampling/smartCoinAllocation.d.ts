/**
 * SMART COIN ALLOCATION ENGINE - Phase 3
 * Decides HOW MUCH coins to give based on multiple factors
 *
 * Features:
 * - Dynamic coin calculation based on multiple factors
 * - Merchant factors (inventory, conversion rate, rating)
 * - User factors (affinity, stage, past conversion)
 * - Market factors (time of day, day of week, competition)
 * - Budget management (daily/weekly/user limits, auto-pause)
 */
import Redis from 'ioredis';
export interface CoinAllocationRequest {
    userId: string;
    campaignId: string;
    merchantId: string;
    baseCoins: number;
    location?: {
        lat: number;
        lng: number;
    };
}
export interface CoinAllocationResponse {
    coins: number;
    breakdown: {
        base: number;
        userBoost: number;
        merchantBoost: number;
        marketBoost: number;
    };
    reason: string;
    budgetStatus: 'ok' | 'low' | 'exhausted';
}
export interface MerchantData {
    inventoryLevel: number;
    conversionRate: number;
    rating: number;
    totalRedeems: number;
    avgDailyRedeems: number;
    campaignBudget: number;
    dailyBudget: number;
}
export interface UserData {
    affinity: number;
    stage: 'NEW' | 'WARM' | 'HOT';
    pastConversionRate: number;
    lifetimeCoins: number;
    recentScans: number;
    categoryHistory: Record<string, string>;
}
export interface MarketConditions {
    hourOfDay: number;
    dayOfWeek: number;
    nearbyCompetitors: number;
    isWeekend: boolean;
    isPeakHour: boolean;
}
declare const DEFAULT_CONFIG: {
    minCoins: number;
    maxCoins: number;
    defaultBaseCoins: number;
    dailyBudgetLimit: number;
    perUserDailyLimit: number;
    perUserWeeklyLimit: number;
    highInventoryThreshold: number;
    lowInventoryThreshold: number;
    newMerchantThreshold: number;
    maxUserBoost: number;
    maxMerchantBoost: number;
    maxMarketBoost: number;
    newUserBoost: number;
    highInventoryBoost: number;
    newMerchantBoost: number;
    lowRatingPenalty: number;
    highAffinityDiscount: number;
    offPeakBoost: number;
    weekendBoost: number;
    competitionBoost: number;
    highRatingThreshold: number;
    lowRatingThreshold: number;
    highAffinityThreshold: number;
    lowAffinityThreshold: number;
    lunchStart: number;
    lunchEnd: number;
    dinnerStart: number;
    dinnerEnd: number;
    budgetLowThreshold: number;
};
export declare class BudgetManager {
    private config;
    constructor(config?: Partial<typeof DEFAULT_CONFIG>);
    /**
     * Check if budget allows allocation
     */
    checkBudget(campaignId: string, userId: string, requestedAmount: number): Promise<{
        allowed: boolean;
        status: 'ok' | 'low' | 'exhausted';
        reason: string;
        availableBudget: number;
    }>;
    /**
     * Reserve budget for allocation
     */
    reserveBudget(campaignId: string, userId: string, amount: number): Promise<boolean>;
    /**
     * Release reserved budget (e.g., if transaction fails)
     */
    releaseBudget(campaignId: string, userId: string, amount: number): Promise<boolean>;
    /**
     * Get budget status for a campaign
     */
    getCampaignBudgetStatus(campaignId: string): Promise<{
        dailySpent: number;
        dailyLimit: number;
        percentageRemaining: number;
    }>;
    /**
     * Pause campaign when budget exhausted
     */
    pauseCampaign(campaignId: string, reason: string): Promise<void>;
    /**
     * Check if campaign is paused
     */
    isCampaignPaused(campaignId: string): Promise<{
        paused: boolean;
        reason?: string;
        pausedAt?: string;
    }>;
    private getWeekStart;
}
export declare class MerchantAnalyzer {
    private redis;
    constructor(redisInstance?: Redis);
    /**
     * Get merchant data from Redis cache
     */
    getMerchantData(merchantId: string): Promise<MerchantData>;
    /**
     * Calculate merchant boost factor
     */
    calculateBoost(merchant: MerchantData): {
        boost: number;
        breakdown: Record<string, number>;
    };
    /**
     * Get average daily redemptions
     */
    private getAvgDailyRedeems;
    /**
     * Cache merchant data
     */
    cacheMerchantData(merchantId: string, data: Partial<MerchantData>): Promise<void>;
}
export declare class UserAnalyzer {
    private redis;
    constructor(redisInstance?: Redis);
    /**
     * Get user data from Redis cache
     */
    getUserData(userId: string, merchantId?: string): Promise<UserData>;
    /**
     * Calculate user boost factor
     */
    calculateBoost(user: UserData): {
        boost: number;
        breakdown: Record<string, number>;
    };
    /**
     * Get recent scan count
     */
    private getRecentScans;
    /**
     * Calculate user's past conversion rate
     */
    private calculatePastConversionRate;
    /**
     * Record coin allocation for analytics
     */
    recordAllocation(userId: string, merchantId: string, amount: number, outcome: 'pending' | 'redeemed' | 'expired'): Promise<void>;
}
export declare class MarketAnalyzer {
    private redis;
    constructor(redisInstance?: Redis);
    /**
     * Get current market conditions
     */
    getMarketConditions(location?: {
        lat: number;
        lng: number;
    }): MarketConditions;
    /**
     * Calculate market boost factor
     */
    calculateBoost(conditions: MarketConditions): {
        boost: number;
        breakdown: Record<string, number>;
    };
    /**
     * Find nearby competitors
     */
    findNearbyCompetitors(merchantId: string, location?: {
        lat: number;
        lng: number;
    }): Promise<number>;
    /**
     * Get time of day label
     */
    getTimeOfDayLabel(hour: number): string;
    private isPeakHour;
    private isMealTime;
}
export declare class SmartCoinAllocator {
    private budgetManager;
    private merchantAnalyzer;
    private userAnalyzer;
    private marketAnalyzer;
    private config;
    constructor(config?: Partial<typeof DEFAULT_CONFIG>);
    /**
     * Main allocation function
     */
    allocate(request: CoinAllocationRequest): Promise<CoinAllocationResponse>;
    /**
     * Recalculate allocation (e.g., when user context changes)
     */
    recalculate(request: CoinAllocationRequest, originalCoins: number): Promise<CoinAllocationResponse>;
    /**
     * Validate allocation before finalizing
     */
    validate(request: CoinAllocationRequest): Promise<{
        valid: boolean;
        errors: string[];
        warnings: string[];
    }>;
    /**
     * Get budget status
     */
    getBudgetStatus(campaignId: string): Promise<{
        status: 'ok' | 'low' | 'exhausted';
        dailySpent: number;
        dailyLimit: number;
        percentageRemaining: number;
    }>;
    /**
     * Pause campaign
     */
    pauseCampaign(campaignId: string, reason: string): Promise<void>;
    private createExhaustedResponse;
    private generateReason;
}
export declare function allocateCoins(request: CoinAllocationRequest): Promise<CoinAllocationResponse>;
export declare function getCoinAllocationBreakdown(request: CoinAllocationRequest): Promise<{
    merchantBoost: ReturnType<MerchantAnalyzer['calculateBoost']>;
    userBoost: ReturnType<UserAnalyzer['calculateBoost']>;
    marketBoost: ReturnType<MarketAnalyzer['calculateBoost']>;
    estimatedCoins: number;
}>;
export declare function getUserCoinStats(userId: string): Promise<{
    lifetimeCoins: number;
    recentScans: number;
    stage: 'NEW' | 'WARM' | 'HOT';
    avgAllocation: number;
}>;
export {};
