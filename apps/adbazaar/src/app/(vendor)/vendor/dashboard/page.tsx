'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies

// SECURITY: Now uses @supabase/ssr with HttpOnly cookies instead of localStorage

const statusColors: Record<string, { bg: string; text: string }> = {
  inquiry:   { bg: '#1e3a5f', text: '#60a5fa' },
  quoted:    { bg: '#1e3a5f', text: '#93c5fd' },
  confirmed: { bg: '#14532d', text: '#4ade80' },
  paid:      { bg: '#14532d', text: '#86efac' },
  executing: { bg: '#713f12', text: '#fbbf24' },
  completed: { bg: '#14532d', text: '#a7f3d0' },
  disputed:  { bg: '#7f1d1d', text: '#f87171' },
  cancelled: { bg: '#27272a', text: '#71717a' },
}

interface VendorStats {
  totalListings: number
  activeListings: number
  totalBookings: number
  totalEarnings: number
  recentBookings: Array<{
    id: string
    listing_id: string
    buyer_id: string
    amount: number
    status: string
    created_at: string
    listings?: { title: string } | null
  }>
  rezMerchantId: string | null
  totalViewCount: number
  totalQrScans: number
  totalVisits: number
}

// Singleton Supabase client
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

export default function VendorDashboardPage() {
  const [stats, setStats] = useState<VendorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabase()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token ?? ''
        if (!token) {
          window.location.href = '/login?next=/vendor/dashboard'
          return
        }

        const headers: Record<string, string> = { Authorization: `Bearer ${token}` }

        const [listingsRes, bookingsRes, profileRes, attributionRes] = await Promise.all([
          fetch('/api/vendor/listings', { headers }),
          fetch('/api/bookings?role=vendor', { headers }),
          fetch('/api/profile', { headers }),
          fetch('/api/vendor/attribution', { headers }),
        ])

        const listingsData = await listingsRes.json()
        const bookingsData = await bookingsRes.json()

        const listings = listingsData.listings ?? []
        const bookings = bookingsData.bookings ?? []

        let rezMerchantId: string | null = null
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          rezMerchantId = profileData.profile?.rez_merchant_id ?? null
        }

        // Calculate total view count from listings
        const totalViewCount = listings.reduce(
          (sum: number, l: { view_count?: number }) => sum + (l.view_count ?? 0),
          0
        )

        // Attribution data
        let totalQrScans = 0
        let totalVisits = 0
        if (attributionRes.ok) {
          const attrData = await attributionRes.json()
          totalQrScans = attrData.totalScans ?? 0
          totalVisits = attrData.totalVisits ?? 0
        }

        setStats({
          totalListings: listings.length,
          activeListings: listings.filter((l: { status: string }) => l.status === 'active').length,
          totalBookings: bookings.length,
          totalEarnings: bookings
            // AB2-M14 FIX: Only count 'completed' bookings as actual earnings.
            // 'paid' and 'executing' are pending states where payout hasn't been confirmed yet.
            // Revenue should only be recognized when the service is delivered and proof is approved.
            .filter((b: { status: string }) => ['completed'].includes(b.status))
            .reduce((sum: number, b: { vendor_payout: number }) => sum + (b.vendor_payout ?? 0), 0),
          recentBookings: bookings.slice(0, 5),
          rezMerchantId,
          totalViewCount,
          totalQrScans,
          totalVisits,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading dashboard...</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-sm">{error || 'Failed to load'}</p>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Listings', value: stats.totalListings },
    { label: 'Active Listings', value: stats.activeListings },
    { label: 'Total Bookings', value: stats.totalBookings },
    { label: 'Total Earnings', value: `₹${stats.totalEarnings.toLocaleString('en-IN')}` },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/vendor/listings/new"
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          + Create New Listing
        </Link>
      </div>

      {/* REZ Connect banner — shown only when not yet linked */}
      {!stats.rezMerchantId ? (
        <div
          className="flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: '#1e3a5f33', border: '1px solid #60a5fa44' }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🔗</span>
            <div>
              <p className="text-sm font-semibold text-white">Unlock the full attribution loop with REZ</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Connect your REZ merchant account so QR scans on your ads earn coins for users,
                drive real store visits, and show you complete ROI — impressions → scans → visits → purchases.
              </p>
            </div>
          </div>
          <Link
            href="/vendor/rez-connect"
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ backgroundColor: '#60a5fa', color: '#0f0f0f' }}
          >
            Connect REZ →
          </Link>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-3"
          style={{ backgroundColor: '#14532d22', border: '1px solid #4ade8033' }}
        >
          <span className="text-lg">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400">REZ account connected</p>
            <p className="text-xs text-gray-500 truncate">Merchant ID: {stats.rezMerchantId}</p>
          </div>
          <Link href="/vendor/rez-connect" className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0">
            Change
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Performance section */}
      {(stats.totalViewCount > 0 || stats.totalQrScans > 0) && (
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <h2 className="text-sm font-semibold text-white mb-4">Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Listing Views</p>
              <p className="mt-1 text-2xl font-bold text-white">{stats.totalViewCount.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-500">across all listings</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total QR Scans</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: '#f59e0b' }}>
                {stats.totalQrScans.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-500">from active bookings</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Conversion Rate</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {stats.totalQrScans > 0
                  ? `${Math.round((stats.totalVisits / stats.totalQrScans) * 100)}%`
                  : '—'}
              </p>
              <p className="text-xs text-gray-500">scans to REZ visits</p>
            </div>
          </div>
          <div className="mt-3 text-right">
            <Link
              href="/vendor/attribution"
              className="text-xs transition-colors hover:opacity-80"
              style={{ color: '#f59e0b' }}
            >
              Full attribution report &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div
        className="rounded-xl"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2a2a2a' }}>
          <h2 className="text-base font-semibold text-white">Recent Bookings</h2>
        </div>

        {stats.recentBookings.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  {['Listing', 'Buyer', 'Amount', 'Status', 'Date'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#2a2a2a' }}>
                {stats.recentBookings.map((booking) => {
                  const sc = statusColors[booking.status] ?? statusColors.cancelled
                  return (
                    <tr key={booking.id}>
                      <td className="px-6 py-3 font-medium text-white">
                        {booking.listings?.title ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-400">{booking.buyer_id?.slice(0, 8)}…</td>
                      <td className="px-6 py-3 text-white">
                        ₹{(booking.amount ?? 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                          style={{ backgroundColor: sc.bg, color: sc.text }}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-400">
                        {new Date(booking.created_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
