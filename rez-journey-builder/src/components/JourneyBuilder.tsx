/**
 * REZ Journey Builder - Visual Automation Canvas
 * Drag-and-drop interface for building customer journeys
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { JourneyCanvas } from './canvas/JourneyCanvas';
import { NodePalette } from './nodes/NodePalette';
import { PropertiesPanel } from './components/PropertiesPanel';
import { JourneyToolbar } from './components/JourneyToolbar';
import { useJourney } from '../hooks/useJourney';
import { JourneyNode, JourneyConnection, JourneyTemplate } from '../types';

export interface JourneyBuilderProps {
  journeyId?: string;
  onSave?: (journey: JourneyTemplate) => void;
  onPublish?: (journeyId: string) => void;
  readOnly?: boolean;
}

export function JourneyBuilder({
  journeyId,
  onSave,
  onPublish,
  readOnly = false,
}: JourneyBuilderProps) {
  const {
    journey,
    nodes,
    connections,
    selectedNode,
    setSelectedNode,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    saveJourney,
  } = useJourney(journeyId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<JourneyNode | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // If dragging from palette, create preview
    if (active.data.current?.type === 'palette') {
      setActiveNode({
        id: `node-${Date.now()}`,
        type: active.data.current.nodeType,
        position: { x: 0, y: 0 },
        data: {
          label: active.data.current.label,
          config: {},
        },
      });
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveNode(null);

    if (!over) return;

    // Handle node creation from palette
    if (active.data.current?.type === 'palette' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const position = {
        x: event.activatorEvent instanceof MouseEvent
          ? event.activatorEvent.clientX - rect.left
          : 100,
        y: event.activatorEvent instanceof MouseEvent
          ? event.activatorEvent.clientY - rect.top
          : 100,
      };

      addNode({
        id: `node-${Date.now()}`,
        type: active.data.current.nodeType,
        position,
        data: {
          label: active.data.current.label,
          config: {},
        },
      });
    }

    // Handle connection creation
    if (active.data.current?.type === 'node' && over.data.current?.type === 'handle') {
      const sourceId = active.id as string;
      const targetId = over.id as string;

      if (sourceId !== targetId) {
        addConnection({
          id: `conn-${Date.now()}`,
          source: sourceId,
          target: targetId,
        });
      }
    }
  }, [addNode, addConnection]);

  const handleSave = useCallback(async () => {
    const template: JourneyTemplate = {
      id: journey?.id || `journey-${Date.now()}`,
      name: journey?.name || 'Untitled Journey',
      nodes,
      connections,
      status: 'draft',
    };
    await saveJourney(template);
    onSave?.(template);
  }, [journey, nodes, connections, saveJourney, onSave]);

  const handlePublish = useCallback(async () => {
    if (!journey?.id) {
      console.error('Journey must be saved before publishing');
      return;
    }
    onPublish?.(journey.id);
  }, [journey, onPublish]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <JourneyToolbar
        journeyName={journey?.name || 'Untitled Journey'}
        onSave={handleSave}
        onPublish={handlePublish}
        readOnly={readOnly}
      />

      <div className="flex flex-1 overflow-hidden">
        <NodePalette readOnly={readOnly} />

        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div ref={canvasRef} className="flex-1 overflow-auto">
            <JourneyCanvas
              nodes={nodes}
              connections={connections}
              selectedNodeId={selectedNode}
              onSelectNode={setSelectedNode}
              readOnly={readOnly}
            />
          </div>

          <DragOverlay>
            {activeNode && (
              <div className="px-4 py-2 bg-white rounded-lg shadow-lg border border-blue-200">
                {activeNode.data.label}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onUpdate={(config) => updateNode(selectedNode.id, { data: { ...selectedNode.data, config } })}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}
