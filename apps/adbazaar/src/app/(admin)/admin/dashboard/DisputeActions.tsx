'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

interface DisputeActionsProps {
  bookingId: string
}

export function DisputeActions({ bookingId }: DisputeActionsProps) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState<'vendor_wins' | 'buyer_wins' | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token ?? '')
    })
  }, [])

  async function resolve(resolution: 'vendor_wins' | 'buyer_wins') {
    setLoading(resolution)
    setError('')
    try {
      const res = await fetch(`/api/admin/disputes/${bookingId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resolution,
          notes: `Admin: ${resolution.replace('_', ' ')}`,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed')
      } else {
        setDone(true)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return <span className="text-xs text-gray-500">Resolved</span>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => resolve('vendor_wins')}
          disabled={loading !== null}
          className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          style={{ backgroundColor: '#14532d', color: '#4ade80' }}
        >
          {loading === 'vendor_wins' ? '…' : 'Vendor Wins'}
        </button>
        <button
          type="button"
          onClick={() => resolve('buyer_wins')}
          disabled={loading !== null}
          className="rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50"
          style={{ backgroundColor: '#7f1d1d', color: '#f87171' }}
        >
          {loading === 'buyer_wins' ? '…' : 'Buyer Wins'}
        </button>
      </div>
    </div>
  )
}
