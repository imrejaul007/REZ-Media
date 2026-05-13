'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface UnifiedStats {
  totalRevenue: number
  totalImpressions: number
  totalScans: number
  totalListings: number
  totalQRCampaigns: number
  totalDoohScreens: number
  totalInAppAds: number
  breakdown: {
    listings: number
    qrCampaigns: number
    dooh: number
    inAppAds: number
  }
  recentActivity: Activity[]
}

interface Activity {
  id: string
  type: 'booking' | 'scan' | 'impression' | 'payment'
  description: string
  amount: number
  timestamp: string
}

interface PerformanceData {
  date: string
  listings: number
  qrScans: number
  doohImpressions: number
  inAppImpressions: number
}

export default function OwnerDashboardPage() {
  const [stats, setStats] = useState<UnifiedStats | null>(null)
  const [performance, setPerformance] = useState<PerformanceData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    try {
      // In production, call rez-owner-service API
      // For now, use comprehensive mock data
      setStats({
        totalRevenue: 45680,
        totalImpressions: 892000,
        totalScans: 28500,
        totalListings: 24,
        totalQRCampaigns: 8,
        totalDoohScreens: 5,
        totalInAppAds: 6,
        breakdown: {
          listings: 24560,
          qrCampaigns: 8540,
          dooh: 9820,
          inAppAds: 2760,
        },
        recentActivity: [
          { id: '1', type: 'booking', description: 'New booking on Billboard at MG Road', amount: 15000, timestamp: '2 hours ago' },
          { id: '2', type: 'scan', description: 'QR Campaign "Summer Sale" reached 500 scans', amount: 0, timestamp: '4 hours ago' },
          { id: '3', type: 'impression', description: 'DOOH Screen at Mall crossed 50K impressions', amount: 0, timestamp: '6 hours ago' },
          { id: '4', type: 'payment', description: 'Payout received from In-App Ads', amount: 2760, timestamp: '1 day ago' },
          { id: '5', type: 'booking', description: 'New inquiry for Metro Station Kiosk', amount: 0, timestamp: '1 day ago' },
        ]
      })

      // Generate mock performance data
      const mockPerformance: PerformanceData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        mockPerformance.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          listings: Math.floor(Math.random() * 5000) + 2000,
          qrScans: Math.floor(Math.random() * 800) + 200,
          doohImpressions: Math.floor(Math.random() * 15000) + 5000,
          inAppImpressions: Math.floor(Math.random() * 8000) + 2000,
        })
      }
      setPerformance(mockPerformance)
    } finally {
      setLoading(false)
    }
  }

  const maxImpressions = Math.max(...performance.map(p => p.doohImpressions + p.inAppImpressions + p.listings))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Owner Dashboard</h1>
        <p className="text-gray-400 text-sm">Unified view of all your advertising inventory</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stats && (
        <>
          {/* Total Revenue Card */}
          <div className="mb-6 p-6 rounded-xl" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)', border: '1px solid #2563eb/30' }}>
            <p className="text-blue-300 text-sm font-medium mb-2">Total Revenue (This Month)</p>
            <p className="text-4xl font-bold text-white mb-4">₹{stats.totalRevenue.toLocaleString()}</p>
            <div className="flex gap-6">
              <div>
                <p className="text-gray-400 text-xs">Listings</p>
                <p className="text-white font-medium">₹{stats.breakdown.listings.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">QR Campaigns</p>
                <p className="text-white font-medium">₹{stats.breakdown.qrCampaigns.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">DOOH</p>
                <p className="text-white font-medium">₹{stats.breakdown.dooh.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">In-App Ads</p>
                <p className="text-white font-medium">₹{stats.breakdown.inAppAds.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Inventory Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link
              href="/owner/listings"
              className="p-4 rounded-lg transition-transform hover:scale-102"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <span className="text-gray-400 text-sm">Listings</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalListings}</p>
              <p className="text-green-400 text-xs mt-1">+2 this week</p>
            </Link>

            <Link
              href="/owner/qr-campaigns"
              className="p-4 rounded-lg transition-transform hover:scale-102"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <span className="text-xl">◫</span>
                </div>
                <span className="text-gray-400 text-sm">QR Campaigns</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalQRCampaigns}</p>
              <p className="text-cyan-400 text-xs mt-1">{stats.totalScans.toLocaleString()} total scans</p>
            </Link>

            <Link
              href="/owner/dooh-screens"
              className="p-4 rounded-lg transition-transform hover:scale-102"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <span className="text-xl">🖥</span>
                </div>
                <span className="text-gray-400 text-sm">DOOH Screens</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalDoohScreens}</p>
              <p className="text-purple-400 text-xs mt-1">Online: 3</p>
            </Link>

            <Link
              href="/owner/inapp-ads"
              className="p-4 rounded-lg transition-transform hover:scale-102"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <span className="text-xl">📱</span>
                </div>
                <span className="text-gray-400 text-sm">In-App Ads</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats.totalInAppAds}</p>
              <p className="text-pink-400 text-xs mt-1">Active: 4</p>
            </Link>
          </div>

          {/* Performance Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Performance (Last 7 Days)</h2>
              <div className="h-48 flex items-end gap-2">
                {performance.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col gap-0.5" style={{ height: '180px' }}>
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${(day.listings / maxImpressions) * 100}%`,
                          backgroundColor: '#f97316',
                          minHeight: day.listings > 0 ? '4px' : '0'
                        }}
                      />
                      <div
                        className="w-full"
                        style={{
                          height: `${(day.qrScans * 10 / maxImpressions) * 100}%`,
                          backgroundColor: '#06b6d4',
                          minHeight: day.qrScans > 0 ? '4px' : '0'
                        }}
                      />
                      <div
                        className="w-full"
                        style={{
                          height: `${(day.doohImpressions / maxImpressions) * 100}%`,
                          backgroundColor: '#a855f7',
                          minHeight: day.doohImpressions > 0 ? '4px' : '0'
                        }}
                      />
                      <div
                        className="w-full rounded-b"
                        style={{
                          height: `${(day.inAppImpressions / maxImpressions) * 100}%`,
                          backgroundColor: '#ec4899',
                          minHeight: day.inAppImpressions > 0 ? '4px' : '0'
                        }}
                      />
                    </div>
                    <span className="text-gray-500 text-xs">{day.date}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-orange-500" />
                  <span className="text-gray-400 text-xs">Listings</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-cyan-500" />
                  <span className="text-gray-400 text-xs">QR Scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-purple-500" />
                  <span className="text-gray-400 text-xs">DOOH</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-pink-500" />
                  <span className="text-gray-400 text-xs">In-App</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {stats.recentActivity.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'booking' ? 'bg-green-500/20' :
                      activity.type === 'scan' ? 'bg-cyan-500/20' :
                      activity.type === 'impression' ? 'bg-purple-500/20' :
                      'bg-yellow-500/20'
                    }`}>
                      <span className="text-sm">
                        {activity.type === 'booking' ? '📋' :
                         activity.type === 'scan' ? '◫' :
                         activity.type === 'impression' ? '👁' : '💰'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{activity.description}</p>
                      <p className="text-gray-500 text-xs">{activity.timestamp}</p>
                    </div>
                    {activity.amount > 0 && (
                      <span className="text-green-400 text-sm font-medium">+₹{activity.amount.toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/owner/listings/new"
              className="p-4 rounded-lg text-center transition-colors"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <span className="text-2xl mb-2 block">📋</span>
              <span className="text-white text-sm">New Listing</span>
            </Link>
            <Link
              href="/owner/qr-campaigns/new"
              className="p-4 rounded-lg text-center transition-colors"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <span className="text-2xl mb-2 block">◫</span>
              <span className="text-white text-sm">QR Campaign</span>
            </Link>
            <Link
              href="/owner/dooh-screens/register"
              className="p-4 rounded-lg text-center transition-colors"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <span className="text-2xl mb-2 block">🖥</span>
              <span className="text-white text-sm">Register Screen</span>
            </Link>
            <Link
              href="/owner/inapp-ads/new"
              className="p-4 rounded-lg text-center transition-colors"
              style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}
            >
              <span className="text-2xl mb-2 block">📱</span>
              <span className="text-white text-sm">Ad Unit</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
