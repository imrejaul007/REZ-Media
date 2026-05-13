import { Node } from '../models/Node';
import { Edge } from '../models/Edge';
import { nodeService, NodeQuery } from './nodeService';
import { edgeService, EdgeQuery } from './edgeService';
import { pathFinder, FindPathsOptions } from './pathFinder';
import { NodeType, INode } from '../models/Node';

export interface Consumer360 {
  consumer: INode;
  profile: {
    interactions: number;
    connections: number;
    categories: string[];
    locations: string[];
  };
  products: {
    ordered: INode[];
    browsed: INode[];
    liked: INode[];
  };
  merchants: INode[];
  recentActivity: Array<{
    type: string;
    target: INode;
    timestamp: Date;
  }>;
}

export interface SimilarConsumer {
  consumer: INode;
  similarityScore: number;
  commonProducts: INode[];
  commonCategories: string[];
}

export interface ConsumerJourney {
  consumer: INode;
  events: Array<{
    timestamp: Date;
    action: string;
    nodeType: NodeType;
    nodeId: string;
    externalId: string;
    properties: Record<string, unknown>;
  }>;
}

export interface MerchantConnections {
  merchant: INode;
  stats: {
    totalOrders: number;
    totalCustomers: number;
    avgOrderValue: number;
  };
  topProducts: Array<{
    product: INode;
    orderCount: number;
  }>;
  topCategories: string[];
  recentCustomers: INode[];
}

export class GraphService {
  /**
   * Get complete 360 profile of a consumer
   */
  async getConsumer360(nodeId: string): Promise<Consumer360 | null> {
    const consumer = await nodeService.findByNodeId(nodeId);

    if (!consumer || consumer.type !== 'consumer') {
      return null;
    }

    // Get all edges for this consumer
    const [outgoingEdges, incomingEdges] = await Promise.all([
      edgeService.getOutgoingEdges(nodeId, undefined, { limit: 500, populate: true }),
      edgeService.getIncomingEdges(nodeId, undefined, { limit: 500, populate: true }),
    ]);

    const products: Consumer360['products'] = {
      ordered: [],
      browsed: [],
      liked: [],
    };

    const merchants = new Set<string>();
    const categories = new Set<string>();
    const locations = new Set<string>();

    for (const edge of outgoingEdges) {
      const targetNode = (edge as unknown as { targetNode?: INode }).targetNode;
      if (!targetNode) continue;

      switch (edge.type) {
        case 'ordered':
          products.ordered.push(targetNode);
          if (targetNode.type === 'category') {
            categories.add(targetNode.externalId);
          }
          break;
        case 'browsed':
          products.browsed.push(targetNode);
          break;
        case 'liked':
          products.liked.push(targetNode);
          break;
        case 'visited':
          if (targetNode.type === 'location') {
            locations.add(targetNode.externalId);
          }
          if (targetNode.type === 'merchant') {
            merchants.add(targetNode.nodeId);
          }
          break;
      }
    }

    for (const edge of incomingEdges) {
      const sourceNode = (edge as unknown as { sourceNode?: INode }).sourceNode;
      if (sourceNode?.type === 'merchant') {
        merchants.add(sourceNode.nodeId);
      }
    }

    // Get merchant nodes
    const merchantNodes = await Promise.all(
      Array.from(merchants).map(id => nodeService.findByNodeId(id))
    );

    // Build recent activity
    const recentActivity = [...outgoingEdges, ...incomingEdges]
      .sort((a, b) => {
        const aTime = (a.properties?.timestamp as Date) || a.createdAt;
        const bTime = (b.properties?.timestamp as Date) || b.createdAt;
        return bTime.getTime() - aTime.getTime();
      })
      .slice(0, 20)
      .map(edge => {
        const otherNode = edge.sourceNodeId === nodeId
          ? (edge as unknown as { targetNode?: INode }).targetNode
          : (edge as unknown as { sourceNode?: INode }).sourceNode;

        return {
          type: edge.type,
          target: otherNode as INode,
          timestamp: (edge.properties?.timestamp as Date) || edge.createdAt,
        };
      });

    return {
      consumer,
      profile: {
        interactions: outgoingEdges.length + incomingEdges.length,
        connections: merchants.size + products.ordered.length + products.liked.length,
        categories: Array.from(categories),
        locations: Array.from(locations),
      },
      products,
      merchants: merchantNodes.filter((m): m is INode => m !== null),
      recentActivity,
    };
  }

  /**
   * Find consumers similar to a given consumer
   */
  async findSimilarConsumers(
    nodeId: string,
    limit: number = 10
  ): Promise<SimilarConsumer[]> {
    const targetConsumer = await nodeService.findByNodeId(nodeId);

    if (!targetConsumer || targetConsumer.type !== 'consumer') {
      return [];
    }

    // Get target consumer's products and categories
    const targetEdges = await edgeService.getOutgoingEdges(nodeId);
    const targetProducts = new Set(
      targetEdges
        .filter(e => ['ordered', 'browsed', 'liked'].includes(e.type))
        .map(e => e.targetNodeId)
    );
    const targetCategories = new Set<string>();

    for (const productId of targetProducts) {
      const product = await nodeService.findByNodeId(productId);
      if (product?.type === 'category') {
        targetCategories.add(product.externalId);
      }
    }

    // Find other consumers with similar products
    const similarConsumers: SimilarConsumer[] = [];
    const visited = new Set<string>([nodeId]);

    for (const productId of targetProducts) {
      const edges = await edgeService.getOutgoingEdges(productId, 'ordered');
      const productNode = await nodeService.findByNodeId(productId);

      for (const edge of edges) {
        if (visited.has(edge.sourceNodeId)) {
          continue;
        }

        visited.add(edge.sourceNodeId);

        const consumer = await nodeService.findByNodeId(edge.sourceNodeId);
        if (!consumer || consumer.type !== 'consumer') {
          continue;
        }

        // Get this consumer's products
        const consumerEdges = await edgeService.getOutgoingEdges(consumer.nodeId);
        const consumerProducts = new Set(
          consumerEdges
            .filter(e => ['ordered', 'browsed', 'liked'].includes(e.type))
            .map(e => e.targetNodeId)
        );

        // Calculate Jaccard similarity
        const intersection = [...targetProducts].filter(p => consumerProducts.has(p));
        const union = new Set([...targetProducts, ...consumerProducts]);
        const similarity = intersection.length / union.size;

        if (similarity > 0) {
          // Find common products
          const commonProductNodes = await Promise.all(
            intersection.map(id => nodeService.findByNodeId(id))
          );

          // Find common categories
          const commonCategoriesSet = new Set<string>();
          for (const product of commonProductNodes) {
            if (product?.type === 'category') {
              commonCategoriesSet.add(product.externalId);
            }
          }

          // Check if this consumer is already in the list
          const existing = similarConsumers.find(c => c.consumer.nodeId === consumer.nodeId);
          if (existing) {
            existing.similarityScore = Math.max(existing.similarityScore, similarity);
          } else {
            similarConsumers.push({
              consumer,
              similarityScore: similarity,
              commonProducts: commonProductNodes.filter((p): p is INode => p !== null),
              commonCategories: Array.from(commonCategoriesSet),
            });
          }
        }
      }
    }

    // Sort by similarity and return top N
    return similarConsumers
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);
  }

  /**
   * Get consumer journey (all interactions in chronological order)
   */
  async getConsumerJourney(
    nodeId: string,
    limit: number = 50
  ): Promise<ConsumerJourney | null> {
    const consumer = await nodeService.findByNodeId(nodeId);

    if (!consumer || consumer.type !== 'consumer') {
      return null;
    }

    // Get all edges connected to this consumer
    const [outgoingEdges, incomingEdges] = await Promise.all([
      edgeService.getOutgoingEdges(nodeId, undefined, { limit: limit * 2, populate: true }),
      edgeService.getIncomingEdges(nodeId, undefined, { limit: limit * 2, populate: true }),
    ]);

    // Combine and sort by timestamp
    const events = [...outgoingEdges, ...incomingEdges]
      .map(edge => {
        const isOutgoing = edge.sourceNodeId === nodeId;
        const otherNode = isOutgoing
          ? (edge as unknown as { targetNode?: INode }).targetNode
          : (edge as unknown as { sourceNode?: INode }).sourceNode;

        return {
          timestamp: (edge.properties?.timestamp as Date) || edge.createdAt,
          action: isOutgoing ? `out_${edge.type}` : `in_${edge.type}`,
          nodeType: otherNode?.type || 'unknown',
          nodeId: otherNode?.nodeId || '',
          externalId: otherNode?.externalId || '',
          properties: otherNode?.properties || {},
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return {
      consumer,
      events,
    };
  }

  /**
   * Get merchant connections and stats
   */
  async getMerchantConnections(
    nodeId: string
  ): Promise<MerchantConnections | null> {
    const merchant = await nodeService.findByNodeId(nodeId);

    if (!merchant || merchant.type !== 'merchant') {
      return null;
    }

    // Get all order edges to this merchant
    const orderEdges = await edgeService.getIncomingEdges(nodeId, 'ordered', { populate: true });
    const orderedProducts = new Map<string, number>();
    const customers = new Set<string>();

    for (const edge of orderEdges) {
      const sourceNode = (edge as unknown as { sourceNode?: INode }).sourceNode;
      if (sourceNode?.type === 'consumer') {
        customers.add(sourceNode.nodeId);
      }

      const currentCount = orderedProducts.get(edge.sourceNodeId) || 0;
      orderedProducts.set(edge.sourceNodeId, currentCount + 1);
    }

    // Get top products
    const topProducts: Array<{ product: INode; orderCount: number }> = [];

    for (const [productNodeId, count] of orderedProducts) {
      const product = await nodeService.findByNodeId(productNodeId);
      if (product?.type === 'product') {
        topProducts.push({ product, orderCount: count });
      }
    }

    topProducts.sort((a, b) => b.orderCount - a.orderCount);

    // Get top categories
    const categoryCounts = new Map<string, number>();
    for (const { product } of topProducts.slice(0, 20)) {
      const categoryEdge = await edgeService.find({
        sourceNodeId: product.nodeId,
        type: 'linked_to',
      });

      for (const edge of categoryEdge) {
        const category = await nodeService.findByNodeId(edge.targetNodeId);
        if (category?.type === 'category') {
          const currentCount = categoryCounts.get(category.externalId) || 0;
          categoryCounts.set(category.externalId, currentCount + 1);
        }
      }
    }

    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Get recent customers
    const recentCustomerEdges = await edgeService.getIncomingEdges(
      nodeId,
      'ordered',
      { limit: 10, populate: true }
    );

    const recentCustomers: INode[] = [];
    const seenCustomers = new Set<string>();

    for (const edge of recentCustomerEdges) {
      const sourceNode = (edge as unknown as { sourceNode?: INode }).sourceNode;
      if (sourceNode?.type === 'consumer' && !seenCustomers.has(sourceNode.nodeId)) {
        recentCustomers.push(sourceNode);
        seenCustomers.add(sourceNode.nodeId);
      }
    }

    // Calculate stats
    const totalOrders = orderEdges.length;
    const totalCustomers = customers.size;
    const avgOrderValue = totalCustomers > 0
      ? (merchant.properties?.avgOrderValue as number) || 0
      : 0;

    return {
      merchant,
      stats: {
        totalOrders,
        totalCustomers,
        avgOrderValue,
      },
      topProducts: topProducts.slice(0, 10),
      topCategories: topCategories.slice(0, 5),
      recentCustomers,
    };
  }

  /**
   * Find paths between two nodes
   */
  async findPaths(
    sourceNodeId: string,
    targetNodeId: string,
    options?: FindPathsOptions
  ): Promise<{ shortest?: ReturnType<typeof pathFinder.findShortestPath>; all?: ReturnType<typeof pathFinder.findAllPaths> }> {
    const [shortest, all] = await Promise.all([
      pathFinder.findShortestPath(sourceNodeId, targetNodeId, options),
      pathFinder.findAllPaths(sourceNodeId, targetNodeId, { ...options, maxDepth: options?.maxDepth || 4 }),
    ]);

    return { shortest: shortest || undefined, all };
  }

  /**
   * Get graph statistics
   */
  async getGraphStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<NodeType, number>;
    edgeTypes: Record<string, number>;
    avgDegree: number;
  }> {
    const [nodeCounts, edgeCounts, totalEdges] = await Promise.all([
      nodeService.getTypeCounts(),
      edgeService.getTypeCounts(),
      Edge.countDocuments(),
    ]);

    const totalNodes = Object.values(nodeCounts).reduce((a, b) => a + b, 0);
    const avgDegree = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;

    return {
      totalNodes,
      totalEdges,
      nodeTypes: nodeCounts,
      edgeTypes: edgeCounts,
      avgDegree,
    };
  }
}

export const graphService = new GraphService();
