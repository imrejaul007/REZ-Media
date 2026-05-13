import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { edgeService } from '../services/edgeService';
import { EdgeType } from '../models/Edge';

const router = Router();

// Validation schemas
const createEdgeSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  type: z.enum(['ordered', 'browsed', 'liked', 'visited', 'linked_to', 'similar_to']),
  weight: z.number().min(0).max(1).optional(),
  properties: z.record(z.unknown()).optional(),
});

const updateEdgeSchema = z.object({
  weight: z.number().min(0).max(1).optional(),
  properties: z.record(z.unknown()).optional(),
});

const edgeQuerySchema = z.object({
  sourceNodeId: z.string().optional(),
  targetNodeId: z.string().optional(),
  type: z.enum(['ordered', 'browsed', 'liked', 'visited', 'linked_to', 'similar_to']).optional(),
  minWeight: z.string().optional().transform(s => s ? parseFloat(s) : undefined),
  maxWeight: z.string().optional().transform(s => s ? parseFloat(s) : undefined),
  limit: z.string().optional().transform(s => s ? parseInt(s, 10) : undefined),
  skip: z.string().optional().transform(s => s ? parseInt(s, 10) : undefined),
  populate: z.string().optional().transform(s => s === 'true'),
});

const incrementWeightSchema = z.object({
  increment: z.number().min(0).max(1).optional().default(0.1),
});

/**
 * POST /edges - Create a new edge
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createEdgeSchema.parse(req.body);
    const edge = await edgeService.create(validated);

    res.status(201).json({
      success: true,
      data: edge,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges - List edges with optional filters
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = edgeQuerySchema.parse(req.query);
    const edges = await edgeService.find(
      {
        sourceNodeId: query.sourceNodeId,
        targetNodeId: query.targetNodeId,
        type: query.type,
        minWeight: query.minWeight,
        maxWeight: query.maxWeight,
      },
      {
        limit: query.limit,
        skip: query.skip,
        populate: query.populate,
      }
    );

    res.json({
      success: true,
      data: edges,
      count: edges.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges/between/:sourceNodeId/:targetNodeId - Find edge between two nodes
 */
router.get('/between/:sourceNodeId/:targetNodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceNodeId, targetNodeId } = req.params;
    const edge = await edgeService.findBetweenNodes(sourceNodeId, targetNodeId);

    if (!edge) {
      res.status(404).json({
        success: false,
        error: 'Edge not found',
      });
      return;
    }

    res.json({
      success: true,
      data: edge,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges/:edgeId - Get an edge by edgeId
 */
router.get('/:edgeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { edgeId } = req.params;
    const edge = await edgeService.findByEdgeId(edgeId);

    if (!edge) {
      res.status(404).json({
        success: false,
        error: 'Edge not found',
      });
      return;
    }

    res.json({
      success: true,
      data: edge,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /edges/:edgeId - Update an edge
 */
router.patch('/:edgeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { edgeId } = req.params;
    const validated = updateEdgeSchema.parse(req.body);
    const edge = await edgeService.update(edgeId, validated);

    if (!edge) {
      res.status(404).json({
        success: false,
        error: 'Edge not found',
      });
      return;
    }

    res.json({
      success: true,
      data: edge,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /edges/:edgeId - Delete an edge
 */
router.delete('/:edgeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { edgeId } = req.params;
    const deleted = await edgeService.delete(edgeId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Edge not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Edge deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges/node/:nodeId/outgoing - Get outgoing edges from a node
 */
router.get('/node/:nodeId/outgoing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { type, limit, populate } = req.query;
    const edges = await edgeService.getOutgoingEdges(
      nodeId,
      type as EdgeType | undefined,
      {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        populate: populate === 'true',
      }
    );

    res.json({
      success: true,
      data: edges,
      count: edges.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges/node/:nodeId/incoming - Get incoming edges to a node
 */
router.get('/node/:nodeId/incoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { type, limit, populate } = req.query;
    const edges = await edgeService.getIncomingEdges(
      nodeId,
      type as EdgeType | undefined,
      {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        populate: populate === 'true',
      }
    );

    res.json({
      success: true,
      data: edges,
      count: edges.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /edges/increment - Increment edge weight or create new edge
 */
router.post('/increment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceNodeId, targetNodeId, type, increment } = incrementWeightSchema.parse({
      ...req.body,
      increment: req.body.increment ?? 0.1,
    });

    const edge = await edgeService.incrementWeight(
      sourceNodeId,
      targetNodeId,
      type,
      increment
    );

    if (!edge) {
      res.status(404).json({
        success: false,
        error: 'Could not find or create edge',
      });
      return;
    }

    res.json({
      success: true,
      data: edge,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /edges/types/counts - Get counts by edge type
 */
router.get('/types/counts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await edgeService.getTypeCounts();

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
