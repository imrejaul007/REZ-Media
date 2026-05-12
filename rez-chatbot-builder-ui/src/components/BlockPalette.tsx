'use client'

import { MessageSquare, Zap, GitBranch, Settings, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import type { BlockType } from '@/types'
import { BLOCK_LABELS, BLOCK_COLORS } from '@/types'

interface BlockPaletteProps {
  onAddBlock?: (type: BlockType) => void
}

const blockDefinitions: { type: BlockType; description: string; icon: React.ReactNode }[] = [
  {
    type: 'message',
    description: 'Send a text message to the user',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    type: 'quick_reply',
    description: 'Present options for the user to choose from',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    type: 'condition',
    description: 'Branch the conversation based on conditions',
    icon: <GitBranch className="w-5 h-5" />,
  },
  {
    type: 'action',
    description: 'Perform an action like webhook or AI response',
    icon: <Settings className="w-5 h-5" />,
  },
]

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const handleDragStart = (event: React.DragEvent, type: BlockType) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Blocks</h2>
        <p className="text-sm text-gray-500 mt-1">Drag to canvas or click to add</p>
      </div>

      {/* Block List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {blockDefinitions.map((block) => {
          const colors = BLOCK_COLORS[block.type]
          return (
            <div key={block.type} className="space-y-1">
              {/* Draggable Block */}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, block.type)}
                onClick={() => onAddBlock?.(block.type)}
                className={clsx(
                  'p-3 rounded-xl cursor-grab active:cursor-grabbing transition-all',
                  'border-2 border-dashed',
                  colors.bg,
                  colors.border,
                  'hover:shadow-md hover:scale-[1.02]'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={colors.text}>{block.icon}</span>
                    <span className={clsx('font-medium', colors.text)}>
                      {BLOCK_LABELS[block.type]}
                    </span>
                  </div>
                  <Plus className={clsx('w-4 h-4', colors.text, 'opacity-50')} />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 pl-1">{block.description}</p>
            </div>
          )
        })}
      </div>

      {/* Help Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Tips</h3>
        <ul className="text-xs text-gray-500 space-y-1">
          <li>Drag blocks to the canvas</li>
          <li>Connect blocks by dragging from handles</li>
          <li>Click a block to edit it</li>
          <li>Press Delete to remove selected</li>
        </ul>
      </div>
    </div>
  )
}
