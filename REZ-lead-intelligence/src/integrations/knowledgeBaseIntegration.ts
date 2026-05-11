/**
 * Knowledge Base Integration
 * Connects user knowledge base to personalized offers engine
 *
 * Integrates with:
 * - ReZ Mind: User knowledge and preferences
 * - rez-marketing: Available offers and vouchers
 * - rez-lead-intelligence: Lead scoring for personalization
 */

import axios, { AxiosInstance } from 'axios';
import config from '../config';
import { logger } from '@rez/shared';

// ============================================================================
// Type Definitions
// ============================================================================

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
  priceRange: { min: number; max: number };
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

// ============================================================================
// ReZ Mind Integration Client
// ============================================================================

class ReZMindClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = config.services.mind || process.env.MIND_SERVICE_URL || 'https://rez-event-platform.onrender.com';
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get user knowledge from ReZ Mind
   */
  async getUserKnowledge(userId: string): Promise<UserKnowledge | null> {
    try {
      const response = await this.client.get(`/api/v1/users/${userId}/knowledge`);

      if (response.data?.data) {
        return this.transformMindData(response.data.data);
      }

      return null;
    } catch (error: any) {
      logger.warn('[ReZ Mind] Failed to fetch user knowledge', {
        error: error.message,
        userId,
      });
      return null;
    }
  }

  /**
   * Get user interests from ReZ Mind
   */
  async getUserInterests(userId: string): Promise<{ tag: string; score: number }[]> {
    try {
      const response = await this.client.get(`/api/v1/users/${userId}/interests`);

      if (response.data?.data?.interests) {
        return response.data.data.interests;
      }

      return [];
    } catch (error: any) {
      logger.warn('[ReZ Mind] Failed to fetch user interests', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Transform ReZ Mind data to UserKnowledge format
   */
  private transformMindData(data: any): UserKnowledge {
    return {
      userId: data.userId || data.id,
      preferences: {
        cuisines: data.preferences?.cuisines || data.cuisines || [],
        priceRange: data.preferences?.priceRange || data.priceRange || { min: 0, max: 1000 },
        dietary: data.preferences?.dietary || data.dietary || [],
        brands: data.preferences?.brands || data.brands || [],
        occasions: data.preferences?.occasions || data.occasions || [],
      },
      history: {
        ordersCount: data.history?.ordersCount || data.ordersCount || 0,
        avgOrderValue: data.history?.avgOrderValue || data.avgOrderValue || 0,
        favoriteCategories: data.history?.favoriteCategories || data.favoriteCategories || [],
        lastOrderDate: data.history?.lastOrderDate
          ? new Date(data.history.lastOrderDate)
          : data.lastOrderDate
            ? new Date(data.lastOrderDate)
            : new Date(0),
      },
      signals: {
        recentSearches: data.signals?.recentSearches || data.recentSearches || [],
        recentViews: data.signals?.recentViews || data.recentViews || [],
        abandonedProducts: data.signals?.abandonedProducts || data.abandonedProducts || [],
      },
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : new Date(),
    };
  }

  /**
   * Send offer interaction event to ReZ Mind
   */
  async sendOfferInteraction(
    userId: string,
    offerId: string,
    action: 'viewed' | 'clicked' | 'applied' | 'converted'
  ): Promise<{ success: boolean }> {
    try {
      await this.client.post('/webhook/offer/interaction', {
        userId,
        offerId,
        action,
        timestamp: new Date().toISOString(),
        source: 'lead_intelligence_service',
      });

      return { success: true };
    } catch (error: any) {
      logger.warn('[ReZ Mind] Failed to send offer interaction', {
        error: error.message,
        userId,
        offerId,
      });
      return { success: false };
    }
  }
}

// ============================================================================
// Marketing Service Integration Client
// ============================================================================

class MarketingServiceClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = config.services.marketing || process.env.MARKETING_SERVICE_URL || 'https://rez-marketing-service.onrender.com';
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get available offers from marketing service
   */
  async getAvailableOffers(options?: {
    merchantId?: string;
    category?: string;
    userId?: string;
    limit?: number;
  }): Promise<AvailableOffer[]> {
    try {
      const params: Record<string, string | number> = {};
      if (options?.merchantId) params.merchantId = options.merchantId;
      if (options?.category) params.category = options.category;
      if (options?.userId) params.userId = options.userId;
      if (options?.limit) params.limit = options.limit;

      const response = await this.client.get('/api/v1/offers/available', { params });

      return response.data?.offers || response.data?.data || [];
    } catch (error: any) {
      logger.warn('[Marketing] Failed to fetch available offers', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get vouchers from marketing service
   */
  async getVouchers(options?: {
    merchantId?: string;
    status?: string;
    limit?: number;
  }): Promise<AvailableOffer[]> {
    try {
      const params: Record<string, string | number> = {};
      if (options?.merchantId) params.merchantId = options.merchantId;
      if (options?.status) params.status = options.status;
      if (options?.limit) params.limit = options.limit || 50;

      const response = await this.client.get('/api/v1/vouchers', { params });

      const vouchers = response.data?.vouchers || response.data?.data || [];

      // Transform vouchers to offers format
      return vouchers.map((v: any) => this.transformVoucherToOffer(v));
    } catch (error: any) {
      logger.warn('[Marketing] Failed to fetch vouchers', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get personalized offers for user
   */
  async getPersonalizedOffers(userId: string): Promise<AvailableOffer[]> {
    try {
      const response = await this.client.get('/api/v1/offers/personalized', {
        params: { userId },
      });

      return response.data?.offers || response.data?.data || [];
    } catch (error: any) {
      logger.warn('[Marketing] Failed to fetch personalized offers', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Transform voucher to offer format
   */
  private transformVoucherToOffer(voucher: any): AvailableOffer {
    return {
      id: voucher._id || voucher.id,
      merchantId: voucher.merchantId || voucher.storeId || '',
      productId: voucher.productId,
      category: voucher.category,
      type: voucher.type,
      value: voucher.value,
      code: voucher.code,
      description: voucher.description,
      minOrderValue: voucher.minOrderValue || 0,
      maxDiscount: voucher.maxDiscount,
      validFrom: new Date(voucher.validFrom),
      validUntil: new Date(voucher.validUntil),
      applicableTo: voucher.applicableTo || 'all',
      applicableIds: voucher.applicableIds,
      cuisines: voucher.cuisines,
    };
  }

  /**
   * Track offer conversion
   */
  async trackOfferConversion(
    offerId: string,
    userId: string,
    orderValue: number
  ): Promise<{ success: boolean }> {
    try {
      await this.client.post('/api/v1/offers/track', {
        offerId,
        userId,
        orderValue,
        action: 'converted',
        timestamp: new Date().toISOString(),
        source: 'lead_intelligence_service',
      });

      return { success: true };
    } catch (error: any) {
      logger.warn('[Marketing] Failed to track offer conversion', {
        error: error.message,
        offerId,
        userId,
      });
      return { success: false };
    }
  }
}

// ============================================================================
// Knowledge Base Integration Service
// ============================================================================

export class KnowledgeBaseIntegration {
  private rezMind: ReZMindClient;
  private marketing: MarketingServiceClient;

  constructor() {
    this.rezMind = new ReZMindClient();
    this.marketing = new MarketingServiceClient();
  }

  /**
   * Get user knowledge from knowledge base
   * Fetches from ReZ Mind and enriches with local data
   */
  async getUserKnowledge(userId: string): Promise<UserKnowledge> {
    logger.info('[KnowledgeBase] Fetching user knowledge', { userId });

    // Try to get from ReZ Mind
    let knowledge = await this.rezMind.getUserKnowledge(userId);

    // If not found, try marketing service for interests
    if (!knowledge) {
      const interests = await this.rezMind.getUserInterests(userId);

      if (interests.length > 0) {
        knowledge = this.buildKnowledgeFromInterests(userId, interests);
      }
    }

    // Fallback to minimal knowledge
    if (!knowledge) {
      knowledge = this.createEmptyKnowledge(userId);
    }

    logger.info('[KnowledgeBase] User knowledge fetched', {
      userId,
      cuisines: knowledge.preferences.cuisines.length,
      categories: knowledge.history.favoriteCategories.length,
    });

    return knowledge;
  }

  /**
   * Build user knowledge from interests
   */
  private buildKnowledgeFromInterests(
    userId: string,
    interests: { tag: string; score: number }[]
  ): UserKnowledge {
    // Sort interests by score
    const sortedInterests = [...interests].sort((a, b) => b.score - a.score);

    // Top interests as favorite categories
    const favoriteCategories = sortedInterests
      .slice(0, 5)
      .map((i) => i.tag);

    return {
      userId,
      preferences: {
        cuisines: this.extractCuisines(sortedInterests),
        priceRange: { min: 0, max: 500 },
        dietary: [],
        brands: [],
        occasions: [],
      },
      history: {
        ordersCount: 0,
        avgOrderValue: 0,
        favoriteCategories,
        lastOrderDate: new Date(0),
      },
      signals: {
        recentSearches: [],
        recentViews: [],
        abandonedProducts: [],
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Extract cuisine types from interests
   */
  private extractCuisines(interests: { tag: string; score: number }[]): string[] {
    const cuisineKeywords = [
      'indian', 'chinese', 'italian', 'mexican', 'thai', 'japanese',
      'korean', 'american', 'mediterranean', 'continental', 'biryani',
      'pizza', 'burger', 'sushi', 'dessert', 'cafe', 'fast_food',
    ];

    return interests
      .filter((i) => cuisineKeywords.some((c) => i.tag.toLowerCase().includes(c)))
      .map((i) => i.tag);
  }

  /**
   * Create empty knowledge structure
   */
  private createEmptyKnowledge(userId: string): UserKnowledge {
    return {
      userId,
      preferences: {
        cuisines: [],
        priceRange: { min: 0, max: 1000 },
        dietary: [],
        brands: [],
        occasions: [],
      },
      history: {
        ordersCount: 0,
        avgOrderValue: 0,
        favoriteCategories: [],
        lastOrderDate: new Date(0),
      },
      signals: {
        recentSearches: [],
        recentViews: [],
        abandonedProducts: [],
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get personalized offers for a user
   * Matches available offers to user preferences and signals
   */
  async getPersonalizedOffers(
    userId: string,
    availableOffers?: AvailableOffer[]
  ): Promise<PersonalizedOffer[]> {
    logger.info('[KnowledgeBase] Getting personalized offers', { userId });

    // Get user knowledge
    const userKnowledge = await this.getUserKnowledge(userId);

    // Get available offers if not provided
    const offers = availableOffers || await this.marketing.getAvailableOffers({ limit: 100 });

    if (offers.length === 0) {
      logger.info('[KnowledgeBase] No offers available', { userId });
      return [];
    }

    // Match offers to user
    const matchedOffers = this.matchOffersToUser(offers, userKnowledge);

    // Rank by affinity
    const rankedOffers = this.rankOffersByAffinity(matchedOffers, userKnowledge);

    logger.info('[KnowledgeBase] Personalized offers generated', {
      userId,
      totalOffers: offers.length,
      matchedOffers: rankedOffers.length,
    });

    return rankedOffers;
  }

  /**
   * Match offers to user preferences and signals
   */
  private matchOffersToUser(
    offers: AvailableOffer[],
    userKnowledge: UserKnowledge
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const offer of offers) {
      const { score, reasons } = this.calculateMatchScore(offer, userKnowledge);

      // Only include if score is above threshold
      if (score > 0.1) {
        results.push({ offer, score, matchReasons: reasons });
      }
    }

    return results;
  }

  /**
   * Calculate match score between offer and user
   */
  private calculateMatchScore(
    offer: AvailableOffer,
    userKnowledge: UserKnowledge
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Factor 1: Cuisine/Category match (weight: 0.3)
    const categoryScore = this.matchCategory(offer, userKnowledge);
    if (categoryScore > 0) {
      score += categoryScore * 0.3;
      reasons.push(`Matches your ${offer.cuisines?.join(', ') || offer.category || 'category'} preferences`);
    }

    // Factor 2: Price range match (weight: 0.2)
    const priceScore = this.matchPriceRange(offer, userKnowledge);
    if (priceScore > 0) {
      score += priceScore * 0.2;
      reasons.push('Within your preferred price range');
    }

    // Factor 3: History affinity (weight: 0.25)
    const historyScore = this.matchHistory(offer, userKnowledge);
    if (historyScore > 0) {
      score += historyScore * 0.25;
      reasons.push('Based on your order history');
    }

    // Factor 4: Signal match (weight: 0.25)
    const signalScore = this.matchSignals(offer, userKnowledge);
    if (signalScore > 0) {
      score += signalScore * 0.25;
      reasons.push('Related to items you viewed or searched');
    }

    // Normalize score to 0-100
    score = Math.min(Math.round(score * 100), 100);

    return { score, reasons };
  }

  /**
   * Match offer category to user preferences
   */
  private matchCategory(offer: AvailableOffer, userKnowledge: UserKnowledge): number {
    const { cuisines } = userKnowledge.preferences;
    const { favoriteCategories } = userKnowledge.history;
    const allCategories = [...cuisines, ...favoriteCategories];

    if (allCategories.length === 0) return 0.5; // Neutral if no preferences

    // Check cuisine match
    if (offer.cuisines && offer.cuisines.length > 0) {
      const cuisineMatch = offer.cuisines.some((c) =>
        allCategories.some((cat) => cat.toLowerCase().includes(c.toLowerCase()))
      );
      if (cuisineMatch) return 1.0;
    }

    // Check category match
    if (offer.category) {
      const categoryMatch = allCategories.some((cat) =>
        cat.toLowerCase().includes(offer.category!.toLowerCase())
      );
      if (categoryMatch) return 0.8;
    }

    return 0;
  }

  /**
   * Match offer to user price range
   */
  private matchPriceRange(offer: AvailableOffer, userKnowledge: UserKnowledge): number {
    const { min, max } = userKnowledge.preferences.priceRange;

    // If min order value is within user's preferred range
    if (offer.minOrderValue >= min && offer.minOrderValue <= max) {
      return 1.0;
    }

    // If offer's min order is slightly above user's max (discount brings it into range)
    if (offer.minOrderValue > max && offer.minOrderValue <= max * 1.5) {
      return 0.6;
    }

    // If no preference set, return neutral
    if (min === 0 && max === 0) {
      return 0.5;
    }

    return 0;
  }

  /**
   * Match offer to user history
   */
  private matchHistory(offer: AvailableOffer, userKnowledge: UserKnowledge): number {
    const { favoriteCategories } = userKnowledge.history;

    if (favoriteCategories.length === 0) return 0;

    // High match if category matches favorites
    if (offer.category && favoriteCategories.includes(offer.category)) {
      return 1.0;
    }

    // Medium match if category contains favorite keywords
    if (offer.category) {
      const keywordMatch = favoriteCategories.some((cat) =>
        offer.category!.toLowerCase().includes(cat.toLowerCase())
      );
      if (keywordMatch) return 0.6;
    }

    return 0;
  }

  /**
   * Match offer to recent user signals
   */
  private matchSignals(offer: AvailableOffer, userKnowledge: UserKnowledge): number {
    const { recentSearches, recentViews, abandonedProducts } = userKnowledge.signals;
    const allSignals = [...recentSearches, ...recentViews, ...abandonedProducts];

    if (allSignals.length === 0) return 0;

    const offerText = `${offer.description || ''} ${offer.category || ''}`.toLowerCase();
    const offerId = `${offer.id}`.toLowerCase();

    let matchCount = 0;

    // Count signal matches
    for (const signal of allSignals) {
      const signalLower = signal.toLowerCase();
      if (
        offerText.includes(signalLower) ||
        offerId.includes(signalLower) ||
        offer.category?.toLowerCase().includes(signalLower)
      ) {
        matchCount++;
      }
    }

    // Calculate score based on match ratio
    return Math.min(matchCount / Math.max(allSignals.length, 1), 1.0);
  }

  /**
   * Rank offers by affinity to user
   */
  rankOffersByAffinity(
    matchResults: MatchResult[],
    userKnowledge: UserKnowledge
  ): PersonalizedOffer[] {
    return matchResults
      .map((result) => {
        const offerText = this.generateOfferText(result.offer, userKnowledge);
        const reason = result.matchReasons.join('. ') || 'Recommended for you';

        return {
          offerId: result.offer.id,
          merchantId: result.offer.merchantId,
          productId: result.offer.productId || '',
          matchScore: result.score,
          discount: this.calculateDiscountValue(result.offer),
          coins: this.calculateCoins(result.offer),
          offerText,
          reason,
          category: result.offer.category || '',
          cuisine: result.offer.cuisines?.join(', '),
          expiresAt: result.offer.validUntil,
        } as PersonalizedOffer;
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Generate personalized offer text
   */
  generateOfferText(offer: AvailableOffer, userKnowledge: UserKnowledge): string {
    const discountValue = this.calculateDiscountValue(offer);
    const coins = this.calculateCoins(offer);

    // Get personalized prefix based on user signals
    const personalizedPrefix = this.getPersonalizedPrefix(offer, userKnowledge);

    // Build offer text based on type
    let offerText = '';

    switch (offer.type) {
      case 'percentage':
        offerText = `${personalizedPrefix}Get ${offer.value}% off`;
        if (offer.maxDiscount) {
          offerText += ` (up to $${offer.maxDiscount})`;
        }
        break;

      case 'fixed':
        offerText = `${personalizedPrefix}Save $${discountValue}`;
        break;

      case 'bogo':
        offerText = `${personalizedPrefix}Buy 1 Get 1 Free`;
        break;

      case 'free_delivery':
        offerText = `${personalizedPrefix}Free delivery on your order`;
        break;

      case 'cashback':
        offerText = `${personalizedPrefix}Earn ${coins} coins back`;
        break;

      default:
        offerText = `${personalizedPrefix}Special offer: ${offer.description || 'Limited time deal'}`;
    }

    // Add category context if available
    if (offer.cuisines?.length) {
      offerText += ` on ${offer.cuisines[0]} orders`;
    } else if (offer.category) {
      offerText += ` on ${offer.category}`;
    }

    // Add minimum order if relevant
    if (offer.minOrderValue > 0) {
      offerText += ` (min order $${offer.minOrderValue})`;
    }

    return offerText;
  }

  /**
   * Get personalized prefix based on user signals
   */
  private getPersonalizedPrefix(offer: AvailableOffer, userKnowledge: UserKnowledge): string {
    const { abandonedProducts, recentSearches, recentViews } = userKnowledge.signals;

    // Check if offer matches abandoned products
    if (abandonedProducts.length > 0) {
      const offerText = `${offer.description || ''} ${offer.category || ''}`.toLowerCase();
      const abandonedMatch = abandonedProducts.some((p) =>
        offerText.includes(p.toLowerCase())
      );
      if (abandonedMatch) {
        return "Don't miss out - ";
      }
    }

    // Check if offer matches recent views
    if (recentViews.length > 0) {
      const offerText = `${offer.description || ''} ${offer.category || ''}`.toLowerCase();
      const viewMatch = recentViews.some((v) =>
        offerText.includes(v.toLowerCase())
      );
      if (viewMatch) {
        return "Great choice - ";
      }
    }

    // Check order frequency for frequent buyers
    if (userKnowledge.history.ordersCount > 10) {
      return "Loyal customer special - ";
    }

    // Check if it's a special occasion
    if (userKnowledge.preferences.occasions.length > 0) {
      return "Celebrate with ";
    }

    return "Exclusive: ";
  }

  /**
   * Calculate discount value in currency
   */
  private calculateDiscountValue(offer: AvailableOffer): number {
    switch (offer.type) {
      case 'percentage':
        // Assume average order value of $50 for calculation
        const estimatedValue = 50;
        const discount = (offer.value / 100) * estimatedValue;
        return offer.maxDiscount ? Math.min(discount, offer.maxDiscount) : discount;

      case 'fixed':
        return offer.value;

      case 'bogo':
        // Assume $10 value for free item
        return 10;

      case 'free_delivery':
        // Assume $5 delivery fee
        return 5;

      default:
        return 0;
    }
  }

  /**
   * Calculate coins earned
   */
  private calculateCoins(offer: AvailableOffer): number {
    if (offer.type === 'cashback') {
      return offer.value;
    }

    // Default coin calculation based on discount value
    const discountValue = this.calculateDiscountValue(offer);
    return Math.round(discountValue * 10); // 10 coins per dollar saved
  }

  /**
   * Get top N offer recommendations for user
   */
  async getOfferRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<PersonalizedOffer[]> {
    logger.info('[KnowledgeBase] Getting offer recommendations', { userId, limit });

    // Get personalized offers
    const personalizedOffers = await this.getPersonalizedOffers(userId);

    // Return top N
    const recommendations = personalizedOffers.slice(0, limit);

    // Send view event to ReZ Mind
    for (const offer of recommendations) {
      await this.rezMind.sendOfferInteraction(userId, offer.offerId, 'viewed');
    }

    logger.info('[KnowledgeBase] Offer recommendations generated', {
      userId,
      count: recommendations.length,
    });

    return recommendations;
  }

  /**
   * Track offer conversion
   */
  async trackOfferConversion(
    userId: string,
    offerId: string,
    orderValue: number
  ): Promise<void> {
    logger.info('[KnowledgeBase] Tracking offer conversion', { userId, offerId, orderValue });

    // Track in marketing service
    await this.marketing.trackOfferConversion(offerId, userId, orderValue);

    // Send conversion event to ReZ Mind
    await this.rezMind.sendOfferInteraction(userId, offerId, 'converted');
  }

  /**
   * Refresh user knowledge cache
   */
  async refreshUserKnowledge(userId: string): Promise<UserKnowledge> {
    logger.info('[KnowledgeBase] Refreshing user knowledge', { userId });

    // Re-fetch from ReZ Mind
    const knowledge = await this.getUserKnowledge(userId);

    logger.info('[KnowledgeBase] User knowledge refreshed', { userId });

    return knowledge;
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const knowledgeBaseIntegration = new KnowledgeBaseIntegration();
export default knowledgeBaseIntegration;
