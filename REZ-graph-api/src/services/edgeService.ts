import { Edge, IEdge, EdgeType } from '../models/Edge';
import { Node } from '../models/Node';
import { v4 as uuidv4 } from 'uuid';

export interface CreateEdgeInput {
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface UpdateEdgeInput {
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface EdgeQuery {
  sourceNodeId?: string;
  targetNodeId?: string;
  type?: EdgeType;
  minWeight?: number;
  maxWeight?: number;
}

export class EdgeService {
  /**
   * Create a new edge
   */
  async create(input: CreateEdgeInput): Promise<IEdge> {
    // Verify source and target nodes exist
    const sourceNode = await Node.findOne({ nodeId: input.sourceNodeId });
    const targetNode = await Node.findOne({ nodeId: input.targetNodeId });

    if (!sourceNode) {
      throw new Error(`Source node not found: ${input.sourceNodeId}`);
    }

    if (!targetNode) {
      throw new Error(`Target node not found: ${input.targetNodeId}`);
    }

    const edgeId = uuidv4();

    const edge = new Edge({
      edgeId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      type: input.type,
      weight: input.weight ?? 1,
      properties: input.properties || {},
    });

    await edge.save();
    return edge;
  }

  /**
   * Find an edge by edgeId
   */
  async findByEdgeId(edgeId: string): Promise<IEdge | null> {
    return Edge.findOne({ edgeId });
  }

  /**
   * Find edge between two nodes
   */
  async findBetweenNodes(
    sourceNodeId: string,
    targetNodeId: string
  ): Promise<IEdge | null> {
    return Edge.findOne({
      sourceNodeId,
      targetNodeId,
    });
  }

  /**
   * Find edges matching query criteria
   */
  async find(
    query: EdgeQuery,
    options?: { limit?: number; skip?: number; populate?: boolean }
  ): Promise<IEdge[]> {
    const filter: Record<string, unknown> = {};

    if (query.sourceNodeId) {
      filter.sourceNodeId = query.sourceNodeId;
    }

    if (query.targetNodeId) {
      filter.targetNodeId = query.targetNodeId;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.minWeight !== undefined || query.maxWeight !== undefined) {
      filter.weight = {};
      if (query.minWeight !== undefined) {
        (filter.weight as Record<string, number>).$gte = query.minWeight;
      }
      if (query.maxWeight !== undefined) {
        (filter.weight as Record<string, number>).$lte = query.maxWeight;
      }
    }

    let queryBuilder = Edge.find(filter);

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    if (options?.skip) {
      queryBuilder = queryBuilder.skip(options.skip);
    }

    let edges = await queryBuilder;

    if (options?.populate) {
      edges = await Edge.populate(edges, [
        { path: 'sourceNode', model: 'Node' },
        { path: 'targetNode', model: 'Node' },
      ]);
    }

    return edges;
  }

  /**
   * Get outgoing edges from a node
   */
  async getOutgoingEdges(
    nodeId: string,
    type?: EdgeType,
    options?: { limit?: number; populate?: boolean }
  ): Promise<IEdge[]> {
    const query: EdgeQuery = { sourceNodeId: nodeId };
    if (type) {
      query.type = type;
    }
    return this.find(query, { limit: options?.limit, populate: options?.populate });
  }

  /**
   * Get incoming edges to a node
   */
  async getIncomingEdges(
    nodeId: string,
    type?: EdgeType,
    options?: { limit?: number; populate?: boolean }
  ): Promise<IEdge[]> {
    const query: EdgeQuery = { targetNodeId: nodeId };
    if (type) {
      query.type = type;
    }
    return this.find(query, { limit: options?.limit, populate: options?.populate });
  }

  /**
   * Update an edge
   */
  async update(edgeId: string, input: UpdateEdgeInput): Promise<IEdge | null> {
    const updateData: Record<string, unknown> = {};

    if (input.weight !== undefined) {
      updateData.weight = input.weight;
    }

    if (input.properties !== undefined) {
      updateData.properties = input.properties;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findByEdgeId(edgeId);
    }

    return Edge.findOneAndUpdate(
      { edgeId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete an edge by edgeId
   */
  async delete(edgeId: string): Promise<boolean> {
    const result = await Edge.deleteOne({ edgeId });
    return result.deletedCount > 0;
  }

  /**
   * Delete all edges connected to a node
   */
  async deleteByNodeId(nodeId: string): Promise<number> {
    const result = await Edge.deleteMany({
      $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
    });
    return result.deletedCount;
  }

  /**
   * Get or create an edge
   */
  async getOrCreate(input: CreateEdgeInput): Promise<IEdge> {
    let edge = await this.findBetweenNodes(input.sourceNodeId, input.targetNodeId);

    if (!edge) {
      edge = await this.create(input);
    } else {
      // Update weight if edge exists
      if (input.weight !== undefined) {
        edge.weight = input.weight;
        await edge.save();
      }
    }

    return edge;
  }

  /**
   * Increment edge weight (for activity tracking)
   */
  async incrementWeight(
    sourceNodeId: string,
    targetNodeId: string,
    type: EdgeType,
    increment: number = 0.1
  ): Promise<IEdge | null> {
    let edge = await this.findBetweenNodes(sourceNodeId, targetNodeId);

    if (!edge) {
      try {
        edge = await this.create({
          sourceNodeId,
          targetNodeId,
          type,
          weight: Math.min(1, increment),
        });
      } catch {
        return null;
      }
    } else {
      edge.weight = Math.min(1, edge.weight + increment);
      await edge.save();
    }

    return edge;
  }

  /**
   * Get edge count by type
   */
  async countByType(type?: EdgeType): Promise<number> {
    const filter = type ? { type } : {};
    return Edge.countDocuments(filter);
  }

  /**
   * Get all edge types with counts
   */
  async getTypeCounts(): Promise<Record<EdgeType, number>> {
    const matchStage = {};

    const counts = await Edge.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {
      ordered: 0,
      browsed: 0,
      liked: 0,
      visited: 0,
      linked_to: 0,
      similar_to: 0,
    };

    counts.forEach(({ _id, count }) => {
      result[_id] = count;
    });

    return result as Record<EdgeType, number>;
  }

  /**
   * Get degree (number of connections) for a node
   */
  async getDegree(nodeId: string): Promise<{ inDegree: number; outDegree: number; total: number }> {
    const [inCount, outCount] = await Promise.all([
      Edge.countDocuments({ targetNodeId: nodeId }),
      Edge.countDocuments({ sourceNodeId: nodeId }),
    ]);

    return {
      inDegree: inCount,
      outDegree: outCount,
      total: inCount + outCount,
    };
  }
}

export const edgeService = new EdgeService();
