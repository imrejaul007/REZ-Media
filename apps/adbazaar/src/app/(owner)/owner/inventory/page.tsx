'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface InventoryItem {
  id: string
  type: 'listing' | 'qr-campaign' | 'dooh' | 'inapp-ad'
  name: string
  status: string
  impressions: number
  earnings: number
  createdAt: string
}

export default function OwnerInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'listing' | 'qr-campaign' | 'dooh' | 'inapp-ad'>('all')

  useEffect(() => {
    loadInventory()
  }, [])

  async function loadInventory() {
    try {
      setLoading(true)
      // Mock unified inventory data
      const mockInventory: InventoryItem[] = [
        { id: '1', type: 'listing', name: 'Billboard at MG Road', status: 'active', impressions: 45000, earnings: 15000, createdAt: '2024-01-10' },
        { id: '2', type: 'listing', name: 'Bus Shelter Ads - Brigade Road', status: 'active', impressions: 12000, earnings: 5000, createdAt: '2024-01-12' },
        { id: '3', type: 'qr-campaign', name: 'Summer Sale QR', status: 'active', impressions: 2500, earnings: 2500, createdAt: '2024-01-15' },
        { id: '4', type: 'qr-campaign', name: 'New Arrivals Campaign', status: 'paused', impressions: 890, earnings: 890, createdAt: '2024-01-20' },
        { id: '5', type: 'dooh', name: 'Mall Entrance LED', status: 'online', impressions: 45600, earnings: 2052, createdAt: '2024-01-08' },
        { id: '6', type: 'dooh', name: 'Metro Station Kiosk', status: 'online', impressions: 28500, earnings: 998, createdAt: '2024-01-05' },
        { id: '7', type: 'inapp-ad', name: 'Home Banner - Hotel App', status: 'active', impressions: 125000, earnings: 1875, createdAt: '2024-01-01' },
        { id: '8', type: 'inapp-ad', name: 'Search Feed Ad', status: 'active', impressions: 89000, earnings: 1780, createdAt: '2024-01-02' },
      ]
      setInventory(mockInventory)
    } finally {
      setLoading(false)
    }
  }

  const filteredInventory = filter === 'all'
    ? inventory
    : inventory.filter(item => item.type === filter)

  const stats = {
    total: inventory.length,
    active: inventory.filter(i => i.status === 'active' || i.status === 'online').length,
    impressions: inventory.reduce((sum, i) => sum + i.impressions, 0),
    earnings: inventory.reduce((sum, i) => sum + i.earnings, 0),
  }

  const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
    listing: { label: 'Listing', color: 'orange', icon: '📋' },
    'qr-campaign': { label: 'QR Campaign', color: 'cyan', icon: '◫' },
    dooh: { label: 'DOOH Screen', color: 'purple', icon: '🖥' },
    'inapp-ad': { label: 'In-App Ad', color: 'pink', icon: '📱' },
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    online: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    inactive: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Unified Inventory</h1>
        <p className="text-gray-400 text-sm">All your advertising inventory in one place</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
          <p className="text-gray-400 text-sm">Total Items</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
          <p className="text-gray-400 text-sm">Active</p>
          <p className="text-2xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
          <p className="text-gray-400 text-sm">Total Impressions</p>
          <p className="text-2xl font-bold text-white">{(stats.impressions / 1000).toFixed(0)}K</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
          <p className="text-gray-400 text-sm">Total Earnings</p>
          <p className="text-2xl font-bold text-yellow-400">₹{(stats.earnings / 1000).toFixed(1)}K</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'listing', 'qr-campaign', 'dooh', 'inapp-ad'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === type ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
            style={{
              backgroundColor: filter === type ? '#3b82f6' : 'transparent',
              border: filter === type ? 'none' : '1px solid #2a2a3e'
            }}
          >
            {type === 'all' ? 'All' : typeLabels[type].label}
          </button>
        ))}
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
          <table className="w-full">
            <thead style={{ backgroundColor: '#0d0d14' }}>
              <tr>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Type</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Name</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Status</th>
                <th className="text-right text-gray-400 text-sm font-medium px-4 py-3">Impressions</th>
                <th className="text-right text-gray-400 text-sm font-medium px-4 py-3">Earnings</th>
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#2a2a3e' }}>
              {filteredInventory.map(item => (
                <tr key={item.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span>{typeLabels[item.type].icon}</span>
                      <span className="text-white text-sm">{typeLabels[item.type].label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white text-sm">{item.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-white text-sm">{(item.impressions / 1000).toFixed(1)}K</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-yellow-400 text-sm">₹{item.earnings.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/owner/${item.type === 'qr-campaign' ? 'qr-campaigns' : item.type === 'dooh' ? 'dooh-screens' : item.type === 'inapp-ad' ? 'inapp-ads' : 'listings'}/${item.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
