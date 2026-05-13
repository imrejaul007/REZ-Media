'use client'

import { useEffect, useState } from 'react'

interface AnalyticsData {
  impressions: {
    listings: number
    qrScans: number
    dooh: number
    inApp: number
    total: number
  }
  clicks: {
    listings: number
    inApp: number
    total: number
  }
  conversions: {
    qr: number
    listings: number
    total: number
  }
  timeline: Array<{
    date: string
    impressions: number
    earnings: number
  }>
}

export default function OwnerAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadAnalytics()
  }, [period])

  async function loadAnalytics() {
    try {
      setLoading(true)
      // Mock analytics data
      const mockAnalytics: AnalyticsData = {
        impressions: {
          listings: 156000,
          qrScans: 28500,
          dooh: 892000,
          inApp: 345000,
          total: 1421500,
        },
        clicks: {
          listings: 4200,
          inApp: 12300,
          total: 16500,
        },
        conversions: {
          qr: 3200,
          listings: 145,
          total: 3345,
        },
        timeline: [
          { date: 'Jan 19', impressions: 45000, earnings: 1200 },
          { date: 'Jan 20', impressions: 52000, earnings: 1450 },
          { date: 'Jan 21', impressions: 48000, earnings: 1380 },
          { date: 'Jan 22', impressions: 61000, earnings: 1680 },
          { date: 'Jan 23', impressions: 55000, earnings: 1520 },
          { date: 'Jan 24', impressions: 72000, earnings: 1980 },
          { date: 'Jan 25', impressions: 68000, earnings: 1850 },
        ]
      }
      setAnalytics(mockAnalytics)
    } finally {
      setLoading(false)
    }
  }

  const maxImpressions = analytics ? Math.max(...analytics.timeline.map(t => t.impressions)) : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Unified Analytics</h1>
          <p className="text-gray-400 text-sm">Cross-platform performance metrics</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analytics && (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-1">Total Impressions</p>
              <p className="text-2xl font-bold text-white">{(analytics.impressions.total / 1000000).toFixed(2)}M</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-1">Total Clicks</p>
              <p className="text-2xl font-bold text-white">{(analytics.clicks.total / 1000).toFixed(1)}K</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-1">Conversions</p>
              <p className="text-2xl font-bold text-white">{analytics.conversions.total.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-1">Avg CTR</p>
              <p className="text-2xl font-bold text-white">
                {((analytics.clicks.total / analytics.impressions.total) * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Source Breakdown */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Impressions by Source */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Impressions by Source</h2>
              <div className="space-y-3">
                {[
                  { label: 'DOOH Screens', value: analytics.impressions.dooh, color: '#a855f7', icon: '🖥' },
                  { label: 'In-App Ads', value: analytics.impressions.inApp, color: '#ec4899', icon: '📱' },
                  { label: 'Listings', value: analytics.impressions.listings, color: '#f97316', icon: '📋' },
                  { label: 'QR Campaigns', value: analytics.impressions.qrScans, color: '#06b6d4', icon: '◫' },
                ].map(source => (
                  <div key={source.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{source.icon}</span>
                        {source.label}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {(source.value / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: '#2a2a3e' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(source.value / analytics.impressions.total) * 100}%`,
                          backgroundColor: source.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Conversions by Source */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Conversions by Source</h2>
              <div className="space-y-3">
                {[
                  { label: 'QR Campaigns', value: analytics.conversions.qr, color: '#06b6d4', icon: '◫' },
                  { label: 'Listings', value: analytics.conversions.listings, color: '#f97316', icon: '📋' },
                ].map(source => (
                  <div key={source.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-sm text-gray-400">
                        <span>{source.icon}</span>
                        {source.label}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {source.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ backgroundColor: '#2a2a3e' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(source.value / analytics.conversions.total) * 100}%`,
                          backgroundColor: source.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total Conversions</span>
                  <span className="text-white font-bold">{analytics.conversions.total.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-400 text-sm">Conversion Rate</span>
                  <span className="text-green-400 font-bold">
                    {((analytics.conversions.total / analytics.impressions.total) * 100).toFixed(3)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Chart */}
          <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Performance Timeline</h2>
            <div className="h-48 flex items-end gap-4">
              {analytics.timeline.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col gap-1" style={{ height: '160px' }}>
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${(day.impressions / maxImpressions) * 100}%`,
                        background: 'linear-gradient(to top, #3b82f6, #60a5fa)'
                      }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs">{day.date}</span>
                  <span className="text-gray-400 text-xs">₹{day.earnings}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
