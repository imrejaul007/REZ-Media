'use client'

import { useState, useEffect } from 'react'

interface ScanEvent {
  id: string
  created_at: string
  device_type: string
  location_lat: number | null
  location_lng: number | null
}

interface QRAnalyticsProps {
  qrId: string
  campaignId?: string
}

export default function QRAnalytics({ qrId, campaignId }: QRAnalyticsProps) {
  const [analytics, setAnalytics] = useState<{
    totalScans: number
    uniqueScans: number
    todayScans: number
    timeline: { date: string; count: number }[]
    deviceBreakdown: { device: string; count: number; percentage: number }[]
    topLocations: { location: string; count: number }[]
  }>({
    totalScans: 0,
    uniqueScans: 0,
    todayScans: 0,
    timeline: [],
    deviceBreakdown: [],
    topLocations: []
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [events, setEvents] = useState<ScanEvent[]>([])

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/analytics/qr/${qrId}?range=${timeRange}`)
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [qrId, timeRange])

  useEffect(() => {
    async function fetchRecentEvents() {
      try {
        const res = await fetch(`/api/analytics/qr/${qrId}/events?limit=50`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events || [])
        }
      } catch (error) {
        console.error('Failed to fetch events:', error)
      }
    }

    fetchRecentEvents()
    const interval = setInterval(fetchRecentEvents, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [qrId])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Scans</p>
              <p className="text-3xl font-bold text-indigo-600">{analytics.totalScans.toLocaleString()}</p>
            </div>
            <div className="text-3xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unique Users</p>
              <p className="text-3xl font-bold text-green-600">{analytics.uniqueScans.toLocaleString()}</p>
            </div>
            <div className="text-3xl opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-3xl font-bold text-orange-600">{analytics.todayScans.toLocaleString()}</p>
            </div>
            <div className="text-3xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversion</p>
              <p className="text-3xl font-bold text-blue-600">
                {analytics.totalScans > 0
                  ? ((analytics.uniqueScans / analytics.totalScans) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <div className="text-3xl opacity-20">📈</div>
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan Timeline</h3>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-sm rounded ${
                  timeRange === range
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-48 flex items-end gap-1">
          {analytics.timeline.length > 0 ? (
            analytics.timeline.map((point, idx) => {
              const maxCount = Math.max(...analytics.timeline.map(p => p.count), 1)
              const height = (point.count / maxCount) * 100

              return (
                <div
                  key={idx}
                  className="flex-1 bg-indigo-500 rounded-t transition-all hover:bg-indigo-600 relative group"
                  style={{ height: `${Math.max(height, 4)}%` }}
                >
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {point.date}: {point.count}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              No data for this period
            </div>
          )}
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{analytics.timeline[0]?.date || 'Start'}</span>
          <span>{analytics.timeline[analytics.timeline.length - 1]?.date || 'End'}</span>
        </div>
      </div>

      {/* Device Breakdown & Locations */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Device Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Device Breakdown</h3>

          {analytics.deviceBreakdown.length > 0 ? (
            <div className="space-y-3">
              {analytics.deviceBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className="text-lg">
                        {item.device === 'mobile' && '📱'}
                        {item.device === 'tablet' && '📟'}
                        {item.device === 'desktop' && '💻'}
                        {item.device === 'unknown' && '❓'}
                      </span>
                      <span className="capitalize">{item.device}</span>
                    </span>
                    <span className="text-gray-500">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No device data available</p>
          )}
        </div>

        {/* Top Locations */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Top Locations</h3>

          {analytics.topLocations.length > 0 ? (
            <div className="space-y-2">
              {analytics.topLocations.slice(0, 5).map((loc, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📍</span>
                    <span className="text-sm">{loc.location || 'Unknown Location'}</span>
                  </div>
                  <span className="text-sm font-medium">{loc.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No location data available</p>
          )}
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Recent Scans</h3>

        {events.length > 0 ? (
          <div className="space-y-2">
            {events.slice(0, 10).map(event => (
              <div key={event.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {event.device_type === 'mobile' && '📱'}
                    {event.device_type === 'tablet' && '📟'}
                    {event.device_type === 'desktop' && '💻'}
                    {event.device_type === 'unknown' && '❓'}
                  </span>
                  <div>
                    <p className="text-sm capitalize">{event.device_type || 'Unknown Device'}</p>
                    {event.location_lat && event.location_lng && (
                      <p className="text-xs text-gray-400">
                        {event.location_lat.toFixed(4)}, {event.location_lng.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-400">{formatTime(event.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No recent scans</p>
        )}
      </div>
    </div>
  )
}
