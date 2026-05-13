'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

interface QRCampaign {
  id: string
  campaignId: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  scans: number
  uniqueScans: number
  conversions: number
  coinReward: number
  earnings: number
  createdAt: string
  qrCodeUrl?: string
  template?: string
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: '#14532d', text: '#4ade80' },
  paused: { label: 'Paused', bg: '#713f12', text: '#fbbf24' },
  completed: { label: 'Completed', bg: '#1e3a5f', text: '#60a5fa' },
  draft: { label: 'Draft', bg: '#27272a', text: '#a1a1aa' },
}

export default function QRCampaignsPage() {
  const [campaigns, setCampaigns] = useState<QRCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'paused' | 'completed'>('all')

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function loadCampaigns() {
    try {
      setLoading(true)
      // In production, this would call the rez-owner-service or adsqr API
      // For now, we'll use mock data
      const mockCampaigns: QRCampaign[] = [
        {
          id: '1',
          campaignId: 'QR-001',
          name: 'Summer Sale QR Code',
          status: 'active',
          scans: 1250,
          uniqueScans: 980,
          conversions: 145,
          coinReward: 10,
          earnings: 1450,
          createdAt: '2024-01-15',
          template: 'modern'
        },
        {
          id: '2',
          campaignId: 'QR-002',
          name: 'New Arrivals Campaign',
          status: 'active',
          scans: 890,
          uniqueScans: 720,
          conversions: 89,
          coinReward: 15,
          earnings: 890,
          createdAt: '2024-01-20',
          template: 'classic'
        },
        {
          id: '3',
          campaignId: 'QR-003',
          name: 'Loyalty Program Launch',
          status: 'paused',
          scans: 450,
          uniqueScans: 380,
          conversions: 56,
          coinReward: 20,
          earnings: 560,
          createdAt: '2024-01-10',
          template: 'minimal'
        },
        {
          id: '4',
          campaignId: 'QR-004',
          name: 'Flash Sale Weekend',
          status: 'completed',
          scans: 3200,
          uniqueScans: 2800,
          conversions: 420,
          coinReward: 25,
          earnings: 4200,
          createdAt: '2023-12-15',
          template: 'bold'
        },
      ]
      setCampaigns(mockCampaigns)
    } catch (err) {
      setError('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    if (activeTab === 'all') return true
    return campaign.status === activeTab
  })

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    totalScans: campaigns.reduce((sum, c) => sum + c.scans, 0),
    totalEarnings: campaigns.reduce((sum, c) => sum + c.earnings, 0),
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">QR Campaigns</h1>
          <p className="text-gray-400 text-sm">Create and manage QR code campaigns for your ads</p>
        </div>
        <Link
          href="/vendor/qr-campaigns/new"
          className="px-4 py-2 rounded-lg font-medium text-white transition-colors"
          style={{ backgroundColor: '#2563eb' }}
        >
          + Create Campaign
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Total Campaigns</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Active</p>
          <p className="text-2xl font-bold" style={{ color: '#4ade80' }}>{stats.active}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Total Scans</p>
          <p className="text-2xl font-bold text-white">{stats.totalScans.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="text-gray-400 text-sm mb-1">Total Earnings</p>
          <p className="text-2xl font-bold" style={{ color: '#fbbf24' }}>₹{stats.totalEarnings.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'paused', 'completed'] as const).map(tab => (
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

      {/* Campaign List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">◫</div>
          <p className="text-gray-400 mb-4">No campaigns found</p>
          <Link
            href="/vendor/qr-campaigns/new"
            className="px-4 py-2 rounded-lg font-medium text-white inline-block"
            style={{ backgroundColor: '#2563eb' }}
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map(campaign => (
            <div
              key={campaign.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: statusConfig[campaign.status].bg, color: statusConfig[campaign.status].text }}
                    >
                      {statusConfig[campaign.status].label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">ID: {campaign.campaignId} • Created: {campaign.createdAt}</p>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs">Scans</p>
                      <p className="text-white font-medium">{campaign.scans.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Unique</p>
                      <p className="text-white font-medium">{campaign.uniqueScans.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Conversions</p>
                      <p className="text-white font-medium">{campaign.conversions}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Earnings</p>
                      <p className="text-yellow-400 font-medium">₹{campaign.earnings.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/vendor/qr-campaigns/${campaign.id}`}
                    className="px-3 py-1.5 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: '#374151' }}
                  >
                    View
                  </Link>
                  <Link
                    href={`/vendor/qr-campaigns/${campaign.id}/edit`}
                    className="px-3 py-1.5 rounded text-sm font-medium text-white"
                    style={{ backgroundColor: '#2563eb' }}
                  >
                    Edit
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
