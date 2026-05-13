'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  sender_id: string
  sender_role: 'buyer' | 'vendor'
  content: string
  created_at: string
}

interface Props {
  bookingId: string
  token: string
  currentUserId?: string
  currentRole: 'buyer' | 'vendor'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function MessageThread({ bookingId, token, currentRole }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const authHeaders: Record<string, string> = {}
    if (token) authHeaders['Authorization'] = `Bearer ${token}`

    async function load() {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, { headers: authHeaders })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
      }
      setLoading(false)
    }

    load()
    // Poll every 15s for new messages while component is mounted
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [bookingId, token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setSending(true)
    setError('')

    const sendHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) sendHeaders['Authorization'] = `Bearer ${token}`

    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: sendHeaders,
      body: JSON.stringify({ content: input.trim() }),
    })
    const data = await res.json()
    setSending(false)

    if (!res.ok) { setError(data.error ?? 'Failed to send'); return }
    setMessages(prev => [...prev, data.message])
    setInput('')
  }

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', height: 320 }}
    >
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: '#111111', borderBottom: '1px solid #2a2a2a' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
          Messages
        </p>
        <span className="text-xs" style={{ color: '#4b5563' }}>
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs" style={{ color: '#4b5563' }}>No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_role === currentRole
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                  style={{
                    backgroundColor: isMine ? '#f59e0b' : '#1a1a1a',
                    color: isMine ? '#0f0f0f' : '#e5e7eb',
                    borderBottomRightRadius: isMine ? 4 : undefined,
                    borderBottomLeftRadius: !isMine ? 4 : undefined,
                  }}
                >
                  <p>{msg.content}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: isMine ? '#78350f' : '#4b5563', textAlign: 'right' }}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex gap-2 p-2 flex-shrink-0" style={{ borderTop: '1px solid #2a2a2a' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f', flexShrink: 0 }}
        >
          {sending ? '…' : '↑'}
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}
