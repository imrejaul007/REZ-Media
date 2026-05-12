import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { BlockData, BlockType, Flow, FlowNode, FlowEdge, QuickReplyOption, ConditionBranch, ActionConfig, WhatsAppConnection, PreviewMessage } from '@/types'

interface ChatbotStore {
  // Flow state
  flow: Flow
  setFlow: (flow: Flow) => void
  updateFlowMeta: (meta: Partial<Pick<Flow, 'name' | 'description'>>) => void

  // Nodes & Edges
  nodes: FlowNode[]
  edges: FlowEdge[]
  setNodes: (nodes: FlowNode[]) => void
  setEdges: (edges: FlowEdge[]) => void
  addNode: (type: BlockType, position?: { x: number; y: number }) => FlowNode
  updateNode: (id: string, data: Partial<BlockData>) => void
  deleteNode: (id: string) => void
  connectNodes: (sourceId: string, targetId: string, sourceHandle?: string) => void
  disconnectNodes: (edgeId: string) => void

  // Selection
  selectedNodeId: string | null
  setSelectedNodeId: (id: string | null) => void

  // Block editing helpers
  updateBlockContent: (id: string, content: string) => void
  updateBlockOptions: (id: string, options: QuickReplyOption[]) => void
  updateBlockConditions: (id: string, conditions: ConditionBranch[]) => void
  updateBlockAction: (id: string, action: ActionConfig) => void
  addConditionBranch: (nodeId: string) => void
  removeConditionBranch: (nodeId: string, branchId: string) => void
  addQuickReplyOption: (nodeId: string) => void
  removeQuickReplyOption: (nodeId: string, optionId: string) => void

  // WhatsApp connection
  whatsappConnection: WhatsAppConnection | null
  setWhatsAppConnection: (connection: WhatsAppConnection | null) => void

  // Preview
  previewMessages: PreviewMessage[]
  addPreviewMessage: (message: Omit<PreviewMessage, 'id' | 'timestamp'>) => void
  clearPreview: () => void

  // Flow operations
  saveFlow: () => Flow
  loadFlow: (flow: Flow) => void
  resetFlow: () => void

  // History (undo/redo)
  history: { nodes: FlowNode[]; edges: FlowEdge[] }[]
  historyIndex: number
  pushHistory: () => void
  undo: () => void
  redo: () => void
}

const createDefaultNode = (type: BlockType, position: { x: number; y: number }): FlowNode => {
  const baseData: BlockData = {
    id: uuidv4(),
    type,
    content: type === 'quick_reply' ? 'Select an option:' : getDefaultContent(type),
  }

  if (type === 'quick_reply') {
    baseData.options = [
      { id: uuidv4(), label: 'Option 1', value: 'option_1' },
      { id: uuidv4(), label: 'Option 2', value: 'option_2' },
    ]
  }

  if (type === 'condition') {
    baseData.conditions = [
      { id: uuidv4(), label: 'Yes', condition: 'user_response === "yes"' },
      { id: uuidv4(), label: 'No', condition: 'user_response === "no"' },
    ]
  }

  if (type === 'action') {
    baseData.action = {
      type: 'ai_response',
      config: {},
    }
  }

  return {
    id: baseData.id,
    type: 'block',
    position,
    data: baseData,
  }
}

const getDefaultContent = (type: BlockType): string => {
  switch (type) {
    case 'message':
      return 'Hello! How can I help you today?'
    case 'condition':
      return 'Check user response'
    case 'action':
      return 'Perform action'
    default:
      return 'New message'
  }
}

const createDefaultFlow = (): Flow => ({
  id: uuidv4(),
  name: 'Untitled Flow',
  description: '',
  nodes: [],
  edges: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  status: 'draft',
})

const createDefaultStore = (): Omit<ChatbotStore, 'setFlow'> => ({
  flow: createDefaultFlow(),
  nodes: [],
  edges: [],
  selectedNodeId: null,
  whatsappConnection: null,
  previewMessages: [],
  history: [],
  historyIndex: -1,

  setFlow: () => {},
  updateFlowMeta: (meta) => {},
  setNodes: (nodes) => {},
  setEdges: (edges) => {},
  addNode: () => createDefaultNode('message', { x: 100, y: 100 }),
  updateNode: () => {},
  deleteNode: () => {},
  connectNodes: () => {},
  disconnectNodes: () => {},
  setSelectedNodeId: () => {},
  updateBlockContent: () => {},
  updateBlockOptions: () => {},
  updateBlockConditions: () => {},
  updateBlockAction: () => {},
  addConditionBranch: () => {},
  removeConditionBranch: () => {},
  addQuickReplyOption: () => {},
  removeQuickReplyOption: () => {},
  setWhatsAppConnection: () => {},
  addPreviewMessage: () => {},
  clearPreview: () => {},
  saveFlow: () => createDefaultFlow(),
  loadFlow: () => {},
  resetFlow: () => {},
  pushHistory: () => {},
  undo: () => {},
  redo: () => {},
})

export const useChatbotStore = create<ChatbotStore>()(
  persist(
    (set, get) => ({
      ...createDefaultStore(),

      setFlow: (flow) => set({ flow, nodes: flow.nodes, edges: flow.edges }),

      updateFlowMeta: (meta) => set((state) => ({
        flow: { ...state.flow, ...meta, updatedAt: new Date() }
      })),

      setNodes: (nodes) => set((state) => ({
        nodes,
        flow: { ...state.flow, nodes, updatedAt: new Date() }
      })),

      setEdges: (edges) => set((state) => ({
        edges,
        flow: { ...state.flow, edges, updatedAt: new Date() }
      })),

      addNode: (type, position = { x: 250, y: 100 + get().nodes.length * 150 }) => {
        const node = createDefaultNode(type, position)
        set((state) => ({
          nodes: [...state.nodes, node],
          flow: { ...state.flow, nodes: [...state.nodes, node], updatedAt: new Date() }
        }))
        get().pushHistory()
        return node
      },

      updateNode: (id, data) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...data } } : n
          ),
        }))
      },

      deleteNode: (id) => {
        get().pushHistory()
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        }))
      },

      connectNodes: (sourceId, targetId, sourceHandle) => {
        const edgeId = `${sourceId}-${sourceHandle || 'default'}-${targetId}`
        const edge: FlowEdge = {
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: sourceHandle || 'default',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 2 },
        }
        set((state) => ({
          edges: [...state.edges.filter(e => e.id !== edgeId), edge],
        }))
        get().pushHistory()
      },

      disconnectNodes: (edgeId) => {
        get().pushHistory()
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== edgeId),
        }))
      },

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      updateBlockContent: (id, content) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, content } } : n
          ),
        }))
      },

      updateBlockOptions: (id, options) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, options } } : n
          ),
        }))
      },

      updateBlockConditions: (id, conditions) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, conditions } } : n
          ),
        }))
      },

      updateBlockAction: (id, action) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, action } } : n
          ),
        }))
      },

      addConditionBranch: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n
            const conditions = n.data.conditions || []
            return {
              ...n,
              data: {
                ...n.data,
                conditions: [
                  ...conditions,
                  { id: uuidv4(), label: `Branch ${conditions.length + 1}`, condition: '' }
                ]
              }
            }
          }),
        }))
      },

      removeConditionBranch: (nodeId, branchId) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n
            return {
              ...n,
              data: {
                ...n.data,
                conditions: n.data.conditions?.filter(c => c.id !== branchId)
              }
            }
          }),
        }))
      },

      addQuickReplyOption: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n
            const options = n.data.options || []
            return {
              ...n,
              data: {
                ...n.data,
                options: [
                  ...options,
                  { id: uuidv4(), label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }
                ]
              }
            }
          }),
        }))
      },

      removeQuickReplyOption: (nodeId, optionId) => {
        set((state) => ({
          nodes: state.nodes.map((n) => {
            if (n.id !== nodeId) return n
            return {
              ...n,
              data: {
                ...n.data,
                options: n.data.options?.filter(o => o.id !== optionId)
              }
            }
          }),
        }))
      },

      setWhatsAppConnection: (connection) => set({ whatsappConnection: connection }),

      addPreviewMessage: (message) => set((state) => ({
        previewMessages: [
          ...state.previewMessages,
          { ...message, id: uuidv4(), timestamp: new Date() }
        ]
      })),

      clearPreview: () => set({ previewMessages: [] }),

      saveFlow: () => {
        const { flow, nodes, edges } = get()
        const savedFlow = { ...flow, nodes, edges, updatedAt: new Date() }
        set({ flow: savedFlow })
        return savedFlow
      },

      loadFlow: (flow) => set({
        flow,
        nodes: flow.nodes,
        edges: flow.edges,
        selectedNodeId: null,
        history: [],
        historyIndex: -1,
      }),

      resetFlow: () => set({
        ...createDefaultStore(),
        flow: createDefaultFlow(),
      }),

      pushHistory: () => set((state) => {
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push({ nodes: state.nodes, edges: state.edges })
        if (newHistory.length > 50) newHistory.shift()
        return { history: newHistory, historyIndex: newHistory.length - 1 }
      }),

      undo: () => set((state) => {
        if (state.historyIndex <= 0) return state
        const newIndex = state.historyIndex - 1
        const snapshot = state.history[newIndex]
        return {
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          historyIndex: newIndex,
        }
      }),

      redo: () => set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state
        const newIndex = state.historyIndex + 1
        const snapshot = state.history[newIndex]
        return {
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          historyIndex: newIndex,
        }
      }),
    }),
    {
      name: 'rez-chatbot-storage',
      partialize: (state) => ({
        flow: state.flow,
        nodes: state.nodes,
        edges: state.edges,
        whatsappConnection: state.whatsappConnection,
      }),
    }
  )
)
