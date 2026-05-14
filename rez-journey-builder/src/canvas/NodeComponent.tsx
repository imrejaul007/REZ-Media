/**
 * REZ Journey Builder - Node Component
 * Individual draggable node on the canvas
 */

'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { JourneyNode } from '../types';

interface NodeComponentProps {
  node: JourneyNode;
  isSelected: boolean;
  onClick: () => void;
  readOnly?: boolean;
}

const NODE_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  trigger: { bg: 'bg-green-100', border: 'border-green-500', icon: '⚡' },
  condition: { bg: 'bg-yellow-100', border: 'border-yellow-500', icon: '❓' },
  action: { bg: 'bg-blue-100', border: 'border-blue-500', icon: '🎬' },
  delay: { bg: 'bg-purple-100', border: 'border-purple-500', icon: '⏱️' },
  split: { bg: 'bg-orange-100', border: 'border-orange-500', icon: '🔀' },
  end: { bg: 'bg-red-100', border: 'border-red-500', icon: '✅' },
};

export function JourneyNode({ node, isSelected, onClick, readOnly }: NodeComponentProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    disabled: readOnly,
    data: { type: 'node', nodeType: node.type },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const colors = NODE_COLORS[node.type] || NODE_COLORS.action;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, left: node.position.x, top: node.position.y }}
      className={`
        absolute w-[200px] rounded-lg shadow-md cursor-pointer
        ${colors.bg} border-2 ${colors.border}
        ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
        transition-shadow hover:shadow-lg
      `}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/10">
        <span className="text-lg">{colors.icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase">{node.type}</span>
      </div>

      {/* Content */}
      <div className="px-3 py-3">
        <p className="font-medium text-gray-900 text-sm">{node.data.label}</p>
        {node.data.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{node.data.description}</p>
        )}
      </div>

      {/* Handle (connection point) */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-crosshair hover:scale-125 transition-transform" />

      {/* Source handle (for connections FROM this node) */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-crosshair hover:scale-125 transition-transform" />
    </div>
  );
}
