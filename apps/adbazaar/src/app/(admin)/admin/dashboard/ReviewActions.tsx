'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'

interface ReviewActionsProps {
  listingId: string
}

export function ReviewActions({ listingId }: ReviewActionsProps) {
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

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={loading === 'approve'}
          onClick={handleApprove}
        >
          Approve
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowRejectModal(true)
            setError(null)
            setReason('')
          }}
          className="border-red-800 text-red-400 hover:bg-red-900/20 hover:border-red-700"
        >
          Reject
        </Button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Listing</h3>

            {error && (
              <div className="mb-3 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
                {error}
              </div>
            )}

            <label className="block text-sm text-gray-300 mb-2">
              Reason for rejection
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this listing is being rejected..."
              className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/30 transition-colors resize-none"
            />

            <div className="flex gap-3 mt-4">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setShowRejectModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="md"
                loading={loading === 'reject'}
                onClick={handleReject}
                className="flex-1 border-red-800 text-red-400 hover:bg-red-900/20"
              >
                Confirm Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
