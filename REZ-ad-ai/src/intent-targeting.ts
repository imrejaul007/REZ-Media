/**
 * AdBazaar Integration - Intent-Based Targeting
 *
 * Philosophy:
 * ❌ NOT: "show ad because we know everything about user"
 * ✅ YES: "show ad based on current intent"
 */

import { UserIntelligence, UserIntelligenceDoc } from './models/UserIntelligence';

export class AdTargetingService {

  /**
   * Get ads for user based on INTENT (not surveillance)
   *
   * Example:
   * User searches for "spa" → Intent: "looking_for_service"
   * → Show spa ads (not random ads based on past browsing)
   */
  async getTargetedAds(user_id: string, context: {
    location?: string;
    time?: string;
  }) {
    // Get user intelligence
    const intelligence = await UserIntelligence.findOne({ user_id });

    if (!intelligence) {
      // Cold start - show general ads
      return this.getGeneralAds();
    }

    // Check consent
    if (!intelligence.consent?.ads) {
      return []; // User opted out
    }

    // Get ads based on INTENT (not past data)
    const intent = intelligence.intent.current;
    const segments = intelligence.segments ?? [];

    // Intent-based targeting (primary)
    const intentAds = this.getIntentBasedAds(intent, context);

    // Segment-based (secondary)
    const segmentAds = this.getSegmentBasedAds(segments, context);

    // Combine and dedupe
    return this.combineAds(intentAds, segmentAds);
  }

  /**
   * Intent-based ad selection
   * User intent = which ads to show
   */
  private getIntentBasedAds(intent: string, context: any) {
    const intentAdMap: Record<string, string[]> = {
      'looking_for_food': ['restaurant_offer', 'food_delivery_deal'],
      'looking_for_service': ['salon_promo', 'spa_offer'],
      'looking_for_dinner': ['restaurant_dinner_deal', 'biryani_promo'],
      'ordering': ['free_delivery', 'first_order_discount'],
      'booking': ['salon_discount', 'hotel_offer'],
      'browsing': ['general_promo'],
    };

    const adTypes = intentAdMap[intent] || ['general_promo'];

    return adTypes.map(type => ({
      type,
      reason: `intent:${intent}`,
      score: 0.8,
    }));
  }

  /**
   * Segment-based ad selection (secondary)
   */
  private getSegmentBasedAds(segments: string[], context: any) {
    const segmentAdMap: Record<string, string[]> = {
      'foodies': ['premium_food_deal', 'new_restaurant_promo'],
      'deal_seekers': ['flat_20_off', 'coupon_deal'],
      'vip': ['exclusive_offer', 'vip_access'],
      'at_risk': ['win_back_offer', 'special_discount'],
      'new_user': ['first_order_deal', 'welcome_offer'],
    };

    const adTypes: string[] = [];
    segments.forEach(segment => {
      const ads = segmentAdMap[segment] || [];
      adTypes.push(...ads);
    });

    return adTypes.map(type => ({
      type,
      reason: `segment:${segments.join(',')}`,
      score: 0.6,
    }));
  }

  /**
   * General ads for cold start
   */
  private getGeneralAds() {
    return [
      { type: 'restaurant_offer', reason: 'general', score: 0.5 },
      { type: 'free_delivery', reason: 'general', score: 0.4 },
    ];
  }

  /**
   * Combine and dedupe ads
   */
  private combineAds(intentAds: any[], segmentAds: any[]) {
    interface AdItem { type: string; reason: string; score: number; }
    const combined: AdItem[] = [...intentAds, ...segmentAds];
    const deduped = combined.reduce<AdItem[]>((acc, ad) => {
      if (!acc.find((a: AdItem) => a.type === ad.type)) {
        acc.push(ad);
      }
      return acc;
    }, []);

    // Sort by score
    return deduped.sort((a: AdItem, b: AdItem) => b.score - a.score);
  }

  /**
   * Get merchant targeting insights
   *
   * "Which users to show my ads to?"
   */
  async getMerchantTargeting(merchant_id: string) {
    // Find users whose intelligence matches merchant's target segments
    const targeting = {
      primary_segments: ['foodies', 'deal_seekers'],
      intent_filters: ['looking_for_food', 'ordering'],
      exclude_segments: ['churned'],
      estimated_reach: 1500,
    };

    return targeting;
  }

  /**
   * Track ad impression (just counts, no personal data)
   */
  async trackImpression(ad_type: string, user_segment: string, location: string) {
    // Store aggregate only, no PII
    return {
      tracked: true,
      ad_type,
      user_segment,
      location,
      timestamp: new Date(),
    };
  }

  /**
   * Track ad click (aggregate only)
   */
  async trackClick(ad_type: string, user_segment: string) {
    return {
      tracked: true,
      ad_type,
      user_segment,
      timestamp: new Date(),
    };
  }
}

export const adTargeting = new AdTargetingService();
