'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useChatbotStore } from '@/lib/store'
import { BlockNode } from './BlockNode'
import { v4 as uuidv4 } from 'uuid'
import type { BlockType, FlowNode, FlowEdge } from '@/types'

const nodeTypes = {
  block: BlockNode,
}

interface FlowCanvasProps {
  onNodeSelect?: (nodeId: string | null) => void
}

export function FlowCanvas({ onNodeSelect }: FlowCanvasProps) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    addNode,
    selectedNodeId,
    setSelectedNodeId,
    connectNodes,
    deleteNode,
    updateBlockContent,
  } = useChatbotStore()

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges)

  // Sync with store
  const syncToStore = useCallback((updatedNodes: Node[], updatedEdges: Edge[]) => {
    setNodes(updatedNodes)
    setEdges(updatedEdges)
    setStoreNodes(updatedNodes as FlowNode[])
    setStoreEdges(updatedEdges as FlowEdge[])
  }, [setNodes, setEdges, setStoreNodes, setStoreEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge(
        {
          ...params,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
        },
        edges
      )
      setEdges(newEdges)
      setStoreEdges(newEdges as FlowEdge[])

      if (params.source && params.target) {
        connectNodes(params.source, params.target, params.sourceHandle || undefined)
      }
    },
    [edges, setEdges, setStoreEdges, connectNodes]
  )

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      deletedNodes.forEach((node) => {
        deleteNode(node.id)
      })
    },
    [deleteNode]
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        useChatbotStore.getState().disconnectNodes(edge.id)
      })
    },
    []
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      onNodeSelect?.(node.id)
    },
    [setSelectedNodeId, onNodeSelect]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onNodeSelect?.(null)
  }, [setSelectedNodeId, onNodeSelect])

  // Handle drop from palette
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as BlockType
      if (!type) return

      const reactFlowBounds = event.currentTarget.getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      }

      const newNode = addNode(type, position)
      const updatedNodes = [...nodes, newNode]
      syncToStore(updatedNodes, edges)
    },
    [nodes, edges, addNode, syncToStore]
  )

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-gray-50"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls className="bg-white border border-gray-200 rounded-lg shadow-md" />
        <MiniMap
          className="bg-white border border-gray-200 rounded-lg shadow-md"
          nodeColor={(node) => {
            switch (node.data?.type) {
              case 'message':
                return '#a855f7'
              case 'quick_reply':
                return '#3b82f6'
              case 'condition':
                return '#22c55e'
              case 'action':
                return '#f97316'
              default:
                return '#8b5cf6'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />

        {nodes.length === 0 && (
          <Panel position="top-center" className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <p className="text-gray-500 text-sm">
              Drag blocks from the left panel or click to add
            </p>
          </Panel>
        )}
      </ReactFlow>
    </div>
  )
}
