import type { Node, Edge } from '@xyflow/react'

export type BlockType = 'message' | 'quick_reply' | 'condition' | 'action'

export interface QuickReplyOption {
  id: string
  label: string
  value: string
}

export interface ConditionBranch {
  id: string
  label: string
  condition: string
  nextBlockId?: string
}

export interface ActionConfig {
  type: 'send_email' | 'webhook' | 'update_database' | 'ai_response' | 'transfer_human'
  config: Record<string, unknown>
}

export interface BlockData {
  id: string
  type: BlockType
  content: string
  options?: QuickReplyOption[]
  conditions?: ConditionBranch[]
  action?: ActionConfig
  nextBlockId?: string
  delay?: number
  variables?: Record<string, string>
}

export interface FlowNode extends Node<BlockData> {
  data: BlockData
}

export interface FlowEdge extends Edge {
  sourceBlockId?: string
  targetBlockId?: string
  label?: string
}

export interface Flow {
  id: string
  name: string
  description?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  createdAt: Date
  updatedAt: Date
  status: 'draft' | 'published' | 'archived'
  whatsappPhoneId?: string
  metadata?: Record<string, unknown>
}

export interface WhatsAppConnection {
  phoneNumberId: string
  businessAccountId: string
  verifiedName: string
  isConnected: boolean
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface SaveFlowRequest {
  flow: Omit<Flow, 'createdAt' | 'updatedAt'>
}

export interface PreviewMessage {
  id: string
  type: 'bot' | 'user'
  content: string
  timestamp: Date
  quickReplies?: QuickReplyOption[]
}

export const BLOCK_COLORS: Record<BlockType, { bg: string; text: string; border: string }> = {
  message: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  quick_reply: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  condition: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  action: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  message: 'Message',
  quick_reply: 'Quick Reply',
  condition: 'Condition',
  action: 'Action',
}
