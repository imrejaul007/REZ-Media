'use client'

import { useState } from 'react'

const CATEGORIES = [
  { slug: 'fashion', name: 'Fashion & Style', icon: '👗', count: 1234 },
  { slug: 'food', name: 'Food & Dining', icon: '🍔', count: 892 },
  { slug: 'travel', name: 'Travel', icon: '✈️', count: 756 },
  { slug: 'fitness', name: 'Fitness & Health', icon: '💪', count: 645 },
  { slug: 'tech', name: 'Tech & Gadgets', icon: '📱', count: 534 },
  { slug: 'beauty', name: 'Beauty & Skincare', icon: '💄', count: 478 },
  { slug: 'lifestyle', name: 'Lifestyle', icon: '🌟', count: 412 },
  { slug: 'finance', name: 'Finance & Business', icon: '💰', count: 289 },
]

const FEATURED_CREATORS = [
  {
    id: '1',
    name: 'Priya Sharma',
    username: '@priyasharma',
    avatar: 'https://i.pravatar.cc/150?img=1',
    followers: '2.5M',
    engagement: '8.5%',
    niche: ['Fashion', 'Lifestyle'],
    rate: 50000,
  },
  {
    id: '2',
    name: 'Rahul Mehta',
    username: '@rahulmehta',
    avatar: 'https://i.pravatar.cc/150?img=3',
    followers: '1.8M',
    engagement: '6.2%',
    niche: ['Tech', 'Gaming'],
    rate: 35000,
  },
  {
    id: '3',
    name: 'Ananya Patel',
    username: '@ananyapatel',
    avatar: 'https://i.pravatar.cc/150?img=5',
    followers: '1.2M',
    engagement: '9.1%',
    niche: ['Beauty', 'Fashion'],
    rate: 45000,
  },
]

export default function CreatorMarketplacePage() {
  const [activeTab, setActiveTab] = useState<'discover' | 'campaigns' | 'dashboard'>('discover')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="border-b border-white/10" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Creator Marketplace</h1>
              <p className="text-sm text-white/50">Connect with influencers for your brand</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
                + Post Campaign
              </button>
              <button className="px-4 py-2 rounded-lg border border-white/20">
                Become a Creator
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-4">
            {(['discover', 'campaigns', 'dashboard'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 ${
                  activeTab === tab
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-white/50'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-3 rounded-xl border border-white/10"
            style={{ backgroundColor: '#1a1a1a' }}
          />
        </div>

        {/* Categories */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              !selectedCategory ? 'bg-amber-500 text-black' : 'bg-white/10'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                selectedCategory === cat.slug ? 'bg-amber-500 text-black' : 'bg-white/10'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-2xl font-bold text-amber-500">12,456</p>
            <p className="text-sm text-white/50">Active Creators</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-2xl font-bold text-amber-500">3,789</p>
            <p className="text-sm text-white/50">Open Campaigns</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-2xl font-bold text-amber-500">₹2.4Cr</p>
            <p className="text-sm text-white/50">Creator Earnings</p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
            <p className="text-2xl font-bold text-amber-500">45K</p>
            <p className="text-sm text-white/50">Content Pieces</p>
          </div>
        </div>

        {/* Featured Creators */}
        <h2 className="text-xl font-bold mb-4">Featured Creators</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {FEATURED_CREATORS.map((creator) => (
            <div key={creator.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="h-24" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)' }} />
              <div className="p-4 -mt-12 relative">
                <img
                  src={creator.avatar}
                  alt={creator.name}
                  className="w-20 h-20 rounded-full border-4 border-black absolute -top-10 left-4"
                />
                <div className="pt-10">
                  <h3 className="font-bold">{creator.name}</h3>
                  <p className="text-sm text-white/50">{creator.username}</p>
                  <div className="flex gap-2 mt-2">
                    {creator.niche.map((n) => (
                      <span key={n} className="px-2 py-0.5 rounded text-xs bg-white/10">{n}</span>
                    ))}
                  </div>
                  <div className="flex justify-between mt-3 text-sm">
                    <span>{creator.followers} followers</span>
                    <span className="text-amber-500">₹{creator.rate.toLocaleString()}/post</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All Creators */}
        <h2 className="text-xl font-bold mb-4">All Creators</h2>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={`https://i.pravatar.cc/80?img=${i + 10}`}
                  alt=""
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="font-medium">Creator {i}</p>
                  <p className="text-xs text-white/50">@creator{i}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/50">
                <span>{(i * 500)}K followers</span>
                <span>{5 + i}% engagement</span>
              </div>
              <button className="w-full mt-3 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#f59e0b', color: '#000' }}>
                Invite to Campaign
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
