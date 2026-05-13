'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies

// SECURITY: Now uses @supabase/ssr with HttpOnly cookies instead of localStorage

// Singleton Supabase client
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function fetchUnreadCount(t: string) {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silent
    }
  }

  useEffect(() => {
    async function getToken() {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      setToken(t)
      if (t) fetchUnreadCount(t)
    }
    getToken()
  }, [])

  // Poll unread count every 30s
  useEffect(() => {
    if (!token) return
    const interval = setInterval(() => fetchUnreadCount(token), 30000)
    return () => clearInterval(interval)
  }, [token])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function openDropdown() {
    if (open) { setOpen(false); return }
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(0)
      // Mark all as read
      if (data.unreadCount > 0) {
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={openDropdown}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/[0.06]"
        style={{ color: '#9ca3af' }}
        aria-label="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f', fontSize: 10 }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-80 rounded-xl overflow-hidden shadow-xl"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #2a2a2a' }}
          >
            <p className="text-sm font-semibold text-white">Notifications</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: '#6b7280' }}>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto" style={{ borderColor: '#2a2a2a' }}>
              {notifications.map((n) => (
                n.link ? (
                  <a
                    key={n.id}
                    href={n.link}
                    className="block px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    onClick={() => setOpen(false)}
                    style={{ textDecoration: 'none' }}
                  >
                    <NotificationItem notification={n} timeAgo={timeAgo} />
                  </a>
                ) : (
                  <div key={n.id} className="px-4 py-3">
                    <NotificationItem notification={n} timeAgo={timeAgo} />
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationItem({
  notification: n,
  timeAgo,
}: {
  notification: Notification
  timeAgo: (d: string) => string
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white leading-tight">{n.title}</p>
        {!n.read_at && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
            style={{ backgroundColor: '#f59e0b' }}
          />
        )}
      </div>
      {n.body && (
        <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>{n.body}</p>
      )}
      <p className="text-xs mt-1" style={{ color: '#4b5563' }}>{timeAgo(n.created_at)}</p>
    </>
  )
}
