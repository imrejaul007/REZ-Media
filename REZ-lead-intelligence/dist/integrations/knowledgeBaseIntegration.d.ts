/**
 * Knowledge Base Integration
 * Connects user knowledge base to personalized offers engine
 *
 * Integrates with:
 * - ReZ Mind: User knowledge and preferences
 * - rez-marketing: Available offers and vouchers
 * - rez-lead-intelligence: Lead scoring for personalization
 */
/**
 * User knowledge base structure containing preferences and signals
 */
export interface UserKnowledge {
    userId: string;
    preferences: UserPreferences;
    history: UserHistory;
    signals: UserSignals;
    lastUpdated: Date;
}
export interface UserPreferences {
    cuisines: string[];
    priceRange: {
        min: number;
        max: number;
    };
    dietary: string[];
    brands: string[];
    occasions: string[];
}
export interface UserHistory {
    ordersCount: number;
    avgOrderValue: number;
    favoriteCategories: string[];
    lastOrderDate: Date;
}
export interface UserSignals {
    recentSearches: string[];
    recentViews: string[];
    abandonedProducts: string[];
}
/**
 * Personalized offer structure with matching metadata
 */
export interface PersonalizedOffer {
    offerId: string;
    merchantId: string;
    productId: string;
    matchScore: number;
    discount: number;
    coins: number;
    offerText: string;
    reason: string;
    category: string;
    cuisine?: string;
    expiresAt?: Date;
}
/**
 * Raw offer from marketing service
 */
export interface AvailableOffer {
    id: string;
    merchantId: string;
    productId?: string;
    category?: string;
    type: 'percentage' | 'fixed' | 'bogo' | 'free_delivery' | 'cashback';
    value: number;
    code?: string;
    description?: string;
    minOrderValue: number;
    maxDiscount?: number;
    validFrom: Date;
    validUntil: Date;
    applicableTo: 'all' | 'category' | 'product' | 'store';
    applicableIds?: string[];
    cuisines?: string[];
}
/**
 * Match result with scoring details
 */
interface MatchResult {
    offer: AvailableOffer;
    score: number;
    matchReasons: string[];
}
export declare class KnowledgeBaseIntegration {
    private rezMind;
    private marketing;
    constructor();
    /**
     * Get user knowledge from knowledge base
     * Fetches from ReZ Mind and enriches with local data
     */
    getUserKnowledge(userId: string): Promise<UserKnowledge>;
    /**
     * Build user knowledge from interests
     */
    private buildKnowledgeFromInterests;
    /**
     * Extract cuisine types from interests
     */
    private extractCuisines;
    /**
     * Create empty knowledge structure
     */
    private createEmptyKnowledge;
    /**
     * Get personalized offers for a user
     * Matches available offers to user preferences and signals
     */
    getPersonalizedOffers(userId: string, availableOffers?: AvailableOffer[]): Promise<PersonalizedOffer[]>;
    /**
     * Match offers to user preferences and signals
     */
    private matchOffersToUser;
    /**
     * Calculate match score between offer and user
     */
    private calculateMatchScore;
    /**
     * Match offer category to user preferences
     */
    private matchCategory;
    /**
     * Match offer to user price range
     */
    private matchPriceRange;
    /**
     * Match offer to user history
     */
    private matchHistory;
    /**
     * Match offer to recent user signals
     */
    private matchSignals;
    /**
     * Rank offers by affinity to user
     */
    rankOffersByAffinity(matchResults: MatchResult[], userKnowledge: UserKnowledge): PersonalizedOffer[];
    /**
     * Generate personalized offer text
     */
    generateOfferText(offer: AvailableOffer, userKnowledge: UserKnowledge): string;
    /**
     * Get personalized prefix based on user signals
     */
    private getPersonalizedPrefix;
    /**
     * Calculate discount value in currency
     */
    private calculateDiscountValue;
    /**
     * Calculate coins earned
     */
    private calculateCoins;
    /**
     * Get top N offer recommendations for user
     */
    getOfferRecommendations(userId: string, limit?: number): Promise<PersonalizedOffer[]>;
    /**
     * Track offer conversion
     */
    trackOfferConversion(userId: string, offerId: string, orderValue: number): Promise<void>;
    /**
     * Refresh user knowledge cache
     */
    refreshUserKnowledge(userId: string): Promise<UserKnowledge>;
}
export declare const knowledgeBaseIntegration: KnowledgeBaseIntegration;
export default knowledgeBaseIntegration;
//# sourceMappingURL=knowledgeBaseIntegration.d.ts.map