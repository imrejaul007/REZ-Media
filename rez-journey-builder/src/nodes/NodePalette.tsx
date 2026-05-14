/**
 * REZ Journey Builder - Node Palette
 * Sidebar with draggable node types
 */

'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';

interface NodePaletteProps {
  readOnly?: boolean;
}

interface PaletteNode {
  type: string;
  nodeType: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const PALETTE_NODES: PaletteNode[] = [
  // Triggers
  { type: 'trigger', nodeType: 'trigger', label: 'Event Trigger', description: 'Start when event occurs', icon: '⚡', color: 'green' },
  { type: 'trigger', nodeType: 'schedule', label: 'Schedule', description: 'Start at specific time', icon: '📅', color: 'green' },
  { type: 'trigger', nodeType: 'api', label: 'API Trigger', description: 'Start via API call', icon: '🔗', color: 'green' },

  // Actions
  { type: 'action', nodeType: 'email', label: 'Send Email', description: 'Send email to customer', icon: '📧', color: 'blue' },
  { type: 'action', nodeType: 'sms', label: 'Send SMS', description: 'Send SMS notification', icon: '💬', color: 'blue' },
  { type: 'action', nodeType: 'push', label: 'Push Notification', description: 'Send push notification', icon: '🔔', color: 'blue' },
  { type: 'action', nodeType: 'whatsapp', label: 'WhatsApp', description: 'Send WhatsApp message', icon: '📱', color: 'blue' },
  { type: 'action', nodeType: 'webhook', label: 'Webhook', description: 'Call external API', icon: '🌐', color: 'blue' },

  // Logic
  { type: 'condition', nodeType: 'condition', label: 'Condition', description: 'Branch based on rules', icon: '❓', color: 'yellow' },
  { type: 'condition', nodeType: 'split', label: 'A/B Split', description: 'Split into A/B test', icon: '🔀', color: 'yellow' },
  { type: 'delay', nodeType: 'delay', label: 'Wait/Delay', description: 'Wait before next step', icon: '⏱️', color: 'purple' },

  // End
  { type: 'end', nodeType: 'end', label: 'End Journey', description: 'End of journey', icon: '✅', color: 'red' },
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function PaletteItem({ node, readOnly }: { node: PaletteNode; readOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${node.nodeType}`,
    disabled: readOnly,
    data: { type: 'palette', nodeType: node.nodeType, label: node.label },
  });

  const colors = COLOR_CLASSES[node.color];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg border cursor-grab
        ${colors.bg} ${colors.border}
        hover:shadow-md transition-all
        ${isDragging ? 'opacity-50 cursor-grabbing' : ''}
      `}
    >
      <span className="text-xl">{node.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${colors.text}`}>{node.label}</p>
        <p className="text-xs text-gray-500 truncate">{node.description}</p>
      </div>
    </div>
  );
}

export function NodePalette({ readOnly }: NodePaletteProps) {
  const triggerNodes = PALETTE_NODES.filter((n) => n.type === 'trigger');
  const actionNodes = PALETTE_NODES.filter((n) => n.type === 'action');
  const logicNodes = PALETTE_NODES.filter((n) => n.type === 'condition' || n.type === 'delay');
  const endNodes = PALETTE_NODES.filter((n) => n.type === 'end');

  return (
    <div className="w-64 bg-gray-100 border-r overflow-y-auto">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nodes</h2>

        {/* Triggers */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Triggers
          </h3>
          <div className="space-y-2">
            {triggerNodes.map((node) => (
              <PaletteItem key={node.nodeType} node={node} readOnly={readOnly} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Actions
          </h3>
          <div className="space-y-2">
            {actionNodes.map((node) => (
              <PaletteItem key={node.nodeType} node={node} readOnly={readOnly} />
            ))}
          </div>
        </div>

        {/* Logic */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Logic
          </h3>
          <div className="space-y-2">
            {logicNodes.map((node) => (
              <PaletteItem key={node.nodeType} node={node} readOnly={readOnly} />
            ))}
          </div>
        </div>

        {/* End */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            End
          </h3>
          <div className="space-y-2">
            {endNodes.map((node) => (
              <PaletteItem key={node.nodeType} node={node} readOnly={readOnly} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
