/**
 * BUDGET ALLOCATOR ENGINE
 * Distributes campaign budget across channels/time, optimizes spend for maximum ROI
 *
 * Phase 3: Sampling Platform Budget Management
 */
export interface BudgetConfig {
    campaignId: string;
    totalBudget: number;
    channels: {
        whatsapp: number;
        push: number;
        ads: number;
        qr: number;
    };
    dailyLimit?: number;
    perUserLimit?: number;
}
export interface ChannelMetrics {
    channel: string;
    allocated: number;
    spent: number;
    conversions: number;
    cpc: number;
    impressions: number;
    ctr: number;
    status: 'active' | 'paused' | 'exhausted';
    lastUpdated: Date;
}
export interface BudgetAllocation {
    campaignId: string;
    totalBudget: number;
    spent: number;
    remaining: number;
    allocations: ChannelMetrics[];
    timeSlots: TimeSlotAllocation;
    userSpending: Record<string, number>;
    alerts: BudgetAlert[];
    reallocationSuggestion?: ReallocationSuggestion;
}
export interface TimeSlotAllocation {
    morning: {
        allocated: number;
        spent: number;
    };
    afternoon: {
        allocated: number;
        spent: number;
    };
    evening: {
        allocated: number;
        spent: number;
    };
    night: {
        allocated: number;
        spent: number;
    };
}
export interface ReallocationSuggestion {
    from: string;
    to: string;
    amount: number;
    reason: string;
    confidence: number;
    potentialGain: number;
}
export interface BudgetAlert {
    type: 'low_budget' | 'channel_exhausted' | 'overspend' | 'performance_drop';
    channel?: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    timestamp: Date;
}
export interface SpendingRecord {
    campaignId: string;
    channel: string;
    userId: string;
    amount: number;
    timestamp: Date;
    conversion?: boolean;
}
declare const CHANNELS: readonly ["whatsapp", "push", "ads", "qr"];
declare const TIME_SLOTS: readonly ["morning", "afternoon", "evening", "night"];
type TimeSlot = typeof TIME_SLOTS[number];
declare const CHANNEL_WEIGHTS: {
    whatsapp: number;
    push: number;
    ads: number;
    qr: number;
};
declare const TIME_SLOT_DISTRIBUTION: {
    morning: {
        start: number;
        end: number;
        weight: number;
    };
    afternoon: {
        start: number;
        end: number;
        weight: number;
    };
    evening: {
        start: number;
        end: number;
        weight: number;
    };
    night: {
        start: number;
        end: number;
        weight: number;
    };
};
declare const PERFORMANCE_THRESHOLDS: {
    minCPC: number;
    maxCPC: number;
    minCTR: number;
    targetCVR: number;
    reallocationThreshold: number;
    pauseThreshold: number;
    lowBudgetWarning: number;
};
declare function getCurrentTimeSlot(): TimeSlot;
declare function getRedisKey(campaignId: string, ...parts: string[]): string;
export declare class BudgetGuard {
    private campaignConfig;
    private dailyLimit;
    private perUserLimit;
    private minimumReserve;
    constructor(config: BudgetConfig);
    /**
     * Check if spending is allowed for a specific channel and user
     */
    canSpend(campaignId: string, channel: string, userId: string, amount: number): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Check if channel should be paused
     */
    shouldPauseChannel(campaignId: string, channel: string): Promise<boolean>;
    /**
     * Check if campaign should be paused
     */
    shouldPauseCampaign(campaignId: string): Promise<boolean>;
    private getDailySpend;
    private getTotalSpend;
    private getUserSpend;
    private getChannelSpend;
}
export declare class SpendingTracker {
    /**
     * Record a spending event
     */
    record(campaignId: string, record: Omit<SpendingRecord, 'campaignId' | 'timestamp'>): Promise<void>;
    /**
     * Get all spending for a campaign
     */
    getCampaignSpending(campaignId: string): Promise<{
        total: number;
        byChannel: Record<string, number>;
        byTimeSlot: Record<string, number>;
        byUser: Record<string, number>;
        daily: number;
    }>;
    /**
     * Get user spending summary
     */
    getUserSpending(campaignId: string): Promise<Record<string, number>>;
}
export declare class ROICalculator {
    /**
     * Calculate performance metrics for a channel
     */
    calculateChannelMetrics(campaignId: string, channel: string): Promise<ChannelMetrics>;
    /**
     * Calculate cost per conversion for each channel
     */
    getCostPerConversion(campaignId: string): Promise<Record<string, number>>;
    /**
     * Identify best performing channel
     */
    getBestPerformingChannel(campaignId: string): Promise<{
        channel: string;
        cpc: number;
        conversions: number;
    } | null>;
    /**
     * Identify worst performing channel
     */
    getWorstPerformingChannel(campaignId: string): Promise<{
        channel: string;
        cpc: number;
        conversions: number;
    } | null>;
    private getChannelBudget;
}
export declare class ReallocationEngine {
    private roiCalculator;
    constructor();
    /**
     * Generate reallocation suggestions
     */
    generateSuggestions(campaignId: string): Promise<ReallocationSuggestion[]>;
    /**
     * Apply a reallocation
     */
    applyReallocation(campaignId: string, suggestion: ReallocationSuggestion): Promise<boolean>;
}
export declare class AlertManager {
    private alerts;
    /**
     * Check and generate alerts for a campaign
     */
    checkAlerts(campaignId: string, config: BudgetConfig, spending: {
        total: number;
        daily: number;
    }): Promise<BudgetAlert[]>;
    /**
     * Get recent alerts for a campaign
     */
    getRecentAlerts(campaignId: string): Promise<BudgetAlert[]>;
}
export declare class BudgetDistributionEngine {
    private config;
    constructor(config: BudgetConfig);
    /**
     * Initialize budget allocation in Redis
     */
    initialize(): Promise<void>;
    /**
     * Get initial allocation structure
     */
    getInitialAllocation(): Promise<BudgetAllocation>;
    /**
     * Calculate optimal bid for a channel based on performance
     */
    calculateOptimalBid(channel: string, targetCPC: number): number;
    /**
     * Get time-based allocation factor
     */
    getTimeAllocationFactor(): number;
}
export declare class BudgetAllocator {
    private config;
    private guard;
    private tracker;
    private roiCalculator;
    private reallocationEngine;
    private alertManager;
    private distributionEngine;
    constructor(config: BudgetConfig);
    /**
     * Initialize the budget allocator for a campaign
     */
    initialize(): Promise<void>;
    /**
     * Get current budget allocation status
     */
    getAllocation(): Promise<BudgetAllocation>;
    /**
     * Check if spending is allowed
     */
    canSpend(channel: string, userId: string, amount: number): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Record spending and track metrics
     */
    recordSpending(channel: string, userId: string, amount: number, conversion?: boolean): Promise<void>;
    /**
     * Record an impression
     */
    recordImpression(channel: string): Promise<void>;
    /**
     * Record a click
     */
    recordClick(channel: string): Promise<void>;
    /**
     * Get channel performance metrics
     */
    getChannelMetrics(channel: string): Promise<ChannelMetrics>;
    /**
     * Get cost per conversion per channel
     */
    getCostPerConversion(): Promise<Record<string, number>>;
    /**
     * Get reallocation suggestions
     */
    getReallocationSuggestions(): Promise<ReallocationSuggestion[]>;
    /**
     * Apply a reallocation suggestion
     */
    applyReallocation(suggestion: ReallocationSuggestion): Promise<boolean>;
    /**
     * Get budget alerts
     */
    getAlerts(): Promise<BudgetAlert[]>;
    /**
     * Calculate optimal bid for a channel
     */
    getOptimalBid(channel: string): number;
    /**
     * Get time-based allocation factor
     */
    getTimeAllocationFactor(): number;
    /**
     * Check if channel should be paused
     */
    shouldPauseChannel(channel: string): Promise<boolean>;
    /**
     * Check if campaign should be paused
     */
    shouldPauseCampaign(): Promise<boolean>;
    /**
     * Get user spending for this campaign
     */
    getUserSpending(userId: string): Promise<number>;
    /**
     * Reset budget for a new day
     */
    resetDaily(): Promise<void>;
    /**
     * Get spending history
     */
    getSpendingHistory(limit?: number): Promise<SpendingRecord[]>;
}
export declare function createBudgetAllocator(config: BudgetConfig): Promise<BudgetAllocator>;
export { CHANNELS, TIME_SLOTS, CHANNEL_WEIGHTS, TIME_SLOT_DISTRIBUTION, PERFORMANCE_THRESHOLDS, getRedisKey, getCurrentTimeSlot };
