import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { karmaCampaignService, CreateCampaignDTO, UpdateCampaignDTO, CampaignFilters } from '../services/karmaCampaignService';
import { logger } from '../config/logger';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────────

const locationSchema = z.object({
  coordinates: z.tuple([z.number(), z.number()]),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  landmark: z.string().optional(),
});

const scheduleSchema = z.object({
  startDate: z.string().datetime() || z.date(),
  endDate: z.string().datetime() || z.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  isAllDay: z.boolean().optional(),
});

const rewardConfigSchema = z.object({
  coinsPerParticipant: z.number().min(0),
  bonusCoinsForCompletion: z.number().min(0).optional(),
  maxTotalRewards: z.number().int().min(1).optional(),
});

const badgeConfigSchema = z.object({
  badgeName: z.string().min(1),
  badgeDescription: z.string().optional(),
  badgeIcon: z.string().url().optional(),
  earnAfterCount: z.number().int().min(1).optional(),
});

const sharingConfigSchema = z.object({
  autoShareOnCompletion: z.boolean().optional(),
  shareTextTemplates: z.record(z.string(), z.string()).optional(),
  includeCampaignImage: z.boolean().optional(),
  includeTrackingLink: z.boolean().optional(),
});

const verificationSettingsSchema = z.object({
  requirePhotoProof: z.boolean().optional(),
  requireCheckIn: z.boolean().optional(),
  verificationDeadlineHours: z.number().int().positive().optional(),
  manualVerificationRequired: z.boolean().optional(),
});

const createCampaignSchema = z.object({
  merchantId: z.string().min(1, 'merchantId is required'),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  campaignType: z.enum(['blood_donation', 'food_distribution', 'tree_plantation', 'ngo_collaboration', 'volunteer', 'environment']),
  imageUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  objectives: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  impactMetrics: z.record(z.string(), z.string()).optional(),
  location: locationSchema,
  schedule: scheduleSchema,
  participantLimit: z.number().int().positive().optional(),
  rewardConfig: rewardConfigSchema,
  badgeConfig: badgeConfigSchema.optional(),
  sharingConfig: sharingConfigSchema.optional(),
  verificationSettings: verificationSettingsSchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdBy: z.string().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  imageUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  objectives: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  impactMetrics: z.record(z.string(), z.string()).optional(),
  location: locationSchema.optional(),
  schedule: scheduleSchema.optional(),
  participantLimit: z.number().int().positive().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
  rewardConfig: rewardConfigSchema.optional(),
  badgeConfig: badgeConfigSchema.optional(),
  sharingConfig: sharingConfigSchema.optional(),
  verificationSettings: verificationSettingsSchema.optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const joinCampaignSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  campaignId: z.string().min(1, 'campaignId is required'),
});

const verifyParticipationSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  verifiedBy: z.string().min(1, 'verifiedBy is required'),
  verificationNotes: z.string().optional(),
  coinsEarned: z.number().min(0).optional(),
});

const recordCheckInSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  checkInLocation: z.object({
    coordinates: z.tuple([z.number(), z.number()]),
    address: z.string().optional(),
  }).optional(),
  proofPhotoUrl: z.string().url().optional(),
});

const submitFeedbackSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  feedback: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5),
});

const recordShareSchema = z.object({
  participantId: z.string().min(1, 'participantId is required'),
  platform: z.string().min(1),
  shareText: z.string().min(1).max(500),
});

const listCampaignsQuerySchema = z.object({
  merchantId: z.string().optional(),
  campaignType: z.enum(['blood_donation', 'food_distribution', 'tree_plantation', 'ngo_collaboration', 'volunteer', 'environment']).optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
  city: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().optional(),
  upcoming: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const listParticipantsQuerySchema = z.object({
  status: z.enum(['registered', 'attended', 'verified', 'rewarded']).optional(),
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

// ── Validation Middleware ────────────────────────────────────────────────────────

function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: Function) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues,
      });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: Function) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.issues,
      });
    }
    req.query = result.data as any;
    next();
  };
}

// ── Campaign CRUD Routes ─────────────────────────────────────────────────────────

/**
 * POST /karma-campaigns
 * Create a new karma campaign
 */
router.post('/', validate(createCampaignSchema), async (req: Request, res: Response) => {
  const data: CreateCampaignDTO = req.body;

  // Convert date strings to Date objects
  if (typeof data.schedule.startDate === 'string') {
    data.schedule.startDate = new Date(data.schedule.startDate);
  }
  if (typeof data.schedule.endDate === 'string') {
    data.schedule.endDate = new Date(data.schedule.endDate);
  }

  const campaign = await karmaCampaignService.createCampaign(data);

  res.status(201).json({
    success: true,
    campaign,
    message: 'Campaign created successfully',
  });
});

/**
 * GET /karma-campaigns
 * List campaigns with filters
 */
router.get('/', validateQuery(listCampaignsQuerySchema), async (req: Request, res: Response) => {
  const query = req.query as z.infer<typeof listCampaignsQuerySchema>;

  const filters: CampaignFilters = {
    merchantId: query.merchantId,
    campaignType: query.campaignType,
    status: query.status,
    city: query.city,
    upcoming: query.upcoming,
    page: query.page,
    limit: query.limit,
  };

  // Handle location-based filtering
  if (query.lat !== undefined && query.lng !== undefined && query.radiusKm !== undefined) {
    filters.near = {
      coordinates: [query.lng, query.lat],
      radiusKm: query.radiusKm,
    };
  }

  const { campaigns, total } = await karmaCampaignService.listCampaigns(filters);

  res.json({
    success: true,
    campaigns,
    pagination: {
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      pages: Math.ceil(total / (filters.limit || 20)),
    },
  });
});

/**
 * GET /karma-campaigns/nearby
 * Get campaigns near a location
 */
router.get('/nearby', validateQuery(listCampaignsQuerySchema), async (req: Request, res: Response) => {
  const query = req.query as z.infer<typeof listCampaignsQuerySchema>;

  if (!query.lat || !query.lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const campaigns = await karmaCampaignService.getNearbyCampaigns(
    [query.lng, query.lat],
    query.radiusKm || 10,
    { campaignType: query.campaignType, status: query.status },
  );

  res.json({
    success: true,
    campaigns,
    count: campaigns.length,
  });
});

/**
 * GET /karma-campaigns/types
 * Get available campaign types
 */
router.get('/types', (_req: Request, res: Response) => {
  const types = [
    { value: 'blood_donation', label: 'Blood Donation', icon: 'droplet', description: 'Blood donation camps and drives' },
    { value: 'food_distribution', label: 'Food Distribution', icon: 'utensils', description: 'Food distribution to underprivileged' },
    { value: 'tree_plantation', label: 'Tree Plantation', icon: 'tree', description: 'Tree planting and environmental initiatives' },
    { value: 'ngo_collaboration', label: 'NGO Collaboration', icon: 'handshake', description: 'Partnerships with NGOs for social causes' },
    { value: 'volunteer', label: 'Volunteer Work', icon: 'users', description: 'Volunteer work opportunities' },
    { value: 'environment', label: 'Environment', icon: 'leaf', description: 'Environmental conservation efforts' },
  ];

  res.json({ success: true, types });
});

/**
 * GET /karma-campaigns/:id
 * Get campaign by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  const campaign = await karmaCampaignService.getCampaignWithMerchant(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Increment view count
  karmaCampaignService.incrementViews(req.params.id).catch((err) =>
    logger.warn('[KarmaCampaigns] View increment failed', { error: err.message })
  );

  res.json({ success: true, campaign });
});

/**
 * PATCH /karma-campaigns/:id
 * Update a campaign
 */
router.patch('/:id', validate(updateCampaignSchema), async (req: Request, res: Response) => {
  const data: UpdateCampaignDTO = req.body;

  // Convert date strings to Date objects
  if (data.schedule?.startDate && typeof data.schedule.startDate === 'string') {
    data.schedule.startDate = new Date(data.schedule.startDate);
  }
  if (data.schedule?.endDate && typeof data.schedule.endDate === 'string') {
    data.schedule.endDate = new Date(data.schedule.endDate);
  }

  const campaign = await karmaCampaignService.updateCampaign(req.params.id, data);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  res.json({ success: true, campaign });
});

/**
 * DELETE /karma-campaigns/:id
 * Delete (cancel) a campaign
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const reason = req.query.reason as string | undefined;
  const deleted = await karmaCampaignService.deleteCampaign(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  res.json({ success: true, message: 'Campaign cancelled successfully', reason });
});

// ── Campaign Status Routes ──────────────────────────────────────────────────────

/**
 * POST /karma-campaigns/:id/publish
 * Publish a draft campaign
 */
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const campaign = await karmaCampaignService.publishCampaign(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ success: true, campaign, message: 'Campaign published successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /karma-campaigns/:id/complete
 * Complete an active campaign
 */
router.post('/:id/complete', async (req: Request, res: Response) => {
  try {
    const campaign = await karmaCampaignService.completeCampaign(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ success: true, campaign, message: 'Campaign completed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// ── Participation Routes ────────────────────────────────────────────────────────

/**
 * POST /karma-campaigns/join
 * Join a campaign
 */
router.post('/join', validate(joinCampaignSchema), async (req: Request, res: Response) => {
  const { userId, campaignId } = req.body;

  const result = await karmaCampaignService.joinCampaign({ userId, campaignId });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result.message });
  }

  res.status(201).json({
    success: true,
    participant: result.participant,
    message: result.message,
  });
});

/**
 * GET /karma-campaigns/user/:userId/participations
 * Get user's campaign participations
 */
router.get('/user/:userId/participations', async (req: Request, res: Response) => {
  const { past, upcoming } = await karmaCampaignService.getUserParticipations(req.params.userId);

  res.json({
    success: true,
    participations: {
      past,
      upcoming,
      total: past.length + upcoming.length,
    },
  });
});

/**
 * GET /karma-campaigns/user/:userId/campaign/:campaignId
 * Get user's participation in a specific campaign
 */
router.get('/user/:userId/campaign/:campaignId', async (req: Request, res: Response) => {
  const participation = await karmaCampaignService.getUserParticipation(
    req.params.userId,
    req.params.campaignId,
  );

  if (!participation) {
    return res.status(404).json({ error: 'Participation not found' });
  }

  res.json({ success: true, participation });
});

/**
 * GET /karma-campaigns/:id/participants
 * List participants for a campaign
 */
router.get('/:id/participants', validateQuery(listParticipantsQuerySchema), async (req: Request, res: Response) => {
  const query = req.query as z.infer<typeof listParticipantsQuerySchema>;

  const { participants, total } = await karmaCampaignService.listParticipants(req.params.id, {
    status: query.status,
    page: query.page,
    limit: query.limit,
  });

  res.json({
    success: true,
    participants,
    pagination: {
      total,
      page: query.page || 1,
      limit: query.limit || 20,
      pages: Math.ceil(total / (query.limit || 20)),
    },
  });
});

/**
 * GET /karma-campaigns/:id/participants/:participantId
 * Get participant details
 */
router.get('/:id/participants/:participantId', async (req: Request, res: Response) => {
  const participant = await karmaCampaignService.getParticipant(req.params.participantId);

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  res.json({ success: true, participant });
});

/**
 * POST /karma-campaigns/:id/checkin
 * Record participant check-in
 */
router.post('/:id/checkin', validate(recordCheckInSchema), async (req: Request, res: Response) => {
  const { participantId, checkInLocation, proofPhotoUrl } = req.body;

  try {
    const participant = await karmaCampaignService.recordCheckIn({ participantId, checkInLocation, proofPhotoUrl });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json({ success: true, participant, message: 'Check-in recorded successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /karma-campaigns/:id/verify
 * Verify participant participation
 */
router.post('/:id/verify', validate(verifyParticipationSchema), async (req: Request, res: Response) => {
  const { participantId, verifiedBy, verificationNotes, coinsEarned } = req.body;

  try {
    const participant = await karmaCampaignService.verifyParticipation({
      participantId,
      verifiedBy,
      verificationNotes,
      coinsEarned,
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json({
      success: true,
      participant,
      message: 'Participation verified successfully',
      coinsEarned: participant.coinsEarned,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /karma-campaigns/:id/award-rewards
 * Award rewards to verified participant
 */
router.post('/:id/award-rewards', async (req: Request, res: Response) => {
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: 'participantId is required' });
  }

  try {
    const participant = await karmaCampaignService.awardRewards(participantId);

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json({ success: true, participant, message: 'Rewards awarded successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

// ── Feedback & Social Routes ────────────────────────────────────────────────────

/**
 * POST /karma-campaigns/:id/feedback
 * Submit feedback for a campaign
 */
router.post('/:id/feedback', validate(submitFeedbackSchema), async (req: Request, res: Response) => {
  const { participantId, feedback, rating } = req.body;

  try {
    const participant = await karmaCampaignService.submitFeedback({ participantId, feedback, rating });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json({ success: true, participant, message: 'Feedback submitted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /karma-campaigns/:id/share
 * Record social share
 */
router.post('/:id/share', validate(recordShareSchema), async (req: Request, res: Response) => {
  const { participantId, platform, shareText } = req.body;

  const participant = await karmaCampaignService.recordShare({ participantId, platform, shareText });

  if (!participant) {
    return res.status(404).json({ error: 'Participant not found' });
  }

  res.json({ success: true, participant, message: 'Share recorded successfully' });
});

/**
 * GET /karma-campaigns/:id/share-text
 * Generate share text for a campaign
 */
router.get('/:id/share-text', async (req: Request, res: Response) => {
  const campaign = await karmaCampaignService.getCampaignById(req.params.id);

  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const merchantName = req.query.merchantName as string || 'REZ';
  const trackingLink = req.query.trackingLink as string | undefined;

  const shareText = karmaCampaignService.generateShareText(campaign, merchantName, trackingLink);

  res.json({
    success: true,
    shareText,
    templates: SHARE_TEMPLATES,
  });
});

import { KarmaCampaignType } from '../models/KarmaCampaign';

// ── Analytics Routes ────────────────────────────────────────────────────────────

/**
 * GET /karma-campaigns/:id/analytics
 * Get campaign analytics
 */
router.get('/:id/analytics', async (req: Request, res: Response) => {
  const analytics = await karmaCampaignService.getCampaignAnalytics(req.params.id);

  if (!analytics) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  res.json({ success: true, analytics });
});

/**
 * GET /karma-campaigns/merchant/:merchantId/goodwill
 * Get merchant goodwill report
 */
router.get('/merchant/:merchantId/goodwill', async (req: Request, res: Response) => {
  const report = await karmaCampaignService.getMerchantGoodwillReport(req.params.merchantId);

  if (!report) {
    return res.status(404).json({ error: 'No campaigns found for this merchant' });
  }

  res.json({ success: true, report });
});

/**
 * GET /karma-campaigns/merchant/:merchantId/summary
 * Get merchant campaign summary
 */
router.get('/merchant/:merchantId/summary', async (req: Request, res: Response) => {
  const filters: CampaignFilters = {
    merchantId: req.params.merchantId,
  };

  const { campaigns, total } = await karmaCampaignService.listCampaigns(filters);

  // Calculate summary stats
  let totalRegistrations = 0;
  let totalVerifications = 0;
  let totalCoinsAwarded = 0;
  let activeCount = 0;
  let completedCount = 0;
  const typeBreakdown = new Map<KarmaCampaignType, number>();

  for (const campaign of campaigns) {
    totalRegistrations += campaign.stats.totalRegistrations;
    totalVerifications += campaign.stats.totalVerifications;
    totalCoinsAwarded += campaign.stats.totalCoinsAwarded;
    typeBreakdown.set(campaign.campaignType, (typeBreakdown.get(campaign.campaignType) || 0) + 1);

    if (campaign.status === 'active') activeCount++;
    if (campaign.status === 'completed') completedCount++;
  }

  res.json({
    success: true,
    summary: {
      totalCampaigns: total,
      activeCampaigns: activeCount,
      completedCampaigns: completedCount,
      totalRegistrations,
      totalParticipantsVerified: totalVerifications,
      totalCoinsAwarded,
      conversionRate: totalRegistrations > 0 ? ((totalVerifications / totalRegistrations) * 100).toFixed(2) + '%' : '0%',
      typeBreakdown: Array.from(typeBreakdown.entries()).map(([type, count]) => ({ type, count })),
    },
  });
});

// ── Admin/Cron Routes ──────────────────────────────────────────────────────────

/**
 * POST /karma-campaigns/cleanup
 * Auto-complete expired campaigns (admin/cron endpoint)
 */
router.post('/cleanup', async (_req: Request, res: Response) => {
  const count = await karmaCampaignService.autoCompleteExpiredCampaigns();
  res.json({ success: true, message: `Auto-completed ${count} expired campaigns` });
});

export default router;

// Share templates for reference
const SHARE_TEMPLATES: Record<string, string> = {
  blood_donation: 'I just donated blood and earned Branded Coins! Every drop counts. Join the cause at {merchantName} and make a difference. {campaignLink}',
  food_distribution: 'I participated in a food distribution drive and earned Branded Coins! Together we can end hunger. Join {merchantName} and help feed those in need. {campaignLink}',
  tree_plantation: 'I planted trees today and earned Branded Coins! Let\'s grow a greener future together. Join {merchantName} in making the planet greener. {campaignLink}',
  ngo_collaboration: 'I supported an NGO cause today and earned Branded Coins! Small actions create big changes. Thank you {merchantName} for making giving easy. {campaignLink}',
  volunteer: 'I volunteered today and earned Branded Coins! Giving back feels amazing. Join me in making a difference with {merchantName}. {campaignLink}',
  environment: 'I took action for the environment today and earned Branded Coins! Every small step matters. Join {merchantName} in protecting our planet. {campaignLink}',
};
