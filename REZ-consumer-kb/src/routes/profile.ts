import { Router, Response } from 'express';
import { z } from 'zod';
import { profileService } from '../services/profileService';
import { AuthRequest, authenticate, requireRole, getConsumerId } from '../middleware/auth';

const router = Router();

// Validation schemas
const CreateProfileSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const UpdateProfileSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'flagged']).optional(),
});

const AddPreferenceSchema = z.object({
  category: z.string(),
  value: z.string(),
  source: z.enum(['direct_input', 'survey', 'explicit_action']),
  confidence: z.number().min(0).max(1).optional(),
});

const BatchPreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      category: z.string(),
      value: z.string(),
      evidence: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const AddGoalSchema = z.object({
  type: z.enum(['purchase', 'lifestyle', 'service', 'general']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  targetDate: z.string().datetime().optional(),
});

const UpdateGoalStatusSchema = z.object({
  status: z.enum(['active', 'completed', 'abandoned']),
  progress: z.number().min(0).max(100).optional(),
});

const AddMemorySchema = z.object({
  type: z.enum(['conversation', 'interaction', 'transaction', 'preference', 'context']),
  content: z.record(z.unknown()),
  importance: z.number().min(0).max(1),
  tags: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});

const UpdateContextSchema = z.object({
  currentLocation: z.string().optional(),
  currentIntent: z.string().optional(),
  sessionData: z.record(z.unknown()).optional(),
  deviceInfo: z.object({
    type: z.string(),
    browser: z.string().optional(),
    os: z.string().optional(),
  }).optional(),
});

const UpdateRtoFactorsSchema = z.object({
  orderCount: z.number().min(0).optional(),
  returnRate: z.number().min(0).max(1).optional(),
  codRate: z.number().min(0).max(1).optional(),
  fraudSignals: z.number().min(0).optional(),
  addressValidity: z.number().min(0).max(100).optional(),
  deviceTrust: z.number().min(0).max(100).optional(),
});

const FlagProfileSchema = z.object({
  reason: z.string(),
});

const SearchProfilesSchema = z.object({
  status: z.enum(['active', 'inactive', 'flagged']).optional(),
  rtoRiskLevel: z.enum(['low', 'medium', 'high']).optional(),
  minInteractions: z.coerce.number().min(0).optional(),
  hasEmail: z.enum(['true', 'false']).optional().transform((s) => s === 'true'),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

/**
 * Create new Profile
 * POST /api/profiles
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const consumerId = getConsumerId(req);
    if (!consumerId) {
      res.status(400).json({ error: 'Consumer ID required' });
      return;
    }

    const body = CreateProfileSchema.parse(req.body);
    const profile = await profileService.createProfile({ consumerId, ...body });

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Create profile error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

/**
 * Get Profile
 * GET /api/profiles/:consumerId
 */
router.get('/:consumerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const profile = await profileService.getProfile(consumerId);

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * Get or create Profile
 * GET /api/profiles/:consumerId/or-create
 */
router.get('/:consumerId/or-create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const profile = await profileService.getOrCreateProfile({ consumerId });

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Get or create profile error:', error);
    res.status(500).json({ error: 'Failed to get/create profile' });
  }
});

/**
 * Update Profile
 * PATCH /api/profiles/:consumerId
 */
router.patch('/:consumerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const updates = UpdateProfileSchema.parse(req.body);

    const profile = await profileService.updateProfile(consumerId, updates);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Get profile summary
 * GET /api/profiles/:consumerId/summary
 */
router.get('/:consumerId/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const summary = await profileService.getProfileSummary(consumerId);

    if (!summary) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get profile summary error:', error);
    res.status(500).json({ error: 'Failed to get profile summary' });
  }
});

/**
 * Add explicit preference
 * POST /api/profiles/:consumerId/preferences
 */
router.post('/:consumerId/preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddPreferenceSchema.parse(req.body);

    const profile = await profileService.addExplicitPreference(consumerId, body);

    res.status(201).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add preference error:', error);
    res.status(500).json({ error: 'Failed to add preference' });
  }
});

/**
 * Batch update inferred preferences
 * POST /api/profiles/:consumerId/preferences/batch
 */
router.post('/:consumerId/preferences/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = BatchPreferencesSchema.parse(req.body);

    const profile = await profileService.batchUpdateInferredPreferences(consumerId, body.preferences);

    res.json({
      success: true,
      data: profile,
      updated: body.preferences.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Batch update preferences error:', error);
    res.status(500).json({ error: 'Failed to batch update preferences' });
  }
});

/**
 * Get preferences by category
 * GET /api/profiles/:consumerId/preferences/:category
 */
router.get('/:consumerId/preferences/:category', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId, category } = req.params;
    const preferences = await profileService.getPreferencesByCategory(consumerId, category);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * Get all preferences merged
 * GET /api/profiles/:consumerId/preferences
 */
router.get('/:consumerId/preferences', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const preferences = await profileService.getAllPreferences(consumerId);

    // Convert Map to object for JSON response
    const result: Record<string, unknown[]> = {};
    preferences.forEach((value, key) => {
      result[key] = value;
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get all preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * Add goal
 * POST /api/profiles/:consumerId/goals
 */
router.post('/:consumerId/goals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddGoalSchema.parse(req.body);

    const goal = await profileService.addGoal(consumerId, {
      ...body,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
    });

    res.status(201).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add goal error:', error);
    res.status(500).json({ error: 'Failed to add goal' });
  }
});

/**
 * Update goal status
 * PATCH /api/profiles/:consumerId/goals/:goalId
 */
router.patch('/:consumerId/goals/:goalId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId, goalId } = req.params;
    const body = UpdateGoalStatusSchema.parse(req.body);

    const profile = await profileService.updateGoalStatus(consumerId, goalId, body.status, body.progress);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    console.error('Update goal status error:', error);
    res.status(500).json({ error: 'Failed to update goal status' });
  }
});

/**
 * Get active goals
 * GET /api/profiles/:consumerId/goals
 */
router.get('/:consumerId/goals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const activeOnly = req.query.active === 'true';
    const profile = await profileService.getProfile(consumerId);

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    if (activeOnly) {
      const goals = await profileService.getActiveGoals(consumerId);
      res.json({ success: true, data: goals });
    } else {
      res.json({ success: true, data: profile.goals });
    }
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

/**
 * Add memory
 * POST /api/profiles/:consumerId/memories
 */
router.post('/:consumerId/memories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddMemorySchema.parse(req.body);

    const memory = await profileService.addMemory(consumerId, {
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });

    res.status(201).json({
      success: true,
      data: memory,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add memory error:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

/**
 * Get memories
 * GET /api/profiles/:consumerId/memories
 */
router.get('/:consumerId/memories', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const options: { type?: 'conversation' | 'interaction' | 'transaction' | 'preference' | 'context'; tags?: string[]; minImportance?: number } = {};

    if (req.query.type) {
      options.type = req.query.type as 'conversation' | 'interaction' | 'transaction' | 'preference' | 'context';
    }
    if (req.query.tags) {
      options.tags = (req.query.tags as string).split(',').filter(Boolean);
    }
    if (req.query.minImportance) {
      options.minImportance = parseFloat(req.query.minImportance as string);
    }

    const memories = await profileService.getMemories(consumerId, options);

    res.json({
      success: true,
      data: memories,
      count: memories.length,
    });
  } catch (error) {
    console.error('Get memories error:', error);
    res.status(500).json({ error: 'Failed to get memories' });
  }
});

/**
 * Update context
 * PUT /api/profiles/:consumerId/context
 */
router.put('/:consumerId/context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = UpdateContextSchema.parse(req.body);

    const profile = await profileService.updateContext(consumerId, body);

    res.json({
      success: true,
      data: profile.context,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update context error:', error);
    res.status(500).json({ error: 'Failed to update context' });
  }
});

/**
 * Get context
 * GET /api/profiles/:consumerId/context
 */
router.get('/:consumerId/context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const context = await profileService.getContext(consumerId);

    if (!context) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      success: true,
      data: context,
    });
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to get context' });
  }
});

/**
 * Calculate RTO score
 * POST /api/profiles/:consumerId/rto-score
 */
router.post('/:consumerId/rto-score', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const profile = await profileService.calculateRtoScore(consumerId);

    res.json({
      success: true,
      data: profile.rtoScore,
    });
  } catch (error) {
    console.error('Calculate RTO score error:', error);
    res.status(500).json({ error: 'Failed to calculate RTO score' });
  }
});

/**
 * Get RTO score
 * GET /api/profiles/:consumerId/rto-score
 */
router.get('/:consumerId/rto-score', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const score = await profileService.getRtoScore(consumerId);

    if (!score) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      success: true,
      data: score,
    });
  } catch (error) {
    console.error('Get RTO score error:', error);
    res.status(500).json({ error: 'Failed to get RTO score' });
  }
});

/**
 * Update RTO factors
 * PATCH /api/profiles/:consumerId/rto-score/factors
 */
router.patch('/:consumerId/rto-score/factors', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = UpdateRtoFactorsSchema.parse(req.body);

    await profileService.calculateRtoScore(consumerId);

    res.json({
      success: true,
      message: 'RTO factors updated and score recalculated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update RTO factors error:', error);
    res.status(500).json({ error: 'Failed to update RTO factors' });
  }
});

/**
 * Flag profile
 * POST /api/profiles/:consumerId/flag
 */
router.post('/:consumerId/flag', requireRole('admin', 'service'), async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = FlagProfileSchema.parse(req.body);

    const profile = await profileService.flagProfile(consumerId, body.reason);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Flag profile error:', error);
    res.status(500).json({ error: 'Failed to flag profile' });
  }
});

/**
 * Unflag profile
 * DELETE /api/profiles/:consumerId/flag
 */
router.delete('/:consumerId/flag', requireRole('admin', 'service'), async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const reason = req.query.reason as string | undefined;

    const profile = await profileService.unflagProfile(consumerId, reason);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Unflag profile error:', error);
    res.status(500).json({ error: 'Failed to unflag profile' });
  }
});

/**
 * Search profiles (admin only)
 * GET /api/profiles
 */
router.get('/', requireRole('admin', 'service'), async (req: AuthRequest, res: Response) => {
  try {
    const options = SearchProfilesSchema.parse(req.query);
    const profiles = await profileService.searchProfiles(options);

    res.json({
      success: true,
      data: profiles,
      count: profiles.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Search profiles error:', error);
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

/**
 * Delete profile (admin only)
 * DELETE /api/profiles/:consumerId
 */
router.delete('/:consumerId', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const deleted = await profileService.deleteProfile(consumerId);

    res.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
