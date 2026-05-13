'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface ListingActionsProps {
  listingId: string
  currentStatus: string
}

export function ListingActions({ listingId, currentStatus }: ListingActionsProps) {
  const router = useRouter()
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? '')
    })
  }, [])

  const handleApprove = async () => {
    setLoading('approve')
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/admin/listings/${listingId}/review`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Approval failed')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) {
      setError('Please provide a rejection reason.')
      return
    }
    setLoading('reject')
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/admin/listings/${listingId}/review`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'reject', reason }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Rejection failed')
        return
      }
      setShowRejectModal(false)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  if (currentStatus === 'active') {
    return <span className="text-xs" style={{ color: '#4ade80' }}>Approved</span>
  }
  if (currentStatus === 'rejected') {
    return <span className="text-xs" style={{ color: '#f87171' }}>Rejected</span>
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={loading === 'approve'}
          className="rounded px-2.5 py-1 text-xs font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#22c55e22', color: '#4ade80', border: '1px solid #22c55e44' }}
        >
          {loading === 'approve' ? '...' : 'Approve'}
        </button>
        <button
          onClick={() => { setShowRejectModal(true); setError(null); setReason('') }}
          className="rounded px-2.5 py-1 text-xs font-semibold transition-opacity"
          style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
        >
          Reject
        </button>
      </div>

      {error && !showRejectModal && (
        <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error}</p>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="rounded-2xl p-6 w-full max-w-md"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Reject Listing</h3>

            {error && (
              <div
                className="mb-3 p-3 rounded-lg text-sm"
                style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
              >
                {error}
              </div>
            )}

            <label className="block text-sm mb-2" style={{ color: '#9ca3af' }}>
              Reason for rejection
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this listing is being rejected..."
              className="w-full rounded-lg px-3 py-2 text-white text-sm resize-none outline-none"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 rounded-lg py-2 text-sm font-medium transition-opacity"
                style={{ backgroundColor: '#2a2a2a', color: '#9ca3af' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading === 'reject'}
                className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#ef444422', color: '#f87171', border: '1px solid #ef444444' }}
              >
                {loading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
