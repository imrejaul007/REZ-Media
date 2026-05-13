export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'
import { BookingStatus } from '@/types'

async function getPlatformStats() {
  const supabase = createServerClient()

  const [
    { data: bookingAmounts },
    { data: bookingsByStatus },
    { data: listingsByStatus },
    { count: totalScans },
    { count: totalAttributions },
    { count: totalQRCodes },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('amount, status')
      .in('status', [BookingStatus.Paid, BookingStatus.Executing, BookingStatus.Completed]),
    supabase.from('bookings').select('status'),
    supabase.from('listings').select('status'),
    supabase.from('scan_events').select('*', { count: 'exact', head: true }),
    supabase.from('attribution').select('*', { count: 'exact', head: true }),
    supabase.from('qr_codes').select('*', { count: 'exact', head: true }),
  ])

  const totalRevenue = (bookingAmounts ?? []).reduce(
    (sum: number, b: { amount: number }) => sum + (b.amount ?? 0),
    0
  )

  const bookingCounts: Record<string, number> = {}
  for (const status of Object.values(BookingStatus)) {
    bookingCounts[status] = (bookingsByStatus ?? []).filter(
      (b: { status: string }) => b.status === status
    ).length
  }

  const listingCounts: Record<string, number> = {}
  for (const status of ['draft', 'active', 'paused', 'rejected']) {
    listingCounts[status] = (listingsByStatus ?? []).filter(
      (l: { status: string }) => l.status === status
    ).length
  }

  return {
    totalRevenue,
    bookingCounts,
    listingCounts,
    totalScans: totalScans ?? 0,
    totalAttributions: totalAttributions ?? 0,
    totalQRCodes: totalQRCodes ?? 0,
  }
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function AdminStatsPage() {
  let stats: Awaited<ReturnType<typeof getPlatformStats>>
  try {
    stats = await getPlatformStats()
  } catch (err) {
    void err
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        Failed to load data. Please refresh the page.
      </div>
    )
  }

  const topStatCards = [
    { label: 'Total Revenue (GMV)', value: formatINR(stats.totalRevenue), highlight: true },
    { label: 'Total QR Scans', value: stats.totalScans.toLocaleString('en-IN') },
    { label: 'Total Attributions', value: stats.totalAttributions.toLocaleString('en-IN') },
    { label: 'Total QR Codes Generated', value: stats.totalQRCodes.toLocaleString('en-IN') },
  ]

  const bookingRows = [
    { status: 'inquiry', label: 'Inquiry' },
    { status: 'quoted', label: 'Quoted' },
    { status: 'confirmed', label: 'Confirmed' },
    { status: 'paid', label: 'Paid' },
    { status: 'executing', label: 'Executing' },
    { status: 'completed', label: 'Completed' },
    { status: 'disputed', label: 'Disputed' },
    { status: 'cancelled', label: 'Cancelled' },
  ]

  const listingRows = [
    { status: 'draft', label: 'Pending Review' },
    { status: 'active', label: 'Active' },
    { status: 'paused', label: 'Paused' },
    { status: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Stats</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide metrics and breakdowns</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {topStatCards.map(({ label, value, highlight }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{
              backgroundColor: '#1a1a1a',
              border: highlight ? '1px solid rgba(245,158,11,0.4)' : '1px solid #2a2a2a',
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: highlight ? '#f59e0b' : '#ffffff' }}
            >
              {value}
            </div>
            <div className="text-xs mt-1" style={{ color: '#6b7280' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Bookings by status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
            <h2 className="text-sm font-semibold text-white">Bookings by Status</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {bookingRows.map(({ status, label }) => (
                <tr
                  key={status}
                  style={{ borderBottom: '1px solid #1f1f1f' }}
                >
                  <td className="px-4 py-2.5 text-gray-300">{label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-white">
                    {(stats.bookingCounts[status] ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Listings by status */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
            <h2 className="text-sm font-semibold text-white">Listings by Status</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {listingRows.map(({ status, label }) => (
                <tr
                  key={status}
                  style={{ borderBottom: '1px solid #1f1f1f' }}
                >
                  <td className="px-4 py-2.5 text-gray-300">{label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-white">
                    {(stats.listingCounts[status] ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
