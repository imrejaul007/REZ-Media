'use client'

import { X, Trash2, Plus, GripVertical, MessageSquare, Zap, GitBranch, Settings } from 'lucide-react'
import { clsx } from 'clsx'
import { useChatbotStore } from '@/lib/store'
import { BLOCK_COLORS, BLOCK_LABELS } from '@/types'
import type { BlockData, QuickReplyOption, ConditionBranch, ActionConfig } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const ACTION_TYPES = [
  { value: 'ai_response', label: 'AI Response' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'update_database', label: 'Update Database' },
  { value: 'transfer_human', label: 'Transfer to Human' },
] as const

interface BlockEditorProps {
  onClose?: () => void
}

export function BlockEditor({ onClose }: BlockEditorProps) {
  const {
    selectedNodeId,
    nodes,
    setSelectedNodeId,
    updateBlockContent,
    updateBlockOptions,
    updateBlockConditions,
    updateBlockAction,
    deleteNode,
    addQuickReplyOption,
    removeQuickReplyOption,
    addConditionBranch,
    removeConditionBranch,
  } = useChatbotStore()

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const data = selectedNode?.data as BlockData | undefined

  if (!data) {
    return (
      <div className="w-80 h-full bg-white border-l border-gray-200 flex items-center justify-center">
        <div className="text-center p-6">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Select a block to edit</p>
          <p className="text-sm text-gray-400 mt-1">Click on any block in the canvas</p>
        </div>
      </div>
    )
  }

  const colors = BLOCK_COLORS[data.type]

  const handleClose = () => {
    setSelectedNodeId(null)
    onClose?.()
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={clsx('p-2 rounded-lg', colors.bg)}>
              <span className={colors.text}>
                {data.type === 'message' && <MessageSquare className="w-4 h-4" />}
                {data.type === 'quick_reply' && <Zap className="w-4 h-4" />}
                {data.type === 'condition' && <GitBranch className="w-4 h-4" />}
                {data.type === 'action' && <Settings className="w-4 h-4" />}
              </span>
            </div>
            <h2 className="font-semibold text-gray-800">{BLOCK_LABELS[data.type]}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">ID: {data.id.slice(0, 8)}...</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Message Content (all types) */}
        {(data.type === 'message' || data.type === 'condition') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Message Content
            </label>
            <textarea
              value={data.content}
              onChange={(e) => updateBlockContent(data.id, e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={4}
              placeholder="Enter your message..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports basic markdown: *bold*, _italic_, `code`
            </p>
          </div>
        )}

        {/* Quick Reply Options */}
        {data.type === 'quick_reply' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Question / Prompt
              </label>
              <textarea
                value={data.content}
                onChange={(e) => updateBlockContent(data.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={3}
                placeholder="What would you like to ask?"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Quick Reply Options</label>
                <button
                  onClick={() => addQuickReplyOption(data.id)}
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Option
                </button>
              </div>

              <div className="space-y-2">
                {data.options?.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <input
                      value={option.label}
                      onChange={(e) => {
                        const newOptions = [...(data.options || [])]
                        newOptions[index] = { ...option, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') }
                        updateBlockOptions(data.id, newOptions)
                      }}
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      onClick={() => removeQuickReplyOption(data.id, option.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Condition Branches */}
        {data.type === 'condition' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Condition Branches</label>
              <button
                onClick={() => addConditionBranch(data.id)}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Branch
              </button>
            </div>

            <div className="space-y-3">
              {data.conditions?.map((branch, index) => (
                <div key={branch.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      value={branch.label}
                      onChange={(e) => {
                        const newConditions = [...(data.conditions || [])]
                        newConditions[index] = { ...branch, label: e.target.value }
                        updateBlockConditions(data.id, newConditions)
                      }}
                      className="px-2 py-1 bg-white border border-green-200 rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Branch name"
                    />
                    {data.conditions && data.conditions.length > 2 && (
                      <button
                        onClick={() => removeConditionBranch(data.id, branch.id)}
                        className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <input
                    value={branch.condition}
                    onChange={(e) => {
                      const newConditions = [...(data.conditions || [])]
                      newConditions[index] = { ...branch, condition: e.target.value }
                      updateBlockConditions(data.id, newConditions)
                    }}
                    className="w-full px-2 py-1 bg-white border border-green-200 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="user_response === 'yes'"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Configuration */}
        {data.type === 'action' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Action Type
              </label>
              <select
                value={data.action?.type || 'ai_response'}
                onChange={(e) => {
                  updateBlockAction(data.id, {
                    type: e.target.value as ActionConfig['type'],
                    config: data.action?.config || {},
                  })
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {ACTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={data.content}
                onChange={(e) => updateBlockContent(data.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
                placeholder="Describe what this action does..."
              />
            </div>

            {/* Action-specific config would go here */}
            {data.action?.type === 'webhook' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={(data.action.config?.url as string) || ''}
                  onChange={(e) => {
                    updateBlockAction(data.id, {
                      ...data.action!,
                      config: { ...data.action.config, url: e.target.value },
                    })
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="https://api.example.com/webhook"
                />
              </div>
            )}

            {data.action?.type === 'send_email' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    To Email
                  </label>
                  <input
                    type="email"
                    value={(data.action.config?.to as string) || ''}
                    onChange={(e) => {
                      updateBlockAction(data.id, {
                        ...data.action!,
                        config: { ...data.action.config, to: e.target.value },
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={(data.action.config?.subject as string) || ''}
                    onChange={(e) => {
                      updateBlockAction(data.id, {
                        ...data.action!,
                        config: { ...data.action.config, subject: e.target.value },
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Email subject"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => {
            deleteNode(data.id)
            onClose?.()
          }}
          className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Block
        </button>
      </div>
    </div>
  )
}
