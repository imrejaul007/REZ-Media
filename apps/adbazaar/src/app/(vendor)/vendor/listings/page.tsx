'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import Image from '@/components/ui/Image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Listing } from '@/types'
import { LISTING_CATEGORIES } from '@/lib/constants'

function freshnessColor(score: number): string {
  if (score >= 70) return '#4ade80'
  if (score >= 40) return '#fbbf24'
  return '#f87171'
}

function freshnessLabel(score: number, lastUpdated: string): string {
  if (!lastUpdated) return 'Never refreshed'
  const days = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400000)
  if (score >= 70) return `Fresh · ${days}d ago`
  if (score >= 40) return `Aging · ${days}d ago`
  return `Stale · ${days}d ago`
}

type StatusFilter = 'all' | 'draft' | 'active' | 'paused' | 'rejected'

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  draft:    { label: 'Draft',    bg: '#27272a', text: '#a1a1aa' },
  active:   { label: 'Active',   bg: '#14532d', text: '#4ade80' },
  paused:   { label: 'Paused',   bg: '#713f12', text: '#fbbf24' },
  rejected: { label: 'Rejected', bg: '#7f1d1d', text: '#f87171' },
  archived: { label: 'Archived', bg: '#27272a', text: '#6b7280' },
}

const tabs: { key: StatusFilter; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'draft',    label: 'Drafts' },
  { key: 'paused',   label: 'Paused' },
  { key: 'rejected', label: 'Rejected' },
]

function VendorListingsContent() {
  const searchParams = useSearchParams()
  const created = searchParams.get('created')
  const updated = searchParams.get('updated')
  const [banner, setBanner] = useState<string | null>(
    created ? 'Listing created successfully! It is now under review.' : updated ? 'Listing updated successfully.' : null
  )

  const [listings, setListings] = useState<Listing[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''
      setToken(accessToken)
      const headers: Record<string, string> = {}
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
      fetch('/api/vendor/listings', { headers })
        .then((r) => r.json())
        .then((data) => { setListings(data.listings ?? []); setLoading(false) })
        .catch(() => setLoading(false))
    }
    load()
  }, [])

  // Exclude archived listings from 'all' view — they were self-deleted
  const filtered = filter === 'all'
    ? listings.filter((l) => (l.status as string) !== 'archived')
    : listings.filter((l) => l.status === filter)

  async function toggleStatus(listing: Listing) {
    // draft listings can only be activated by admin after review
    if (listing.status === 'draft') return
    const newStatus = listing.status === 'active' ? 'paused' : 'active'
    setActionLoading(listing.id)
    const toggleHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) toggleHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/vendor/listings/${listing.id}`, {
      method: 'PATCH',
      headers: toggleHeaders,
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setListings((prev) =>
        prev.map((l) => (l.id === listing.id ? { ...l, status: newStatus } : l))
      )
    }
    setActionLoading(null)
  }

  async function deleteListing(id: string) {
    if (!confirm('Delete this listing?')) return
    setActionLoading(id)
    const deleteHeaders: Record<string, string> = {}
    if (token) deleteHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/vendor/listings/${id}`, { method: 'DELETE', headers: deleteHeaders })
    if (res.ok) setListings((prev) => prev.filter((l) => l.id !== id))
    setActionLoading(null)
  }

  async function refreshListing(id: string) {
    setActionLoading(id)
    const refreshHeaders: Record<string, string> = {}
    if (token) refreshHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/vendor/listings/${id}/refresh`, {
      method: 'POST',
      headers: refreshHeaders,
    })
    if (res.ok) {
      const data = await res.json()
      setListings((prev) =>
        prev.map((l) => l.id === id
          ? { ...l, freshness_score: data.listing.freshness_score, freshness_last_updated: data.listing.freshness_last_updated, status: data.listing.status }
          : l
        )
      )
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {banner && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#052e16', border: '1px solid #14532d', color: '#4ade80' }}
        >
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="ml-4 text-base leading-none" style={{ color: '#4ade80' }}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Listings</h1>
        <Link
          href="/vendor/listings/new"
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          + New Listing
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: filter === tab.key ? '#f59e0b' : 'transparent',
              color: filter === tab.key ? '#0f0f0f' : '#9ca3af',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          No listings found.{' '}
          <Link href="/vendor/listings/new" style={{ color: '#f59e0b' }}>
            Create one
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing) => {
            const sc = statusConfig[listing.status] ?? statusConfig.draft
            const catLabel =
              LISTING_CATEGORIES[listing.category as keyof typeof LISTING_CATEGORIES]?.label ??
              listing.category
            const isActing = actionLoading === listing.id

            return (
              <div
                key={listing.id}
                className="flex flex-col rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                {/* Image */}
                <div
                  className="h-36 w-full flex items-center justify-center text-4xl"
                  style={{ backgroundColor: '#111111' }}
                >
                  {listing.images?.[0] ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.title}
                      width={400}
                      height={144}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-gray-600">🖼</span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4 gap-3">
                  {/* Title + badges */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: '#f59e0b22', color: '#f59e0b' }}
                      >
                        {catLabel}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white line-clamp-1">{listing.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {listing.city}{listing.area ? `, ${listing.area}` : ''}
                    </p>
                    {listing.status === 'rejected' && !!((listing as unknown as Record<string, unknown>).rejection_reason) && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: '#f87171' }}>
                        Reason: {String((listing as unknown as Record<string, unknown>).rejection_reason)}
                      </p>
                    )}
                  </div>

                  {/* Price + counts */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold" style={{ color: '#f59e0b' }}>
                      {listing.price ? `₹${listing.price.toLocaleString('en-IN')}` : 'Quote'}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {listing.view_count} views · {listing.booking_count} bookings
                    </span>
                  </div>

                  {/* Freshness bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: freshnessColor(listing.freshness_score ?? 100) }}>
                        {freshnessLabel(listing.freshness_score ?? 100, listing.freshness_last_updated)}
                      </span>
                      <span className="text-xs font-medium" style={{ color: freshnessColor(listing.freshness_score ?? 100) }}>
                        {listing.freshness_score ?? 100}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${listing.freshness_score ?? 100}%`,
                          backgroundColor: freshnessColor(listing.freshness_score ?? 100),
                        }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 flex-wrap" style={{ borderTop: '1px solid #2a2a2a' }}>
                    <Link
                      href={`/vendor/listings/${listing.id}/edit`}
                      className="flex-1 rounded-lg py-1.5 text-center text-xs font-medium text-gray-300 transition-colors hover:text-white"
                      style={{ backgroundColor: '#27272a' }}
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleStatus(listing)}
                      disabled={isActing || listing.status === 'rejected'}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#27272a', color: '#d1d5db' }}
                    >
                      {isActing ? '…' : listing.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => refreshListing(listing.id)}
                      disabled={isActing}
                      title="Mark listing as still current — resets freshness"
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#27272a', color: '#4ade80' }}
                    >
                      {isActing ? '…' : '↻'}
                    </button>
                    <button
                      onClick={() => deleteListing(listing.id)}
                      disabled={isActing}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:text-red-400 disabled:opacity-40"
                      style={{ backgroundColor: '#27272a', color: '#f87171' }}
                    >
                      {isActing ? '…' : 'Del'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function VendorListingsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading…</div>}>
      <VendorListingsContent />
    </Suspense>
  )
}
