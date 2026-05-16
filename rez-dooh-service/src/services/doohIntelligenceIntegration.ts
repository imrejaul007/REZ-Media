/**
 * DOOH Service - DOOH Intelligence Integration
 *
 * Connects to REZ-dooh-intelligence for:
 * - Dynamic pricing
 * - Audience matching
 * - Captivity scoring
 */

import axios from 'axios';

// Configuration
const DOOH_INTEL_URL = process.env.DOOH_INTEL_URL || 'http://localhost:4080';
const ENABLE_INTELLIGENCE = process.env.ENABLE_DOOH_INTELLIGENCE !== 'false';

// Types
interface PricingAdjustment {
  captivity: number;
  cityTier: number;
  timeSlot: number;
  seasonal: number;
  demand: number;
  audienceMatch: number;
}

interface IntelligencePricing {
  finalCPM: number;
  adjustments: PricingAdjustment;
  baseCPM: number;
}

interface AudienceMatch {
  score: number;
  matchLevel: 'excellent' | 'good' | 'fair' | 'poor';
  priceAdjustment: number;
  matchedSegments: string[];
}

interface CaptivityMetrics {
  level: 'personal' | 'captive_private' | 'semi_captive' | 'public';
  avgDwellTime: number;
  attentionLevel: number;
  premiumScore: number;
}

// ============================================================================
// INTELLIGENCE CLIENT
// ============================================================================

class DOOHIntelligenceClient {
  private baseURL: string;
  private enabled: boolean;
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();

  constructor() {
    this.baseURL = DOOH_INTEL_URL;
    this.enabled = ENABLE_INTELLIGENCE;
  }

  private async get<T>(endpoint: string, cacheKey?: string, ttlMs = 60000): Promise<T | null> {
    if (!this.enabled) {
      console.log('[DOOH-Intel] Intelligence disabled, skipping');
      return null;
    }

    // Check cache
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.data as T;
      }
    }

    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        timeout: 3000,
      });

      if (cacheKey) {
        this.cache.set(cacheKey, {
          data: response.data,
          expiry: Date.now() + ttlMs,
        });
      }

      return response.data;
    } catch (error) {
      console.error(`[DOOH-Intel] Failed to fetch ${endpoint}:`, error);
      return null;
    }
  }

  private async post<T>(endpoint: string, data: unknown, cacheKey?: string, ttlMs = 60000): Promise<T | null> {
    if (!this.enabled) {
      console.log('[DOOH-Intel] Intelligence disabled, skipping');
      return null;
    }

    // Check cache
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.data as T;
      }
    }

    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, {
        timeout: 5000,
      });

      if (cacheKey) {
        this.cache.set(cacheKey, {
          data: response.data,
          expiry: Date.now() + ttlMs,
        });
      }

      return response.data;
    } catch (error) {
      console.error(`[DOOH-Intel] Failed to post ${endpoint}:`, error);
      return null;
    }
  }

  // ============================================================================
  // PRICING METHODS
  // ============================================================================

  /**
   * Get dynamic pricing for a screen
   */
  async getDynamicPricing(params: {
    screenType: string;
    city: string;
    tier: 'metro' | 'tier1' | 'tier2' | 'tier3';
    scheduledTime: { start: Date; end: Date };
    campaignObjective?: string;
  }): Promise<IntelligencePricing | null> {
    const cacheKey = `pricing:${params.screenType}:${params.tier}:${params.city}`;

    const result = await this.post<{ success: boolean; data: IntelligencePricing }>(
      '/api/pricing/calculate',
      {
        screenType: params.screenType,
        location: {
          city: params.city,
          tier: params.tier,
        },
        scheduledTime: params.scheduledTime,
        campaignObjective: params.campaignObjective || 'awareness',
      },
      cacheKey,
      60000 // 1 min cache
    );

    return result?.data || null;
  }

  /**
   * Get base pricing for all screen types
   */
  async getScreenTypes(): Promise<{
    type: string;
    baseCPM: number;
    maxCPM: number;
  }[] | null> {
    const result = await this.get<{ success: boolean; data: { screens: : unknown[] } }>(
      '/api/screens/types',
      'screen-types',
      300000 // 5 min cache
    );

    return result?.data?.screens?.map((s: any) => ({
      type: s.type,
      baseCPM: s.baseCPM,
      maxCPM: s.maxCPM,
    })) || null;
  }

  // ============================================================================
  // AUDIENCE METHODS
  // ============================================================================

  /**
   * Match user to screen
   */
  async matchAudienceToScreen(params: {
    screenType: string;
    userId: string;
    userProfile?: {
      rfmSegment?: string;
      interests?: string[];
      demographics?: { ageRange?: string; income?: string };
    };
  }): Promise<AudienceMatch | null> {
    const result = await this.post<{ success: boolean; data: AudienceMatch }>(
      '/api/targeting/users',
      {
        screenType: params.screenType,
        location: { city: 'unknown', tier: 'tier2' },
        audienceCriteria: params.userProfile ? {
          interests: params.userProfile.interests,
        } : undefined,
        limit: 1,
      }
    );

    return result?.data || null;
  }

  /**
   * Get screen profile
   */
  async getScreenProfile(screenType: string): Promise<{
    captivityLevel: string;
    basePricing: { base: number; max: number };
    audience: { demographics: any; interests: string[] };
  } | null> {
    const result = await this.get<{
      success: boolean;
      data: {
        captivityLevel: string;
        basePricing: { base: number; max: number };
        audience: { demographics: any; interests: string[] };
      };
    }>(
      `/api/targeting/screen-profile/${screenType}`,
      `screen-profile:${screenType}`,
      300000
    );

    return result?.data || null;
  }

  // ============================================================================
  // CAPTIVITY METHODS
  // ============================================================================

  /**
   * Get captivity metrics for a screen type
   */
  getCaptivityMetrics(screenType: string): CaptivityMetrics {
    const captivityMap: Record<string, CaptivityMetrics> = {
      hotel_tv: { level: 'captive_private', avgDwellTime: 60, attentionLevel: 0.9, premiumScore: 85 },
      cab_screen: { level: 'captive_private', avgDwellTime: 30, attentionLevel: 0.85, premiumScore: 75 },
      flight_seat: { level: 'captive_private', avgDwellTime: 180, attentionLevel: 0.95, premiumScore: 90 },
      bus_seat: { level: 'captive_private', avgDwellTime: 45, attentionLevel: 0.7, premiumScore: 60 },
      mall_kiosk: { level: 'semi_captive', avgDwellTime: 10, attentionLevel: 0.5, premiumScore: 55 },
      office_lobby: { level: 'semi_captive', avgDwellTime: 5, attentionLevel: 0.4, premiumScore: 65 },
      gym_screen: { level: 'semi_captive', avgDwellTime: 30, attentionLevel: 0.6, premiumScore: 60 },
      cinema_screen: { level: 'semi_captive', avgDwellTime: 120, attentionLevel: 0.85, premiumScore: 70 },
      billboard_led: { level: 'public', avgDwellTime: 3, attentionLevel: 0.2, premiumScore: 40 },
      bus_shelter: { level: 'public', avgDwellTime: 2, attentionLevel: 0.15, premiumScore: 30 },
    };

    return captivityMap[screenType] || {
      level: 'public',
      avgDwellTime: 5,
      attentionLevel: 0.3,
      premiumScore: 50,
    };
  }
}

// Export singleton
export const doohIntelligence = new DOOHIntelligenceClient();

// ============================================================================
// PRICING HELPER
// ============================================================================

/**
 * Calculate final CPM with intelligence adjustments
 */
export function calculateIntelligentCPM(params: {
  baseCPM: number;
  screenType: string;
  cityTier: 'metro' | 'tier1' | 'tier2' | 'tier3';
  isPeakHour: boolean;
  isWeekend: boolean;
  audienceMatch?: AudienceMatch;
}): number {
  let multiplier = 1.0;

  // City tier multiplier
  const tierMultipliers = {
    metro: 2.5,
    tier1: 2.0,
    tier2: 1.3,
    tier3: 1.0,
  };
  multiplier *= tierMultipliers[params.cityTier];

  // Time multiplier
  if (params.isPeakHour) multiplier *= 2.0;
  if (params.isWeekend) multiplier *= 1.3;

  // Captivity multiplier
  const captivity = doohIntelligence.getCaptivityMetrics(params.screenType);
  if (captivity.level === 'captive_private') multiplier *= 1.5;
  else if (captivity.level === 'semi_captive') multiplier *= 1.2;

  // Audience match bonus
  if (params.audienceMatch) {
    multiplier *= params.audienceMatch.priceAdjustment;
  }

  return Math.round(params.baseCPM * multiplier * 100) / 100;
}

export default doohIntelligence;
