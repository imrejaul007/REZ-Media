/**
 * Loyalty Integration Routes
 *
 * API endpoints for connecting rez-marketing to the REZ Loyalty Ecosystem.
 *
 * Endpoints:
 * - GET  /loyalty/profile/:userId         - Get user's loyalty profile
 * - POST /loyalty/profiles/batch          - Get multiple user profiles
 * - GET  /loyalty/stats/:merchantId       - Get loyalty statistics
 * - POST /loyalty/target                  - Find users by loyalty criteria
 * - POST /loyalty/estimate                - Estimate audience size
 * - POST /loyalty/personalize             - Personalize message with loyalty data
 * - POST /loyalty/event                   - Process loyalty event
 * - GET  /loyalty/triggers                - Get campaign triggers
 * - POST /loyalty/triggers                - Create campaign trigger
 * - PATCH /loyalty/triggers/:id           - Update campaign trigger
 * - DELETE /loyalty/triggers/:id         - Delete campaign trigger
 * - GET  /loyalty/health                 - Health check for Profile Aggregator
 */

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { verifyInternal, verifyMerchant } from '../middleware/auth';
import { logger } from '../config/logger';
import {
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
  LoyaltyTargetingCriteria,
  LoyaltyEvent,
  LoyaltyEventType,
  LoyaltyCampaignTrigger,
  LoyaltyTier,
  StreakMilestone,
  KarmaLevel,
  LoyaltyProfile,
} from '../services/loyaltyIntegrationService';

const router = Router();

// ── Validation Helpers ────────────────────────────────────────────────────────

function isValidObjectId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

function isValidUserId(id: string): boolean {
  // User IDs can be ObjectId or string format from external systems
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
}

function validateLoyaltyCriteria(criteria: unknown): criteria is LoyaltyTargetingCriteria {
  if (!criteria || typeof criteria !== 'object') return false;

  const c = criteria as Record<string, unknown>;

  // Validate score range
  if (c.scoreRange) {
    if (typeof c.scoreRange !== 'object') return false;
    const sr = c.scoreRange as Record<string, unknown>;
    if (sr.min !== undefined && (typeof sr.min !== 'number' || sr.min < 0 || sr.min > 1000)) return false;
    if (sr.max !== undefined && (typeof sr.max !== 'number' || sr.max < 0 || sr.max > 1000)) return false;
    if (sr.min !== undefined && sr.max !== undefined && sr.min > sr.max) return false;
  }

  // Validate tiers
  if (c.tiers) {
    if (!Array.isArray(c.tiers)) return false;
    const validTiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    for (const tier of c.tiers) {
      if (!validTiers.includes(tier as LoyaltyTier)) return false;
    }
  }

  // Validate streak milestones
  if (c.streakMilestones) {
    if (!Array.isArray(c.streakMilestones)) return false;
    const validMilestones: StreakMilestone[] = [7, 14, 30, 60, 90, 180, 365];
    for (const m of c.streakMilestones) {
      if (!validMilestones.includes(m as StreakMilestone)) return false;
    }
  }

  // Validate karma levels
  if (c.karmaLevels) {
    if (!Array.isArray(c.karmaLevels)) return false;
    const validLevels: KarmaLevel[] = ['newcomer', 'active', 'contributor', 'expert', 'legend'];
    for (const level of c.karmaLevels) {
      if (!validLevels.includes(level as KarmaLevel)) return false;
    }
  }

  // Validate exclude users
  if (c.excludeUsers) {
    if (!Array.isArray(c.excludeUsers)) return false;
    for (const id of c.excludeUsers) {
      if (typeof id !== 'string' || id.length > 100) return false;
    }
  }

  return true;
}

// ── Profile Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /loyalty/profile/:userId
 * Get loyalty profile for a single user
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!isValidUserId(userId)) {
    return res.status(400).json({ error: 'Invalid userId format' });
  }

  const profile = await getLoyaltyProfile(userId);

  if (!profile) {
    return res.status(404).json({
      error: 'Loyalty profile not found',
      userId,
    });
  }

  res.json({ profile });
});

/**
 * POST /loyalty/profiles/batch
 * Get loyalty profiles for multiple users
 * Body: { userIds: string[] }
 */
router.post('/profiles/batch', async (req: Request, res: Response) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: 'userIds must be an array' });
  }

  if (userIds.length === 0) {
    return res.status(400).json({ error: 'userIds array cannot be empty' });
  }

  if (userIds.length > 1000) {
    return res.status(400).json({ error: 'Maximum 1000 userIds per request' });
  }

  // Validate all userIds
  for (const userId of userIds) {
    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: `Invalid userId: ${userId}` });
    }
  }

  const profiles = await getLoyaltyProfiles(userIds);

  const result: Record<string, LoyaltyProfile | null> = {};
  for (const userId of userIds) {
    result[userId] = profiles.get(userId) || null;
  }

  res.json({
    profiles: result,
    total: userIds.length,
    found: profiles.size,
  });
});

// ── Statistics Endpoints ────────────────────────────────────────────────────────

/**
 * GET /loyalty/stats/:merchantId
 * Get loyalty statistics for a merchant's user base
 */
router.get('/stats/:merchantId', verifyMerchant, async (req: Request, res: Response) => {
  const { merchantId } = req.params;

  // Verify merchant access
  if (req.merchantId !== merchantId) {
    // Internal services can access any merchant stats
    const internalKey = req.headers['x-internal-token'] || req.headers['x-internal-key'];
    if (!internalKey) {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (!isValidObjectId(merchantId) && !isValidUserId(merchantId)) {
    return res.status(400).json({ error: 'Invalid merchantId format' });
  }

  const stats = await getLoyaltyStats(merchantId);

  res.json({ stats });
});

// ── Targeting Endpoints ────────────────────────────────────────────────────────

/**
 * POST /loyalty/target
 * Find users matching loyalty targeting criteria
 * Body: { merchantId: string, criteria: LoyaltyTargetingCriteria }
 */
router.post('/target', verifyMerchant, async (req: Request, res: Response) => {
  const { merchantId, criteria } = req.body;

  if (!merchantId) {
    return res.status(400).json({ error: 'merchantId required' });
  }

  if (!validateLoyaltyCriteria(criteria)) {
    return res.status(400).json({ error: 'Invalid targeting criteria' });
  }

  const userIds = await getUsersByLoyaltyCriteria(merchantId, criteria);

  res.json({
    userIds,
    count: userIds.length,
    criteria,
  });
});

/**
 * POST /loyalty/estimate
 * Estimate audience size for loyalty targeting criteria
 * Body: { merchantId: string, criteria: LoyaltyTargetingCriteria }
 */
router.post('/estimate', verifyMerchant, async (req: Request, res: Response) => {
  const { merchantId, criteria } = req.body;

  if (!merchantId) {
    return res.status(400).json({ error: 'merchantId required' });
  }

  if (!validateLoyaltyCriteria(criteria)) {
    return res.status(400).json({ error: 'Invalid targeting criteria' });
  }

  const estimatedCount = await estimateLoyaltyAudience(merchantId, criteria);

  res.json({
    estimatedCount,
    criteria,
  });
});

/**
 * GET /loyalty/filter
 * Build MongoDB filter from loyalty criteria (for local queries)
 * Query params: scoreMin, scoreMax, tiers, karmaLevels, badges, excludeUsers
 */
router.get('/filter', async (req: Request, res: Response) => {
  const { scoreMin, scoreMax, tiers, karmaLevels, badges, excludeUsers } = req.query;

  const criteria: LoyaltyTargetingCriteria = {};

  if (scoreMin || scoreMax) {
    criteria.scoreRange = {
      min: scoreMin ? parseInt(scoreMin as string, 10) : undefined,
      max: scoreMax ? parseInt(scoreMax as string, 10) : undefined,
    };
  }

  if (tiers) {
    criteria.tiers = (tiers as string).split(',') as LoyaltyTier[];
  }

  if (karmaLevels) {
    criteria.karmaLevels = (karmaLevels as string).split(',') as KarmaLevel[];
  }

  if (badges) {
    criteria.hasBadges = (badges as string).split(',');
  }

  if (excludeUsers) {
    criteria.excludeUsers = (excludeUsers as string).split(',');
  }

  const filter = buildLoyaltyFilter(criteria);

  res.json({ filter, criteria });
});

// ── Personalization Endpoints ──────────────────────────────────────────────────

/**
 * POST /loyalty/personalize
 * Personalize message with loyalty data
 * Body: { userId: string, template: string }
 */
router.post('/personalize', async (req: Request, res: Response) => {
  const { userId, template } = req.body;

  if (!userId || !isValidUserId(userId)) {
    return res.status(400).json({ error: 'Valid userId required' });
  }

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'template string required' });
  }

  if (template.length > 5000) {
    return res.status(400).json({ error: 'Template too long (max 5000 characters)' });
  }

  const profile = await getLoyaltyProfile(userId);

  if (!profile) {
    return res.status(404).json({ error: 'Loyalty profile not found', userId });
  }

  const vars = generatePersonalizationVars(profile);
  const personalizedMessage = personalizeMessage(template, vars);

  res.json({
    original: template,
    personalized: personalizedMessage,
    vars,
    profile: {
      userId: profile.userId,
      tier: profile.tier,
      score: profile.score,
      streak: profile.streak.current,
    },
  });
});

/**
 * POST /loyalty/personalize/tier
 * Generate tier-based message variation
 * Body: { tier: LoyaltyTier, message: string }
 */
router.post('/personalize/tier', async (req: Request, res: Response) => {
  const { tier, message } = req.body;

  const validTiers: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  if (!tier || !validTiers.includes(tier)) {
    return res.status(400).json({
      error: 'Valid tier required',
      validTiers,
    });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message string required' });
  }

  const personalized = generateTierMessage(message, tier);

  res.json({
    tier,
    original: message,
    personalized,
  });
});

// ── Event Processing Endpoints ────────────────────────────────────────────────

/**
 * POST /loyalty/event
 * Process a loyalty event and trigger associated campaigns
 * Body: LoyaltyEvent
 */
router.post('/event', verifyInternal, async (req: Request, res: Response) => {
  const event = req.body as LoyaltyEvent;

  // Validate event
  if (!event.type) {
    return res.status(400).json({ error: 'event.type required' });
  }

  const validEventTypes: LoyaltyEventType[] = [
    'tier_upgrade',
    'tier_downgrade',
    'milestone_reached',
    'badge_earned',
    'streak_maintained',
    'streak_broken',
    'high_score_achieved',
    'karma_level_up',
  ];

  if (!validEventTypes.includes(event.type)) {
    return res.status(400).json({
      error: 'Invalid event type',
      validTypes: validEventTypes,
    });
  }

  if (!event.userId) {
    return res.status(400).json({ error: 'event.userId required' });
  }

  if (!isValidUserId(event.userId)) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  // Ensure timestamp
  if (!event.timestamp) {
    event.timestamp = new Date();
  }

  logger.info('[LoyaltyRoutes] Processing loyalty event', {
    type: event.type,
    userId: event.userId,
  });

  const result = await processLoyaltyEvent(event);

  res.json({
    processed: true,
    triggered: result.triggered,
    campaignIds: result.campaignIds,
    event: {
      type: event.type,
      userId: event.userId,
      timestamp: event.timestamp,
    },
  });
});

// ── Campaign Triggers Endpoints ────────────────────────────────────────────────

/**
 * GET /loyalty/triggers
 * Get campaign triggers, optionally filtered by event type
 * Query: eventType (optional)
 */
router.get('/triggers', async (req: Request, res: Response) => {
  const { eventType } = req.query;

  let triggers: LoyaltyCampaignTrigger[];

  if (eventType) {
    const validEventTypes: LoyaltyEventType[] = [
      'tier_upgrade',
      'tier_downgrade',
      'milestone_reached',
      'badge_earned',
      'streak_maintained',
      'streak_broken',
      'high_score_achieved',
      'karma_level_up',
    ];

    if (!validEventTypes.includes(eventType as LoyaltyEventType)) {
      return res.status(400).json({
        error: 'Invalid eventType',
        validTypes: validEventTypes,
      });
    }

    triggers = await getCampaignTriggers(eventType as LoyaltyEventType);
  } else {
    // Fetch all triggers for all event types
    triggers = [];
    const eventTypes: LoyaltyEventType[] = [
      'tier_upgrade',
      'tier_downgrade',
      'milestone_reached',
      'badge_earned',
      'streak_maintained',
      'streak_broken',
      'high_score_achieved',
      'karma_level_up',
    ];

    for (const type of eventTypes) {
      const typeTriggers = await getCampaignTriggers(type);
      triggers.push(...typeTriggers);
    }
  }

  res.json({ triggers, count: triggers.length });
});

/**
 * POST /loyalty/triggers
 * Create a new campaign trigger for loyalty events
 */
router.post('/triggers', verifyInternal, async (req: Request, res: Response) => {
  const { merchantId, loyaltyEvent, campaignId, personalizationTemplate, active = true } = req.body;

  if (!merchantId) {
    return res.status(400).json({ error: 'merchantId required' });
  }

  const validEventTypes: LoyaltyEventType[] = [
    'tier_upgrade',
    'tier_downgrade',
    'milestone_reached',
    'badge_earned',
    'streak_maintained',
    'streak_broken',
    'high_score_achieved',
    'karma_level_up',
  ];

  if (!loyaltyEvent || !validEventTypes.includes(loyaltyEvent)) {
    return res.status(400).json({
      error: 'Valid loyaltyEvent required',
      validTypes: validEventTypes,
    });
  }

  if (!campaignId) {
    return res.status(400).json({ error: 'campaignId required' });
  }

  if (personalizationTemplate && typeof personalizationTemplate !== 'string') {
    return res.status(400).json({ error: 'personalizationTemplate must be a string' });
  }

  if (personalizationTemplate && personalizationTemplate.length > 2000) {
    return res.status(400).json({ error: 'personalizationTemplate too long (max 2000 characters)' });
  }

  const trigger: LoyaltyCampaignTrigger = {
    id: new mongoose.Types.ObjectId().toString(),
    merchantId,
    loyaltyEvent,
    campaignId,
    personalizationTemplate,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Store trigger (would typically save to DB or forward to Profile Aggregator)
  // For now, return the created trigger
  logger.info('[LoyaltyRoutes] Created campaign trigger', {
    triggerId: trigger.id,
    merchantId,
    loyaltyEvent,
    campaignId,
  });

  res.status(201).json({ trigger });
});

/**
 * PATCH /loyalty/triggers/:id
 * Update an existing campaign trigger
 */
router.patch('/triggers/:id', verifyInternal, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { active, personalizationTemplate, campaignId } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid trigger ID' });
  }

  // Validate update fields
  if (active !== undefined && typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }

  if (personalizationTemplate !== undefined) {
    if (typeof personalizationTemplate !== 'string') {
      return res.status(400).json({ error: 'personalizationTemplate must be a string' });
    }
    if (personalizationTemplate.length > 2000) {
      return res.status(400).json({ error: 'personalizationTemplate too long (max 2000 characters)' });
    }
  }

  // In production, would update in DB
  logger.info('[LoyaltyRoutes] Updated campaign trigger', {
    triggerId: id,
    updates: { active, personalizationTemplate, campaignId },
  });

  res.json({
    updated: true,
    triggerId: id,
    updates: { active, personalizationTemplate, campaignId },
  });
});

/**
 * DELETE /loyalty/triggers/:id
 * Delete a campaign trigger
 */
router.delete('/triggers/:id', verifyInternal, async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid trigger ID' });
  }

  // In production, would delete from DB
  logger.info('[LoyaltyRoutes] Deleted campaign trigger', { triggerId: id });

  res.json({ deleted: true, triggerId: id });
});

// ── Health Check Endpoint ──────────────────────────────────────────────────────

/**
 * GET /loyalty/health
 * Health check for Profile Aggregator connectivity
 */
router.get('/health', async (_req: Request, res: Response) => {
  const health = await checkProfileAggregatorHealth();

  const statusCode = health.healthy ? 200 : 503;

  res.status(statusCode).json({
    service: 'profile-aggregator',
    status: health.healthy ? 'ok' : 'error',
    latencyMs: health.latencyMs,
    error: health.error,
    url: process.env.PROFILE_AGGREGATOR_URL || 'http://localhost:4025',
    timestamp: new Date().toISOString(),
  });
});

export default router;
