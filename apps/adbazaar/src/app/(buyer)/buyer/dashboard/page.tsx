'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// SECURITY: Now uses @supabase/ssr with HttpOnly cookies instead of localStorage

interface DashboardData {
  totalBookings: number
  activeBookings: number
  totalSpend: number
  pendingInquiries: number
  completedBookings: number
  campaignCount: number
}

function StatCard({
  label, value, sub, href, accent,
}: {
  label: string; value: string; sub?: string; href?: string; accent?: boolean
}) {
  const inner = (
    <div
      className="rounded-xl p-5 h-full transition-colors"
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
  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>
  return inner
}

// Singleton Supabase client for this page
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

export default function BuyerDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabase()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login?next=/buyer/dashboard')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      setToken(t)
      const headers: Record<string, string> = {}
      if (t) headers['Authorization'] = `Bearer ${t}`

      const [bookingsRes, inquiriesRes, campaignsRes] = await Promise.all([
        fetch('/api/bookings?role=buyer', { headers }),
        fetch('/api/inquiries?role=buyer', { headers }),
        fetch('/api/campaigns', { headers }),
      ])

      const bookingsData = bookingsRes.ok ? await bookingsRes.json() : { bookings: [] }
      const inquiriesData = inquiriesRes.ok ? await inquiriesRes.json() : { inquiries: [] }
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : { campaigns: [] }

      const bookings = bookingsData.bookings ?? []
      const inquiries = inquiriesData.inquiries ?? []
      const campaigns = campaignsData.campaigns ?? []

      setData({
        totalBookings: bookings.length,
        activeBookings: bookings.filter((b: { status: string }) =>
          ['confirmed', 'paid', 'executing'].includes(b.status)
        ).length,
        totalSpend: bookings
          .filter((b: { status: string }) => b.status !== 'cancelled')
          .reduce((s: number, b: { amount: number }) => s + (b.amount ?? 0), 0),
        pendingInquiries: inquiries.filter((i: { status: string }) => i.status === 'pending' || i.status === 'quoted').length,
        completedBookings: bookings.filter((b: { status: string }) => b.status === 'completed').length,
        campaignCount: campaigns.length,
      })
      setLoading(false)
    }
    load()
   
  }, [router])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Your ad campaign overview</p>
        </div>
        <Link
          href="/browse"
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          + Book Ad Space
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl h-24 animate-pulse" style={{ backgroundColor: '#1a1a1a' }} />
          ))}
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Total Ad Spend"
              value={`₹${data.totalSpend.toLocaleString('en-IN')}`}
              sub="All confirmed bookings"
              accent
              href="/buyer/bookings"
            />
            <StatCard
              label="Active Campaigns"
              value={String(data.activeBookings)}
              sub="Confirmed/executing"
              href="/buyer/bookings"
            />
            <StatCard
              label="Campaigns"
              value={String(data.campaignCount)}
              sub="Multi-listing bundles"
              href="/buyer/campaigns"
            />
            <StatCard
              label="Total Bookings"
              value={String(data.totalBookings)}
              href="/buyer/bookings"
            />
            <StatCard
              label="Completed"
              value={String(data.completedBookings)}
              sub="Proof approved"
              href="/buyer/bookings"
            />
            <StatCard
              label="Open Inquiries"
              value={String(data.pendingInquiries)}
              sub="Awaiting / quoted"
              href="/buyer/inquiries"
            />
          </div>

          {/* Quick actions */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
              Quick Actions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { href: '/browse', label: 'Browse Listings', icon: '🔍' },
                { href: '/buyer/bookings', label: 'My Bookings', icon: '📋' },
                { href: '/buyer/inquiries', label: 'My Inquiries', icon: '💬' },
                { href: '/buyer/campaigns', label: 'My Campaigns', icon: '◈' },
              ].map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-colors hover:bg-white/5"
                  style={{ border: '1px solid #2a2a2a' }}
                >
                  <span className="text-2xl">{icon}</span>
                  <span className="text-xs font-medium text-gray-300">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {data.pendingInquiries > 0 && (
            <div
              className="rounded-xl px-5 py-4 flex items-center justify-between"
              style={{ backgroundColor: '#1c1400', border: '1px solid #f59e0b44' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {data.pendingInquiries} open inquir{data.pendingInquiries !== 1 ? 'ies' : 'y'}
                  </p>
                  <p className="text-xs" style={{ color: '#9ca3af' }}>
                    {data.pendingInquiries === 1 ? 'A vendor has responded' : 'Vendors are waiting for your reply'}
                  </p>
                </div>
              </div>
              <Link
                href="/buyer/inquiries"
                className="rounded-lg px-4 py-2 text-xs font-semibold"
                style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
              >
                View →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
