/**
 * REZ Media Intelligence Service
 *
 * Connects REZ Media platform to REZ Intelligence
 * Powers personalized marketing, ad optimization, and loyalty
 */

import axios, { AxiosError } from 'axios';

const INTELLIGENCE_URL = process.env.INTELLIGENCE_URL || 'https://rez-intelligence.onrender.com';
const LOYALTY_URL = process.env.LOYALTY_URL || 'https://rez-loyalty.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// Type definitions
export type RFMTier = 'platinum' | 'gold' | 'silver' | 'bronze';
export type ChurnRisk = 'low' | 'medium' | 'high';

export interface CustomerProfile {
  customerId: string;
  segments: string[];
  rfmTier: RFMTier;
  churnRisk: ChurnRisk;
  ltv: number;
  preferences: string[];
}

export interface RFMScore {
  score: number;
  recency: number;
  frequency: number;
  monetary: number;
}

export interface ChurnPrediction {
  risk: ChurnRisk;
  probability: number;
  factors: string[];
}

export interface LTVPrediction {
  lifetimeValue: number;
  predictedMonths: number;
  confidence: number;
}

export interface Segment {
  id: string;
  name: string;
  preferences?: string[];
  criteria?: Record<string, unknown>;
}

export interface CampaignTargets {
  segments: string[];
  customerIds: string[];
  estimatedReach: number;
}

export interface PersonalizedContent {
  content: string;
  subject?: string;
  offer?: {
    discount: number;
    expiresIn: number;
    code?: string;
  };
}

export type ContentType = 'offer' | 'email' | 'notification';

export interface DOOHContext {
  timeOfDay: string;
  location: string;
  nearbyCustomers: string[];
}

export interface OptimizedAd {
  adId: string;
  reason: string;
  expectedEngagement: number;
  adContent?: {
    title: string;
    imageUrl: string;
    ctaText: string;
  };
}

export interface TierBenefits {
  cashbackRate: number;
  freeDelivery: boolean;
  prioritySupport: boolean;
  exclusiveAccess: string[];
}

export interface LoyaltyOffer {
  offerId: string;
  customerId: string;
  type: 'retention' | 'welcome' | 'promotional';
  discount: number;
  expiresAt: Date;
  status: 'pending' | 'used' | 'expired';
}

// Error types
export class MediaIntelligenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'MediaIntelligenceError';
  }
}

// HTTP Client configuration
const httpClient = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for internal token
httpClient.interceptors.request.use((config) => {
  if (INTERNAL_TOKEN) {
    config.headers['X-Internal-Token'] = INTERNAL_TOKEN;
  }
  return config;
});

// Response interceptor for error handling
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      throw new MediaIntelligenceError(
        error.response.data instanceof Object
          ? JSON.stringify(error.response.data)
          : String(error.response.data),
        'API_ERROR',
        error.response.status
      );
    } else if (error.request) {
      throw new MediaIntelligenceError(
        'No response received from intelligence service',
        'NETWORK_ERROR'
      );
    } else {
      throw new MediaIntelligenceError(
        error.message || 'Unknown error',
        'UNKNOWN_ERROR'
      );
    }
  }
);

/**
 * Get AI-powered customer profile combining RFM, churn, LTV, and segment data
 * @param customerId - Unique customer identifier
 * @returns Complete customer profile with AI insights
 */
export async function getCustomerProfile(customerId: string): Promise<CustomerProfile> {
  if (!customerId || typeof customerId !== 'string') {
    throw new MediaIntelligenceError('Invalid customer ID', 'INVALID_INPUT');
  }

  const [rfm, churn, ltv, segments] = await Promise.all([
    getRFMSegment(customerId),
    predictChurn(customerId),
    predictLTV(customerId),
    getUserSegments(customerId)
  ]);

  return {
    customerId,
    segments: segments.map((s: Segment) => s.name),
    rfmTier: mapRFMScore(rfm.score),
    churnRisk: churn.risk,
    ltv: ltv.lifetimeValue,
    preferences: extractPreferences(segments),
  };
}

/**
 * Get RFM (Recency, Frequency, Monetary) score for a customer
 */
async function getRFMSegment(customerId: string): Promise<RFMScore> {
  try {
    const response = await httpClient.get<RFMScore>(`${INTELLIGENCE_URL}/api/rfm/${customerId}`);
    return response.data;
  } catch (error) {
    // Return default score if service unavailable
    console.warn(`RFM service unavailable for ${customerId}, using default`);
    return { score: 50, recency: 50, frequency: 50, monetary: 50 };
  }
}

/**
 * Predict customer churn risk using ML model
 */
async function predictChurn(customerId: string): Promise<ChurnPrediction> {
  try {
    const response = await httpClient.get<ChurnPrediction>(`${INTELLIGENCE_URL}/api/churn/${customerId}`);
    return response.data;
  } catch (error) {
    console.warn(`Churn prediction unavailable for ${customerId}, using default`);
    return { risk: 'medium', probability: 0.5, factors: ['service_unavailable'] };
  }
}

/**
 * Predict customer lifetime value using ML model
 */
async function predictLTV(customerId: string): Promise<LTVPrediction> {
  try {
    const response = await httpClient.get<LTVPrediction>(`${INTELLIGENCE_URL}/api/ltv/${customerId}`);
    return response.data;
  } catch (error) {
    console.warn(`LTV prediction unavailable for ${customerId}, using default`);
    return { lifetimeValue: 0, predictedMonths: 0, confidence: 0 };
  }
}

/**
 * Get user segments from intelligence platform
 */
async function getUserSegments(customerId: string): Promise<Segment[]> {
  try {
    const response = await httpClient.get<{ segments: Segment[] }>(
      `${INTELLIGENCE_URL}/api/segments/${customerId}`
    );
    return response.data.segments || [];
  } catch (error) {
    console.warn(`Segments unavailable for ${customerId}, using default`);
    return [];
  }
}

/**
 * Map RFM score to tier
 */
export function mapRFMScore(score: number): RFMTier {
  if (score >= 80) return 'platinum';
  if (score >= 60) return 'gold';
  if (score >= 40) return 'silver';
  return 'bronze';
}

/**
 * Extract preferences from segments
 */
function extractPreferences(segments: Segment[]): string[] {
  const prefs: string[] = [];
  segments.forEach((s: Segment) => {
    if (s.preferences) {
      prefs.push(...s.preferences);
    }
  });
  return [...new Set(prefs)];
}

/**
 * Get campaign targeting information
 * @param campaignId - Unique campaign identifier
 * @returns Campaign targets with segments and customer IDs
 */
export async function getCampaignTargets(campaignId: string): Promise<CampaignTargets> {
  if (!campaignId || typeof campaignId !== 'string') {
    throw new MediaIntelligenceError('Invalid campaign ID', 'INVALID_INPUT');
  }

  try {
    const response = await httpClient.get<CampaignTargets>(
      `${INTELLIGENCE_URL}/api/campaigns/${campaignId}/targets`
    );
    return response.data;
  } catch (error) {
    console.warn(`Campaign targets unavailable for ${campaignId}`);
    return {
      segments: [],
      customerIds: [],
      estimatedReach: 0,
    };
  }
}

/**
 * Generate AI-powered personalized content for customer
 * @param customerId - Unique customer identifier
 * @param contentType - Type of content to generate
 * @returns Personalized content with optional offer
 */
export async function generatePersonalizedContent(
  customerId: string,
  contentType: ContentType
): Promise<PersonalizedContent> {
  if (!customerId || typeof customerId !== 'string') {
    throw new MediaIntelligenceError('Invalid customer ID', 'INVALID_INPUT');
  }

  const profile = await getCustomerProfile(customerId);

  try {
    const response = await httpClient.post<PersonalizedContent>(
      `${INTELLIGENCE_URL}/api/generate/content`,
      {
        customerId,
        profile,
        contentType,
      }
    );
    return response.data;
  } catch (error) {
    // Generate fallback content
    return generateFallbackContent(profile, contentType);
  }
}

/**
 * Generate fallback content when AI service is unavailable
 */
function generateFallbackContent(
  profile: CustomerProfile,
  contentType: ContentType
): PersonalizedContent {
  const tierDiscounts: Record<RFMTier, number> = {
    platinum: 20,
    gold: 15,
    silver: 10,
    bronze: 5,
  };

  const discount = tierDiscounts[profile.rfmTier];
  const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days

  const templates: Record<ContentType, { content: string; offer?: PersonalizedContent['offer'] }> = {
    offer: {
      content: `Exclusive ${discount}% off just for you, ${profile.rfmTier} member!`,
      offer: {
        discount,
        expiresIn,
        code: `WELCOME${profile.rfmTier.toUpperCase()}`,
      },
    },
    email: {
      content: `Dear Valued Customer,\n\nAs a ${profile.rfmTier} member, you deserve exclusive rewards. Use code WELCOME${profile.rfmTier.toUpperCase()} for ${discount}% off your next order.\n\nBest regards,\nREZ Media Team`,
      offer: {
        discount,
        expiresIn,
        code: `WELCOME${profile.rfmTier.toUpperCase()}`,
      },
    },
    notification: {
      content: `Hey! Your ${profile.rfmTier} status just unlocked ${discount}% off. Tap to shop now!`,
      offer: {
        discount,
        expiresIn,
        code: `WELCOME${profile.rfmTier.toUpperCase()}`,
      },
    },
  };

  return templates[contentType];
}

/**
 * Optimize DOOH (Digital Out of Home) ad selection
 * @param screenId - Unique screen identifier
 * @param context - Current context including time, location, and nearby customers
 * @returns Optimized ad with reasoning
 */
export async function optimizeDOOHAd(
  screenId: string,
  context: DOOHContext
): Promise<OptimizedAd> {
  if (!screenId || typeof screenId !== 'string') {
    throw new MediaIntelligenceError('Invalid screen ID', 'INVALID_INPUT');
  }

  if (!context || !context.timeOfDay || !context.location) {
    throw new MediaIntelligenceError('Invalid context', 'INVALID_INPUT');
  }

  // Get customer profiles nearby (limit to prevent overload)
  const nearbyCustomers = context.nearbyCustomers.slice(0, 50);
  const profiles = await Promise.all(
    nearbyCustomers.map((id: string) => getCustomerProfile(id))
  );

  try {
    const response = await httpClient.post<OptimizedAd>(
      `${INTELLIGENCE_URL}/api/dooh/optimize`,
      {
        screenId,
        context,
        profiles,
      }
    );
    return response.data;
  } catch (error) {
    // Return default ad when service unavailable
    return selectDefaultAd(context, profiles);
  }
}

/**
 * Select default ad based on audience composition
 */
function selectDefaultAd(
  context: DOOHContext,
  profiles: CustomerProfile[]
): OptimizedAd {
  // Analyze audience composition
  const tierCounts = profiles.reduce(
    (acc, p) => {
      acc[p.rfmTier] = (acc[p.rfmTier] || 0) + 1;
      return acc;
    },
    {} as Record<RFMTier, number>
  );

  const dominantTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as RFMTier || 'bronze';

  const adMap: Record<string, OptimizedAd> = {
    morning: {
      adId: 'ad_rez_breakfast',
      reason: `Morning audience - ${dominantTier} tier customers`,
      expectedEngagement: 0.75,
      adContent: {
        title: 'Start Your Day Right',
        imageUrl: 'https://cdn.rez.money/ads/morning-special.jpg',
        ctaText: 'Shop Now',
      },
    },
    afternoon: {
      adId: 'ad_rez_lunch',
      reason: `Afternoon rush - ${dominantTier} tier customers`,
      expectedEngagement: 0.82,
      adContent: {
        title: 'Lunch Deals',
        imageUrl: 'https://cdn.rez.money/ads/lunch-deals.jpg',
        ctaText: 'Order Now',
      },
    },
    evening: {
      adId: 'ad_rez_evening',
      reason: `Evening shoppers - ${dominantTier} tier customers`,
      expectedEngagement: 0.88,
      adContent: {
        title: 'Evening Specials',
        imageUrl: 'https://cdn.rez.money/ads/evening-specials.jpg',
        ctaText: 'Explore',
      },
    },
  };

  const timeKey = context.timeOfDay.toLowerCase();
  return adMap[timeKey] || {
    adId: 'ad_rez_default',
    reason: 'Default ad - time-based selection',
    expectedEngagement: 0.65,
    adContent: {
      title: 'Discover REZ',
      imageUrl: 'https://cdn.rez.money/ads/default.jpg',
      ctaText: 'Learn More',
    },
  };
}

/**
 * Get tier benefits for a customer tier
 * @param tier - Customer RFM tier
 * @returns Tier benefits configuration
 */
export function getTierBenefits(tier: RFMTier): TierBenefits {
  const benefits: Record<RFMTier, TierBenefits> = {
    platinum: {
      cashbackRate: 5,
      freeDelivery: true,
      prioritySupport: true,
      exclusiveAccess: ['early_access', 'vip_events', 'personal_shopper'],
    },
    gold: {
      cashbackRate: 3,
      freeDelivery: true,
      prioritySupport: false,
      exclusiveAccess: ['early_access', 'vip_events'],
    },
    silver: {
      cashbackRate: 2,
      freeDelivery: false,
      prioritySupport: false,
      exclusiveAccess: ['early_access'],
    },
    bronze: {
      cashbackRate: 1,
      freeDelivery: false,
      prioritySupport: false,
      exclusiveAccess: [],
    },
  };

  return benefits[tier];
}

/**
 * Trigger re-engagement campaign for at-risk customers
 * @param customerId - Unique customer identifier
 */
export async function triggerReEngagement(customerId: string): Promise<void> {
  if (!customerId || typeof customerId !== 'string') {
    throw new MediaIntelligenceError('Invalid customer ID', 'INVALID_INPUT');
  }

  const profile = await getCustomerProfile(customerId);

  if (profile.churnRisk === 'high') {
    // Send special offer based on tier
    await sendChurnOffer(customerId, profile.rfmTier);
  }
}

/**
 * Send churn prevention offer to customer
 */
async function sendChurnOffer(
  customerId: string,
  tier: RFMTier
): Promise<void> {
  const offerAmounts: Record<RFMTier, number> = {
    platinum: 500,
    gold: 300,
    silver: 150,
    bronze: 100,
  };

  const offerAmount = offerAmounts[tier];

  try {
    await httpClient.post(
      `${LOYALTY_URL}/api/offers/create`,
      {
        customerId,
        type: 'retention',
        discount: offerAmount,
        reason: 'churn_prevention',
        expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      },
      {
        headers: {
          'X-Internal-Token': INTERNAL_TOKEN,
        },
      }
    );
  } catch (error) {
    console.error(`Failed to send churn offer to ${customerId}:`, error);
    throw new MediaIntelligenceError(
      'Failed to create retention offer',
      'LOYALTY_API_ERROR'
    );
  }
}

/**
 * Batch get customer profiles for multiple customers
 * @param customerIds - Array of customer identifiers
 * @returns Array of customer profiles
 */
export async function getBatchCustomerProfiles(
  customerIds: string[]
): Promise<CustomerProfile[]> {
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    throw new MediaIntelligenceError('Invalid customer IDs array', 'INVALID_INPUT');
  }

  // Limit batch size to prevent overload
  const limitedIds = customerIds.slice(0, 100);

  return Promise.all(
    limitedIds.map((id: string) => getCustomerProfile(id))
  );
}

/**
 * Get segment analysis for a specific segment
 * @param segmentId - Unique segment identifier
 * @returns Segment statistics and characteristics
 */
export async function getSegmentAnalysis(segmentId: string): Promise<{
  id: string;
  name: string;
  size: number;
  avgLTV: number;
  churnRisk: ChurnRisk;
  topPreferences: string[];
}> {
  try {
    const response = await httpClient.get(
      `${INTELLIGENCE_URL}/api/segments/${segmentId}/analysis`
    );
    return response.data;
  } catch (error) {
    console.warn(`Segment analysis unavailable for ${segmentId}`);
    return {
      id: segmentId,
      name: 'Unknown Segment',
      size: 0,
      avgLTV: 0,
      churnRisk: 'medium',
      topPreferences: [],
    };
  }
}

/**
 * Get content recommendations for a customer segment
 * @param segmentId - Unique segment identifier
 * @returns Recommended content types and themes
 */
export async function getContentRecommendations(
  segmentId: string
): Promise<{
  contentTypes: ContentType[];
  themes: string[];
  bestTimes: string[];
}> {
  try {
    const response = await httpClient.get(
      `${INTELLIGENCE_URL}/api/segments/${segmentId}/recommendations`
    );
    return response.data;
  } catch (error) {
    // Return default recommendations
    return {
      contentTypes: ['offer', 'email', 'notification'],
      themes: ['discount', 'new_arrivals', 'loyalty'],
      bestTimes: ['morning', 'evening'],
    };
  }
}

/**
 * Health check for intelligence service connectivity
 * @returns Service health status
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    intelligence: boolean;
    loyalty: boolean;
  };
}> {
  const results = {
    intelligence: false,
    loyalty: false,
  };

  try {
    await httpClient.get(`${INTELLIGENCE_URL}/health`, { timeout: 3000 });
    results.intelligence = true;
  } catch {
    results.intelligence = false;
  }

  try {
    await httpClient.get(`${LOYALTY_URL}/health`, { timeout: 3000 });
    results.loyalty = true;
  } catch {
    results.loyalty = false;
  }

  const allHealthy = results.intelligence && results.loyalty;
  const anyHealthy = results.intelligence || results.loyalty;

  return {
    status: allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy',
    services: results,
  };
}
