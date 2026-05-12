'use client'

import { useState, useEffect } from 'react'

interface Screen {
  id: string
  name: string
  type: string
  status: string
  last_heartbeat: string
  is_online: boolean
}

interface Stats {
  total_screens: number
  online: number
  offline: number
  total_impressions: number
}

export default function DashboardPage() {
  const [screens, setScreens] = useState<Screen[]>([])
  const [stats, setStats] = useState<Stats>({ total_screens: 0, online: 0, offline: 0, total_impressions: 0 })

  useEffect(() => {
    // In production, fetch from API
    // For demo, show empty state
    setStats({
      total_screens: 0,
      online: 0,
      offline: 0,
      total_impressions: 0,
    })
  }, [])

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">DOOH Dashboard</h1>
          <p className="text-white/60">Manage your screens and track earnings</p>
        </div>
        <a
          href="/register"
          className="px-6 py-3 rounded-lg font-bold"
          style={{ backgroundColor: '#f59e0b', color: '#000' }}
        >
          + Add Screen
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-sm mb-1">Total Screens</p>
          <p className="text-3xl font-bold">{stats.total_screens}</p>
        </div>
        <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-sm mb-1">Online</p>
          <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{stats.online}</p>
        </div>
        <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-sm mb-1">Offline</p>
          <p className="text-3xl font-bold" style={{ color: '#ef4444' }}>{stats.offline}</p>
        </div>
        <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
          <p className="text-white/40 text-sm mb-1">Earnings</p>
          <p className="text-3xl font-bold" style={{ color: '#f59e0b' }}>₹0</p>
        </div>
      </div>

      {/* Screens List */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold">Your Screens</h2>
        </div>

        {screens.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📺</div>
            <h3 className="text-xl font-semibold mb-2">No screens registered</h3>
            <p className="text-white/40 mb-6">Register your first screen to start earning</p>
            <a
              href="/register"
              className="inline-block px-6 py-3 rounded-lg font-semibold"
              style={{ backgroundColor: '#f59e0b', color: '#000' }}
            >
              Register Screen
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm text-white/40">
                <th className="p-4">Screen</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Seen</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {screens.map((screen) => (
                <tr key={screen.id} className="border-t border-white/5">
                  <td className="p-4">
                    <p className="font-medium">{screen.name}</p>
                    <p className="text-sm text-white/40">{screen.id}</p>
                  </td>
                  <td className="p-4 text-white/70">{screen.type}</td>
                  <td className="p-4">
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: screen.is_online ? '#22c55e20' : '#ef444420',
                        color: screen.is_online ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {screen.is_online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="p-4 text-white/70">{screen.last_heartbeat || 'Never'}</td>
                  <td className="p-4">
                    <button className="text-sm text-amber-400 hover:underline">Configure</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Setup Guide */}
      <div className="mt-8 p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
        <h2 className="text-xl font-semibold mb-4">Quick Setup Guide</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">1. Register</h3>
            <p className="text-sm text-white/60">Register your screen and get an ID</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">2. Install</h3>
            <p className="text-sm text-white/60">Install DOOH Screen App on your display</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">3. Earn</h3>
            <p className="text-sm text-white/60">Start earning from ads automatically</p>
          </div>
        </div>
      </div>
    </div>
  )
}
