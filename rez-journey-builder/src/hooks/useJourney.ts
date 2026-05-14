/**
 * REZ Journey Builder - useJourney Hook
 * State management for journey builder
 */

'use client';

import { useState, useCallback } from 'react';
import { JourneyNode, JourneyConnection, JourneyTemplate } from '../types';

interface UseJourneyOptions {
  journeyId?: string;
}

export function useJourney({ journeyId }: UseJourneyOptions = {}) {
  const [journey, setJourney] = useState<JourneyTemplate | null>(null);
  const [nodes, setNodes] = useState<JourneyNode[]>([]);
  const [connections, setConnections] = useState<JourneyConnection[]>([]);
  const [selectedNode, setSelectedNode] = useState<JourneyNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load journey from API
  const loadJourney = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/journeys/${id}`);
      if (!response.ok) throw new Error('Failed to load journey');
      const data = await response.json();
      setJourney(data.journey);
      setNodes(data.journey.nodes || []);
      setConnections(data.journey.connections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add node
  const addNode = useCallback((node: JourneyNode) => {
    setNodes((prev) => [...prev, node]);
  }, []);

  // Update node
  const updateNode = useCallback((nodeId: string, updates: Partial<JourneyNode>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      )
    );

    // Update selected node if it's the one being edited
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedNode]);

  // Remove node
  const removeNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    // Also remove connections to/from this node
    setConnections((prev) =>
      prev.filter((conn) => conn.source !== nodeId && conn.target !== nodeId)
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  // Add connection
  const addConnection = useCallback((connection: JourneyConnection) => {
    // Check if connection already exists
    const exists = connections.some(
      (c) => c.source === connection.source && c.target === connection.target
    );
    if (!exists) {
      setConnections((prev) => [...prev, connection]);
    }
  }, [connections]);

  // Remove connection
  const removeConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
  }, []);

  // Save journey
  const saveJourney = useCallback(async (template: JourneyTemplate) => {
    setIsLoading(true);
    setError(null);
    try {
      const method = journey?.id ? 'PUT' : 'POST';
      const url = journey?.id ? `/api/journeys/${journey.id}` : '/api/journeys';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!response.ok) throw new Error('Failed to save journey');
      const data = await response.json();
      setJourney(data.journey);
      return data.journey;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [journey]);

  // Publish journey
  const publishJourney = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/journeys/${id}/publish`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to publish journey');
      const data = await response.json();
      setJourney((prev) => prev ? { ...prev, status: 'published' } : null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load journey on mount
  if (journeyId && !journey && !isLoading) {
    loadJourney(journeyId);
  }

  return {
    // State
    journey,
    nodes,
    connections,
    selectedNode,
    isLoading,
    error,

    // Actions
    loadJourney,
    setSelectedNode,
    addNode,
    updateNode,
    removeNode,
    addConnection,
    removeConnection,
    saveJourney,
    publishJourney,
  };
}
