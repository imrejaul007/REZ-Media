export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { BookingStatus } from '@/types'
import { DisputeResolver } from './DisputeResolver'
import { requireAdmin } from '@/lib/adminAuth'

type FilterTab = 'all' | BookingStatus

async function getAllBookings() {
  const supabase = createServerClient()

  const { data } = await supabase
    .from('bookings')
    .select(`
      id,
      amount,
      status,
      created_at,
      listings(title),
      users!bookings_buyer_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

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

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  inquiry:   { bg: '#ffffff11', color: '#9ca3af', border: '#ffffff22' },
  quoted:    { bg: '#3b82f611', color: '#60a5fa', border: '#3b82f633' },
  confirmed: { bg: '#22c55e11', color: '#4ade80', border: '#22c55e33' },
  paid:      { bg: '#f59e0b11', color: '#f59e0b', border: '#f59e0b33' },
  executing: { bg: '#a855f711', color: '#c084fc', border: '#a855f733' },
  completed: { bg: '#22c55e11', color: '#4ade80', border: '#22c55e33' },
  disputed:  { bg: '#ef444411', color: '#f87171', border: '#ef444433' },
  cancelled: { bg: '#ffffff11', color: '#6b7280', border: '#ffffff22' },
}

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: BookingStatus.Confirmed, label: 'Confirmed' },
  { key: BookingStatus.Disputed, label: 'Disputed' },
  { key: BookingStatus.Completed, label: 'Completed' },
  { key: BookingStatus.Cancelled, label: 'Cancelled' },
]

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await requireAdmin()
  const { filter } = await searchParams
  const activeFilter: FilterTab = (filter as FilterTab) ?? 'all'

  let bookings: Awaited<ReturnType<typeof getAllBookings>>
  try {
    bookings = await getAllBookings()
  } catch (err) {
    void err
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        Failed to load data. Please refresh the page.
      </div>
    )
  }

  const filtered = activeFilter === 'all'
    ? bookings
    : bookings.filter(b => b.status === activeFilter)

  const counts: Record<string, number> = { all: bookings.length }
  FILTER_TABS.forEach(tab => {
    if (tab.key !== 'all') {
      counts[tab.key] = bookings.filter(b => b.status === tab.key).length
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Bookings</h1>
        <p className="text-gray-500 text-sm mt-1">All bookings on the platform</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_TABS.map(tab => (
          <a
            key={tab.key}
            href={`/admin/bookings?filter=${tab.key}`}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: activeFilter === tab.key ? '#f59e0b' : '#1a1a1a',
              color: activeFilter === tab.key ? '#0f0f0f' : '#9ca3af',
              border: '1px solid #2a2a2a',
            }}
          >
            {tab.label} ({counts[tab.key] ?? 0})
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-gray-500">No bookings found.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                {['Booking ID', 'Listing', 'Buyer', 'Amount', 'Status', 'Created', ''].map(h => (
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
              {filtered.map((booking: Record<string, unknown>) => {
                const style = STATUS_STYLE[booking.status as string] ?? STATUS_STYLE.inquiry
                return (
                  <tr
                    key={booking.id as string}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: '1px solid #1f1f1f' }}
                  >
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {(booking.id as string).slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                      {((booking.listings as Record<string, unknown> | null)?.title as string) ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {(Array.isArray(booking.users)
                        ? (booking.users[0] as Record<string, unknown>)?.name as string
                        : (booking.users as Record<string, unknown> | null)?.name as string) ?? 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-medium">
                      {formatINR(booking.amount as number)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                      >
                        {booking.status as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(booking.created_at as string)}
                    </td>
                    <td className="px-4 py-3">
                      {booking.status === 'disputed' && (
                        <DisputeResolver bookingId={booking.id as string} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
