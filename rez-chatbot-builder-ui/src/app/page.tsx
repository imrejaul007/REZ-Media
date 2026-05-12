'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, Save, Play, Settings } from 'lucide-react'

interface Block {
  id: string
  type: 'message' | 'quick_reply' | 'condition' | 'action'
  content: string
  options?: string[]
  nextBlockId?: string
}

export default function ChatbotBuilder() {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: '1', type: 'message', content: 'Hello! How can I help you today?' }
  ])
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)

  const addBlock = (type: Block['type']) => {
    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: type === 'quick_reply' ? 'Select an option:' : 'New message'
    }
    setBlocks([...blocks, newBlock])
  }

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id))
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r p-4">
        <h2 className="font-semibold mb-4">Blocks</h2>
        <div className="space-y-2">
          <button onClick={() => addBlock('message')} className="w-full p-3 bg-purple-100 text-purple-700 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Message
          </button>
          <button onClick={() => addBlock('quick_reply')} className="w-full p-3 bg-blue-100 text-blue-700 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Quick Reply
          </button>
          <button onClick={() => addBlock('condition')} className="w-full p-3 bg-green-100 text-green-700 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Condition
          </button>
          <button onClick={() => addBlock('action')} className="w-full p-3 bg-orange-100 text-orange-700 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Action
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-lg mx-auto space-y-4">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              onClick={() => setSelectedBlock(block.id)}
              className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer ${
                selectedBlock === block.id ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 uppercase">{block.type}</span>
                </div>
                <button onClick={() => deleteBlock(block.id)} className="text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={block.content}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                className="w-full p-2 border rounded-lg resize-none"
                rows={2}
              />
              {block.type === 'quick_reply' && (
                <div className="mt-2 flex gap-2">
                  <input placeholder="Option 1" className="flex-1 p-2 border rounded" />
                  <input placeholder="Option 2" className="flex-1 p-2 border rounded" />
                </div>
              )}
            </div>
          ))}
          {blocks.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Click a block type to add your first message
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <div className="w-80 bg-white border-l p-4">
        <h3 className="font-semibold mb-4">Settings</h3>
        {selectedBlock ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Block ID</label>
              <input value={selectedBlock} disabled className="w-full p-2 border rounded bg-gray-50" />
            </div>
            <button className="w-full py-2 bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Save Flow
            </button>
            <button className="w-full py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> Test Flow
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Select a block to edit</p>
        )}
      </div>
    </div>
  )
}
