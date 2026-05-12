'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Save,
  Play,
  Share2,
  Settings,
  Undo,
  Redo,
  Download,
  Upload,
  MessageSquare,
  Menu,
  X,
  Zap,
  Wifi,
  ChevronDown,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Toaster, toast } from 'sonner'
import { useChatbotStore } from '@/lib/store'
import { api } from '@/lib/api'
import { BlockPalette } from '@/components/BlockPalette'
import { BlockEditor } from '@/components/BlockEditor'
import { Preview } from '@/components/Preview'
import type { BlockType } from '@/types'

// Dynamic import for FlowCanvas to avoid SSR issues with React Flow
const FlowCanvas = dynamic(
  () => import('@/components/FlowCanvas').then((mod) => mod.FlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading canvas...</p>
        </div>
      </div>
    ),
  }
)

type RightPanel = 'editor' | 'preview' | null

export default function ChatbotBuilder() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('editor')
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const {
    flow,
    nodes,
    edges,
    whatsappConnection,
    setWhatsAppConnection,
    updateFlowMeta,
    saveFlow,
    loadFlow,
    resetFlow,
    addNode,
    undo,
    redo,
    history,
    historyIndex,
  } = useChatbotStore()

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const savedFlow = saveFlow()
      toast.success('Flow saved successfully', {
        description: `Last saved at ${new Date().toLocaleTimeString()}`,
      })

      // Try to save to API if available
      try {
        await api.saveFlow(savedFlow)
        toast.success('Synced to server')
      } catch {
        // Silently fail - local storage will persist
      }
    } catch (error) {
      toast.error('Failed to save flow')
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }, [saveFlow])

  const handleExport = useCallback(() => {
    const flowData = JSON.stringify({ nodes, edges, meta: flow }, null, 2)
    const blob = new Blob([flowData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${flow.name.replace(/\s+/g, '-').toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Flow exported successfully')
  }, [nodes, edges, flow])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.nodes && data.edges) {
          loadFlow({
            ...flow,
            nodes: data.nodes,
            edges: data.edges,
            meta: data.meta,
          })
          toast.success('Flow imported successfully')
        } else {
          toast.error('Invalid flow file format')
        }
      } catch {
        toast.error('Failed to parse flow file')
      }
    }
    input.click()
  }, [flow, loadFlow])

  const handlePublish = useCallback(() => {
    if (nodes.length === 0) {
      toast.error('Cannot publish empty flow')
      return
    }

    if (!whatsappConnection?.isConnected) {
      toast.error('Please connect WhatsApp before publishing')
      setShowWhatsAppModal(true)
      return
    }

    toast.success('Flow published to WhatsApp', {
      description: 'Your chatbot is now live!',
    })
  }, [nodes.length, whatsappConnection])

  const handleAddBlock = useCallback((type: BlockType) => {
    const node = addNode(type)
    useChatbotStore.getState().setSelectedNodeId(node.id)
    setRightPanel('editor')
  }, [addNode])

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-gray-900">ReZ Chatbot</span>
          </div>

          {/* Flow Name */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={flow.name}
              onChange={(e) => updateFlowMeta({ name: e.target.value })}
              className="px-2 py-1 text-sm font-medium bg-transparent border border-transparent rounded hover:bg-gray-100 focus:bg-white focus:border-gray-300 focus:outline-none"
            />
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Center Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="w-4 h-4 text-gray-600" />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button
            onClick={handleImport}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Import flow"
          >
            <Upload className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={handleExport}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Export flow"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* WhatsApp Status */}
          <button
            onClick={() => setShowWhatsAppModal(true)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors',
              whatsappConnection?.isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">
              {whatsappConnection?.isConnected ? 'Connected' : 'Connect WhatsApp'}
            </span>
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm font-medium">Save</span>
          </button>

          <button
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-sm font-medium">Publish</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Block Palette */}
        <BlockPalette onAddBlock={handleAddBlock} />

        {/* Canvas */}
        <main className="flex-1 relative">
          <FlowCanvas
            onNodeSelect={(nodeId) => {
              if (nodeId) setRightPanel('editor')
            }}
          />

          {/* Right Panel Toggle */}
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setRightPanel(rightPanel === 'editor' ? null : 'editor')}
              className={clsx(
                'p-2 rounded-lg shadow-md transition-colors',
                rightPanel === 'editor'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
              title="Block Editor"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setRightPanel(rightPanel === 'preview' ? null : 'preview')}
              className={clsx(
                'p-2 rounded-lg shadow-md transition-colors',
                rightPanel === 'preview'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
              title="Preview"
            >
              <Play className="w-5 h-5" />
            </button>
          </div>
        </main>

        {/* Right Panel */}
        {rightPanel === 'editor' && <BlockEditor onClose={() => setRightPanel(null)} />}
        {rightPanel === 'preview' && <Preview onClose={() => setRightPanel(null)} />}
      </div>

      {/* WhatsApp Connection Modal */}
      {showWhatsAppModal && (
        <WhatsAppModal onClose={() => setShowWhatsAppModal(false)} />
      )}
    </div>
  )
}

// WhatsApp Connection Modal Component
function WhatsAppModal({ onClose }: { onClose: () => void }) {
  const { whatsappConnection, setWhatsAppConnection } = useChatbotStore()
  const [phoneId, setPhoneId] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    if (!phoneId.trim()) {
      toast.error('Please enter a Phone Number ID')
      return
    }

    setIsConnecting(true)
    try {
      // Simulate connection (in real app, call api.connectWhatsApp)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setWhatsAppConnection({
        phoneNumberId: phoneId,
        businessAccountId: 'BA_TEST',
        verifiedName: 'Test Business',
        isConnected: true,
      })
      toast.success('WhatsApp connected successfully')
      onClose()
    } catch {
      toast.error('Failed to connect WhatsApp')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await api.disconnectWhatsApp()
      setWhatsAppConnection(null)
      toast.success('WhatsApp disconnected')
      onClose()
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">WhatsApp Integration</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {whatsappConnection?.isConnected ? (
            <>
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-800">Connected</p>
                  <p className="text-sm text-green-600">{whatsappConnection.verifiedName}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone ID</span>
                  <span className="font-mono">{whatsappConnection.phoneNumberId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Business ID</span>
                  <span className="font-mono">{whatsappConnection.businessAccountId}</span>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className="w-full py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Disconnect WhatsApp
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Connect your WhatsApp Business account to enable your chatbot.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={phoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                  placeholder="Enter your Phone Number ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    Connect WhatsApp
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
