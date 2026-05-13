export const dynamic = 'force-dynamic'

import { createServerClient } from '@/lib/supabase'

async function getQRScanStats() {
  const supabase = createServerClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { data: recentScans },
    { count: totalScans },
    { count: scansToday },
    { count: conversions },
  ] = await Promise.all([
    supabase
      .from('scan_events')
      .select(`
        id,
        timestamp,
        coins_amount,
        user_id,
        rez_app_opened,
        rez_coins_credited,
        qr_codes(qr_slug, listing_id, listings(title))
      `)
      .order('timestamp', { ascending: false })
      .limit(100),
    supabase.from('scan_events').select('*', { count: 'exact', head: true }),
    supabase
      .from('scan_events')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', todayStart.toISOString()),
    supabase
      .from('scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('rez_app_opened', true),
  ])

  const conversionRate =
    totalScans && totalScans > 0
      ? Math.round(((conversions ?? 0) / totalScans) * 100)
      : 0

  return {
    recentScans: recentScans ?? [],
    totalScans: totalScans ?? 0,
    scansToday: scansToday ?? 0,
    conversionRate,
  }
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminQRScansPage() {
  let qrStats: Awaited<ReturnType<typeof getQRScanStats>>
  try {
    qrStats = await getQRScanStats()
  } catch (err) {
    void err
    return (
      <div className="p-8 text-center text-red-400 text-sm">
        Failed to load data. Please refresh the page.
      </div>
    )
  }
  const { recentScans, totalScans, scansToday, conversionRate } = qrStats

  const statCards = [
    { label: 'Total Scans Today', value: scansToday.toLocaleString('en-IN'), highlight: true },
    { label: 'Total Scans (All Time)', value: totalScans.toLocaleString('en-IN') },
    { label: 'Conversion Rate (REZ Opened)', value: `${conversionRate}%` },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">QR Scans</h1>
        <p className="text-gray-500 text-sm mt-1">Recent scan events and attribution data</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map(({ label, value, highlight }) => (
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

      {/* Scan events table */}
      {recentScans.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-gray-500">No scan events recorded yet.</p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                {['Time', 'QR Slug', 'Listing', 'Coins Earned', 'REZ User ID', 'Converted'].map(h => (
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
              {recentScans.map((scan: Record<string, unknown>) => {
                const qrCode = scan.qr_codes as Record<string, unknown> | null
                const listing = qrCode?.listings as Record<string, unknown> | null
                const converted = scan.rez_app_opened as boolean
                return (
                  <tr
                    key={scan.id as string}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: '1px solid #1f1f1f' }}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDateTime(scan.timestamp as string)}
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                      {(qrCode?.qr_slug as string | null) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-white max-w-[200px] truncate">
                      {(listing?.title as string | null) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 font-medium">
                      {scan.coins_amount as number}
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {(scan.user_id as string | null)?.slice(0, 12) ?? 'Guest'}
                    </td>
                    <td className="px-4 py-3">
                      {converted ? (
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: '#22c55e11', color: '#4ade80', border: '1px solid #22c55e33' }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: '#6b7280' }}>No</span>
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
