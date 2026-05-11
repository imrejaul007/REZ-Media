/**
 * Loyalty Integration Service
 *
 * Connects rez-marketing to the REZ Loyalty Ecosystem via Profile Aggregator.
 *
 * Integrates:
 * - ReZ Score (0-1000) for targeting
 * - Tier (bronze, silver, gold, platinum, diamond) for personalization
 * - Streak (7-day milestone) for campaign triggers
 * - Badges for targeting
 * - Karma for segmentation
 *
 * Profile Aggregator: http://localhost:4025
 */

import { logger } from '../config/logger';
import { getRedis } from '../config/redis';

// ── Configuration ───────────────────────────────────────────────────────────────

const PROFILE_AGGREGATOR_URL = process.env.PROFILE_AGGREGATOR_URL || 'http://localhost:4025';
const PROFILE_AGGREGATOR_TIMEOUT_MS = 5000;

// ── Type Definitions ───────────────────────────────────────────────────────────

/**
 * ReZ Score ranges from 0-1000
 * Used for engagement scoring and targeting
 */
export type ReZScoreRange = {
  min?: number;
  max?: number;
};

/**
 * Loyalty Tier levels in ascending order
 */
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

/**
 * Streak milestone configurations
 */
export type StreakMilestone = 7 | 14 | 30 | 60 | 90 | 180 | 365;

/**
 * Karma levels for user segmentation
 */
export type KarmaLevel = 'newcomer' | 'active' | 'contributor' | 'expert' | 'legend';

/**
 * Complete loyalty profile from Profile Aggregator
 */
export interface LoyaltyProfile {
  userId: string;
  score: number;                    // 0-1000 ReZ Score
  tier: LoyaltyTier;
  streak: {
    current: number;               // Current streak days
    longest: number;               // Longest streak ever
    milestones: StreakMilestone[]; // Achieved milestones
  };
  badges: string[];                 // Earned badge IDs
  karma: {
    level: KarmaLevel;
    points: number;
    rank?: number;
  };
  metadata: {
    enrolledAt: Date;
    lastActivityAt: Date;
    tierProgress?: number;         // 0-100 progress to next tier
    nextTier?: LoyaltyTier;
  };
}

/**
 * Loyalty targeting criteria for audience building
 */
export interface LoyaltyTargetingCriteria {
  scoreRange?: ReZScoreRange;
  tiers?: LoyaltyTier[];
  streakMilestones?: StreakMilestone[];
  hasBadges?: string[];           // Users who have ANY of these badges
  hasAllBadges?: boolean;        // If true, users must have ALL badges in hasBadges
  karmaLevels?: KarmaLevel[];
  excludeUsers?: string[];       // User IDs to exclude
}

/**
 * Loyalty event types that can trigger campaigns
 */
export type LoyaltyEventType =
  | 'tier_upgrade'
  | 'tier_downgrade'
  | 'milestone_reached'
  | 'badge_earned'
  | 'streak_maintained'
  | 'streak_broken'
  | 'high_score_achieved'
  | 'karma_level_up';

/**
 * Loyalty event payload for campaign triggers
 */
export interface LoyaltyEvent {
  type: LoyaltyEventType;
  userId: string;
  timestamp: Date;
  data: {
    previousValue?: string | number;
    newValue?: string | number;
    tier?: LoyaltyTier;
    milestone?: StreakMilestone;
    badgeId?: string;
    score?: number;
  };
}

/**
 * Personalization variables for message content
 */
export interface LoyaltyPersonalizationVars {
  userFirstName?: string;
  userScore?: number;
  userTier?: LoyaltyTier;
  userTierDisplay?: string;      // Formatted tier name
  tierProgress?: number;
  nextTier?: LoyaltyTier;
  currentStreak?: number;
  longestStreak?: number;
  recentBadge?: string;
  karmaLevel?: KarmaLevel;
  karmaPoints?: number;
  karmaRank?: number;
}

/**
 * Campaign trigger configuration for loyalty events
 */
export interface LoyaltyCampaignTrigger {
  id: string;
  merchantId: string;
  loyaltyEvent: LoyaltyEventType;
  campaignId: string;
  personalizationTemplate?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ── HTTP Client ────────────────────────────────────────────────────────────────

async function fetchFromProfileAggregator<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROFILE_AGGREGATOR_TIMEOUT_MS);

  try {
    const response = await fetch(`${PROFILE_AGGREGATOR_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'rez-marketing',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('[LoyaltyIntegration] Profile Aggregator error', {
        status: response.status,
        endpoint,
        error: errorText,
      });
      return {
        success: false,
        error: `Profile Aggregator returned ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('[LoyaltyIntegration] Profile Aggregator timeout', { endpoint });
      return {
        success: false,
        error: 'Profile Aggregator request timed out',
        code: 'TIMEOUT',
      };
    }

    logger.error('[LoyaltyIntegration] Profile Aggregator fetch error', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: 'Failed to connect to Profile Aggregator',
      code: 'CONNECTION_ERROR',
    };
  }
}

// ── Loyalty Profile Service ────────────────────────────────────────────────────

/**
 * Fetch loyalty profile for a single user
 */
export async function getLoyaltyProfile(userId: string): Promise<LoyaltyProfile | null> {
  const response = await fetchFromProfileAggregator<{ profile: LoyaltyProfile }>(
    `/api/profile/${userId}/loyalty`
  );

  if (!response.success || !response.data) {
    return null;
  }

  return response.data.profile;
}

/**
 * Fetch loyalty profiles for multiple users
 */
export async function getLoyaltyProfiles(userIds: string[]): Promise<Map<string, LoyaltyProfile>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const response = await fetchFromProfileAggregator<{ profiles: LoyaltyProfile[] }>(
    '/api/profiles/loyalty',
    {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }
  );

  if (!response.success || !response.data) {
    return new Map();
  }

  const profileMap = new Map<string, LoyaltyProfile>();
  for (const profile of response.data.profiles) {
    profileMap.set(profile.userId, profile);
  }

  return profileMap;
}

/**
 * Get loyalty summary statistics for a merchant's user base
 */
export async function getLoyaltyStats(merchantId: string): Promise<{
  totalUsers: number;
  tierDistribution: Record<LoyaltyTier, number>;
  averageScore: number;
  averageStreak: number;
  topBadges: Array<{ badgeId: string; count: number }>;
  karmaDistribution: Record<KarmaLevel, number>;
}> {
  const response = await fetchFromProfileAggregator<{
    stats: {
      totalUsers: number;
      tierDistribution: Record<LoyaltyTier, number>;
      averageScore: number;
      averageStreak: number;
      topBadges: Array<{ badgeId: string; count: number }>;
      karmaDistribution: Record<KarmaLevel, number>;
    };
  }>(`/api/merchants/${merchantId}/loyalty-stats`);

  if (!response.success || !response.data) {
    // Return empty stats on error
    return {
      totalUsers: 0,
      tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0 },
      averageScore: 0,
      averageStreak: 0,
      topBadges: [],
      karmaDistribution: { newcomer: 0, active: 0, contributor: 0, expert: 0, legend: 0 },
    };
  }

  return response.data.stats;
}

// ── Targeting Service ─────────────────────────────────────────────────────────

/**
 * Get user IDs matching loyalty targeting criteria
 */
export async function getUsersByLoyaltyCriteria(
  merchantId: string,
  criteria: LoyaltyTargetingCriteria
): Promise<string[]> {
  const response = await fetchFromProfileAggregator<{ userIds: string[] }>(
    `/api/merchants/${merchantId}/loyalty/target`,
    {
      method: 'POST',
      body: JSON.stringify({ criteria }),
    }
  );

  if (!response.success || !response.data) {
    return [];
  }

  return response.data.userIds;
}

/**
 * Build MongoDB filter for loyalty criteria (for local queries)
 */
export function buildLoyaltyFilter(criteria: LoyaltyTargetingCriteria): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (criteria.scoreRange) {
    filter['loyalty.score'] = {};
    if (criteria.scoreRange.min !== undefined) {
      (filter['loyalty.score'] as Record<string, number>).$gte = criteria.scoreRange.min;
    }
    if (criteria.scoreRange.max !== undefined) {
      (filter['loyalty.score'] as Record<string, number>).$lte = criteria.scoreRange.max;
    }
  }

  if (criteria.tiers && criteria.tiers.length > 0) {
    filter['loyalty.tier'] = { $in: criteria.tiers };
  }

  if (criteria.karmaLevels && criteria.karmaLevels.length > 0) {
    filter['loyalty.karma.level'] = { $in: criteria.karmaLevels };
  }

  if (criteria.hasBadges && criteria.hasBadges.length > 0) {
    if (criteria.hasAllBadges) {
      filter['loyalty.badges'] = { $all: criteria.hasBadges };
    } else {
      filter['loyalty.badges'] = { $in: criteria.hasBadges };
    }
  }

  if (criteria.excludeUsers && criteria.excludeUsers.length > 0) {
    filter._id = { $nin: criteria.excludeUsers };
  }

  return filter;
}

/**
 * Estimate audience size based on loyalty criteria
 * Uses Redis caching to avoid repeated expensive queries
 */
export async function estimateLoyaltyAudience(
  merchantId: string,
  criteria: LoyaltyTargetingCriteria
): Promise<number> {
  const redis = getRedis();
  const cacheKey = `mkt:loyalty:estimate:${merchantId}:${JSON.stringify(criteria)}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return parseInt(cached, 10);
    }
  } catch {
    // Redis error - continue without cache
  }

  const userIds = await getUsersByLoyaltyCriteria(merchantId, criteria);
  const count = userIds.length;

  // Cache for 5 minutes
  try {
    await redis.setex(cacheKey, 300, String(count));
  } catch {
    // Redis error - ignore cache failure
  }

  return count;
}

// ── Personalization Service ──────────────────────────────────────────────────

/**
 * Generate personalization variables from loyalty profile
 */
export function generatePersonalizationVars(profile: LoyaltyProfile): LoyaltyPersonalizationVars {
  const tierDisplayNames: Record<LoyaltyTier, string> = {
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    diamond: 'Diamond',
  };

  return {
    userScore: profile.score,
    userTier: profile.tier,
    userTierDisplay: tierDisplayNames[profile.tier],
    tierProgress: profile.metadata.tierProgress,
    nextTier: profile.metadata.nextTier,
    currentStreak: profile.streak.current,
    longestStreak: profile.streak.longest,
    recentBadge: profile.badges[profile.badges.length - 1],
    karmaLevel: profile.karma.level,
    karmaPoints: profile.karma.points,
    karmaRank: profile.karma.rank,
  };
}

/**
 * Personalize message template with loyalty variables
 */
export function personalizeMessage(
  template: string,
  vars: LoyaltyPersonalizationVars
): string {
  let personalized = template;

  // Tier-based replacements
  if (vars.userTierDisplay) {
    personalized = personalized.replace(/\{\{user\.tier\}\}/gi, vars.userTierDisplay);
  }

  if (vars.nextTier) {
    const nextTierDisplay = vars.userTierDisplay
      ? vars.userTierDisplay.charAt(0).toUpperCase() + vars.userTierDisplay.slice(1)
      : vars.nextTier;
    personalized = personalized.replace(/\{\{user\.nextTier\}\}/gi, nextTierDisplay);
  }

  // Score replacements
  if (vars.userScore !== undefined) {
    personalized = personalized.replace(/\{\{user\.score\}\}/gi, String(vars.userScore));
    personalized = personalized.replace(/\{\{user\.score1000\}\}/gi, String(vars.userScore));
  }

  // Streak replacements
  if (vars.currentStreak !== undefined) {
    personalized = personalized.replace(/\{\{user\.streak\}\}/gi, String(vars.currentStreak));
    personalized = personalized.replace(
      /\{\{user\.streakDays\}\}/gi,
      vars.currentStreak === 1 ? 'day' : 'days'
    );
  }

  if (vars.longestStreak !== undefined) {
    personalized = personalized.replace(/\{\{user\.longestStreak\}\}/gi, String(vars.longestStreak));
  }

  // Progress replacements
  if (vars.tierProgress !== undefined) {
    personalized = personalized.replace(/\{\{user\.tierProgress\}\}/gi, String(Math.round(vars.tierProgress)));
    personalized = personalized.replace(
      /\{\{user\.tierProgressBar\}\}/gi,
      generateProgressBar(vars.tierProgress)
    );
  }

  // Badge replacements
  if (vars.recentBadge) {
    personalized = personalized.replace(/\{\{user\.recentBadge\}\}/gi, formatBadgeName(vars.recentBadge));
  }

  // Karma replacements
  if (vars.karmaLevel) {
    personalized = personalized.replace(/\{\{user\.karma\}\}/gi, capitalizeFirst(vars.karmaLevel));
  }

  if (vars.karmaPoints !== undefined) {
    personalized = personalized.replace(/\{\{user\.karmaPoints\}\}/gi, formatNumber(vars.karmaPoints));
  }

  if (vars.karmaRank !== undefined) {
    personalized = personalized.replace(/\{\{user\.karmaRank\}\}/gi, formatOrdinal(vars.karmaRank));
  }

  return personalized;
}

/**
 * Generate ASCII progress bar for tier progress
 */
function generateProgressBar(progress: number, length: number = 10): string {
  const filled = Math.round((progress / 100) * length);
  const empty = length - filled;
  return '[' + '■'.repeat(filled) + '□'.repeat(empty) + ']';
}

/**
 * Format badge ID into display name
 */
function formatBadgeName(badgeId: string): string {
  return badgeId
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(capitalizeFirst)
    .join(' ');
}

/**
 * Format large numbers with K/M suffixes
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(num);
}

/**
 * Convert number to ordinal (1st, 2nd, 3rd, etc.)
 */
function formatOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Event Processing ──────────────────────────────────────────────────────────

/**
 * Process loyalty event and trigger associated campaigns
 */
export async function processLoyaltyEvent(
  event: LoyaltyEvent
): Promise<{ triggered: boolean; campaignIds: string[] }> {
  const campaignIds: string[] = [];

  // Store event for processing
  const redis = getRedis();
  const eventKey = `mkt:loyalty:event:${event.userId}:${Date.now()}`;

  try {
    await redis.setex(eventKey, 86400, JSON.stringify(event));
  } catch (err) {
    logger.warn('[LoyaltyIntegration] Failed to store event', {
      userId: event.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Fetch triggers for this event type
  const triggers = await getCampaignTriggers(event.type);

  for (const trigger of triggers) {
    if (!trigger.active) continue;

    // Fetch user profile for personalization
    const profile = await getLoyaltyProfile(event.userId);
    if (!profile) continue;

    // Apply additional filters if specified in trigger
    if (trigger.data.tier && profile.tier !== trigger.data.tier) continue;
    if (trigger.data.score !== undefined && profile.score < trigger.data.score) continue;

    // Personalize message if template provided
    let personalizedMessage: string | undefined;
    if (trigger.personalizationTemplate) {
      const vars = generatePersonalizationVars(profile);
      personalizedMessage = personalizeMessage(trigger.personalizationTemplate, vars);
    }

    // Queue campaign trigger
    await queueCampaignTrigger(trigger.campaignId, event.userId, personalizedMessage);
    campaignIds.push(trigger.campaignId);

    // Track event
    await trackLoyaltyEvent(event, trigger.campaignId);
  }

  return {
    triggered: campaignIds.length > 0,
    campaignIds,
  };
}

/**
 * Get active campaign triggers for a loyalty event type
 */
export async function getCampaignTriggers(
  eventType: LoyaltyEventType
): Promise<LoyaltyCampaignTrigger[]> {
  const response = await fetchFromProfileAggregator<{ triggers: LoyaltyCampaignTrigger[] }>(
    `/api/loyalty/triggers?eventType=${eventType}&active=true`
  );

  if (!response.success || !response.data) {
    return [];
  }

  return response.data.triggers;
}

/**
 * Queue campaign trigger for async processing
 */
async function queueCampaignTrigger(
  campaignId: string,
  userId: string,
  personalizedMessage?: string
): Promise<void> {
  const redis = getRedis();
  const queueKey = 'mkt:loyalty:campaign:queue';

  try {
    await redis.rpush(queueKey, JSON.stringify({
      campaignId,
      userId,
      personalizedMessage,
      queuedAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.error('[LoyaltyIntegration] Failed to queue campaign trigger', {
      campaignId,
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Track loyalty event for analytics
 */
async function trackLoyaltyEvent(
  event: LoyaltyEvent,
  campaignId: string
): Promise<void> {
  const redis = getRedis();
  const trackKey = `mkt:loyalty:track:${event.type}`;

  try {
    await redis.hincrby(trackKey, campaignId, 1);
    await redis.expire(trackKey, 86400);
  } catch {
    // Tracking failure is non-critical
  }
}

// ── Tier-Based Content Rules ──────────────────────────────────────────────────

/**
 * Tier-specific content modifiers
 */
export const TIER_CONTENT_MODIFIERS: Record<
  LoyaltyTier,
  {
    discountMultiplier: number;
    priorityAccess: boolean;
    exclusiveOffers: boolean;
    freeShipping: boolean;
  }
> = {
  bronze: {
    discountMultiplier: 1.0,
    priorityAccess: false,
    exclusiveOffers: false,
    freeShipping: false,
  },
  silver: {
    discountMultiplier: 1.1,
    priorityAccess: false,
    exclusiveOffers: false,
    freeShipping: false,
  },
  gold: {
    discountMultiplier: 1.2,
    priorityAccess: true,
    exclusiveOffers: false,
    freeShipping: false,
  },
  platinum: {
    discountMultiplier: 1.3,
    priorityAccess: true,
    exclusiveOffers: true,
    freeShipping: true,
  },
  diamond: {
    discountMultiplier: 1.5,
    priorityAccess: true,
    exclusiveOffers: true,
    freeShipping: true,
  },
};

/**
 * Generate tier-based message variations
 */
export function generateTierMessage(
  baseMessage: string,
  tier: LoyaltyTier
): string {
  const modifiers = TIER_CONTENT_MODIFIERS[tier];
  let message = baseMessage;

  if (modifiers.priorityAccess) {
    message = message.replace(
      /\{\{tier\.perks\}\}/gi,
      'You have priority access to exclusive rewards!'
    );
  }

  if (modifiers.exclusiveOffers) {
    message = message.replace(
      /\{\{tier\.perks\}\}/gi,
      'Unlock exclusive offers available only to premium members!'
    );
  }

  if (modifiers.freeShipping) {
    if (!message.includes('free shipping')) {
      message = message.replace(
        /\{\{tier\.shipping\}\}/gi,
        'Enjoy FREE shipping on all orders!'
      );
    }
  }

  // Apply discount percentage based on tier
  const discountPercent = Math.round((modifiers.discountMultiplier - 1) * 100);
  if (discountPercent > 0) {
    message = message.replace(
      /\{\{tier\.bonus\}\}/gi,
      `+${discountPercent}% bonus points on this purchase!`
    );
  }

  return message;
}

// ── Milestone Campaign Templates ─────────────────────────────────────────────

/**
 * Pre-defined campaign templates for streak milestones
 */
export const STREAK_MILESTONE_TEMPLATES: Record<
  StreakMilestone,
  { title: string; message: string; badgeId: string }
> = {
  7: {
    title: 'Week Warrior',
    message: 'Amazing! You\'ve maintained a {{user.streak}}-day streak! Keep it up!',
    badgeId: 'streak-week-warrior',
  },
  14: {
    title: 'Two Week Champion',
    message: 'Incredible! {{user.streak}} days of engagement! You\'re a champion!',
    badgeId: 'streak-two-week-champion',
  },
  30: {
    title: 'Monthly Master',
    message: 'Mind-blowing! A full month of daily engagement! You\'ve earned the Monthly Master badge!',
    badgeId: 'streak-monthly-master',
  },
  60: {
    title: 'Double Month Dynamo',
    message: 'Outstanding dedication! 60 days strong! Your commitment is inspiring!',
    badgeId: 'streak-double-month',
  },
  90: {
    title: 'Quarterly Queen/King',
    message: 'Legendary! 90 days of unbroken engagement! You\'re officially legendary!',
    badgeId: 'streak-quarterly-legend',
  },
  180: {
    title: 'Half Year Hero',
    message: 'UNREAL! 180 days! You\'ve achieved Half Year Hero status!',
    badgeId: 'streak-half-year-hero',
  },
  365: {
    title: 'Year of Gold',
    message: 'MONUMENTAL! A full year of daily engagement! You are forever in the Hall of Fame!',
    badgeId: 'streak-year-of-gold',
  },
};

// ── Health Check ─────────────────────────────────────────────────────────────

/**
 * Check connectivity to Profile Aggregator
 */
export async function checkProfileAggregatorHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${PROFILE_AGGREGATOR_URL}/health`, {
      signal: controller.signal,
      headers: { 'X-Internal-Service': 'rez-marketing' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        error: `Health check returned ${response.status}`,
      };
    }

    return {
      healthy: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ── Export Service Instance ────────────────────────────────────────────────────

export const loyaltyIntegration = {
  getLoyaltyProfile,
  getLoyaltyProfiles,
  getLoyaltyStats,
  getUsersByLoyaltyCriteria,
  buildLoyaltyFilter,
  estimateLoyaltyAudience,
  generatePersonalizationVars,
  personalizeMessage,
  processLoyaltyEvent,
  getCampaignTriggers,
  generateTierMessage,
  checkProfileAggregatorHealth,
};

export default loyaltyIntegration;
