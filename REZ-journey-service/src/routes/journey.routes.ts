import { Router, Request, Response } from 'express';
import { journeyService, store } from '../services/journeyService';
import { journeyWorker } from '../workers/journeyWorker';
import { aiCheckService } from '../services/aiCheckService';
import { Journey } from '../models/Journey';
import { Step } from '../models/Step';
import { ActionType, TriggerType, ABVariant, AICheckConfig, AICheckContext, BUILT_IN_CHECKS } from '../types';

const router = Router();

// ==================== Journey CRUD ====================

// Create a new journey
router.post('/journeys', async (req: Request, res: Response) => {
  try {
    const { name, description, trigger, tags } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Journey name is required' });
    }

    const result = await journeyService.createJourney({
      name,
      description,
      trigger: trigger ? {
        type: trigger.type as TriggerType,
        conditions: trigger.conditions,
        schedule: trigger.schedule,
        customEvent: trigger.customEvent
      } : undefined,
      tags
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get all journeys
router.get('/journeys', async (req: Request, res: Response) => {
  try {
    const { status, page, limit, tags } = req.query;

    const result = await journeyService.listJourneys({
      status: status as Journey['status'],
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      tags: tags ? (tags as string).split(',') : undefined
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get a single journey
router.get('/journeys/:id', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Update a journey
router.put('/journeys/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, trigger, tags, abTest } = req.body;

    const result = await journeyService.updateJourney(req.params.id, {
      name,
      description,
      trigger: trigger ? {
        type: trigger.type as TriggerType,
        conditions: trigger.conditions,
        schedule: trigger.schedule,
        customEvent: trigger.customEvent
      } : undefined,
      tags,
      abTest: abTest ? {
        enabled: abTest.enabled,
        variants: abTest.variants?.map((v: { variant: ABVariant; weight: number; stepIds: string[] }) => ({
          variant: v.variant,
          weight: v.weight,
          stepIds: v.stepIds
        }))
      } : undefined
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Delete a journey
router.delete('/journeys/:id', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.deleteJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Journey Lifecycle ====================

// Activate a journey
router.post('/journeys/:id/activate', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.activateJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Pause a journey
router.post('/journeys/:id/pause', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.pauseJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Resume a journey
router.post('/journeys/:id/resume', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.resumeJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Archive a journey
router.post('/journeys/:id/archive', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.archiveJourney(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Steps ====================

// Add a step to a journey
router.post('/journeys/:id/steps', async (req: Request, res: Response) => {
  try {
    const { name, description, type, actionType, actionConfig, position, conditions, splitBranches } = req.body;

    const result = await journeyService.addStep(req.params.id, {
      name,
      description,
      type,
      actionType,
      actionConfig: actionConfig ? {
        type: actionConfig.type as ActionType,
        emailTemplate: actionConfig.emailTemplate,
        emailSubject: actionConfig.emailSubject,
        emailFrom: actionConfig.emailFrom,
        smsTemplate: actionConfig.smsTemplate,
        smsFrom: actionConfig.smsFrom,
        pushTitle: actionConfig.pushTitle,
        pushBody: actionConfig.pushBody,
        pushData: actionConfig.pushData,
        delayDuration: actionConfig.delayDuration,
        delayUnit: actionConfig.delayUnit,
        webhookUrl: actionConfig.webhookUrl,
        webhookMethod: actionConfig.webhookMethod,
        webhookHeaders: actionConfig.webhookHeaders,
        webhookBody: actionConfig.webhookBody,
        conditions: actionConfig.conditions,
        trueSteps: actionConfig.trueSteps,
        falseSteps: actionConfig.falseSteps
      } : undefined,
      position,
      conditions,
      splitBranches
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Update a step
router.put('/journeys/:journeyId/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const { name, description, actionType, actionConfig, nextStepId, errorStepId, position, retryConfig, timeout, conditions, splitBranches } = req.body;

    const result = await journeyService.updateStep(req.params.journeyId, req.params.stepId, {
      name,
      description,
      actionType,
      actionConfig: actionConfig ? {
        type: actionConfig.type as ActionType,
        emailTemplate: actionConfig.emailTemplate,
        emailSubject: actionConfig.emailSubject,
        emailFrom: actionConfig.emailFrom,
        smsTemplate: actionConfig.smsTemplate,
        smsFrom: actionConfig.smsFrom,
        pushTitle: actionConfig.pushTitle,
        pushBody: actionConfig.pushBody,
        pushData: actionConfig.pushData,
        delayDuration: actionConfig.delayDuration,
        delayUnit: actionConfig.delayUnit,
        webhookUrl: actionConfig.webhookUrl,
        webhookMethod: actionConfig.webhookMethod,
        webhookHeaders: actionConfig.webhookHeaders,
        webhookBody: actionConfig.webhookBody,
        conditions: actionConfig.conditions,
        trueSteps: actionConfig.trueSteps,
        falseSteps: actionConfig.falseSteps
      } : undefined,
      nextStepId,
      errorStepId,
      position,
      retryConfig,
      timeout,
      conditions,
      splitBranches
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Delete a step
router.delete('/journeys/:journeyId/steps/:stepId', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.removeStep(req.params.journeyId, req.params.stepId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Connect steps
router.post('/journeys/:journeyId/steps/:fromStepId/connect', async (req: Request, res: Response) => {
  try {
    const { toStepId, type } = req.body;

    if (!toStepId) {
      return res.status(400).json({ success: false, error: 'Target step ID is required' });
    }

    const result = await journeyService.connectSteps(
      req.params.journeyId,
      req.params.fromStepId,
      toStepId,
      type || 'next'
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Reorder steps
router.post('/journeys/:id/steps/reorder', async (req: Request, res: Response) => {
  try {
    const { stepOrder } = req.body;

    if (!stepOrder || !Array.isArray(stepOrder)) {
      return res.status(400).json({ success: false, error: 'Step order array is required' });
    }

    const result = await journeyService.reorderSteps(req.params.id, stepOrder);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Entries ====================

// Enter a contact into a journey
router.post('/journeys/:id/entries', async (req: Request, res: Response) => {
  try {
    const { contactId, contactData } = req.body;

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'Contact ID is required' });
    }

    const result = await journeyService.enterJourney(req.params.id, contactId, contactData);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get journey entries
router.get('/journeys/:id/entries', async (req: Request, res: Response) => {
  try {
    const { status, page, limit } = req.query;

    const result = await journeyService.getJourneyEntries(req.params.id, {
      status: status as Journey['status'],
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get a single entry
router.get('/entries/:id', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getEntry(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Exit an entry
router.post('/entries/:id/exit', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Exit reason is required' });
    }

    const result = await journeyService.exitEntry(req.params.id, reason);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Triggers ====================

// Process a trigger event
router.post('/triggers/:type', async (req: Request, res: Response) => {
  try {
    const { contactId, contactData } = req.body;

    if (!contactId) {
      return res.status(400).json({ success: false, error: 'Contact ID is required' });
    }

    const result = await journeyService.processTrigger(
      req.params.type as TriggerType,
      contactId,
      contactData || {}
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Analytics ====================

// Get journey analytics
router.get('/journeys/:id/analytics', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getJourneyAnalytics(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get step analytics
router.get('/journeys/:journeyId/steps/:stepId/analytics', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getStepAnalytics(req.params.journeyId, req.params.stepId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== A/B Testing ====================

// Configure A/B test
router.post('/journeys/:id/ab-test', async (req: Request, res: Response) => {
  try {
    const { enabled, variants } = req.body;

    const result = await journeyService.configureABTest(req.params.id, {
      enabled,
      variants: variants?.map((v: { variant: ABVariant; weight: number; stepIds: string[] }) => ({
        variant: v.variant,
        weight: v.weight,
        stepIds: v.stepIds
      }))
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Get A/B test results
router.get('/journeys/:id/ab-test/results', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getABTestResults(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Templates ====================

// Create template from journey
router.post('/journeys/:id/template', async (req: Request, res: Response) => {
  try {
    const { name, description, category, tags } = req.body;

    if (!name || !category) {
      return res.status(400).json({ success: false, error: 'Name and category are required' });
    }

    const result = await journeyService.createTemplate(req.params.id, {
      name,
      description: description || '',
      category,
      tags: tags || []
    });

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// List templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const { category, tags } = req.query;

    const result = await journeyService.listTemplates({
      category: category as string,
      tags: tags ? (tags as string).split(',') : undefined
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Create journey from template
router.post('/templates/:id/clone', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Journey name is required' });
    }

    const result = await journeyService.createFromTemplate(req.params.id, name);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Delete template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.deleteTemplate(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Visual Builder ====================

// Get journey canvas
router.get('/journeys/:id/canvas', async (req: Request, res: Response) => {
  try {
    const result = await journeyService.getJourneyCanvas(req.params.id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Update step position
router.post('/journeys/:journeyId/steps/:stepId/position', async (req: Request, res: Response) => {
  try {
    const { x, y } = req.body;

    if (x === undefined || y === undefined) {
      return res.status(400).json({ success: false, error: 'Position (x, y) is required' });
    }

    const result = await journeyService.updateCanvasPosition(req.params.journeyId, req.params.stepId, { x, y });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});
});

// ==================== AI-Check Nodes ====================

/**
 * GET /api/journeys/:journeyId/steps/:stepId/ai-check
 * Get AI check configuration for a step
 */
router.get('/journeys/:journeyId/steps/:stepId/ai-check', async (req: Request, res: Response) => {
  try {
    const { journeyId, stepId } = req.params;

    const journey = store.getJourney(journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const step = journey.getStep(stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    if (step.type !== 'ai_check') {
      return res.status(400).json({ success: false, error: 'Step is not an AI check type' });
    }

    res.json({
      success: true,
      data: {
        config: step.aiCheckConfig,
        analytics: step.aiCheckAnalytics,
        lastResult: step.lastAiCheckResult,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/journeys/:id/steps/ai-check
 * Add AI check node to journey
 */
router.post('/journeys/:id/steps/ai-check', async (req: Request, res: Response) => {
  try {
    const { name, description, checkType, model, prompt, threshold, trueLabel, falseLabel, trueNextStepId, falseNextStepId, outputVariable, position } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Step name is required' });
    }

    if (!checkType) {
      return res.status(400).json({ success: false, error: 'Check type is required' });
    }

    const validCheckTypes = ['lead_score', 'purchase_probability', 'churn_risk', 'upsell_eligibility', 'channel_preference', 'custom'];
    if (!validCheckTypes.includes(checkType)) {
      return res.status(400).json({ success: false, error: `Invalid check type. Must be one of: ${validCheckTypes.join(', ')}` });
    }

    const builtInCheck = BUILT_IN_CHECKS.find(c => c.checkType === checkType);
    const defaultThreshold = builtInCheck?.defaultThreshold || 0.5;

    const aiCheckConfig: AICheckConfig = {
      type: 'ai_check',
      checkType,
      model: model || 'claude',
      prompt: checkType === 'custom' ? prompt : undefined,
      threshold: threshold !== undefined ? threshold : defaultThreshold,
      trueLabel: trueLabel || 'pass',
      falseLabel: falseLabel || 'fail',
      trueNextStepId,
      falseNextStepId,
      outputVariable,
    };

    const result = await journeyService.addStep(req.params.id, {
      name,
      description: description || `AI Check: ${checkType}`,
      type: 'ai_check',
      actionType: null,
      actionConfig: null,
      position: position || { x: 0, y: 0 },
      conditions: undefined,
      splitBranches: undefined,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    const journey = store.getJourney(req.params.id);
    if (journey) {
      const step = journey.getStep(result.data?.id);
      if (step) {
        step.setAICheckConfig(aiCheckConfig);
        store.saveJourney(journey);
      }
    }

    res.status(201).json({
      success: true,
      data: { ...result.data, aiCheckConfig },
      message: 'AI check step added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/journeys/:journeyId/steps/:stepId/ai-check
 * Update AI check configuration
 */
router.put('/journeys/:journeyId/steps/:stepId/ai-check', async (req: Request, res: Response) => {
  try {
    const { checkType, model, prompt, threshold, trueLabel, falseLabel, trueNextStepId, falseNextStepId, outputVariable } = req.body;

    const journey = store.getJourney(req.params.journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const step = journey.getStep(req.params.stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    if (step.type !== 'ai_check' || !step.aiCheckConfig) {
      return res.status(400).json({ success: false, error: 'Step is not an AI check type' });
    }

    const updatedConfig: AICheckConfig = {
      ...step.aiCheckConfig,
      checkType: checkType || step.aiCheckConfig.checkType,
      model: model || step.aiCheckConfig.model,
      prompt: prompt !== undefined ? prompt : step.aiCheckConfig.prompt,
      threshold: threshold !== undefined ? threshold : step.aiCheckConfig.threshold,
      trueLabel: trueLabel || step.aiCheckConfig.trueLabel,
      falseLabel: falseLabel || step.aiCheckConfig.falseLabel,
      trueNextStepId: trueNextStepId !== undefined ? trueNextStepId : step.aiCheckConfig.trueNextStepId,
      falseNextStepId: falseNextStepId !== undefined ? falseNextStepId : step.aiCheckConfig.falseNextStepId,
      outputVariable: outputVariable !== undefined ? outputVariable : step.aiCheckConfig.outputVariable,
    };

    step.setAICheckConfig(updatedConfig);
    store.saveJourney(journey);

    res.json({
      success: true,
      data: { config: step.aiCheckConfig, analytics: step.aiCheckAnalytics },
      message: 'AI check configuration updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/journeys/:journeyId/steps/:stepId/test
 * Test AI check with sample data
 */
router.post('/journeys/:journeyId/steps/:stepId/test', async (req: Request, res: Response) => {
  try {
    const { testData } = req.body;

    const journey = store.getJourney(req.params.journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const step = journey.getStep(req.params.stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    if (!step.aiCheckConfig) {
      return res.status(400).json({ success: false, error: 'Step has no AI check configuration' });
    }

    const context: AICheckContext = {
      contactData: testData?.contactData || {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        id: 'test-user-id',
      },
      journeyData: { journeyId: journey.id, journeyName: journey.name },
      entryData: { entryId: 'test-entry-id', enteredAt: new Date().toISOString() },
      historicalData: testData?.historicalData || {
        recentSearches: ['product 1', 'product 2'],
        views: ['category/electronics', 'product/smartphone'],
        engagementScore: 75,
      },
    };

    const testResult = await aiCheckService.testCheck(step.aiCheckConfig, context);

    res.json({ success: true, data: testResult });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/journeys/:journeyId/steps/:stepId/result
 * Get last AI check result
 */
router.get('/journeys/:journeyId/steps/:stepId/result', async (req: Request, res: Response) => {
  try {
    const journey = store.getJourney(req.params.journeyId);
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Journey not found' });
    }

    const step = journey.getStep(req.params.stepId);
    if (!step) {
      return res.status(404).json({ success: false, error: 'Step not found' });
    }

    if (!step.aiCheckConfig) {
      return res.status(400).json({ success: false, error: 'Step has no AI check configuration' });
    }

    res.json({
      success: true,
      data: {
        lastResult: step.lastAiCheckResult,
        analytics: step.aiCheckAnalytics,
        config: step.aiCheckConfig,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/ai-checks/available
 * Get available AI check types
 */
router.get('/ai-checks/available', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: BUILT_IN_CHECKS.map(check => ({
      type: check.checkType,
      name: check.name,
      description: check.description,
      defaultThreshold: check.defaultThreshold,
      variableMapping: check.variableMapping,
    })),
  });
});

/**
 * POST /api/ai-checks/clear-cache
 * Clear AI check cache
 */
router.post('/ai-checks/clear-cache', async (_req: Request, res: Response) => {
  try {
    const stats = aiCheckService.getCacheStats();
    aiCheckService.clearCache();

    res.json({
      success: true,
      message: 'AI check cache cleared',
      previousStats: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Worker Status ====================

// Get worker status
router.get('/worker/status', (_req: Request, res: Response) => {
  try {
    const status = journeyWorker.getStatus();
    const events = journeyWorker.getWorkerEvents(50);

    res.json({
      success: true,
      data: {
        ...status,
        recentEvents: events
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// ==================== Health Check ====================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'rez-journey-service',
      version: '1.0.0'
    }
  });
});

export default router;
