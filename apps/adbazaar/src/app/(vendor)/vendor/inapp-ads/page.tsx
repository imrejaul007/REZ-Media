'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

interface InAppAd {
  id: string
  adUnitId: string
  name: string
  placement: string
  app: string
  type: 'banner' | 'feed' | 'splash' | 'rewarded' | 'interstitial'
  status: 'active' | 'paused' | 'inactive'
  impressions: number
  clicks: number
  ctr: number
  cpm: number
  earnings: number
  lastUpdated: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: '#14532d', text: '#4ade80' },
  paused: { label: 'Paused', bg: '#713f12', text: '#fbbf24' },
  inactive: { label: 'Inactive', bg: '#27272a', text: '#a1a1aa' },
}

const typeLabels: Record<string, string> = {
  banner: 'Banner Ad',
  feed: 'Feed Ad',
  splash: 'Splash Ad',
  rewarded: 'Rewarded Ad',
  interstitial: 'Interstitial',
}

const appLabels: Record<string, string> = {
  hotel: 'Hotel Booking',
  rendez: 'Rendez App',
  adbazaar: 'AdBazaar',
  general: 'General',
}

export default function InAppAdsPage() {
  const [ads, setAds] = useState<InAppAd[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused' | 'inactive'>('all')
  const [filterApp, setFilterApp] = useState<string>('all')

  useEffect(() => {
    loadAds()
  }, [])

  async function loadAds() {
    try {
      setLoading(true)
      // Mock data - in production, call In-App Ad API
      const mockAds: InAppAd[] = [
        {
          id: '1',
          adUnitId: 'IAA-001',
          name: 'Home Banner',
          placement: 'Home Screen Banner',
          app: 'hotel',
          type: 'banner',
          status: 'active',
          impressions: 125000,
          clicks: 3125,
          ctr: 2.5,
          cpm: 15,
          earnings: 1875,
          lastUpdated: '2024-01-25'
        },
        {
          id: '2',
          adUnitId: 'IAA-002',
          name: 'Search Results Feed',
          placement: 'Between Search Results',
          app: 'hotel',
          type: 'feed',
          status: 'active',
          impressions: 89000,
          clicks: 3560,
          ctr: 4.0,
          cpm: 20,
          earnings: 1780,
          lastUpdated: '2024-01-25'
        },
        {
          id: '3',
          adUnitId: 'IAA-003',
          name: 'Splash Screen Ad',
          placement: 'App Launch',
          app: 'rendez',
          type: 'splash',
          status: 'active',
          impressions: 45000,
          clicks: 1800,
          ctr: 4.0,
          cpm: 25,
          earnings: 1125,
          lastUpdated: '2024-01-25'
        },
        {
          id: '4',
          adUnitId: 'IAA-004',
          name: 'Rewarded Video',
          placement: 'After Booking Completion',
          app: 'rendez',
          type: 'rewarded',
          status: 'active',
          impressions: 23000,
          clicks: 3450,
          ctr: 15.0,
          cpm: 35,
          earnings: 805,
          lastUpdated: '2024-01-25'
        },
        {
          id: '5',
          adUnitId: 'IAA-005',
          name: 'Booking Interstitial',
          placement: 'Before Payment',
          app: 'hotel',
          type: 'interstitial',
          status: 'paused',
          impressions: 34000,
          clicks: 1020,
          ctr: 3.0,
          cpm: 22,
          earnings: 748,
          lastUpdated: '2024-01-24'
        },
        {
          id: '6',
          adUnitId: 'IAA-006',
          name: 'AdBazaar Banner',
          placement: 'Marketplace Header',
          app: 'adbazaar',
          type: 'banner',
          status: 'inactive',
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpm: 12,
          earnings: 0,
          lastUpdated: '2024-01-20'
        },
      ]
      setAds(mockAds)
    } catch (err) {
      setError('Failed to load ads')
    } finally {
      setLoading(false)
    }
  }

  const filteredAds = ads.filter(ad => {
    if (activeTab !== 'all' && ad.status !== activeTab) return false
    if (filterApp !== 'all' && ad.app !== filterApp) return false
    return true
  })

  const stats = {
    total: ads.length,
    active: ads.filter(a => a.status === 'active').length,
    totalImpressions: ads.reduce((sum, a) => sum + a.impressions, 0),
    totalClicks: ads.reduce((sum, a) => sum + a.clicks, 0),
    avgCTR: ads.filter(a => a.impressions > 0).length > 0
      ? ads.filter(a => a.impressions > 0).reduce((sum, a) => sum + a.ctr, 0) / ads.filter(a => a.impressions > 0).length
      : 0,
    totalEarnings: ads.reduce((sum, a) => sum + a.earnings, 0),
  }

  async function toggleAd(adId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    setAds(ads.map(a =>
      a.id === adId ? { ...a, status: newStatus as any } : a
    ))
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">In-App Ads</h1>
          <p className="text-gray-400 text-sm">Manage ad placements across ReZ apps</p>
        </div>
        <Link
          href="/vendor/inapp-ads/new"
          className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: '#2563eb' }}
        >
          + Create Ad Unit
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Ad Units</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Active</p>
          <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{stats.active}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Impressions</p>
          <p className="text-2xl font-bold text-white">{(stats.totalImpressions / 1000).toFixed(0)}K</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Clicks</p>
          <p className="text-2xl font-bold text-white">{(stats.totalClicks / 1000).toFixed(1)}K</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Avg CTR</p>
          <p className="text-2xl font-bold text-white">{stats.avgCTR.toFixed(1)}%</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Earnings</p>
          <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>₹{(stats.totalEarnings / 1000).toFixed(1)}K</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex gap-2">
          {(['all', 'active', 'paused', 'inactive'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeTab === tab ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              style={{
                backgroundColor: activeTab === tab ? '#2563eb' : 'transparent',
                border: activeTab === tab ? 'none' : '1px solid #2a2a2a'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={filterApp}
          onChange={(e) => setFilterApp(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm text-white bg-neutral-900 border border-neutral-700"
        >
          <option value="all">All Apps</option>
          <option value="hotel">Hotel Booking</option>
          <option value="rendez">Rendez App</option>
          <option value="adbazaar">AdBazaar</option>
          <option value="general">General</option>
        </select>
      </div>

      {/* Ad List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📱</div>
          <p className="text-gray-400 mb-4">No ad units found</p>
          <Link
            href="/vendor/inapp-ads/new"
            className="px-4 py-2 rounded-lg font-medium text-white inline-block"
            style={{ backgroundColor: '#2563eb' }}
          >
            Create Your First Ad Unit
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAds.map(ad => (
            <div
              key={ad.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{ad.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: statusConfig[ad.status].bg, color: statusConfig[ad.status].text }}
                    >
                      {statusConfig[ad.status].label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    {ad.adUnitId} • {typeLabels[ad.type]} • {appLabels[ad.app]}
                  </p>
                  <p className="text-gray-500 text-xs mb-3">Placement: {ad.placement}</p>

                  <div className="grid grid-cols-5 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Impressions</p>
                      <p className="text-white font-medium">{(ad.impressions / 1000).toFixed(1)}K</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Clicks</p>
                      <p className="text-white font-medium">{(ad.clicks / 1000).toFixed(1)}K</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">CTR</p>
                      <p className="text-white font-medium">{ad.ctr.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">CPM</p>
                      <p className="text-white font-medium">₹{ad.cpm}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Earnings</p>
                      <p className="text-yellow-400 font-medium">₹{ad.earnings.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {ad.status !== 'inactive' && (
                    <button
                      onClick={() => toggleAd(ad.id, ad.status)}
                      className="px-3 py-1.5 rounded text-sm font-medium text-white"
                      style={{ backgroundColor: ad.status === 'active' ? '#713f12' : '#14532d' }}
                    >
                      {ad.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  )}
                  <Link
                    href={`/vendor/inapp-ads/${ad.id}/analytics`}
                    className="px-3 py-1.5 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: '#374151' }}
                  >
                    Analytics
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
