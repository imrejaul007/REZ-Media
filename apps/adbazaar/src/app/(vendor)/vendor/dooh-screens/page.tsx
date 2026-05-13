'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

interface DoohScreen {
  id: string
  screenId: string
  name: string
  location: string
  type: 'digital_billboard' | 'led_screen' | 'kiosk' | 'interactive_display'
  status: 'online' | 'offline' | 'paused'
  dimensions: string
  impressions: number
  cpm: number
  earnings: number
  lastActive: string
  imageUrl?: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  online: { label: 'Online', bg: '#14532d', text: '#4ade80' },
  offline: { label: 'Offline', bg: '#7f1d1d', text: '#f87171' },
  paused: { label: 'Paused', bg: '#713f12', text: '#fbbf24' },
}

const typeLabels: Record<string, string> = {
  digital_billboard: 'Digital Billboard',
  led_screen: 'LED Screen',
  kiosk: 'Kiosk',
  interactive_display: 'Interactive Display',
}

export default function DoohScreensPage() {
  const [screens, setScreens] = useState<DoohScreen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'offline' | 'paused'>('all')

  useEffect(() => {
    loadScreens()
  }, [])

  async function loadScreens() {
    try {
      setLoading(true)
      // Mock data - in production, call DOOH API or rez-owner-service
      const mockScreens: DoohScreen[] = [
        {
          id: '1',
          screenId: 'DOOH-001',
          name: 'Mall Entrance LED',
          location: 'Phoenix Mall, Bangalore',
          type: 'led_screen',
          status: 'online',
          dimensions: '1920x1080',
          impressions: 45600,
          cpm: 45,
          earnings: 2052,
          lastActive: '2024-01-25 14:30'
        },
        {
          id: '2',
          screenId: 'DOOH-002',
          name: 'Metro Station Kiosk A',
          location: 'MG Road Metro, Bangalore',
          type: 'kiosk',
          status: 'online',
          dimensions: '1080x1920',
          impressions: 28500,
          cpm: 35,
          earnings: 998,
          lastActive: '2024-01-25 14:25'
        },
        {
          id: '3',
          screenId: 'DOOH-003',
          name: 'Airport Digital Board',
          location: 'Kempegowda Airport, Bangalore',
          type: 'digital_billboard',
          status: 'online',
          dimensions: '3840x2160',
          impressions: 89200,
          cpm: 85,
          earnings: 7582,
          lastActive: '2024-01-25 14:28'
        },
        {
          id: '4',
          screenId: 'DOOH-004',
          name: 'Shopping Complex Kiosk',
          location: 'Forum Mall, Bangalore',
          type: 'interactive_display',
          status: 'paused',
          dimensions: '1080x1920',
          impressions: 12400,
          cpm: 40,
          earnings: 496,
          lastActive: '2024-01-24 18:00'
        },
        {
          id: '5',
          screenId: 'DOOH-005',
          name: 'Bus Stand LED',
          location: 'Majestic Bus Station, Bangalore',
          type: 'led_screen',
          status: 'offline',
          dimensions: '1920x1080',
          impressions: 0,
          cpm: 30,
          earnings: 0,
          lastActive: '2024-01-20 10:00'
        },
      ]
      setScreens(mockScreens)
    } catch (err) {
      setError('Failed to load screens')
    } finally {
      setLoading(false)
    }
  }

  const filteredScreens = screens.filter(screen => {
    if (activeTab === 'all') return true
    return screen.status === activeTab
  })

  const stats = {
    total: screens.length,
    online: screens.filter(s => s.status === 'online').length,
    totalImpressions: screens.reduce((sum, s) => sum + s.impressions, 0),
    totalEarnings: screens.reduce((sum, s) => sum + s.earnings, 0),
    avgCPM: screens.filter(s => s.status === 'online').length > 0
      ? screens.filter(s => s.status === 'online').reduce((sum, s) => sum + s.cpm, 0) / screens.filter(s => s.status === 'online').length
      : 0,
  }

  async function toggleScreen(screenId: string, currentStatus: string) {
    const newStatus = currentStatus === 'online' ? 'paused' : 'online'
    // In production, call DOOH API to update status
    setScreens(screens.map(s =>
      s.id === screenId ? { ...s, status: newStatus as any } : s
    ))
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">DOOH Screens</h1>
          <p className="text-gray-400 text-sm">Manage your digital out-of-home advertising screens</p>
        </div>
        <Link
          href="/vendor/dooh-screens/register"
          className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: '#2563eb' }}
        >
          + Register Screen
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Total Screens</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Online</p>
          <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{stats.online}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Impressions</p>
          <p className="text-2xl font-bold text-white">{(stats.totalImpressions / 1000).toFixed(0)}K</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Avg CPM</p>
          <p className="text-2xl font-bold text-white">₹{stats.avgCPM.toFixed(0)}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Earnings</p>
          <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>₹{(stats.totalEarnings / 1000).toFixed(1)}K</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'online', 'offline', 'paused'] as const).map(tab => (
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

      {/* Screen List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredScreens.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🖥</div>
          <p className="text-gray-400 mb-4">No screens found</p>
          <Link
            href="/vendor/dooh-screens/register"
            className="px-4 py-2 rounded-lg font-medium text-white inline-block"
            style={{ backgroundColor: '#2563eb' }}
          >
            Register Your First Screen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredScreens.map(screen => (
            <div
              key={screen.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{screen.name}</h3>
                  <p className="text-gray-400 text-sm">{screen.location}</p>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: statusConfig[screen.status].bg, color: statusConfig[screen.status].text }}
                >
                  {statusConfig[screen.status].label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-2 rounded" style={{ backgroundColor: '#111111' }}>
                  <p className="text-gray-500 text-xs">Type</p>
                  <p className="text-white text-sm font-medium">{typeLabels[screen.type]}</p>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: '#111111' }}>
                  <p className="text-gray-500 text-xs">Dimensions</p>
                  <p className="text-white text-sm font-medium">{screen.dimensions}</p>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: '#111111' }}>
                  <p className="text-gray-500 text-xs">CPM</p>
                  <p className="text-white text-sm font-medium">₹{screen.cpm}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-gray-500 text-xs">Impressions</p>
                  <p className="text-white font-medium">{(screen.impressions / 1000).toFixed(1)}K</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Earnings</p>
                  <p className="text-yellow-400 font-medium">₹{screen.earnings.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {screen.status !== 'offline' && (
                  <button
                    onClick={() => toggleScreen(screen.id, screen.status)}
                    className="px-3 py-1.5 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: screen.status === 'online' ? '#713f12' : '#14532d' }}
                  >
                    {screen.status === 'online' ? 'Pause' : 'Resume'}
                  </button>
                )}
                <Link
                  href={`/vendor/dooh-screens/${screen.id}`}
                  className="px-3 py-1.5 rounded text-sm font-medium text-white"
                  style={{ backgroundColor: '#374151' }}
                >
                  Details
                </Link>
                <Link
                  href={`/vendor/dooh-screens/${screen.id}/analytics`}
                  className="px-3 py-1.5 rounded text-sm font-medium text-white"
                  style={{ backgroundColor: '#374151' }}
                >
                  Analytics
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
