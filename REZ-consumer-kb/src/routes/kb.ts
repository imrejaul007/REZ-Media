import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { kbService } from '../services/kbService';
import { AuthRequest, authenticate, authenticateInternal, getConsumerId } from '../middleware/auth';
import { IKnowledgeEntry } from '../models/KnowledgeBase';

const router = Router();

// Validation schemas
const CreateKBSchema = z.object({
  profileId: z.string().optional(),
});

const UpdateKBSchema = z.object({
  explicit_prefs: z.record(
    z.array(
      z.object({
        key: z.string(),
        value: z.unknown(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
  ).optional(),
  inferred_prefs: z.record(
    z.array(
      z.object({
        key: z.string(),
        value: z.unknown(),
        confidence: z.number().min(0).max(1),
        source: z.enum(['explicit', 'inferred', 'interaction', 'transaction', 'ml']),
      })
    )
  ).optional(),
  memory: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      importance: z.number().min(0).max(1),
      tags: z.array(z.string()),
      expiresAt: z.string().datetime().optional(),
    })
  ).optional(),
  goals: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      priority: z.enum(['high', 'medium', 'low']),
      targetDate: z.string().datetime().optional(),
    })
  ).optional(),
  context: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      metadata: z.record(z.unknown()).optional(),
    })
  ).optional(),
});

const AddPreferenceSchema = z.object({
  category: z.string(),
  key: z.string(),
  value: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

const AddMemorySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  importance: z.number().min(0).max(1),
  tags: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
});

const AddGoalSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  priority: z.enum(['high', 'medium', 'low']),
  targetDate: z.string().datetime().optional(),
});

const UpdateContextSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

const SearchKBSchema = z.object({
  tags: z.string().optional().transform((s) => s?.split(',').filter(Boolean)),
  type: z.enum(['fact', 'preference', 'memory', 'goal', 'context', 'intent']).optional(),
  source: z.enum(['explicit', 'inferred', 'interaction', 'transaction', 'ml']).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

const AddConversationSchema = z.object({
  conversationId: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      timestamp: z.string().datetime().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
  ),
});

const LinkIntentGraphSchema = z.object({
  service: z.string(),
  intentId: z.string(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Create new Knowledge Base
 * POST /api/kb
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const consumerId = getConsumerId(req);
    if (!consumerId) {
      res.status(400).json({ error: 'Consumer ID required' });
      return;
    }

    const body = CreateKBSchema.parse(req.body);
    const kb = await kbService.createKB(consumerId);

    res.status(201).json({
      success: true,
      data: kb,
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
    console.error('Create KB error:', error);
    res.status(500).json({ error: 'Failed to create knowledge base' });
  }
});

/**
 * Get Knowledge Base
 * GET /api/kb/:consumerId
 */
router.get('/:consumerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const kb = await kbService.getKB(consumerId);

    if (!kb) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }

    res.json({
      success: true,
      data: kb,
    });
  } catch (error) {
    console.error('Get KB error:', error);
    res.status(500).json({ error: 'Failed to get knowledge base' });
  }
});

/**
 * Get or create Knowledge Base
 * GET /api/kb/:consumerId/or-create
 */
router.get('/:consumerId/or-create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const kb = await kbService.getOrCreateKB(consumerId);

    res.json({
      success: true,
      data: kb,
      created: !kb.knowledgeBaseId,
    });
  } catch (error) {
    console.error('Get or create KB error:', error);
    res.status(500).json({ error: 'Failed to get/create knowledge base' });
  }
});

/**
 * Update Knowledge Base
 * PATCH /api/kb/:consumerId
 */
router.patch('/:consumerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const updates = UpdateKBSchema.parse(req.body);

    // Transform dates
    if (updates.memory) {
      updates.memory = updates.memory.map((m) => ({
        ...m,
        expiresAt: m.expiresAt ? new Date(m.expiresAt) : undefined,
      }));
    }
    if (updates.goals) {
      updates.goals = updates.goals.map((g) => ({
        ...g,
        targetDate: g.targetDate ? new Date(g.targetDate) : undefined,
      }));
    }

    const kb = await kbService.updateKB(consumerId, updates);

    res.json({
      success: true,
      data: kb,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Update KB error:', error);
    res.status(500).json({ error: 'Failed to update knowledge base' });
  }
});

/**
 * Add explicit preference
 * POST /api/kb/:consumerId/preferences/explicit
 */
router.post('/:consumerId/preferences/explicit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const { category, key, value, metadata } = AddPreferenceSchema.parse(req.body);

    const entry = await kbService.addExplicitPreference(consumerId, category, key, value, metadata);

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add explicit preference error:', error);
    res.status(500).json({ error: 'Failed to add explicit preference' });
  }
});

/**
 * Add inferred preference
 * POST /api/kb/:consumerId/preferences/inferred
 */
router.post('/:consumerId/preferences/inferred', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = z.object({
      category: z.string(),
      key: z.string(),
      value: z.unknown(),
      confidence: z.number().min(0).max(1),
      source: z.enum(['explicit', 'inferred', 'interaction', 'transaction', 'ml']),
      evidence: z.array(z.string()).optional(),
    }).parse(req.body);

    const entry = await kbService.addInferredPreference(
      consumerId,
      body.category,
      body.key,
      body.value,
      body.confidence,
      body.source,
      body.evidence
    );

    res.status(201).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add inferred preference error:', error);
    res.status(500).json({ error: 'Failed to add inferred preference' });
  }
});

/**
 * Add memory
 * POST /api/kb/:consumerId/memory
 */
router.post('/:consumerId/memory', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddMemorySchema.parse(req.body);

    const entry = await kbService.addMemory(
      consumerId,
      body.key,
      body.value,
      body.importance,
      body.tags,
      body.expiresAt ? new Date(body.expiresAt) : undefined
    );

    res.status(201).json({
      success: true,
      data: entry,
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
 * Add goal
 * POST /api/kb/:consumerId/goals
 */
router.post('/:consumerId/goals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddGoalSchema.parse(req.body);

    const entry = await kbService.addGoal(
      consumerId,
      body.key,
      body.value,
      body.priority,
      body.targetDate ? new Date(body.targetDate) : undefined
    );

    res.status(201).json({
      success: true,
      data: entry,
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
 * Update context
 * PUT /api/kb/:consumerId/context
 */
router.put('/:consumerId/context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = UpdateContextSchema.parse(req.body);

    const entry = await kbService.updateContext(consumerId, body.key, body.value, body.metadata);

    res.json({
      success: true,
      data: entry,
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
 * Search Knowledge Base
 * GET /api/kb/:consumerId/search
 */
router.get('/:consumerId/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const options = SearchKBSchema.parse(req.query);

    const results = await kbService.searchKB(consumerId, options);

    res.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Search KB error:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

/**
 * Get relevant memories
 * GET /api/kb/:consumerId/memories/relevant
 */
router.get('/:consumerId/memories/relevant', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const tags = (req.query.tags as string)?.split(',').filter(Boolean) || [];
    const limit = parseInt(req.query.limit as string) || 10;

    const memories = await kbService.getRelevantMemories(consumerId, tags, limit);

    res.json({
      success: true,
      data: memories,
    });
  } catch (error) {
    console.error('Get relevant memories error:', error);
    res.status(500).json({ error: 'Failed to get relevant memories' });
  }
});

/**
 * Add conversation
 * POST /api/kb/:consumerId/conversations
 */
router.post('/:consumerId/conversations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = AddConversationSchema.parse(req.body);

    const conversation = await kbService.addConversation(
      consumerId,
      body.conversationId,
      body.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      }))
    );

    if (!conversation) {
      res.status(404).json({ error: 'Knowledge base not found' });
      return;
    }

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Add conversation error:', error);
    res.status(500).json({ error: 'Failed to add conversation' });
  }
});

/**
 * Link to Intent Graph
 * POST /api/kb/:consumerId/intent-link
 */
router.post('/:consumerId/intent-link', authenticateInternal, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const body = LinkIntentGraphSchema.parse(req.body);

    await kbService.linkToIntentGraph(consumerId, body.service, body.intentId, body.confidence);

    res.json({
      success: true,
      message: 'Linked to intent graph',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    console.error('Link to intent graph error:', error);
    res.status(500).json({ error: 'Failed to link to intent graph' });
  }
});

/**
 * Get intent graph links
 * GET /api/kb/:consumerId/intent-links
 */
router.get('/:consumerId/intent-links', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const links = await kbService.getIntentLinks(consumerId);

    res.json({
      success: true,
      data: links,
    });
  } catch (error) {
    console.error('Get intent links error:', error);
    res.status(500).json({ error: 'Failed to get intent links' });
  }
});

/**
 * Get KB stats
 * GET /api/kb/:consumerId/stats
 */
router.get('/:consumerId/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const stats = await kbService.getStats(consumerId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get KB stats error:', error);
    res.status(500).json({ error: 'Failed to get KB stats' });
  }
});

/**
 * Record interaction
 * POST /api/kb/:consumerId/interaction
 */
router.post('/:consumerId/interaction', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    await kbService.recordInteraction(consumerId);

    res.json({
      success: true,
      message: 'Interaction recorded',
    });
  } catch (error) {
    console.error('Record interaction error:', error);
    res.status(500).json({ error: 'Failed to record interaction' });
  }
});

/**
 * Delete Knowledge Base
 * DELETE /api/kb/:consumerId
 */
router.delete('/:consumerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumerId } = req.params;
    const deleted = await kbService.deleteKB(consumerId);

    res.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error('Delete KB error:', error);
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

export default router;
