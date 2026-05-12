'use client'

import { useState, useEffect } from 'react'
import { Send, RotateCcw, MessageSquare, Bot, User } from 'lucide-react'
import { clsx } from 'clsx'
import { useChatbotStore } from '@/lib/store'
import type { PreviewMessage, BlockData, FlowNode } from '@/types'

interface PreviewProps {
  onClose?: () => void
}

export function Preview({ onClose }: PreviewProps) {
  const { nodes, previewMessages, addPreviewMessage, clearPreview } = useChatbotStore()
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)

  // Start the conversation with the first message
  const startPreview = () => {
    clearPreview()
    const startNode = nodes.find((n) => n.type === 'block')

    if (startNode) {
      const data = startNode.data as BlockData
      addPreviewMessage({
        type: 'bot',
        content: data.content || 'Hello! How can I help you today?',
        quickReplies: data.options,
      })
    } else {
      addPreviewMessage({
        type: 'bot',
        content: 'No flow configured. Add blocks to see the preview.',
      })
    }
    setIsRunning(true)
  }

  // Handle user input
  const handleSend = () => {
    if (!input.trim()) return

    addPreviewMessage({
      type: 'user',
      content: input.trim(),
    })

    // Simulate bot response
    simulateBotResponse(input.trim())
    setInput('')
  }

  // Simulate bot response based on flow
  const simulateBotResponse = (userInput: string) => {
    const currentMessages = useChatbotStore.getState().previewMessages
    const lastBotMessage = currentMessages[currentMessages.length - 1]

    // Find the next node based on quick reply selection or just get first connected node
    if (lastBotMessage?.quickReplies) {
      const selectedOption = lastBotMessage.quickReplies.find(
        (r) => r.label.toLowerCase() === userInput.toLowerCase() || r.value === userInput.toLowerCase()
      )

      if (selectedOption) {
        // Find node connected via this option handle
        const edges = useChatbotStore.getState().edges
        const nextEdge = edges.find(
          (e) => e.sourceHandle === selectedOption.id
        )

        if (nextEdge) {
          const nextNode = nodes.find((n) => n.id === nextEdge.target)
          if (nextNode) {
            const data = nextNode.data as BlockData
            addPreviewMessage({
              type: 'bot',
              content: data.content,
              quickReplies: data.options,
            })
            return
          }
        }
      }
    }

    // Default: just echo or show quick replies
    addPreviewMessage({
      type: 'bot',
      content: 'This is a preview. Connect your blocks to see actual responses.',
    })
  }

  // Handle keyboard submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-scroll to bottom
  useEffect(() => {
    const container = document.getElementById('preview-messages')
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [previewMessages])

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-gray-800">Preview</h2>
          </div>
          <button
            onClick={clearPreview}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear chat"
          >
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Test your chatbot flow</p>
      </div>

      {/* Messages */}
      <div
        id="preview-messages"
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {previewMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-3">
              <Bot className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Start the preview to test your flow
            </p>
            <button
              onClick={startPreview}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Start Preview
            </button>
          </div>
        ) : (
          <>
            {previewMessages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'flex',
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={clsx(
                    'max-w-[85%] rounded-2xl px-4 py-2',
                    message.type === 'user'
                      ? 'bg-purple-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {message.type === 'bot' && (
                      <Bot className="w-4 h-4 mt-0.5 text-purple-600" />
                    )}
                    {message.type === 'user' && (
                      <User className="w-4 h-4 mt-0.5 text-white" />
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Quick Reply Buttons */}
                  {message.type === 'bot' && message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {message.quickReplies.map((reply) => (
                        <button
                          key={reply.id}
                          onClick={() => {
                            addPreviewMessage({
                              type: 'user',
                              content: reply.label,
                            })
                            simulateBotResponse(reply.label)
                          }}
                          className="px-3 py-1 text-xs bg-white border border-purple-200 text-purple-700 rounded-full hover:bg-purple-50 transition-colors"
                        >
                          {reply.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        {isRunning && previewMessages.length > 0 ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={startPreview}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Start Preview
          </button>
        )}
      </div>
    </div>
  )
}
