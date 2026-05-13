'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

interface BookingAttribution {
  bookingId: string
  listingTitle: string
  bookingAmount: number
  totalScans: number
  visits: number
  purchases: number
  revenueAttributed: number
  roi: number
  costPerScan: number
  costPerVisit: number
  costPerAcquisition: number
}

interface AttributionSummary {
  totalScans: number
  totalVisits: number
  totalRevenue: number
  bookings: BookingAttribution[]
}

interface Campaign {
  id: string
  name: string
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function FunnelBar({ label, value, max, count }: { label: string; value: number; max: number; count: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-40 shrink-0 truncate">{label}</span>
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

export default function AttributionPage() {
  const [summary, setSummary] = useState<AttributionSummary | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [initialized, setInitialized] = useState(false)
  const tokenRef = useRef('')

  useEffect(() => {
    async function init() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        window.location.href = '/login?next=/buyer/attribution'
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      tokenRef.current = session?.access_token ?? ''

      // Load campaigns with auth
      try {
        const headers = { Authorization: `Bearer ${tokenRef.current}` }
        const res = await fetch('/api/campaigns?role=buyer', { headers })
        const data = await res.json()
        setCampaigns(data.campaigns ?? [])
      } catch {
        // non-blocking
      }
      setInitialized(true)
    }
    init()
  }, [])

  useEffect(() => {
    if (!initialized) return
    async function loadAttribution() {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (selectedCampaign !== 'all') params.set('campaignId', selectedCampaign)
        const headers = { Authorization: `Bearer ${tokenRef.current}` }
        const res = await fetch(`/api/attribution?${params}`, { headers })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to load attribution')
        setSummary(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load attribution data')
      } finally {
        setLoading(false)
      }
    }
    loadAttribution()
  }, [selectedCampaign, initialized])

  const estimatedImpressions = summary ? summary.totalScans * 4 : 0
  const totalPurchases = summary?.bookings.reduce((a, b) => a + b.purchases, 0) ?? 0
  const funnelMax = estimatedImpressions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">Attribution Dashboard</h1>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Campaign</label>
          <select
            value={selectedCampaign}
            onChange={e => setSelectedCampaign(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <option value="all">All Campaigns</option>
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
          <p className="text-gray-500 text-sm">Loading attribution data...</p>
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
          <p className="text-white font-medium">No attribution data yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Your QR codes will start tracking once your ads go live.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total QR Scans"
              value={summary.totalScans.toLocaleString('en-IN')}
              sub="Unique scan events across all placements"
            />
            <StatCard
              label="Store Visits"
              value={summary.totalVisits.toLocaleString('en-IN')}
              sub="Verified visits via REZ app"
            />
            <StatCard
              label="Revenue Attributed"
              value={`₹${summary.totalRevenue.toLocaleString('en-IN')}`}
              sub="Purchases attributed to your ads"
            />
          </div>

          {/* Funnel */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
              Conversion Funnel
            </h2>
            <div className="space-y-3">
              <FunnelBar
                label="Estimated Impressions"
                value={estimatedImpressions}
                max={funnelMax}
                count={estimatedImpressions.toLocaleString('en-IN')}
              />
              <FunnelBar
                label="QR Scans"
                value={summary.totalScans}
                max={funnelMax}
                count={summary.totalScans.toLocaleString('en-IN')}
              />
              <FunnelBar
                label="Store Visits"
                value={summary.totalVisits}
                max={funnelMax}
                count={summary.totalVisits.toLocaleString('en-IN')}
              />
              <FunnelBar
                label="Purchases"
                value={totalPurchases}
                max={funnelMax}
                count={totalPurchases.toLocaleString('en-IN')}
              />
            </div>
            <p className="text-xs text-gray-600 mt-3">
              * Impressions estimated at 4x scan volume
            </p>
          </div>

          {/* Per-booking table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="px-5 py-4" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                Per Placement Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    {['Ad Placement', 'Scans', 'Visits', 'Purchases', 'Revenue', 'ROI', 'Cost'].map(h => (
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
                    const roiColor = row.roi >= 100 ? '#4ade80' : row.roi >= 50 ? '#f59e0b' : '#f87171'
                    return (
                      <tr
                        key={row.bookingId}
                        style={{ borderBottom: isLast ? 'none' : '1px solid #2a2a2a' }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-white font-medium truncate max-w-[200px]">{row.listingTitle}</p>
                          <p className="text-xs text-gray-500">₹{row.bookingAmount.toLocaleString('en-IN')} spend</p>
                        </td>
                        <td className="px-4 py-3 text-white">{row.totalScans.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-white">{row.visits.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-white">{row.purchases.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-white">₹{row.revenueAttributed.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold" style={{ color: roiColor }}>
                            {row.roi.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs space-y-0.5 text-gray-400">
                            <p>₹{row.costPerScan.toFixed(2)}/scan</p>
                            {row.costPerVisit > 0 && <p>₹{row.costPerVisit.toFixed(2)}/visit</p>}
                            {row.costPerAcquisition > 0 && <p>₹{row.costPerAcquisition.toFixed(2)}/acq</p>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cost metrics summary row */}
          {(() => {
            const totalSpend = summary.bookings.reduce((a, b) => a + b.bookingAmount, 0)
            const cps = summary.totalScans > 0 ? totalSpend / summary.totalScans : 0
            const cpv = summary.totalVisits > 0 ? totalSpend / summary.totalVisits : 0
            const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0
            return (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Cost per Scan', value: cps > 0 ? `₹${cps.toFixed(2)}` : '—' },
                  { label: 'Cost per Visit', value: cpv > 0 ? `₹${cpv.toFixed(2)}` : '—' },
                  { label: 'Cost per Acquisition', value: cpa > 0 ? `₹${cpa.toFixed(2)}` : '—' },
                ].map(metric => (
                  <div
                    key={metric.label}
                    className="rounded-xl p-4 text-center"
                    style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                  >
                    <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                    <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{metric.value}</p>
                  </div>
                ))}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
