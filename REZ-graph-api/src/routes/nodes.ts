import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { nodeService } from '../services/nodeService';
import { edgeService } from '../services/edgeService';
import { NodeType } from '../models/Node';

const router = Router();

// Validation schemas
const createNodeSchema = z.object({
  type: z.enum(['consumer', 'merchant', 'product', 'category', 'location', 'device', 'app']),
  externalId: z.string().min(1),
  properties: z.record(z.unknown()).optional(),
  labels: z.array(z.string()).optional(),
});

const updateNodeSchema = z.object({
  properties: z.record(z.unknown()).optional(),
  labels: z.array(z.string()).optional(),
});

const nodeQuerySchema = z.object({
  type: z.enum(['consumer', 'merchant', 'product', 'category', 'location', 'device', 'app']).optional(),
  externalId: z.string().optional(),
  labels: z.string().optional().transform(s => s ? s.split(',') : undefined),
  limit: z.string().optional().transform(s => s ? parseInt(s, 10) : undefined),
  skip: z.string().optional().transform(s => s ? parseInt(s, 10) : undefined),
});

/**
 * POST /nodes - Create a new node
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createNodeSchema.parse(req.body);
    const node = await nodeService.create(validated);

    res.status(201).json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /nodes - List nodes with optional filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = nodeQuerySchema.parse(req.query);
    const nodes = await nodeService.find(
      {
        type: query.type,
        externalId: query.externalId,
        labels: query.labels,
      },
      {
        limit: query.limit,
        skip: query.skip,
      }
    );

    res.json({
      success: true,
      data: nodes,
      count: nodes.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /nodes/:nodeId - Get a node by nodeId
 */
router.get('/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const node = await nodeService.findByNodeId(nodeId);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /nodes/external/:type/:externalId - Get a node by external ID and type
 */
router.get('/external/:type/:externalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, externalId } = req.params;
    const node = await nodeService.findByExternalId(type as NodeType, externalId);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /nodes/:nodeId - Update a node
 */
router.patch('/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const validated = updateNodeSchema.parse(req.body);
    const node = await nodeService.update(nodeId, validated);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /nodes/:nodeId - Delete a node and its edges
 */
router.delete('/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { deleteEdges } = req.query;

    // Delete connected edges first
    if (deleteEdges === 'true') {
      const deletedEdges = await edgeService.deleteByNodeId(nodeId);
      console.log(`Deleted ${deletedEdges} edges for node ${nodeId}`);
    }

    const deleted = await nodeService.delete(nodeId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Node deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /nodes/:nodeId/labels - Add labels to a node
 */
router.post('/:nodeId/labels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { labels } = req.body;

    if (!Array.isArray(labels)) {
      res.status(400).json({
        success: false,
        error: 'labels must be an array',
      });
      return;
    }

    const node = await nodeService.addLabels(nodeId, labels);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /nodes/:nodeId/labels - Remove labels from a node
 */
router.delete('/:nodeId/labels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { labels } = req.body;

    if (!Array.isArray(labels)) {
      res.status(400).json({
        success: false,
        error: 'labels must be an array',
      });
      return;
    }

    const node = await nodeService.removeLabels(nodeId, labels);

    if (!node) {
      res.status(404).json({
        success: false,
        error: 'Node not found',
      });
      return;
    }

    res.json({
      success: true,
      data: node,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /nodes/:nodeId/degree - Get node degree (number of connections)
 */
router.get('/:nodeId/degree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const degree = await edgeService.getDegree(nodeId);

    res.json({
      success: true,
      data: degree,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /nodes/types/counts - Get counts by node type
 */
router.get('/types/counts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await nodeService.getTypeCounts();

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
