'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export function DisputeResolver({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false)
  const [resolution, setResolution] = useState<'vendor_wins' | 'buyer_wins'>('vendor_wins')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [tokenReady, setTokenReady] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setTokenReady(true)
    })
  }, [])

  async function submit() {
    setLoading(true)
    setResult(null)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const res = await fetch(`/api/admin/disputes/${bookingId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ resolution, notes: notes.trim() || undefined }),
    })
    const json = await res.json()
    if (res.ok) {
      setResult({ ok: true, msg: `Resolved: ${resolution}` })
      setOpen(false)
    } else {
      setResult({ ok: false, msg: json.error ?? 'Failed' })
    }
    setLoading(false)
  }

  if (result?.ok) {
    return <span className="text-xs text-green-400">{result.msg}</span>
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!tokenReady}
        className="text-xs px-2.5 py-1 rounded font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
        style={{ backgroundColor: '#ef444422', color: '#f87171', border: '1px solid #ef444444' }}
      >
        Resolve
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h3 className="text-base font-bold text-white">Resolve Dispute</h3>
            <p className="text-xs text-gray-500 font-mono">{bookingId}</p>

            <div className="space-y-2">
              {(['vendor_wins', 'buyer_wins'] as const).map(opt => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="resolution"
                    value={opt}
                    checked={resolution === opt}
                    onChange={() => setResolution(opt)}
                    className="accent-amber-500"
                  />
                  <span className="text-sm text-white capitalize">{opt.replace('_', ' ')}</span>
                </label>
              ))}
            </div>

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm text-white resize-none outline-none"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
            />

            {result && !result.ok && (
              <p className="text-xs text-red-400">{result.msg}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: '#27272a', color: '#9ca3af' }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
              >
                {loading ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
