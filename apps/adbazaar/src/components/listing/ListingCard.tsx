import Link from 'next/link'
import { Listing, ListingCategory } from '@/types'
import Image from '@/components/ui/Image'

const CATEGORY_BADGE_COLORS: Record<ListingCategory, { bg: string; text: string }> = {
  [ListingCategory.OutdoorOOH]:            { bg: '#78350f', text: '#fde68a' },
  [ListingCategory.TransitInfrastructure]: { bg: '#1e3a5f', text: '#bfdbfe' },
  [ListingCategory.PropertySpaces]:        { bg: '#3b0764', text: '#e9d5ff' },
  [ListingCategory.LocalBusiness]:         { bg: '#14532d', text: '#bbf7d0' },
  [ListingCategory.PrintBroadcast]:        { bg: '#7f1d1d', text: '#fecaca' },
  [ListingCategory.Influencer]:            { bg: '#500724', text: '#fbcfe8' },
  [ListingCategory.Digital]:               { bg: '#083344', text: '#a5f3fc' },
  [ListingCategory.Unconventional]:        { bg: '#431407', text: '#fed7aa' },
}

const CATEGORY_LABELS: Record<ListingCategory, string> = {
  [ListingCategory.OutdoorOOH]:            'Outdoor & OOH',
  [ListingCategory.TransitInfrastructure]: 'Transit & Infra',
  [ListingCategory.PropertySpaces]:        'Property & Spaces',
  [ListingCategory.LocalBusiness]:         'Local Business',
  [ListingCategory.PrintBroadcast]:        'Print & Broadcast',
  [ListingCategory.Influencer]:            'Influencer',
  [ListingCategory.Digital]:               'Digital',
  [ListingCategory.Unconventional]:        'Unconventional',
}

interface ListingCardProps {
  listing: Listing
}

export default function ListingCard({ listing }: ListingCardProps) {
  const badgeStyle = CATEGORY_BADGE_COLORS[listing.category] ?? { bg: '#1a1a1a', text: '#a3a3a3' }
  const label = CATEGORY_LABELS[listing.category] ?? listing.category

  // AB2-L2 FIX: warn on unknown categories so they can be added to the enum
  // Note: console.warn used here intentionally — this is a dev-time signal for the team
  // to add missing categories, not a production runtime issue.
  if (!CATEGORY_BADGE_COLORS[listing.category] && process.env.NODE_ENV === 'development') {
     
    console.warn(`[ListingCard] Unknown category: "${listing.category}" — add to ListingCategory enum`)
  }

  const firstImage = listing.images?.[0]
  const displayPrice =
    listing.pricing_model === 'quote'
      ? 'Quote Based'
      : listing.price
      ? `₹${listing.price.toLocaleString('en-IN')}${listing.duration_unit ? ' / ' + listing.duration_unit.replace(/_/g, ' ') : ''}`
      : '—'

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="block rounded-xl overflow-hidden border transition-all hover:border-amber-500/50 hover:-translate-y-0.5 hover:shadow-lg group"
      style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden" style={{ backgroundColor: '#0f0f0f' }}>
        {firstImage ? (
          <Image
            src={firstImage}
            alt={listing.title}
            width={400}
            height={176}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" style={{ color: '#2a2a2a' }}>
            &#128247;
          </div>
        )}

        {/* Featured badge */}
        {listing.is_featured && (
          <span
            className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
          >
            Featured
          </span>
        )}

        {/* QR badge */}
        {listing.qr_enabled && (
          <span
            className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#064e3b', color: '#6ee7b7' }}
          >
            QR &#10003;
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Category badge */}
        <span
          className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
        >
          {label}
        </span>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: '#ffffff' }}>
          {listing.title}
        </h3>

        {/* Location */}
        <p className="text-xs" style={{ color: '#737373' }}>
          &#128205; {listing.area ? `${listing.area}, ` : ''}{listing.city}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>
            {displayPrice}
          </span>
          <div className="flex items-center gap-2 text-xs" style={{ color: '#737373' }}>
            {listing.booking_count > 0 && <span>{listing.booking_count} booked</span>}
            <span>&#128065; {listing.view_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
