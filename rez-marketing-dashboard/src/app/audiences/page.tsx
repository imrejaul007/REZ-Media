'use client'

import { useState } from 'react'
import {
  Plus,
  Search,
  Users,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'

const audiences = [
  {
    id: '1',
    name: 'High Value Customers',
    description: 'Users with LTV > ₹10,000',
    count: 1240,
    growth: 8,
    source: 'ai',
    lastUpdated: '2 hours ago',
  },
  {
    id: '2',
    name: 'Loyal Users',
    description: 'Users with 3+ purchases',
    count: 892,
    growth: 12,
    source: 'rule',
    lastUpdated: '1 day ago',
  },
  {
    id: '3',
    name: 'At Risk',
    description: 'No activity in 30+ days',
    count: 456,
    growth: -5,
    source: 'ai',
    lastUpdated: '4 hours ago',
  },
  {
    id: '4',
    name: 'New Users (30d)',
    description: 'Joined in last 30 days',
    count: 234,
    growth: 45,
    source: 'rule',
    lastUpdated: '1 hour ago',
  },
  {
    id: '5',
    name: 'Abandoned Cart',
    description: 'Added to cart but no purchase',
    count: 189,
    growth: 3,
    source: 'behavior',
    lastUpdated: '30 min ago',
  },
  {
    id: '6',
    name: 'VIP Members',
    description: 'Top 10% by spend',
    count: 156,
    growth: 2,
    source: 'ai',
    lastUpdated: '1 day ago',
  },
]

const audienceTypes = [
  { id: 'ai', name: 'AI Segments', count: 3, color: 'bg-purple-100 text-purple-700' },
  { id: 'rule', name: 'Rule-Based', count: 2, color: 'bg-blue-100 text-blue-700' },
  { id: 'behavior', name: 'Behavioral', count: 1, color: 'bg-green-100 text-green-700' },
]

export default function AudiencesPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const filteredAudiences = audiences.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter !== 'all' && a.source !== typeFilter) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audiences</h1>
          <p className="text-sm text-gray-500">Manage your customer segments</p>
        </div>
        <Link
          href="/audiences/new"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Create Audience
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {audienceTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setTypeFilter(type.id === typeFilter ? 'all' : type.id)}
            className={`p-4 rounded-xl border text-left transition-all ${
              typeFilter === type.id
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
                {type.name}
              </span>
              <span className="text-2xl font-bold text-gray-900">{type.count}</span>
            </div>
            <p className="text-sm text-gray-500">audiences</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search audiences..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Audience List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAudiences.map((audience) => (
          <div
            key={audience.id}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{audience.name}</h3>
                  <p className="text-sm text-gray-500">{audience.description}</p>
                </div>
              </div>
              <button className="p-1 text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div>
                <p className="text-2xl font-bold text-gray-900">{audience.count.toLocaleString()}</p>
                <p className="text-sm text-gray-500">users</p>
              </div>
              <div className="flex items-center gap-2">
                {audience.source === 'ai' && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                    <Sparkles className="h-3 w-3" />
                    AI
                  </span>
                )}
                <span className={`flex items-center gap-1 text-xs font-medium ${
                  audience.growth > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {audience.growth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(audience.growth)}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                <Edit className="h-4 w-4" />
                Edit
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>

            <Link
              href={`/broadcasts/new?audience=${audience.id}`}
              className="flex items-center justify-center gap-2 w-full mt-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              Send Campaign
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>

      {/* AI Suggestions */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">AI Recommendations</h3>
            <p className="text-purple-100 mb-4">
              Based on your campaign performance, we suggest creating an audience for "Weekend Shoppers" - users who are most active on weekends.
            </p>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-white text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50">
                Create Segment
              </button>
              <button className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
