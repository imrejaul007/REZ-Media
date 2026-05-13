import { Edge } from '../models/Edge';
import { Node, NodeType } from '../models/Node';
import { nodeService } from './nodeService';

export interface PathNode {
  nodeId: string;
  type: NodeType;
  externalId: string;
  properties: Record<string, unknown>;
}

export interface Path {
  nodes: PathNode[];
  edges: Array<{
    edgeId: string;
    type: string;
    weight: number;
  }>;
  totalWeight: number;
  depth: number;
}

export interface FindPathsOptions {
  maxDepth?: number;
  edgeTypes?: string[];
  minWeight?: number;
}

export class PathFinder {
  /**
   * Find shortest path between two nodes using BFS
   */
  async findShortestPath(
    sourceNodeId: string,
    targetNodeId: string,
    options?: FindPathsOptions
  ): Promise<Path | null> {
    const maxDepth = options?.maxDepth || 5;
    const edgeTypes = options?.edgeTypes;
    const minWeight = options?.minWeight || 0;

    // BFS to find shortest path
    const queue: Array<{
      nodeId: string;
      path: Path;
    }> = [];

    const visited = new Set<string>();
    visited.add(sourceNodeId);

    // Get source node
    const sourceNode = await nodeService.findByNodeId(sourceNodeId);
    if (!sourceNode) {
      return null;
    }

    queue.push({
      nodeId: sourceNodeId,
      path: {
        nodes: [{
          nodeId: sourceNode.nodeId,
          type: sourceNode.type,
          externalId: sourceNode.externalId,
          properties: sourceNode.properties,
        }],
        edges: [],
        totalWeight: 0,
        depth: 0,
      },
    });

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (path.depth >= maxDepth) {
        continue;
      }

      // Find all outgoing edges
      const edgeQuery: Record<string, unknown> = { sourceNodeId: nodeId };
      if (edgeTypes) {
        edgeQuery.type = { $in: edgeTypes };
      }
      if (minWeight > 0) {
        edgeQuery.weight = { $gte: minWeight };
      }

      const edges = await Edge.find(edgeQuery).limit(100);

      for (const edge of edges) {
        if (visited.has(edge.targetNodeId)) {
          continue;
        }

        const targetNode = await nodeService.findByNodeId(edge.targetNodeId);
        if (!targetNode) {
          continue;
        }

        const newPath: Path = {
          nodes: [...path.nodes, {
            nodeId: targetNode.nodeId,
            type: targetNode.type,
            externalId: targetNode.externalId,
            properties: targetNode.properties,
          }],
          edges: [...path.edges, {
            edgeId: edge.edgeId,
            type: edge.type,
            weight: edge.weight,
          }],
          totalWeight: path.totalWeight + (1 - edge.weight),
          depth: path.depth + 1,
        };

        // Check if we reached the target
        if (edge.targetNodeId === targetNodeId) {
          return newPath;
        }

        visited.add(edge.targetNodeId);
        queue.push({
          nodeId: edge.targetNodeId,
          path: newPath,
        });
      }
    }

    return null;
  }

  /**
   * Find all paths between two nodes up to maxDepth
   */
  async findAllPaths(
    sourceNodeId: string,
    targetNodeId: string,
    options?: FindPathsOptions
  ): Promise<Path[]> {
    const maxDepth = options?.maxDepth || 4;
    const edgeTypes = options?.edgeTypes;
    const minWeight = options?.minWeight || 0;

    const paths: Path[] = [];

    // Get source node
    const sourceNode = await nodeService.findByNodeId(sourceNodeId);
    if (!sourceNode) {
      return paths;
    }

    const targetNode = await nodeService.findByNodeId(targetNodeId);
    if (!targetNode) {
      return paths;
    }

    // DFS to find all paths
    const dfs = async (
      currentNodeId: string,
      visited: Set<string>,
      currentPath: Path
    ) => {
      if (currentPath.depth >= maxDepth) {
        return;
      }

      // Find all outgoing edges
      const edgeQuery: Record<string, unknown> = { sourceNodeId: currentNodeId };
      if (edgeTypes) {
        edgeQuery.type = { $in: edgeTypes };
      }
      if (minWeight > 0) {
        edgeQuery.weight = { $gte: minWeight };
      }

      const edges = await Edge.find(edgeQuery).limit(100);

      for (const edge of edges) {
        if (visited.has(edge.targetNodeId)) {
          continue;
        }

        const nextNode = await nodeService.findByNodeId(edge.targetNodeId);
        if (!nextNode) {
          continue;
        }

        const newPath: Path = {
          nodes: [...currentPath.nodes, {
            nodeId: nextNode.nodeId,
            type: nextNode.type,
            externalId: nextNode.externalId,
            properties: nextNode.properties,
          }],
          edges: [...currentPath.edges, {
            edgeId: edge.edgeId,
            type: edge.type,
            weight: edge.weight,
          }],
          totalWeight: currentPath.totalWeight + (1 - edge.weight),
          depth: currentPath.depth + 1,
        };

        // Check if we reached the target
        if (edge.targetNodeId === targetNodeId) {
          paths.push(newPath);
        } else {
          visited.add(edge.targetNodeId);
          await dfs(edge.targetNodeId, visited, newPath);
          visited.delete(edge.targetNodeId);
        }
      }
    };

    await dfs(
      sourceNodeId,
      new Set([sourceNodeId]),
      {
        nodes: [{
          nodeId: sourceNode.nodeId,
          type: sourceNode.type,
          externalId: sourceNode.externalId,
          properties: sourceNode.properties,
        }],
        edges: [],
        totalWeight: 0,
        depth: 0,
      }
    );

    // Sort by total weight (shorter paths first)
    return paths.sort((a, b) => a.totalWeight - b.totalWeight);
  }

  /**
   * Find nodes reachable from a given node
   */
  async findReachableNodes(
    sourceNodeId: string,
    options?: FindPathsOptions
  ): Promise<{ nodeId: string; type: NodeType; distance: number }[]> {
    const maxDepth = options?.maxDepth || 3;
    const edgeTypes = options?.edgeTypes;

    const reachable: Map<string, { type: NodeType; distance: number }> = new Map();

    // BFS
    const queue: Array<{ nodeId: string; distance: number }> = [];
    queue.push({ nodeId: sourceNodeId, distance: 0 });

    const visited = new Set<string>();
    visited.add(sourceNodeId);

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      if (distance >= maxDepth) {
        continue;
      }

      const edgeQuery: Record<string, unknown> = { sourceNodeId: nodeId };
      if (edgeTypes) {
        edgeQuery.type = { $in: edgeTypes };
      }

      const edges = await Edge.find(edgeQuery).limit(100);

      for (const edge of edges) {
        if (visited.has(edge.targetNodeId)) {
          continue;
        }

        visited.add(edge.targetNodeId);

        const targetNode = await nodeService.findByNodeId(edge.targetNodeId);
        if (targetNode) {
          // Keep shortest distance
          const existing = reachable.get(edge.targetNodeId);
          if (!existing || existing.distance > distance + 1) {
            reachable.set(edge.targetNodeId, {
              type: targetNode.type,
              distance: distance + 1,
            });
          }

          queue.push({ nodeId: edge.targetNodeId, distance: distance + 1 });
        }
      }
    }

    return Array.from(reachable.entries()).map(([nodeId, data]) => ({
      nodeId,
      type: data.type,
      distance: data.distance,
    }));
  }

  /**
   * Find common neighbors between two nodes
   */
  async findCommonNeighbors(
    nodeId1: string,
    nodeId2: string
  ): Promise<PathNode[]> {
    // Get outgoing neighbors of both nodes
    const [outgoing1, outgoing2] = await Promise.all([
      Edge.find({ sourceNodeId: nodeId1 }).select('targetNodeId'),
      Edge.find({ sourceNodeId: nodeId2 }).select('targetNodeId'),
    ]);

    const neighbors1 = new Set(outgoing1.map(e => e.targetNodeId));
    const neighbors2 = new Set(outgoing2.map(e => e.targetNodeId));

    // Find intersection
    const commonNodeIds = [...neighbors1].filter(id => neighbors2.has(id));

    if (commonNodeIds.length === 0) {
      return [];
    }

    // Get node details
    const nodes = await Node.find({ nodeId: { $in: commonNodeIds } });

    return nodes.map(node => ({
      nodeId: node.nodeId,
      type: node.type,
      externalId: node.externalId,
      properties: node.properties,
    }));
  }

  /**
   * Get neighborhood of a node (nodes within k hops)
   */
  async getNeighborhood(
    nodeId: string,
    depth: number = 1,
    direction: 'in' | 'out' | 'both' = 'both'
  ): Promise<{ nodes: PathNode[]; edges: Array<{ edgeId: string; type: string }> }> {
    const node = await nodeService.findByNodeId(nodeId);
    if (!node) {
      return { nodes: [], edges: [] };
    }

    const nodesMap = new Map<string, PathNode>();
    const edges: Array<{ edgeId: string; type: string }> = [];

    nodesMap.set(nodeId, {
      nodeId: node.nodeId,
      type: node.type,
      externalId: node.externalId,
      properties: node.properties,
    });

    // BFS for neighborhood
    const queue: Array<{ currentNodeId: string; currentDepth: number }> = [];
    const visited = new Set<string>();
    visited.add(nodeId);

    if (direction !== 'out') {
      // Add incoming edges
      const incomingEdges = await Edge.find({ targetNodeId: nodeId });
      for (const edge of incomingEdges) {
        edges.push({ edgeId: edge.edgeId, type: edge.type });
        const sourceNode = await nodeService.findByNodeId(edge.sourceNodeId);
        if (sourceNode && !visited.has(edge.sourceNodeId) && currentDepth < depth) {
          queue.push({ currentNodeId: edge.sourceNodeId, currentDepth: 1 });
        }
      }
    }

    if (direction !== 'in') {
      // Add outgoing edges
      const outgoingEdges = await Edge.find({ sourceNodeId: nodeId });
      for (const edge of outgoingEdges) {
        edges.push({ edgeId: edge.edgeId, type: edge.type });
        const targetNode = await nodeService.findByNodeId(edge.targetNodeId);
        if (targetNode && !visited.has(targetNode.nodeId) && 1 < depth) {
          queue.push({ currentNodeId: targetNode.nodeId, currentDepth: 1 });
        }
      }
    }

    while (queue.length > 0) {
      const { currentNodeId, currentDepth } = queue.shift()!;

      if (visited.has(currentNodeId) || currentDepth > depth) {
        continue;
      }

      visited.add(currentNodeId);

      const currentNode = await nodeService.findByNodeId(currentNodeId);
      if (currentNode) {
        nodesMap.set(currentNodeId, {
          nodeId: currentNode.nodeId,
          type: currentNode.type,
          externalId: currentNode.externalId,
          properties: currentNode.properties,
        });
      }

      // Process edges from this node
      if (direction !== 'in') {
        const outgoing = await Edge.find({ sourceNodeId: currentNodeId });
        for (const edge of outgoing) {
          edges.push({ edgeId: edge.edgeId, type: edge.type });
          if (!visited.has(edge.targetNodeId) && currentDepth < depth) {
            queue.push({ currentNodeId: edge.targetNodeId, currentDepth: currentDepth + 1 });
          }
        }
      }

      if (direction !== 'out') {
        const incoming = await Edge.find({ targetNodeId: currentNodeId });
        for (const edge of incoming) {
          edges.push({ edgeId: edge.edgeId, type: edge.type });
          if (!visited.has(edge.sourceNodeId) && currentDepth < depth) {
            queue.push({ currentNodeId: edge.sourceNodeId, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      edges: [...new Map(edges.map(e => [e.edgeId, e])).values()], // Deduplicate
    };
  }
}

export const pathFinder = new PathFinder();
