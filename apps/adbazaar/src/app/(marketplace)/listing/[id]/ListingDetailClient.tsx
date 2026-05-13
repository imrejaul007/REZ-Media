'use client'

import { useEffect, useState, MouseEvent } from 'react'
import Image from '@/components/ui/Image'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Listing, User, Review } from '@/types'
import { LISTING_CATEGORIES, DEFAULT_COINS_PER_SCAN, DEFAULT_VISIT_BONUS_COINS } from '@/lib/constants'
import ListingCard from '@/components/listing/ListingCard'
import AvailabilityCalendar from '@/components/listing/AvailabilityCalendar'
import { track } from '@/services/intentCaptureService'

interface ListingDetailResponse {
  listing: Listing
  vendor: Pick<User, 'id' | 'name' | 'verified' | 'city' | 'created_at'>
}

const AVAILABILITY_LABELS: Record<string, string> = {
  calendar: 'Calendar Booking',
  slot: 'Slot Booking',
  always_on: 'Always Available',
}

const PRICING_LABELS: Record<string, string> = {
  fixed: 'Fixed Price',
  quote: 'Quote Based',
  both: 'Fixed + Quote',
}

export default function ListingDetailClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<ListingDetailResponse | null>(null)
  const [related, setRelated] = useState<Listing[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null)
  const [selectedTo, setSelectedTo] = useState<string | null>(null)
  const [selectedNights, setSelectedNights] = useState<number>(0)
  const [selectedSlotCount, setSelectedSlotCount] = useState<number>(0)

  useEffect(() => {
    if (!id) return

    // Increment view count — fire and forget
    fetch(`/api/listings/${id}/view`, { method: 'POST' }).catch(() => {})

    async function loadData() {
      setLoading(true)
      try {
        const res = await fetch(`/api/listings/${id}`)
        if (!res.ok) throw new Error('Not found')
        const json: ListingDetailResponse = await res.json()
        setData(json)

        // ReZ Mind intent capture — listing viewed
        try {
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          )
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            track({
              userId: user.id,
              event: 'listing_viewed',
              appType: 'AdBazaar',
              intentKey: `listing:${json.listing.id}`,
              properties: {
                listingId: json.listing.id,
                category: json.listing.category,
                city: json.listing.city,
                price: json.listing.price,
              },
            })
          }
        } catch {
          // Intent capture must never break UX
        }

        // Fetch reviews
        const revRes = await fetch(`/api/listings/${json.listing.id}/reviews?limit=10`)
        if (revRes.ok) {
          const revData = await revRes.json()
          setReviews(revData.reviews ?? [])
        }

        // Fetch related listings
        const relParams = new URLSearchParams({
          category: json.listing.category,
          city: json.listing.city,
          limit: '3',
        })
        const relRes = await fetch(`/api/listings?${relParams.toString()}`)
        if (relRes.ok) {
          const relData = await relRes.json()
          setRelated(relData.listings.filter((l: Listing) => l.id !== id).slice(0, 3))
        }
      } catch {
        router.push('/browse')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, router])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p style={{ color: '#737373' }}>Loading listing...</p>
        </div>
      </div>
    )
  }

  const { listing, vendor } = data
  const categoryLabel = LISTING_CATEGORIES[listing.category]?.label ?? listing.category
  const isQuote = listing.pricing_model === 'quote'
  const specs = listing.specs as Record<string, unknown>

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="text-xs mb-4 flex items-center gap-1" style={{ color: '#737373' }}>
        <Link href="/browse" className="hover:text-white">Browse</Link>
        <span>/</span>
        <Link href={`/browse?category=${listing.category}`} className="hover:text-white">{categoryLabel}</Link>
        <span>/</span>
        <span style={{ color: '#a3a3a3' }}>{listing.title}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN */}
        <div className="flex-1 min-w-0">
          {/* Image gallery */}
          <ImageGallery
            images={listing.images}
            title={listing.title}
            lightboxSrc={lightboxSrc}
            setLightboxSrc={setLightboxSrc}
            activeImg={activeImg}
            setActiveImg={setActiveImg}
          />

          {/* Title + meta */}
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={listing.category} label={categoryLabel} />
              {listing.is_featured && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}>
                  Featured
                </span>
              )}
              {listing.qr_enabled && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#064e3b', color: '#6ee7b7' }}>
                  QR &#10003;
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>{listing.title}</h1>
            <p className="text-sm flex items-center gap-1" style={{ color: '#737373' }}>
              &#128205; {listing.area ? `${listing.area}, ` : ''}{listing.city}
              {listing.address && <span className="ml-1">— {listing.address}</span>}
            </p>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mt-5">
              <h2 className="text-base font-semibold mb-2" style={{ color: '#ffffff' }}>About this space</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#a3a3a3' }}>
                {listing.description}
              </p>
            </div>
          )}

          {/* Specs */}
          {Object.keys(specs).length > 0 && (
            <div className="mt-5">
              <h2 className="text-base font-semibold mb-3" style={{ color: '#ffffff' }}>Specifications</h2>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl border"
                style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                {Object.entries(specs).map(([key, value]) => (
                  value != null && (
                    <div key={key}>
                      <p className="text-xs capitalize" style={{ color: '#737373' }}>
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-medium mt-0.5" style={{ color: '#ffffff' }}>
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </p>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="mt-8">
            <h2 className="text-base font-semibold mb-3" style={{ color: '#ffffff' }}>
              Reviews {reviews.length > 0 && <span style={{ color: '#737373' }}>({reviews.length})</span>}
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm" style={{ color: '#737373' }}>No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (sticky) */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-28 space-y-4">
            {/* Price card */}
            <div
              className="rounded-xl border p-5 space-y-4"
              style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
            >
              <div>
                {isQuote ? (
                  <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>Quote Based</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                      &#8377;{(listing.price ?? 0).toLocaleString('en-IN')}
                    </p>
                    {listing.duration_unit && (
                      <p className="text-xs mt-0.5 capitalize" style={{ color: '#737373' }}>
                        {listing.duration_unit.replace(/_/g, ' ')}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Availability badge */}
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-1 rounded-full border"
                  style={{ borderColor: '#2a2a2a', color: '#a3a3a3' }}
                >
                  {AVAILABILITY_LABELS[listing.availability_model] ?? listing.availability_model}
                </span>
                <span
                  className="text-xs px-2 py-1 rounded-full border"
                  style={{ borderColor: '#2a2a2a', color: '#a3a3a3' }}
                >
                  {PRICING_LABELS[listing.pricing_model] ?? listing.pricing_model}
                </span>
              </div>

              {/* Availability calendar */}
              {!isQuote && (
                <div
                  className="rounded-xl p-4"
                  style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
                    Availability
                  </p>
                  <AvailabilityCalendar
                    listingId={listing.id}
                    onRangeSelect={(from, to, nights) => {
                      setSelectedFrom(from)
                      setSelectedTo(to)
                      setSelectedNights(nights)
                    }}
                    onSlotSelect={(slots) => {
                      setSelectedSlotCount(slots.length)
                    }}
                  />
                </div>
              )}

              {/* CTA */}
              {isQuote ? (
                <Link
                  href={`/buyer/inquire?listing=${listing.id}`}
                  className="block w-full text-center py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#1a1a1a', border: '2px solid #f59e0b', color: '#f59e0b' }}
                >
                  Send Inquiry
                </Link>
              ) : listing.availability_model === 'calendar' ? (
                selectedFrom && selectedTo ? (
                  <Link
                    href={`/buyer/cart?listing=${listing.id}&from=${selectedFrom}&to=${selectedTo}`}
                    className="block w-full text-center py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    Book {selectedNights} day{selectedNights !== 1 ? 's' : ''} →
                  </Link>
                ) : (
                  <button
                    disabled
                    className="block w-full text-center py-3 rounded-lg font-semibold text-sm opacity-40 cursor-not-allowed"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    Select dates to book
                  </button>
                )
              ) : listing.availability_model === 'slot' ? (
                selectedSlotCount > 0 ? (
                  <Link
                    href={`/buyer/cart?listing=${listing.id}&slots=${selectedSlotCount}`}
                    className="block w-full text-center py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    Book {selectedSlotCount} slot{selectedSlotCount !== 1 ? 's' : ''} →
                  </Link>
                ) : (
                  <button
                    disabled
                    className="block w-full text-center py-3 rounded-lg font-semibold text-sm opacity-40 cursor-not-allowed"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    Select slots to book
                  </button>
                )
              ) : (
                <Link
                  href={`/buyer/cart?listing=${listing.id}`}
                  className="block w-full text-center py-3 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                >
                  Book Now
                </Link>
              )}

              {listing.bulk_discount_pct > 0 && (
                <p className="text-xs text-center" style={{ color: '#737373' }}>
                  {listing.bulk_discount_pct}% bulk discount available
                </p>
              )}
            </div>

            {/* Vendor info */}
            <Link
              href={`/vendor/${vendor.id}`}
              className="block rounded-xl border p-4 space-y-2 transition-colors hover:border-amber-500/40"
              style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#737373' }}>Vendor</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                  style={{ backgroundColor: '#2a2a2a', color: '#f59e0b' }}
                >
                  {vendor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium flex items-center gap-1" style={{ color: '#ffffff' }}>
                    {vendor.name}
                    {vendor.verified && (
                      <span className="text-xs" style={{ color: '#3b82f6' }} title="Verified">&#10003;</span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: '#737373' }}>
                    {vendor.city} &bull; Since {new Date(vendor.created_at).getFullYear()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#f59e0b' }}>View all listings &rarr;</p>
                </div>
              </div>
            </Link>

            {/* QR Integration card */}
            {listing.qr_enabled && (
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#737373' }}>
                    QR Integration
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: '#1c1400', color: '#f59e0b', border: '1px solid #78350f' }}
                  >
                    REZ Exclusive
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs" style={{ color: '#737373' }}>Coins / Scan</p>
                    <p className="font-semibold" style={{ color: '#f59e0b' }}>
                      &#9734; {DEFAULT_COINS_PER_SCAN}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#737373' }}>Visit Bonus</p>
                    <p className="font-semibold" style={{ color: '#f59e0b' }}>
                      &#9734; {DEFAULT_VISIT_BONUS_COINS}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#737373' }}>
                  Customers earn REZ coins when they scan the QR code at this location, driving foot traffic and measurable attribution.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related listings */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#ffffff' }}>
            Similar listings in {listing.city}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setLightboxSrc(null)}
        >
            <Image
            src={lightboxSrc}
            alt="Full size"
            width={1200}
            height={800}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-6 text-2xl font-bold"
            style={{ color: '#ffffff' }}
            onClick={() => setLightboxSrc(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}

// --- Sub-components ---

function ImageGallery({
  images,
  title,
  lightboxSrc,
  setLightboxSrc,
  activeImg,
  setActiveImg,
}: {
  images: string[]
  title: string
  lightboxSrc: string | null
  setLightboxSrc: (s: string | null) => void
  activeImg: number
  setActiveImg: (n: number) => void
}) {
  if (!images || images.length === 0) {
    return (
      <div
        className="h-64 rounded-xl flex items-center justify-center text-5xl"
        style={{ backgroundColor: '#1a1a1a', color: '#2a2a2a' }}
      >
        &#128247;
      </div>
    )
  }

  return (
    <div>
      {/* Main image */}
      <div
        className="relative h-72 sm:h-96 rounded-xl overflow-hidden cursor-zoom-in"
        onClick={() => setLightboxSrc(images[activeImg])}
      >
        <Image
          src={images[activeImg]}
          alt={title}
          width={768}
          height={384}
          className="object-cover"
        />
        <div
          className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff' }}
        >
          Click to enlarge
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveImg(i)}
              className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all"
              style={{
                borderColor: i === activeImg ? '#f59e0b' : '#2a2a2a',
              }}
            >
              <Image src={src} alt="" width={64} height={64} className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBadge({ category, label }: { category: string; label: string }) {
  const COLOR_MAP: Record<string, { bg: string; text: string }> = {
    outdoor_ooh:            { bg: '#78350f', text: '#fde68a' },
    transit_infrastructure: { bg: '#1e3a5f', text: '#bfdbfe' },
    property_spaces:        { bg: '#3b0764', text: '#e9d5ff' },
    local_business:         { bg: '#14532d', text: '#bbf7d0' },
    print_broadcast:        { bg: '#7f1d1d', text: '#fecaca' },
    influencer:             { bg: '#500724', text: '#fbcfe8' },
    digital:                { bg: '#083344', text: '#a5f3fc' },
    unconventional:         { bg: '#431407', text: '#fed7aa' },
  }
  const style = COLOR_MAP[category] ?? { bg: '#1a1a1a', text: '#a3a3a3' }
  return (
    <span
      className="inline-block text-xs font-medium px-3 py-1 rounded-full"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {label}
    </span>
  )
}

function ReviewCard({ review }: { review: Review & { reviewerName?: string } }) {
  const stars = review.rating ?? 0
  return (
    <div
      className="p-4 rounded-xl border"
      style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={{ color: n <= stars ? '#f59e0b' : '#2a2a2a' }}>&#9733;</span>
            ))}
          </div>
          {review.reviewerName && (
            <span className="text-xs font-medium" style={{ color: '#d1d5db' }}>
              {review.reviewerName}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: '#737373' }}>
          {new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        </span>
      </div>
      {review.comment && (
        <p className="text-sm" style={{ color: '#a3a3a3' }}>{review.comment}</p>
      )}
    </div>
  )
}
