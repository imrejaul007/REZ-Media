export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ReviewActions } from './ReviewActions'
import { DisputeActions } from './DisputeActions'
import { BookingStatus } from '@/types'
import { requireAdmin } from '@/lib/adminAuth'

async function getPlatformStats() {
  const supabase = createServerClient()

  const [
    { count: totalListings },
    { count: pendingListings },
    { count: activeBookings },
    { data: bookings },
    { count: totalScans },
    { count: totalAttributions },
  ] = await Promise.all([
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .in('status', [BookingStatus.Confirmed, BookingStatus.Executing]),
    supabase.from('bookings').select('amount').in('status', [
      BookingStatus.Paid,
      BookingStatus.Executing,
      BookingStatus.Completed,
    ]),
    supabase.from('scan_events').select('*', { count: 'exact', head: true }),
    supabase.from('attribution').select('*', { count: 'exact', head: true }),
  ])

  const totalGMV = (bookings ?? []).reduce((sum: number, b: { amount: number }) => sum + (b.amount ?? 0), 0)

  return {
    totalListings: totalListings ?? 0,
    pendingListings: pendingListings ?? 0,
    activeBookings: activeBookings ?? 0,
    totalGMV,
    totalScans: totalScans ?? 0,
    totalAttributions: totalAttributions ?? 0,
  }
}

async function getPendingListings() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('listings')
    .select(`
      id,
      title,
      category,
      city,
      created_at,
      vendor_id,
      users!vendor_id(name)
    `)
    .eq('status', 'draft')
    .order('created_at', { ascending: true })
    .limit(20)

  return data ?? []
}

async function getRecentBookings() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('bookings')
    .select(`
      id,
      amount,
      status,
      created_at,
      listings(title),
      users!buyer_id(name)
    `)
    .order('created_at', { ascending: false })
    .limit(10)

  return data ?? []
}

async function getDisputedBookings() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('bookings')
    .select(`
      id,
      amount,
      notes,
      created_at,
      updated_at,
      listings(title, city, vendor_id),
      users!bookings_buyer_id_fkey(name),
      vendor:users!bookings_vendor_id_fkey(name)
    `)
    .eq('status', BookingStatus.Disputed)
    .order('updated_at', { ascending: false })

  return data ?? []
}

function formatINR(amount: number) {
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

const bookingStatusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  inquiry: 'default',
  quoted: 'info',
  confirmed: 'info',
  paid: 'success',
  executing: 'warning',
  completed: 'success',
  disputed: 'error',
  cancelled: 'error',
}

export default async function AdminDashboardPage() {
  await requireAdmin()
  const [stats, pendingListings, recentBookings, disputedBookings] = await Promise.all([
    getPlatformStats(),
    getPendingListings(),
    getRecentBookings(),
    getDisputedBookings(),
  ])

  const statCards = [
    { label: 'Total Listings', value: stats.totalListings.toLocaleString('en-IN') },
    { label: 'Pending Review', value: stats.pendingListings.toLocaleString('en-IN'), highlight: true },
    { label: 'Active Bookings', value: stats.activeBookings.toLocaleString('en-IN') },
    { label: 'Total GMV', value: formatINR(stats.totalGMV) },
    { label: 'Total QR Scans', value: stats.totalScans.toLocaleString('en-IN') },
    { label: 'Total Attributions', value: stats.totalAttributions.toLocaleString('en-IN') },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform overview and moderation queue</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
        {statCards.map(({ label, value, highlight }) => (
          <div
            key={label}
            className={`bg-[#1a1a1a] border rounded-xl p-4 ${
              highlight ? 'border-amber-500/40' : 'border-[#2a2a2a]'
            }`}
          >
            <div className={`text-2xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
              {value}
            </div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Pending Review Queue */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-white mb-4">
          Listings Pending Review
          {stats.pendingListings > 0 && (
            <span className="ml-2 text-sm font-normal text-amber-400">
              ({stats.pendingListings})
            </span>
          )}
        </h2>

        {pendingListings.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center text-gray-500">
            No listings pending review.
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">City</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Submitted</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingListings.map((listing: {
                  id: string
                  title: string
                  category: string
                  city: string
                  created_at: string
                  users?: { name: string } | { name: string }[] | null
                }) => (
                  <tr key={listing.id} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                      {listing.title}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(Array.isArray(listing.users) ? listing.users[0]?.name : (listing.users as { name: string } | null)?.name) ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="default">{listing.category.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{listing.city}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(listing.created_at)}</td>
                    <td className="px-4 py-3">
                      <ReviewActions listingId={listing.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disputes */}
      {disputedBookings.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#f87171' }}>
            Disputes ({disputedBookings.length})
          </h2>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden" style={{ border: '1px solid #7f1d1d' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Listing</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Buyer</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Vendor</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Raised</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {disputedBookings.map((b: Record<string, unknown>) => (
                  <tr key={b.id as string} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3 text-white max-w-[180px] truncate">
                      {(b.listings as { title: string } | null)?.title ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(b.users as { name: string } | null)?.name ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(b.vendor as { name: string } | null)?.name ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-medium">{formatINR(b.amount as number)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(b.updated_at as string)}</td>
                    <td className="px-4 py-3">
                      <DisputeActions bookingId={b.id as string} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Bookings</h2>

        {recentBookings.length === 0 ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center text-gray-500">
            No bookings yet.
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Listing</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Buyer</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((booking: Record<string, unknown>) => (
                  <tr key={booking.id as string} className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#1f1f1f]">
                    <td className="px-4 py-3 text-white max-w-[200px] truncate">
                      {((booking.listings as Record<string, unknown> | null)?.title as string) ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {((booking.users as Record<string, unknown> | null)?.name as string) ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-medium">
                      {formatINR(booking.amount as number)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={bookingStatusVariant[booking.status as string] ?? 'default'}>
                        {booking.status as string}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(booking.created_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
