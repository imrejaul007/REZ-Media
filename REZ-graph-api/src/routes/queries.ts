import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { graphService } from '../services/graphService';
import { pathFinder } from '../services/pathFinder';
import { nodeService } from '../services/nodeService';

const router = Router();

// Validation schemas
const pathQuerySchema = z.object({
  maxDepth: z.string().optional().transform(s => s ? parseInt(s, 10) : undefined),
  edgeTypes: z.string().optional().transform(s => s ? s.split(',') : undefined),
  minWeight: z.string().optional().transform(s => s ? parseFloat(s) : undefined),
});

const similarConsumersSchema = z.object({
  limit: z.string().optional().transform(s => s ? parseInt(s, 10) : 10),
});

const consumerJourneySchema = z.object({
  limit: z.string().optional().transform(s => s ? parseInt(s, 10) : 50),
});

const neighborhoodSchema = z.object({
  depth: z.string().optional().transform(s => s ? parseInt(s, 10) : 1),
  direction: z.enum(['in', 'out', 'both']).optional().default('both'),
});

/**
 * GET /queries/consumer/:nodeId/360 - Get complete 360 profile of a consumer
 */
router.get('/consumer/:nodeId/360', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const profile = await graphService.getConsumer360(nodeId);

    if (!profile) {
      res.status(404).json({
        success: false,
        error: 'Consumer not found',
      });
      return;
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/consumer/:nodeId/similar - Find similar consumers
 */
router.get('/consumer/:nodeId/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { limit } = similarConsumersSchema.parse(req.query);

    const similar = await graphService.findSimilarConsumers(nodeId, limit);

    res.json({
      success: true,
      data: similar,
      count: similar.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/consumer/:nodeId/journey - Get consumer journey
 */
router.get('/consumer/:nodeId/journey', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { limit } = consumerJourneySchema.parse(req.query);

    const journey = await graphService.getConsumerJourney(nodeId, limit);

    if (!journey) {
      res.status(404).json({
        success: false,
        error: 'Consumer not found',
      });
      return;
    }

    res.json({
      success: true,
      data: journey,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/merchant/:nodeId/connections - Get merchant connections and stats
 */
router.get('/merchant/:nodeId/connections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const connections = await graphService.getMerchantConnections(nodeId);

    if (!connections) {
      res.status(404).json({
        success: false,
        error: 'Merchant not found',
      });
      return;
    }

    res.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/paths/:sourceNodeId/:targetNodeId - Find paths between nodes
 */
router.get('/paths/:sourceNodeId/:targetNodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceNodeId, targetNodeId } = req.params;
    const options = pathQuerySchema.parse(req.query);

    const paths = await graphService.findPaths(sourceNodeId, targetNodeId, {
      maxDepth: options.maxDepth,
      edgeTypes: options.edgeTypes,
      minWeight: options.minWeight,
    });

    res.json({
      success: true,
      data: paths,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/shortest-path/:sourceNodeId/:targetNodeId - Find shortest path
 */
router.get('/shortest-path/:sourceNodeId/:targetNodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceNodeId, targetNodeId } = req.params;
    const options = pathQuerySchema.parse(req.query);

    const path = await pathFinder.findShortestPath(sourceNodeId, targetNodeId, {
      maxDepth: options.maxDepth,
      edgeTypes: options.edgeTypes,
      minWeight: options.minWeight,
    });

    if (!path) {
      res.json({
        success: true,
        data: null,
        message: 'No path found',
      });
      return;
    }

    res.json({
      success: true,
      data: path,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/reachable/:nodeId - Find nodes reachable from a given node
 */
router.get('/reachable/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { maxDepth, edgeTypes } = pathQuerySchema.parse(req.query);

    const reachable = await pathFinder.findReachableNodes(nodeId, {
      maxDepth,
      edgeTypes,
    });

    res.json({
      success: true,
      data: reachable,
      count: reachable.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/neighborhood/:nodeId - Get neighborhood of a node
 */
router.get('/neighborhood/:nodeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId } = req.params;
    const { depth, direction } = neighborhoodSchema.parse(req.query);

    const neighborhood = await pathFinder.getNeighborhood(nodeId, depth, direction);

    res.json({
      success: true,
      data: neighborhood,
      nodeCount: neighborhood.nodes.length,
      edgeCount: neighborhood.edges.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/common-neighbors/:nodeId1/:nodeId2 - Find common neighbors between two nodes
 */
router.get('/common-neighbors/:nodeId1/:nodeId2', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nodeId1, nodeId2 } = req.params;

    const commonNeighbors = await pathFinder.findCommonNeighbors(nodeId1, nodeId2);

    res.json({
      success: true,
      data: commonNeighbors,
      count: commonNeighbors.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/stats - Get graph statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await graphService.getGraphStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /queries/search - Search nodes by type and properties
 */
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, externalId, labels, limit, skip } = req.query;

    const nodes = await nodeService.find(
      {
        type: type as string | undefined,
        externalId: externalId as string | undefined,
        labels: labels ? (labels as string).split(',') : undefined,
      },
      {
        limit: limit ? parseInt(limit as string, 10) : undefined,
        skip: skip ? parseInt(skip as string, 10) : undefined,
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

export default router;
