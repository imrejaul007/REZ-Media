/**
 * REZ Journey Builder - Canvas Component
 * The main drag-drop area for building journeys
 */

'use client';

import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { JourneyNode as NodeComponent } from './NodeComponent';
import { JourneyConnection as ConnectionComponent } from './ConnectionComponent';
import { JourneyNode, JourneyConnection } from '../types';

interface JourneyCanvasProps {
  nodes: JourneyNode[];
  connections: JourneyConnection[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  readOnly?: boolean;
}

export function JourneyCanvas({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  readOnly = false,
}: JourneyCanvasProps) {
  const { setNodeRef } = useDroppable({
    id: 'canvas',
  });

  // Calculate SVG path for connections
  const connectionPaths = useMemo(() => {
    return connections.map((conn) => {
      const sourceNode = nodes.find((n) => n.id === conn.source);
      const targetNode = nodes.find((n) => n.id === conn.target);

      if (!sourceNode || !targetNode) return null;

      // Calculate positions (center of nodes)
      const sourceX = sourceNode.position.x + 100; // node width / 2
      const sourceY = sourceNode.position.y + 40; // node height / 2
      const targetX = targetNode.position.x + 100;
      const targetY = targetNode.position.y + 40;

      // Create bezier curve
      const midY = (sourceY + targetY) / 2;
      const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

      return {
        id: conn.id,
        path,
        label: conn.label,
        sourceX,
        sourceY,
        targetX,
        targetY,
      };
    }).filter(Boolean);
  }, [nodes, connections]);

  return (
    <div
      ref={setNodeRef}
      className="relative w-[2000px] h-[2000px] bg-white"
      style={{
        backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* SVG Layer for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>

        {connectionPaths.map((conn) => conn && (
          <g key={conn.id}>
            <path
              d={conn.path}
              fill="none"
              stroke="#6366f1"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
            {conn.label && (
              <text
                x={(conn.sourceX + conn.targetX) / 2}
                y={(conn.sourceY + conn.targetY) / 2 - 10}
                textAnchor="middle"
                className="text-xs fill-indigo-600 font-medium"
              >
                {conn.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Nodes Layer */}
      {nodes.map((node) => (
        <NodeComponent
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          onClick={() => onSelectNode(node.id)}
          readOnly={readOnly}
        />
      ))}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="text-6xl mb-4">🎯</div>
            <p className="text-lg font-medium">Start building your journey</p>
            <p className="text-sm">Drag nodes from the left panel</p>
          </div>
        </div>
      )}
    </div>
  );
}
