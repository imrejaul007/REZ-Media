/**
 * Admin Routes
 *
 * CRUD operations for business rules
 */

import { Router, Request, Response, NextFunction } from 'express';
import { BusinessRule, IBusinessRule } from '../models/BusinessRule';
import { RuleVersion } from '../models';
import { BusinessRule as BusinessRuleType } from '../types';

const router = Router();

// SECURITY FIX: Auth middleware with API key validation
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const serviceToken = req.headers['authorization']?.replace('Bearer ', '');

  const expectedKey = process.env.SERVICE_API_KEY || process.env.INTERNAL_SERVICE_TOKEN;

  // Allow if valid API key or service token
  if (apiKey && apiKey === expectedKey) {
    return next();
  }

  if (serviceToken && serviceToken === expectedKey) {
    return next();
  }

  // Check for admin role in JWT (if Authorization header with Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded.role === 'admin' || decoded.role === 'super_admin') {
        return next();
      }
    } catch {
      // Token invalid, continue to reject
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized - Valid API key or admin token required'
  });
};

/**
 * GET /api/admin/rules
 * List all rules with filters
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      ruleType,
      category,
      subCategory,
      isActive,
      page = '1',
      limit = '50'
    } = req.query;

    const filter: Record<string, any> = {};

    if (ruleType) filter.ruleType = ruleType;
    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [rules, total] = await Promise.all([
      BusinessRule.find(filter)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      BusinessRule.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        rules,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Error listing rules:', error);
    res.status(500).json({ success: false, error: 'Failed to list rules' });
  }
});

/**
 * GET /api/admin/rules/:id
 * Get single rule
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rule = await BusinessRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error getting rule:', error);
    res.status(500).json({ success: false, error: 'Failed to get rule' });
  }
});

/**
 * POST /api/admin/rules
 * Create new rule
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;

    // Validate required fields
    if (!ruleData.ruleType || !ruleData.category || !ruleData.conditions || !ruleData.actions) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ruleType, category, conditions, actions'
      });
    }

    // Set defaults
    ruleData.version = 1;
    ruleData.effectiveFrom = ruleData.effectiveFrom || new Date();
    ruleData.isActive = ruleData.isActive !== false;

    const rule = new BusinessRule(ruleData);
    await rule.save();

    // Create initial version record
    const version = new RuleVersion({
      ruleId: rule._id,
      version: 1,
      ruleSnapshot: rule.toObject(),
      effectiveFrom: rule.effectiveFrom,
      changedBy: req.body.userId,
      changeReason: 'Initial creation'
    });
    await version.save();

    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ success: false, error: 'Failed to create rule' });
  }
});

/**
 * PUT /api/admin/rules/:id
 * Update rule
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const existingRule = await BusinessRule.findById(req.params.id);

    if (!existingRule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const updateData = req.body;
    const changeReason = updateData.changeReason || 'Manual update';

    // If rule type, category, or core structure changed, increment version
    const coreChanged =
      updateData.ruleType !== existingRule.ruleType ||
      updateData.category !== existingRule.category ||
      JSON.stringify(updateData.conditions) !== JSON.stringify(existingRule.conditions) ||
      JSON.stringify(updateData.actions) !== JSON.stringify(existingRule.actions);

    if (coreChanged) {
      // Close current version
      await RuleVersion.findOneAndUpdate(
        { ruleId: existingRule._id, effectiveTo: null },
        { effectiveTo: new Date() }
      );

      // Increment version
      updateData.version = existingRule.version + 1;
    }

    updateData.updatedAt = new Date();

    const updatedRule = await BusinessRule.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Create new version record if core changed
    if (coreChanged) {
      const version = new RuleVersion({
        ruleId: updatedRule!._id,
        version: updatedRule!.version,
        ruleSnapshot: updatedRule!.toObject(),
        effectiveFrom: new Date(),
        changedBy: req.body.userId,
        changeReason
      });
      await version.save();
    }

    res.json({ success: true, data: updatedRule });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ success: false, error: 'Failed to update rule' });
  }
});

/**
 * DELETE /api/admin/rules/:id
 * Delete rule (soft delete)
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rule = await BusinessRule.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    // Close version
    await RuleVersion.findOneAndUpdate(
      { ruleId: rule._id, effectiveTo: null },
      { effectiveTo: new Date() }
    );

    res.json({ success: true, message: 'Rule deactivated' });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ success: false, error: 'Failed to delete rule' });
  }
});

/**
 * POST /api/admin/rules/:id/activate
 * Activate rule
 */
router.post('/:id/activate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rule = await BusinessRule.findByIdAndUpdate(
      req.params.id,
      { isActive: true, updatedAt: new Date() },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error activating rule:', error);
    res.status(500).json({ success: false, error: 'Failed to activate rule' });
  }
});

/**
 * POST /api/admin/rules/:id/deactivate
 * Deactivate rule
 */
router.post('/:id/deactivate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rule = await BusinessRule.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Error deactivating rule:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate rule' });
  }
});

/**
 * GET /api/admin/rules/:id/history
 * Get rule version history
 */
router.get('/:id/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const versions = await RuleVersion.find({ ruleId: req.params.id })
      .sort({ version: -1 });

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('Error getting rule history:', error);
    res.status(500).json({ success: false, error: 'Failed to get rule history' });
  }
});

/**
 * POST /api/admin/rules/:id/clone
 * Clone a rule
 */
router.post('/:id/clone', authMiddleware, async (req: Request, res: Response) => {
  try {
    const existingRule = await BusinessRule.findById(req.params.id);

    if (!existingRule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    const clonedData = existingRule.toObject();
    delete clonedData._id;
    clonedData.category = `${clonedData.category}_copy`;
    clonedData.version = 1;
    clonedData.isActive = true;
    clonedData.effectiveFrom = new Date();
    clonedData.effectiveTo = undefined;

    const clonedRule = new BusinessRule(clonedData);
    await clonedRule.save();

    // Create version record
    const version = new RuleVersion({
      ruleId: clonedRule._id,
      version: 1,
      ruleSnapshot: clonedRule.toObject(),
      effectiveFrom: clonedRule.effectiveFrom,
      changedBy: req.body.userId,
      changeReason: 'Cloned from rule ' + req.params.id
    });
    await version.save();

    res.status(201).json({ success: true, data: clonedRule });
  } catch (error) {
    console.error('Error cloning rule:', error);
    res.status(500).json({ success: false, error: 'Failed to clone rule' });
  }
});

/**
 * POST /api/admin/rules/bulk
 * Bulk create/update rules
 */
router.post('/bulk', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;

    if (!Array.isArray(rules)) {
      return res.status(400).json({ success: false, error: 'Rules must be an array' });
    }

    const results = [];
    for (const ruleData of rules) {
      if (ruleData._id) {
        // Update existing
        const updated = await BusinessRule.findByIdAndUpdate(
          ruleData._id,
          ruleData,
          { new: true, runValidators: true }
        );
        results.push(updated);
      } else {
        // Create new
        ruleData.version = 1;
        ruleData.effectiveFrom = ruleData.effectiveFrom || new Date();
        const created = new BusinessRule(ruleData);
        await created.save();
        results.push(created);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error bulk updating rules:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk update rules' });
  }
});

export default router;
