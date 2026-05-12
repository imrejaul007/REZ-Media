'use client'

import { useState } from 'react'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Edit,
  Pause,
  Play,
  Trash2,
  Eye,
  MousePointer,
  ShoppingCart,
} from 'lucide-react'
import Link from 'next/link'

const campaigns = [
  {
    id: '1',
    name: 'Summer Sale 2024',
    status: 'active',
    channel: 'WhatsApp',
    budget: 5000,
    spent: 2340,
    impressions: 45000,
    clicks: 2340,
    conversions: 156,
    ctr: 5.2,
    startDate: '2024-06-01',
    endDate: '2024-08-31',
  },
  {
    id: '2',
    name: 'New User Welcome',
    status: 'active',
    channel: 'Email',
    budget: 2000,
    spent: 890,
    impressions: 12000,
    clicks: 2340,
    conversions: 89,
    ctr: 19.5,
    startDate: '2024-05-15',
    endDate: '2024-12-31',
  },
  {
    id: '3',
    name: 'Weekend Deals',
    status: 'paused',
    channel: 'SMS',
    budget: 1500,
    spent: 450,
    impressions: 8900,
    clicks: 445,
    conversions: 34,
    ctr: 5.0,
    startDate: '2024-06-15',
    endDate: '2024-07-15',
  },
  {
    id: '4',
    name: 'Product Launch',
    status: 'draft',
    channel: 'Push',
    budget: 3000,
    spent: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    startDate: '2024-07-01',
    endDate: '2024-07-31',
  },
]

const statusColors = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  draft: 'bg-gray-100 text-gray-700',
  completed: 'bg-blue-100 text-blue-700',
}

const channelIcons = {
  WhatsApp: 'bg-green-500',
  Email: 'bg-purple-500',
  SMS: 'bg-blue-500',
  Push: 'bg-orange-500',
}

export default function CampaignsPage() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filteredCampaigns = campaigns.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500">Manage your ad campaigns across all channels</p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'active', 'paused', 'draft'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                filter === status
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCampaigns.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-sm text-gray-500">{campaign.startDate} - {campaign.endDate}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`${channelIcons[campaign.channel as keyof typeof channelIcons]} px-2.5 py-1 rounded-full text-xs font-medium text-white`}>
                    {campaign.channel}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[campaign.status as keyof typeof statusColors]}`}>
                    {campaign.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-gray-900">₹{campaign.budget.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">₹{campaign.spent.toLocaleString()} spent</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-gray-900">{campaign.impressions.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="font-medium text-gray-900">{campaign.clicks.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {campaign.ctr > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-gray-400" />
                    )}
                    <span className={campaign.ctr > 0 ? 'text-green-600' : 'text-gray-500'}>
                      {campaign.ctr}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                      {campaign.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
