import Redis from 'ioredis';
export interface CampaignMetrics {
    campaignId: string;
    scans: number;
    redemptions: number;
    purchases: number;
    coinsSpent: number;
    revenue: number;
    roi: number;
}
export interface OptimizationResult {
    recommendedCoins: number;
    recommendedTargeting: string[];
    estimatedConversionRate: number;
    confidence: number;
    reason: string;
}
export interface Alert {
    id: string;
    type: 'BUDGET_WARNING' | 'LOW_CONVERSION' | 'ANOMALY';
    campaignId: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    createdAt: Date;
}
export interface ABTestResult {
    variantA: {
        coins: number;
        conversionRate: number;
    };
    variantB: {
        coins: number;
        conversionRate: number;
    };
    winner: 'A' | 'B' | 'INSUFFICIENT_DATA';
    confidence: number;
    sampleSize: number;
}
export interface CampaignConfig {
    campaignId: string;
    baseCoins: number;
    targeting: string[];
    startDate: Date;
    endDate: Date;
    budget: number;
    channel: 'APP' | 'EMAIL' | 'PUSH' | 'ALL';
}
interface HistoricalCampaign {
    campaignId: string;
    coins: number;
    targeting: string[];
    conversionRate: number;
    roi: number;
    channel: string;
    date: string;
}
export declare class CampaignOptimizer {
    private redis;
    private readonly TTL_DAYS;
    private readonly MIN_SAMPLE_SIZE;
    private readonly CONFIDENCE_THRESHOLD;
    private readonly BUDGET_WARNING_PERCENT;
    private readonly LOW_CONVERSION_THRESHOLD;
    constructor(redis?: Redis);
    /**
     * Record a scan event for a campaign
     */
    recordScan(campaignId: string): Promise<void>;
    /**
     * Record a redemption (conversion) event
     */
    recordRedemption(campaignId: string, coinsAwarded: number): Promise<void>;
    /**
     * Record a purchase after redemption
     */
    recordPurchase(campaignId: string, amount: number): Promise<void>;
    /**
     * Get current metrics for a campaign
     */
    getMetrics(campaignId: string): Promise<CampaignMetrics>;
    /**
     * Get metrics for multiple campaigns
     */
    getAllMetrics(): Promise<CampaignMetrics[]>;
    /**
     * Assign user to A/B test variant
     */
    assignVariant(userId: string, campaignId: string): 'A' | 'B';
    /**
     * Record A/B test result
     */
    recordABTestResult(campaignId: string, variant: 'A' | 'B', coinsAwarded: number): Promise<void>;
    /**
     * Record conversion for A/B test variant
     */
    recordABTestConversion(campaignId: string, variant: 'A' | 'B'): Promise<void>;
    /**
     * Get A/B test results
     */
    getABTestResults(campaignId: string): Promise<ABTestResult>;
    /**
     * Get optimization recommendation for a campaign
     */
    getOptimization(campaignId: string): Promise<OptimizationResult>;
    /**
     * Calculate recommended coin amount based on multiple factors
     */
    private calculateRecommendedCoins;
    /**
     * Calculate recommended targeting based on performance
     */
    private calculateRecommendedTargeting;
    /**
     * Get segment performance score from historical data
     */
    private getSegmentPerformance;
    /**
     * Store campaign data for learning
     */
    storeCampaignData(config: CampaignConfig): Promise<void>;
    /**
     * Get historical campaign data
     */
    getHistoricalData(limit?: number): Promise<HistoricalCampaign[]>;
    /**
     * Learn from historical campaigns using weighted averages
     */
    private learnFromHistory;
    /**
     * Predict optimal coin amount for a new campaign
     */
    predictOptimalCoins(targeting: string[], channel: string): Promise<{
        coins: number;
        confidence: number;
    }>;
    /**
     * Check for alerts on a campaign
     */
    checkAlerts(campaignId: string, config: CampaignConfig): Promise<Alert[]>;
    /**
     * Detect anomalies in campaign performance
     */
    private detectAnomalyForChannel;
    detectAnomalies(campaignId: string, metrics: CampaignMetrics): Promise<Alert | null>;
    private detectConversionRateAnomaly;
    private detectROIAnomaly;
    private detectActivityAnomaly;
    /**
     * Get alerts for a campaign
     */
    getAlerts(campaignId: string, limit?: number): Promise<Alert[]>;
    /**
     * Clear alerts for a campaign
     */
    clearAlerts(campaignId: string): Promise<void>;
    /**
     * Optimize budget allocation across channels
     */
    optimizeBudgetAllocation(campaigns: {
        campaignId: string;
        channel: string;
        spend: number;
    }[]): Promise<{
        channel: string;
        currentPercent: number;
        recommendedPercent: number;
        reason: string;
    }[]>;
    /**
     * Simple hash function for deterministic A/B assignment
     */
    private simpleHash;
    /**
     * Calculate confidence based on sample size
     */
    private calculateConfidence;
    /**
     * Weighted average for conversion rate
     */
    private weightedAverageConversionRate;
    /**
     * Generate optimization reason string
     */
    private generateOptimizationReason;
    /**
     * Get channel from campaign metrics
     */
    private get channel();
}
export declare const campaignOptimizer: CampaignOptimizer;
export default campaignOptimizer;
