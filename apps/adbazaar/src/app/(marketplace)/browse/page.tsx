'use client'

import { useState, useEffect, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@supabase/supabase-js'
import { Listing } from '@/types'
import { LISTING_CATEGORIES } from '@/lib/constants'
import ListingCard from '@/components/listing/ListingCard'
import { track } from '@/services/intentCaptureService'

// Loaded client-side only — Google Maps cannot SSR
const ListingsMap = dynamic(() => import('@/components/map/ListingsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="hidden lg:flex flex-1 rounded-xl border items-center justify-center"
      style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', minHeight: '60vh' }}
    >
      <span className="text-sm" style={{ color: '#737373' }}>Loading map…</span>
    </div>
  ),
})

interface BrowseResponse {
  listings: Listing[]
  total: number
  page: number
  totalPages: number
}

const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Models' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'slot', label: 'Slot' },
  { value: 'always_on', label: 'Always On' },
]

function BrowseContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const lastSearchRef = useRef('')
  const userIdRef = useRef('')

  // Filter state — initialise from URL params
  const [city, setCity] = useState(searchParams.get('city') ?? '')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '')
  const [availabilityModel, setAvailabilityModel] = useState(searchParams.get('availabilityModel') ?? '')
  const [qrEnabled, setQrEnabled] = useState(searchParams.get('qrEnabled') === 'true')
  const [searchQ, setSearchQ] = useState(searchParams.get('q') ?? '')

  const hasActiveFilters = !!(city || category || minPrice || maxPrice || availabilityModel || qrEnabled || searchQ)

  // Fetch user ID once on mount
  useEffect(() => {
    async function getUser() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (user) userIdRef.current = user.id
    }
    getUser()
  }, [])

  function clearAllFilters() {
    setCity('')
    setCategory('')
    setMinPrice('')
    setMaxPrice('')
    setAvailabilityModel('')
    setQrEnabled(false)
    router.push('/browse')
  }

  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams()
      if (city) params.set('city', city)
      if (category) params.set('category', category)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (availabilityModel) params.set('availabilityModel', availabilityModel)
      if (qrEnabled) params.set('qrEnabled', 'true')
      if (searchQ) params.set('q', searchQ)
      params.set('page', String(p))
      return params.toString()
    },
    [city, category, minPrice, maxPrice, availabilityModel, qrEnabled, searchQ]
  )

  const fetchListings = useCallback(
    async (p: number, append = false) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/listings?${buildQuery(p)}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data: BrowseResponse = await res.json()
        setListings((prev) => (append ? [...prev, ...data.listings] : data.listings))
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(data.page)

        // ReZ Mind intent capture — listing searched (only fire once per search change)
        const searchKey = JSON.stringify({ searchQ, city, category, minPrice, maxPrice, availabilityModel, qrEnabled })
        if (searchKey !== lastSearchRef.current && (searchQ || city || category)) {
          lastSearchRef.current = searchKey
          track({
            userId: userIdRef.current,
            event: 'listing_searched',
            appType: 'AdBazaar',
            intentKey: `search:${searchQ || city || category}`,
            properties: {
              searchQuery: searchQ,
              city,
              category,
              minPrice: minPrice || undefined,
              maxPrice: maxPrice || undefined,
              availabilityModel: availabilityModel || undefined,
              qrEnabled: qrEnabled || undefined,
              resultsCount: data.total,
            },
          })
        }
      } catch {
        // silent — empty state shown
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildQuery is stable via useCallback
    [buildQuery]
  )

  // Initial + filter-driven fetch
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization trigger
    fetchListings(1, false)
  }, [city, category, minPrice, maxPrice, availabilityModel, qrEnabled, searchQ])

  function handleLoadMore() {
    fetchListings(page + 1, true)
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault()
    // State change drives the effect above
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-4">
      {/* Filter bar */}
      <form
        onSubmit={handleApplyFilters}
        className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-xl border"
        style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
      >
        {/* Search */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>Search</label>
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Billboard, hoarding..."
            className="px-3 py-2 rounded-lg text-sm w-44 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          />
        </div>

        {/* City */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai"
            className="px-3 py-2 rounded-lg text-sm w-36 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm w-44 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          >
            <option value="">All Categories</option>
            {Object.entries(LISTING_CATEGORIES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Price range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>Min Price (&#8377;)</label>
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="0"
            min={0}
            className="px-3 py-2 rounded-lg text-sm w-28 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>Max Price (&#8377;)</label>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Any"
            min={0}
            className="px-3 py-2 rounded-lg text-sm w-28 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          />
        </div>

        {/* Availability model */}
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: '#737373' }}>Availability</label>
          <select
            value={availabilityModel}
            onChange={(e) => setAvailabilityModel(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm w-36 outline-none"
            style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', color: '#fff' }}
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* QR toggle */}
        <div className="flex flex-col gap-1 justify-end">
          <label className="text-xs" style={{ color: '#737373' }}>QR Enabled</label>
          <label className="flex items-center gap-2 cursor-pointer py-2">
            <div
              onClick={() => setQrEnabled((v) => !v)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ backgroundColor: qrEnabled ? '#f59e0b' : '#2a2a2a' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                style={{
                  backgroundColor: '#fff',
                  transform: qrEnabled ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </div>
            <span className="text-sm" style={{ color: qrEnabled ? '#f59e0b' : '#737373' }}>
              {qrEnabled ? 'On' : 'Off'}
            </span>
          </label>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-4 py-2 rounded-lg text-sm font-semibold self-end transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#2a2a2a', color: '#9ca3af', border: '1px solid #3a3a3a' }}
          >
            Clear all
          </button>
        )}
      </form>

      {/* Active search query indicator */}
      {searchQ && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs" style={{ color: '#737373' }}>Searching for:</span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
          >
            &ldquo;{searchQ}&rdquo;
          </span>
        </div>
      )}

      {/* Results header */}
      <p className="text-sm mb-3" style={{ color: '#737373' }}>
        {loading ? 'Loading...' : `${total} listing${total !== 1 ? 's' : ''} found`}
      </p>

      {/* Two-panel layout */}
      <div className="flex gap-4" style={{ minHeight: '70vh' }}>
        {/* Left: listing cards */}
        <div className="w-full lg:w-2/5 overflow-y-auto" style={{ maxHeight: '80vh' }}>
          {!loading && listings.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                {listings.map((listing) => (
                  <div key={listing.id} id={`listing-${listing.id}`}
                    onClick={() => setHighlightedId(listing.id)}
                    style={{ outline: highlightedId === listing.id ? '2px solid #f59e0b' : 'none', borderRadius: 12 }}
                  >
                    <ListingCard listing={listing} />
                  </div>
                ))}
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>

              {/* Load more */}
              {!loading && page < totalPages && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-2 rounded-lg text-sm font-medium border transition-colors hover:border-amber-500 hover:text-amber-400"
                    style={{ borderColor: '#2a2a2a', color: '#a3a3a3' }}
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Google Maps */}
        <div
          className="hidden lg:block flex-1 rounded-xl border overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a', minHeight: '60vh' }}
        >
          <ListingsMap
            listings={listings}
            highlightedId={highlightedId}
            onMarkerClick={(id) => {
              setHighlightedId(id)
              // Scroll the matching listing card into view
              document.getElementById(`listing-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl mb-4">&#128269;</span>
      <p className="text-lg font-semibold mb-1" style={{ color: '#ffffff' }}>No listings found</p>
      <p className="text-sm" style={{ color: '#737373' }}>
        Try adjusting your filters or search for a different city or category.
      </p>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl border animate-pulse overflow-hidden"
      style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      <div className="h-44" style={{ backgroundColor: '#2a2a2a' }} />
      <div className="p-3 space-y-2">
        <div className="h-3 w-20 rounded" style={{ backgroundColor: '#2a2a2a' }} />
        <div className="h-4 w-full rounded" style={{ backgroundColor: '#2a2a2a' }} />
        <div className="h-3 w-28 rounded" style={{ backgroundColor: '#2a2a2a' }} />
        <div className="h-4 w-16 rounded mt-2" style={{ backgroundColor: '#2a2a2a' }} />
      </div>
    </div>
  )
}


export default function BrowsePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BrowseContent />
    </Suspense>
  )
}
