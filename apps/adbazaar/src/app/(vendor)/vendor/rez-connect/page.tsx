'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

type ConnectState = 'idle' | 'loading' | 'success' | 'error'

export default function RezConnectPage() {
  const [rezMerchantId, setRezMerchantId] = useState('')
  const [state, setState] = useState<ConnectState>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = rezMerchantId.trim()
    if (!trimmed) return

    setState('loading')
    setError(null)

    try {
      const { data: { session } } = await getSupabase().auth.getSession()
      if (!session) {
        setError('You must be logged in.')
        setState('error')
        return
      }

      const res = await fetch('/api/vendor/connect-rez', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rezMerchantId: trimmed }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to connect. Please try again.')
        setState('error')
        return
      }

      setState('success')
    } catch {
      setError('Network error. Please try again.')
      setState('error')
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <Link href="/vendor/dashboard" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold"
            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
          >
            R
          </div>
          <h1 className="text-2xl font-bold text-white">Connect REZ Account</h1>
        </div>
        <p className="text-gray-400 text-sm">
          Link your REZ merchant account to unlock the closed-loop attribution loop —
          when users scan your ads, they earn REZ coins and visit your store.
        </p>
      </div>

      {state === 'success' ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#14532d22', border: '1px solid #4ade8044' }}
        >
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-white mb-2">REZ Account Connected!</h2>
          <p className="text-sm text-gray-400 mb-6">
            Your AdBazaar listings are now linked to REZ. QR scans will credit coins to
            REZ users and visit/purchase data will flow into your attribution dashboard.
          </p>
          <Link
            href="/vendor/dashboard"
            className="inline-block rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <>
          {/* Benefits */}
          <div
            className="rounded-xl p-5 mb-6"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h3 className="text-sm font-semibold text-white mb-3">What you unlock</h3>
            <ul className="space-y-2.5">
              {[
                { icon: '🪙', text: 'Users earn REZ coins when they scan your physical ads' },
                { icon: '📍', text: 'Automatic visit tracking when users walk into your store' },
                { icon: '📊', text: 'Full funnel ROI: impressions → scans → visits → purchases' },
                { icon: '📣', text: 'Run WhatsApp & SMS broadcasts to REZ user base directly from Promote Hub' },
                { icon: '🔗', text: 'Manage AdBazaar bookings from within the REZ merchant app' },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-start gap-2.5 text-sm text-gray-400">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h3 className="text-sm font-semibold text-white mb-1">Enter your REZ Merchant ID</h3>
            <p className="text-xs text-gray-500 mb-4">
              Find this in your REZ Merchant App → Profile → Merchant ID
            </p>

            {error && (
              <div className="mb-4 rounded-lg p-3 text-sm" style={{ backgroundColor: '#7f1d1d22', border: '1px solid #f8717144', color: '#f87171' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              <input
                type="text"
                required
                value={rezMerchantId}
                onChange={(e) => setRezMerchantId(e.target.value)}
                placeholder="e.g. 66a1b2c3d4e5f6789012abcd"
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  '--tw-ring-color': '#f59e0b80',
                } as React.CSSProperties}
              />
              <button
                type="submit"
                disabled={state === 'loading' || !rezMerchantId.trim()}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
              >
                {state === 'loading' ? 'Connecting…' : 'Connect REZ Account'}
              </button>
            </form>
          </div>

          {/* Not on REZ yet */}
          <div
            className="mt-4 rounded-xl p-5"
            style={{ backgroundColor: '#1e3a5f22', border: '1px solid #60a5fa33' }}
          >
            <p className="text-sm text-blue-300 font-medium mb-1">Not on REZ yet?</p>
            <p className="text-xs text-gray-400 mb-3">
              REZ is India&apos;s loyalty-driven commerce platform. Download the REZ Merchant App and
              onboard for free to get your Merchant ID and unlock the full attribution loop.
            </p>
            <a
              href="https://rezapp.in/merchant"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium transition-colors"
              style={{ color: '#60a5fa' }}
            >
              Learn about REZ for Merchants →
            </a>
          </div>
        </>
      )}
    </div>
  )
}
