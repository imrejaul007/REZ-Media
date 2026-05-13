import { Node, INode, NodeType } from '../models/Node';
import { v4 as uuidv4 } from 'uuid';

export interface CreateNodeInput {
  type: NodeType;
  externalId: string;
  properties?: Record<string, unknown>;
  labels?: string[];
}

export interface UpdateNodeInput {
  properties?: Record<string, unknown>;
  labels?: string[];
}

export interface NodeQuery {
  type?: NodeType;
  externalId?: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

export class NodeService {
  /**
   * Create a new node
   */
  async create(input: CreateNodeInput): Promise<INode> {
    const nodeId = uuidv4();

    const node = new Node({
      nodeId,
      type: input.type,
      externalId: input.externalId,
      properties: input.properties || {},
      labels: input.labels || [],
    });

    await node.save();
    return node;
  }

  /**
   * Find a node by nodeId
   */
  async findByNodeId(nodeId: string): Promise<INode | null> {
    return Node.findOne({ nodeId });
  }

  /**
   * Find a node by external ID and type
   */
  async findByExternalId(type: NodeType, externalId: string): Promise<INode | null> {
    return Node.findOne({ type, externalId });
  }

  /**
   * Find nodes matching query criteria
   */
  async find(query: NodeQuery, options?: { limit?: number; skip?: number }): Promise<INode[]> {
    const filter: Record<string, unknown> = {};

    if (query.type) {
      filter.type = query.type;
    }

    if (query.externalId) {
      filter.externalId = query.externalId;
    }

    if (query.labels && query.labels.length > 0) {
      filter.labels = { $all: query.labels };
    }

    if (query.properties) {
      Object.entries(query.properties).forEach(([key, value]) => {
        filter[`properties.${key}`] = value;
      });
    }

    return Node.find(filter)
      .limit(options?.limit || 100)
      .skip(options?.skip || 0);
  }

  /**
   * Update a node
   */
  async update(nodeId: string, input: UpdateNodeInput): Promise<INode | null> {
    const updateData: Record<string, unknown> = {};

    if (input.properties !== undefined) {
      updateData.properties = input.properties;
    }

    if (input.labels !== undefined) {
      updateData.labels = input.labels;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findByNodeId(nodeId);
    }

    return Node.findOneAndUpdate(
      { nodeId },
      { $set: updateData },
      { new: true }
    );
  }

  /**
   * Delete a node by nodeId
   */
  async delete(nodeId: string): Promise<boolean> {
    const result = await Node.deleteOne({ nodeId });
    return result.deletedCount > 0;
  }

  /**
   * Add labels to a node
   */
  async addLabels(nodeId: string, labels: string[]): Promise<INode | null> {
    return Node.findOneAndUpdate(
      { nodeId },
      { $addToSet: { labels: { $each: labels } } },
      { new: true }
    );
  }

  /**
   * Remove labels from a node
   */
  async removeLabels(nodeId: string, labels: string[]): Promise<INode | null> {
    return Node.findOneAndUpdate(
      { nodeId },
      { $pull: { labels: { $in: labels } } },
      { new: true }
    );
  }

  /**
   * Get node count by type
   */
  async countByType(type: NodeType): Promise<number> {
    return Node.countDocuments({ type });
  }

  /**
   * Get all node types with counts
   */
  async getTypeCounts(): Promise<Record<NodeType, number>> {
    const counts = await Node.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const result: Record<string, number> = {
      consumer: 0,
      merchant: 0,
      product: 0,
      category: 0,
      location: 0,
      device: 0,
      app: 0,
    };

    counts.forEach(({ _id, count }) => {
      result[_id] = count;
    });

    return result as Record<NodeType, number>;
  }

  /**
   * Get or create a node by external ID and type
   */
  async getOrCreate(input: CreateNodeInput): Promise<INode> {
    let node = await this.findByExternalId(input.type, input.externalId);

    if (!node) {
      node = await this.create(input);
    }

    return node;
  }
}

export const nodeService = new NodeService();
