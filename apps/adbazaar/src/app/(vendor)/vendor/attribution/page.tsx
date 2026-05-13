'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface BookingRow {
  bookingId: string
  listingTitle: string
  city: string
  area: string
  category: string
  status: string
  bookingAmount: number
  vendorPayout: number
  createdAt: string
  totalScans: number
  uniqueScanners: number
  visits: number
  purchases: number
  revenueAttributed: number
  scanRate: number
}

interface Summary {
  totalScans: number
  totalVisits: number
  totalPayout: number
  bookings: BookingRow[]
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: '#1a1a1a',
        border: `1px solid ${accent ? '#f59e0b44' : '#2a2a2a'}`,
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent ? '#f59e0b' : '#ffffff' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function FunnelBar({ label, value, max, count }: { label: string; value: number; max: number; count: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-44 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-5 rounded overflow-hidden" style={{ backgroundColor: '#0f0f0f' }}>
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: '#f59e0b' }}
        />
      </div>
      <span className="text-xs text-gray-300 w-20 text-right shrink-0">{count}</span>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#4ade80',
  paid: '#86efac',
  executing: '#fbbf24',
  completed: '#a7f3d0',
  disputed: '#f87171',
  cancelled: '#71717a',
}

export default function VendorAttributionPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token ?? ''
        if (!token) { window.location.href = '/login?next=/vendor/attribution'; return }

        const authHeaders: Record<string, string> = { Authorization: `Bearer ${token}` }
        const res = await fetch('/api/vendor/attribution', {
          headers: authHeaders,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load attribution')
        setSummary(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalPurchases = summary?.bookings.reduce((a, b) => a + b.purchases, 0) ?? 0
  const funnelMax = summary ? Math.max(summary.totalScans, 1) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Attribution Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            How your ad surfaces are performing for buyers
          </p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-sm" style={{ color: '#737373' }}>Loading attribution data…</p>
        </div>
      ) : !summary || summary.bookings.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: '#f59e0b11', border: '1px solid #f59e0b33' }}
          >
            ◎
          </div>
          <p className="font-medium text-white">No performance data yet</p>
          <p className="text-sm mt-1" style={{ color: '#737373' }}>
            Data will appear once your listings have active bookings with QR codes.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total QR Scans"
              value={summary.totalScans.toLocaleString('en-IN')}
              sub="Scans generated across your surfaces"
            />
            <StatCard
              label="REZ App Opens"
              value={summary.totalVisits.toLocaleString('en-IN')}
              sub="Users who opened REZ after scanning"
            />
            <StatCard
              label="Your Earnings"
              value={`₹${summary.totalPayout.toLocaleString('en-IN')}`}
              sub="Net payout across all bookings"
              accent
            />
          </div>

          {/* Funnel */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
              Engagement Funnel
            </h2>
            <div className="space-y-3">
              <FunnelBar
                label="Total QR Scans"
                value={summary.totalScans}
                max={funnelMax}
                count={summary.totalScans.toLocaleString('en-IN')}
              />
              <FunnelBar
                label="REZ App Opens"
                value={summary.totalVisits}
                max={funnelMax}
                count={summary.totalVisits.toLocaleString('en-IN')}
              />
              <FunnelBar
                label="Store Purchases"
                value={totalPurchases}
                max={funnelMax}
                count={totalPurchases.toLocaleString('en-IN')}
              />
            </div>
            <div className="mt-4 text-xs" style={{ color: '#4b5563' }}>
              Scan-to-visit rate:{' '}
              <span style={{ color: '#f59e0b' }}>
                {summary.totalScans > 0 ? Math.round((summary.totalVisits / summary.totalScans) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Per-booking table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                Per Booking Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    {['Listing', 'Status', 'Scans', 'App Opens', 'Purchases', 'Rev. Attributed', 'Payout'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: '#6b7280' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.bookings.map((row, idx) => {
                    const isLast = idx === summary.bookings.length - 1
                    const statusColor = STATUS_COLORS[row.status] ?? '#9ca3af'
                    return (
                      <tr
                        key={row.bookingId}
                        style={{ borderBottom: isLast ? 'none' : '1px solid #2a2a2a' }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-white font-medium truncate max-w-[180px]">{row.listingTitle}</p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>
                            {row.city}{row.area ? `, ${row.area}` : ''} · {row.category}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                            style={{ backgroundColor: statusColor + '22', color: statusColor }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {row.totalScans.toLocaleString('en-IN')}
                          {row.uniqueScanners > 0 && (
                            <p className="text-xs" style={{ color: '#6b7280' }}>
                              {row.uniqueScanners} unique
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white">{row.visits.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-white">{row.purchases.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-white">
                          {row.revenueAttributed > 0
                            ? `₹${row.revenueAttributed.toLocaleString('en-IN')}`
                            : <span style={{ color: '#4b5563' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold" style={{ color: '#f59e0b' }}>
                            ₹{row.vendorPayout.toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>
                            of ₹{row.bookingAmount.toLocaleString('en-IN')}
                          </p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
