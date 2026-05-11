/**
 * Trigger Routes
 */

import { Router, Request, Response } from 'express';
import { triggerEngine, TRIGGER_TEMPLATES } from '../services/triggerEngine';
import { verifyConsumer } from '../middleware/auth';

const router = Router();

// ===================== RULES =====================

/**
 * POST /api/triggers/rules
 * Create trigger rule
 */
router.post('/rules', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const rule = await triggerEngine.createRule({
      ...req.body,
      merchantId: (req as any).user?.id || req.body.merchantId,
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/triggers/rules
 * Get merchant's rules
 */
router.get('/rules', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const merchantId = (req as any).user?.id;
    const { triggerType } = req.query;
    const rules = await triggerEngine.getMerchantRules(merchantId, triggerType as string);
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/triggers/rules/templates
 * Get trigger templates
 */
router.get('/rules/templates', async (req: Request, res: Response) => {
  res.json({ success: true, data: TRIGGER_TEMPLATES });
});

/**
 * PUT /api/triggers/rules/:id
 * Update rule
 */
router.put('/rules/:id', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const rule = await triggerEngine.updateRule(req.params.id, req.body);
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/triggers/rules/:id/toggle
 * Toggle rule active/inactive
 */
router.put('/rules/:id/toggle', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    const rule = await triggerEngine.toggleRule(req.params.id, isActive);
    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/triggers/rules/:id
 * Delete rule
 */
router.delete('/rules/:id', verifyConsumer, async (req: Request, res: Response) => {
  try {
    const { TriggerRule } = await import('../services/triggerEngine');
    await TriggerRule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== EVALUATION =====================

/**
 * POST /api/triggers/evaluate
 * Evaluate user against rules
 */
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const { userId, userData } = req.body;
    const matchingRules = await triggerEngine.evaluateUser(userId, userData);
    res.json({ success: true, data: matchingRules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/triggers/trigger
 * Manually trigger action for user
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { ruleId, userId } = req.body;

    const { TriggerRule } = await import('../services/triggerEngine');
    const rule = await TriggerRule.findById(ruleId);
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const events = await triggerEngine.triggerAction(rule, userId);
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== EVENTS =====================

/**
 * GET /api/triggers/events/:userId
 * Get user's trigger events
 */
router.get('/events/:userId', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const events = await triggerEngine.getUserEvents(
      req.params.userId,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================== ANALYTICS =====================

/**
 * GET /api/triggers/rules/:id/analytics
 * Get rule analytics
 */
router.get('/rules/:id/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await triggerEngine.getRuleAnalytics(req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
