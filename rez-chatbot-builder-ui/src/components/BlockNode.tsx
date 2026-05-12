'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MessageSquare, Zap, GitBranch, Settings } from 'lucide-react'
import { clsx } from 'clsx'
import { BLOCK_COLORS, BLOCK_LABELS } from '@/types'
import type { BlockData } from '@/types'

const BlockIcon = ({ type }: { type: BlockData['type'] }) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="w-4 h-4" />
    case 'quick_reply':
      return <Zap className="w-4 h-4" />
    case 'condition':
      return <GitBranch className="w-4 h-4" />
    case 'action':
      return <Settings className="w-4 h-4" />
    default:
      return <MessageSquare className="w-4 h-4" />
  }
}

export const BlockNode = memo(({ data, selected }: NodeProps<BlockData>) => {
  const colors = BLOCK_COLORS[data.type] || BLOCK_COLORS.message

  return (
    <div
      className={clsx(
        'min-w-[200px] max-w-[280px] bg-white rounded-xl shadow-md border-2 transition-all',
        selected ? 'border-purple-500 shadow-lg' : 'border-transparent',
        colors.bg
      )}
    >
      {/* Target Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className={clsx('p-1.5 rounded-lg', colors.bg)}>
            <span className={colors.text}>
              <BlockIcon type={data.type} />
            </span>
          </div>
          <span className={clsx('text-xs font-semibold uppercase', colors.text)}>
            {BLOCK_LABELS[data.type]}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
          {data.content || 'Empty message'}
        </p>

        {/* Quick Reply Options Preview */}
        {data.type === 'quick_reply' && data.options && data.options.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.options.slice(0, 3).map((option) => (
              <span
                key={option.id}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full"
              >
                {option.label}
              </span>
            ))}
            {data.options.length > 3 && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                +{data.options.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Condition Branches Preview */}
        {data.type === 'condition' && data.conditions && data.conditions.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.conditions.slice(0, 2).map((branch) => (
              <div key={branch.id} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-gray-600 truncate">{branch.label}</span>
              </div>
            ))}
            {data.conditions.length > 2 && (
              <span className="text-xs text-gray-500">
                +{data.conditions.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Action Type Preview */}
        {data.type === 'action' && data.action && (
          <div className="mt-2 flex items-center gap-1">
            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
              {data.action.type.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Source Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
      />

      {/* Conditional Source Handles (for quick_reply and condition blocks) */}
      {data.type === 'quick_reply' && data.options && (
        <>
          {data.options.map((option, index) => (
            <Handle
              key={option.id}
              type="source"
              position={Position.Right}
              id={option.id}
              style={{
                top: `${40 + (index * 100) / Math.max(data.options?.length || 1, 1)}%`,
              }}
              className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
            />
          ))}
        </>
      )}

      {data.type === 'condition' && data.conditions && (
        <>
          {data.conditions.map((branch, index) => (
            <Handle
              key={branch.id}
              type="source"
              position={Position.Right}
              id={branch.id}
              style={{
                top: `${30 + (index * 100) / Math.max(data.conditions?.length || 1, 1)}%`,
              }}
              className="!w-2.5 !h-2.5 !bg-green-500 !border-2 !border-white"
            />
          ))}
        </>
      )}
    </div>
  )
})

BlockNode.displayName = 'BlockNode'
