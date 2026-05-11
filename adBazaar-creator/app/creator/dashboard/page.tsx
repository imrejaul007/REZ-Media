'use client'

import { useState } from 'react'

const STATS = {
  total_earnings: 125000,
  pending_payouts: 35000,
  total_followers: 2500000,
  engagement_rate: 8.5,
}

const CAMPAIGNS = [
  {
    id: '1',
    brand: 'FabIndia',
    type: 'Instagram Post',
    status: 'completed',
    earnings: 50000,
    impressions: 250000,
    date: '2024-03-15',
  },
  {
    id: '2',
    brand: 'Nykaa',
    type: 'Instagram Reel',
    status: 'submitted',
    earnings: 75000,
    impressions: null,
    date: '2024-03-20',
  },
  {
    id: '3',
    brand: 'Zomato',
    type: 'Story',
    status: 'pending',
    earnings: 25000,
    impressions: null,
    date: '2024-03-25',
  },
]

const EARNINGS_HISTORY = [
  { month: 'Mar', amount: 85000 },
  { month: 'Feb', amount: 65000 },
  { month: 'Jan', amount: 92000 },
  { month: 'Dec', amount: 78000 },
  { month: 'Nov', amount: 110000 },
]

export default function CreatorDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'earnings' | 'settings'>('overview')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="border-b border-white/10" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">Creator Dashboard</h1>
              <p className="text-sm text-white/50">Manage your campaigns and earnings</p>
            </div>
            <button className="px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
              + New Campaign
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-4">
            {(['overview', 'campaigns', 'earnings', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium ${
                  activeTab === tab ? 'text-amber-500 border-b-2 border-amber-500' : 'text-white/50'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-amber-500">₹{STATS.total_earnings.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">₹{STATS.pending_payouts.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50 mb-1">Followers</p>
                <p className="text-2xl font-bold">{(STATS.total_followers / 1000000).toFixed(1)}M</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50 mb-1">Engagement</p>
                <p className="text-2xl font-bold text-green-500">{STATS.engagement_rate}%</p>
              </div>
            </div>

            {/* Earnings Chart */}
            <div className="p-6 rounded-xl mb-6" style={{ backgroundColor: '#1a1a1a' }}>
              <h2 className="font-semibold mb-4">Earnings History</h2>
              <div className="flex items-end gap-2 h-32">
                {EARNINGS_HISTORY.map(item => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t bg-amber-500"
                      style={{ height: `${(item.amount / 110000) * 100}%` }}
                    />
                    <span className="text-xs text-white/50">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Campaigns */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="p-4 border-b border-white/10">
                <h2 className="font-semibold">Recent Campaigns</h2>
              </div>
              <div className="divide-y divide-white/5">
                {CAMPAIGNS.map(campaign => (
                  <div key={campaign.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{campaign.brand}</p>
                      <p className="text-sm text-white/50">{campaign.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-amber-500">₹{campaign.earnings.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        campaign.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                        campaign.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-white/10 text-white/50'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4">All Campaigns</h2>
            {CAMPAIGNS.map(campaign => (
              <div key={campaign.id} className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold">{campaign.brand}</h3>
                    <p className="text-sm text-white/50">{campaign.type}</p>
                  </div>
                  <span className="px-3 py-1 rounded text-sm" style={{
                    backgroundColor: campaign.status === 'completed' ? '#22c55e20' : '#f59e0b20',
                    color: campaign.status === 'completed' ? '#22c55e' : '#f59e0b'
                  }}>
                    {campaign.status}
                  </span>
                </div>
                <div className="flex gap-6 mt-3 text-sm text-white/70">
                  <span>Earnings: ₹{campaign.earnings.toLocaleString()}</span>
                  {campaign.impressions && <span>Impressions: {campaign.impressions.toLocaleString()}</span>}
                  <span>Date: {campaign.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Earnings & Payouts</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50">Available Balance</p>
                <p className="text-3xl font-bold text-amber-500">₹{STATS.pending_payouts.toLocaleString()}</p>
                <button className="mt-4 w-full py-2 rounded-lg font-medium" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
                  Request Payout
                </button>
              </div>
              <div className="p-6 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50">Total Earned</p>
                <p className="text-3xl font-bold">₹{STATS.total_earnings.toLocaleString()}</p>
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
              <h3 className="font-semibold mb-3">Payout History</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span>Feb 2024</span>
                  <span className="text-green-500">₹65,000 paid</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span>Jan 2024</span>
                  <span className="text-green-500">₹92,000 paid</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Dec 2023</span>
                  <span className="text-green-500">₹78,000 paid</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl">
            <h2 className="text-xl font-bold mb-4">Profile Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Display Name</label>
                <input type="text" defaultValue="Priya Sharma" className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>
              <div>
                <label className="block text-sm mb-1">Bio</label>
                <textarea rows={3} defaultValue="Fashion blogger..." className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>
              <div>
                <label className="block text-sm mb-1">Instagram URL</label>
                <input type="url" placeholder="https://instagram.com/..." className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>
              <button className="w-full py-3 rounded-lg font-bold" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
