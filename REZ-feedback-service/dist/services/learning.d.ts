import { FeedbackStats, LearningInsight, FeedbackPattern, DriftDetection } from '../types';
declare class LearningService {
    private statsCache;
    private readonly CACHE_TTL;
    /**
     * Calculate feedback statistics for a merchant
     */
    getStats(merchantId: string, period?: string): Promise<FeedbackStats>;
    /**
     * Parse period string to milliseconds
     */
    private parsePeriod;
    /**
     * Calculate statistics from feedback array
     */
    private calculateStats;
    /**
     * Analyze feedback patterns for a merchant
     */
    analyzePatterns(merchantId: string, eventType?: string): Promise<FeedbackPattern[]>;
    /**
     * Generate a feedback pattern from feedback data
     */
    private generatePattern;
    /**
     * Calculate accuracy from feedback array
     */
    private calculateAccuracy;
    /**
     * Detect drift in agent performance
     */
    detectDrift(merchantId: string, threshold?: number): Promise<DriftDetection[]>;
    /**
     * Get stats from database for a specific time range
     */
    private getStatsFromDb;
    /**
     * Get severity based on drift amount
     */
    private getSeverity;
    /**
     * Generate learning insights
     */
    generateInsights(merchantId?: string, minSeverity?: string): Promise<LearningInsight[]>;
    /**
     * Get recommendations based on drift type
     */
    private getRecommendations;
}
export declare const learningService: LearningService;
export {};
//# sourceMappingURL=learning.d.ts.map