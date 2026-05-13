export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ListingActions } from './ListingActions'
import { requireAdmin } from '@/lib/adminAuth'

type FilterTab = 'all' | 'draft' | 'active' | 'rejected'

async function getAllListings() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      category,
      city,
      status,
      price,
      pricing_model,
      created_at,
      vendor_id,
      users!vendor_id(name)
    `)
    .order('created_at', { ascending: false })

  return data ?? []
}

function formatINR(amount: number | null) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  draft: 'warning',
  active: 'success',
  rejected: 'error',
  paused: 'default',
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireAdmin()
  const { filter } = await searchParams
  const activeFilter: FilterTab = (filter as FilterTab) ?? 'all'

  let listings: Awaited<ReturnType<typeof getAllListings>>
  try {
    listings = await getAllListings()
  } catch (err) {
    void err
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        Failed to load data. Please refresh the page.
      </div>
    )
  }

  const counts = {
    all: listings.length,
    draft: listings.filter(l => l.status === 'draft').length,
    active: listings.filter(l => l.status === 'active').length,
    rejected: listings.filter(l => l.status === 'rejected').length,
  }

  const filtered = activeFilter === 'all'
    ? listings
    : listings.filter(l => l.status === activeFilter)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Pending' },
    { key: 'active', label: 'Active' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Listings</h1>
        <p className="text-gray-500 text-sm mt-1">All listings on the platform</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <a
            key={tab.key}
            href={`/admin/listings?filter=${tab.key}`}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeFilter === tab.key ? '#f59e0b' : '#1a1a1a',
              color: activeFilter === tab.key ? '#0f0f0f' : '#9ca3af',
              border: '1px solid #2a2a2a',
            }}
          >
            {tab.label} ({counts[tab.key]})
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-gray-500">No listings found.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                {['Title', 'Vendor', 'Category', 'City', 'Status', 'Price', 'Created', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#6b7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing: Record<string, unknown>) => (
                <tr
                  key={listing.id as string}
                  className="hover:bg-white/[0.02] transition-colors"
                  style={{ borderBottom: '1px solid #1f1f1f' }}
                >
                  <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                    {listing.title as string}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {(Array.isArray(listing.users)
                      ? (listing.users[0] as { name: string })?.name
                      : (listing.users as { name: string } | null)?.name) ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default">
                      {(listing.category as string).replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{listing.city as string}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[listing.status as string] ?? 'default'}>
                      {listing.status as string}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-amber-400">
                    {listing.pricing_model === 'quote'
                      ? 'Quote'
                      : formatINR(listing.price as number | null)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(listing.created_at as string)}
                  </td>
                  <td className="px-4 py-3">
                    <ListingActions
                      listingId={listing.id as string}
                      currentStatus={listing.status as string}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
