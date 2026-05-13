'use client'

import { useEffect, useState } from 'react'
import Image from '@/components/ui/Image'
import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QrAnalytics {
  id: string
  slug: string
  label: string
  posterIndex: number
  qrImageUrl: string | null
  creativeImageUrl: string | null
  isActive: boolean
  totalScansAllTime: number
  uniqueScannersAllTime: number
  windowScans: number
  appOpens: number
  visits: number
  purchases: number
  coinsDistributed: number
  conversionRate: number
  deviceBreakdown: { device: string; count: number }[]
  topCities: { city: string; count: number }[]
  timeline: { date: string; count: number }[]
  lastScanAt: string | null
}

interface BookingAnalytics {
  bookingId: string
  status: string
  amount: number
  startDate: string
  endDate: string
  listing: { id: string; title: string; city: string; area: string; category: string; thumbnail: string | null } | null
  qrCodes: QrAnalytics[]
  summary: {
    totalScans: number
    totalScansAllTime: number
    uniqueScanners: number
    appOpens: number
    visits: number
    purchases: number
    coinsDistributed: number
    revenueAttributed: number
    conversionRate: number
    deviceBreakdown: { device: string; count: number }[]
    topCities: { city: string; count: number }[]
    timeline: { date: string; count: number }[]
  }
}

interface AnalyticsResponse {
  bookings: BookingAnalytics[]
  totals: {
    totalScans: number
    uniqueScanners: number
    totalAppOpens: number
    totalVisits: number
    totalPurchases: number
    totalCoins: number
    totalRevenue: number
    deviceBreakdown: { device: string; count: number }[]
    topCities: { city: string; count: number }[]
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function deviceIcon(d: string) {
  if (d === 'mobile') return '📱'
  if (d === 'tablet') return '📲'
  if (d === 'desktop') return '🖥'
  return '❓'
}

const DAYS_OPTIONS = [7, 14, 30, 60, 90]

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function TimelineChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const visible = data.slice(-30)
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {visible.map(({ date, count }) => (
        <div
          key={date}
          className="flex-1 rounded-t-sm transition-all"
          style={{
            height: `${Math.max((count / max) * 100, count > 0 ? 6 : 2)}%`,
            backgroundColor: count > 0 ? '#f59e0b' : '#2a2a2a',
          }}
          title={`${fmtDate(date)}: ${count} scan${count !== 1 ? 's' : ''}`}
        />
      ))}
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funnel({ scans, opens, visits, purchases }: { scans: number; opens: number; visits: number; purchases: number }) {
  const steps = [
    { label: 'Scans', value: scans, color: '#f59e0b' },
    { label: 'App Opens', value: opens, color: '#60a5fa' },
    { label: 'Store Visits', value: visits, color: '#4ade80' },
    { label: 'Purchases', value: purchases, color: '#a78bfa' },
  ]
  const maxV = Math.max(scans, 1)
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map(({ label, value, color }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-24 text-right text-xs text-gray-400 flex-shrink-0">{label}</div>
          <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
            <div
              className="h-full rounded-md transition-all flex items-center px-2"
              style={{ width: `${Math.max((value / maxV) * 100, value > 0 ? 4 : 0)}%`, backgroundColor: color }}
            >
              {value > 0 && (
                <span className="text-xs font-bold text-black whitespace-nowrap">{value.toLocaleString('en-IN')}</span>
              )}
            </div>
          </div>
          <div className="w-8 text-xs text-gray-500 flex-shrink-0">{value.toLocaleString('en-IN')}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent ? '#f59e0b' : '#ffffff' }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── QR Row ───────────────────────────────────────────────────────────────────

function QrRow({ qr, appUrl }: { qr: QrAnalytics; appUrl: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
      >
        {/* QR image */}
        {qr.qrImageUrl ? (
          <Image src={qr.qrImageUrl} alt="QR" width={40} height={40} className="rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: '#2a2a2a' }}>▦</div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{qr.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {qr.isActive ? '🟢 Active' : '⚫ Inactive'} &nbsp;·&nbsp;
            {qr.totalScansAllTime} total scans all-time
            {qr.lastScanAt && ` · Last scan ${fmtDate(qr.lastScanAt)}`}
          </p>
        </div>

        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-6 text-center flex-shrink-0">
          {[
            { label: 'Scans', v: qr.windowScans },
            { label: 'Opens', v: qr.appOpens },
            { label: 'Visits', v: qr.visits },
            { label: 'Conv.', v: `${qr.conversionRate}%` },
          ].map(({ label, v }) => (
            <div key={label}>
              <p className="text-sm font-bold text-white">{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        {/* QR scan link */}
        <a
          href={`${appUrl}/scan/${qr.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#2a2a2a', color: '#f59e0b' }}
          onClick={e => e.stopPropagation()}
        >
          Preview
        </a>

        <span className="text-gray-500 text-sm flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4" style={{ borderTop: '1px solid #2a2a2a' }}>
          {/* Funnel */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Conversion Funnel</p>
            <Funnel scans={qr.windowScans} opens={qr.appOpens} visits={qr.visits} purchases={qr.purchases} />
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Scan Activity</p>
            <TimelineChart data={qr.timeline} />
          </div>

          {/* Device + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {qr.deviceBreakdown.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Devices</p>
                <div className="space-y-1.5">
                  {qr.deviceBreakdown.map(({ device, count }) => (
                    <div key={device} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{deviceIcon(device)} {device}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {qr.topCities.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Top Cities</p>
                <div className="space-y-1.5">
                  {qr.topCities.slice(0, 5).map(({ city, count }) => (
                    <div key={city} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">📍 {city}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* All-time vs window */}
          <div className="flex gap-4 pt-1">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{qr.totalScansAllTime.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500">Total scans (all time)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{qr.uniqueScannersAllTime.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500">Unique scanners (all time)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold" style={{ color: '#f59e0b' }}>{qr.coinsDistributed.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500">REZ coins given</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)
  const [selectedBookingId, setSelectedBookingId] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings'>('overview')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('Not authenticated'); setLoading(false); return }

        const params = new URLSearchParams({ days: String(days) })
        if (selectedBookingId !== 'all') params.set('bookingId', selectedBookingId)

        const res = await fetch(`/api/vendor/analytics?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        if (!res.ok) { setError(json.error || 'Failed to load'); setLoading(false); return }
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [days, selectedBookingId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">{error || 'No data'}</p>
      </div>
    )
  }

  const { totals } = data
  const displayBookings = selectedBookingId === 'all'
    ? data.bookings
    : data.bookings.filter(b => b.bookingId === selectedBookingId)

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">QR Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Scan performance across all your campaigns</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Booking filter */}
          <select
            value={selectedBookingId}
            onChange={e => setSelectedBookingId(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <option value="all">All campaigns</option>
            {data.bookings.map(b => (
              <option key={b.bookingId} value={b.bookingId}>
                {b.listing?.title || 'Booking'} ({b.listing?.city || ''})
              </option>
            ))}
          </select>

          {/* Days filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
            {DAYS_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className="px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: days === d ? '#f59e0b' : '#1a1a1a',
                  color: days === d ? '#0f0f0f' : '#9ca3af',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        {(['overview', 'bookings'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
            style={{
              backgroundColor: activeTab === tab ? '#f59e0b' : 'transparent',
              color: activeTab === tab ? '#0f0f0f' : '#9ca3af',
            }}
          >
            {tab === 'overview' ? 'Platform Overview' : 'Campaign Breakdown'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Scans" value={totals.totalScans} sub={`last ${days} days`} accent />
            <StatCard label="Unique Scanners" value={totals.uniqueScanners} />
            <StatCard label="REZ App Opens" value={totals.totalAppOpens} />
            <StatCard label="Store Visits" value={totals.totalVisits} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Purchases" value={totals.totalPurchases} />
            <StatCard label="REZ Coins Distributed" value={totals.totalCoins} accent />
            <StatCard label="Revenue Attributed" value={fmtINR(totals.totalRevenue)} />
          </div>

          {/* Funnel */}
          {totals.totalScans > 0 && (
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <p className="text-sm font-semibold text-white mb-4">Conversion Funnel</p>
              <Funnel
                scans={totals.totalScans}
                opens={totals.totalAppOpens}
                visits={totals.totalVisits}
                purchases={totals.totalPurchases}
              />
            </div>
          )}

          {/* Device + City side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {totals.deviceBreakdown.length > 0 && (
              <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <p className="text-sm font-semibold text-white mb-3">Device Breakdown</p>
                <div className="space-y-3">
                  {totals.deviceBreakdown.map(({ device, count }) => {
                    const pct = totals.totalScans > 0 ? Math.round((count / totals.totalScans) * 100) : 0
                    return (
                      <div key={device}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">{deviceIcon(device)} {device}</span>
                          <span className="text-white font-medium">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ backgroundColor: '#2a2a2a' }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: '#f59e0b' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {totals.topCities.length > 0 && (
              <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                <p className="text-sm font-semibold text-white mb-3">Top Scan Cities</p>
                <div className="space-y-2">
                  {totals.topCities.map(({ city, count }, i) => {
                    const pct = totals.totalScans > 0 ? Math.round((count / totals.totalScans) * 100) : 0
                    return (
                      <div key={city} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-gray-600 font-mono text-xs">{i + 1}</span>
                        <span className="flex-1 text-gray-300 truncate">📍 {city}</span>
                        <span className="text-white font-medium">{count}</span>
                        <span className="w-10 text-right text-gray-500 text-xs">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-6">
          {displayBookings.length === 0 ? (
            <div className="rounded-xl p-10 text-center text-gray-500"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              No active campaigns with QR codes yet.
            </div>
          ) : (
            displayBookings.map(booking => (
              <div key={booking.bookingId} className="space-y-3">
                {/* Booking header */}
                <div className="flex items-center gap-3 flex-wrap">
                  {booking.listing?.thumbnail && (
                    <Image src={booking.listing.thumbnail} alt="" width={40} height={40} className="rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{booking.listing?.title || 'Booking'}</p>
                    <p className="text-xs text-gray-500">
                      {booking.listing?.city}{booking.listing?.area ? `, ${booking.listing.area}` : ''} &nbsp;·&nbsp;
                      {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)} &nbsp;·&nbsp;
                      <span className="capitalize">{booking.status}</span>
                    </p>
                  </div>
                  {/* Booking summary badges */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: `${booking.summary.totalScans} scans`, color: '#f59e0b22', text: '#f59e0b' },
                      { label: `${booking.summary.visits} visits`, color: '#14532d22', text: '#4ade80' },
                      { label: `${booking.summary.conversionRate}% conv.`, color: '#1e3a5f22', text: '#60a5fa' },
                    ].map(({ label, color, text }) => (
                      <span key={label} className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ backgroundColor: color, color: text }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Campaign-level timeline */}
                {booking.summary.totalScans > 0 && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
                    <p className="text-xs text-gray-500 mb-2">Campaign scan activity ({days}d)</p>
                    <TimelineChart data={booking.summary.timeline} />
                  </div>
                )}

                {/* Per-QR breakdown */}
                {booking.qrCodes.length === 0 ? (
                  <div className="text-sm text-gray-500 px-2">No QR codes generated for this booking yet.</div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">
                      {booking.qrCodes.length} QR Code{booking.qrCodes.length !== 1 ? 's' : ''} (click to expand)
                    </p>
                    {booking.qrCodes.map(qr => (
                      <QrRow key={qr.id} qr={qr} appUrl={appUrl} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
