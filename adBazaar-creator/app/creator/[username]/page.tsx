'use client'

import { useState } from 'react'

// Demo creator data
const CREATOR = {
  id: '1',
  display_name: 'Priya Sharma',
  username: '@priyasharma',
  bio: 'Fashion blogger | Lifestyle influencer | Brand collaborations | Mumbai based 📍 Travel ✈️ Food 🍕',
  avatar: 'https://i.pravatar.cc/200?img=1',
  cover: 'https://picsum.photos/1200/400?random=1',
  followers: 2500000,
  following: 450,
  posts: 1234,
  engagement_rate: 8.5,
  location: 'Mumbai, India',
  website: 'priyasharma.com',
  verified: true,
  rates: {
    sponsored_post: 50000,
    sponsored_story: 25000,
    sponsored_reel: 75000,
    monthly_retainer: 200000,
    per_scan: 5,
    per_conversion: 500,
  },
  socials: [
    { platform: 'instagram', username: '@priyasharma', followers: 2.5, verified: true },
    { platform: 'youtube', username: '@priyasharma', followers: 500, verified: true },
    { platform: 'twitter', username: '@priyasharma', followers: 120, verified: false },
  ],
  niche: ['Fashion', 'Lifestyle', 'Travel', 'Food'],
}

const REVIEWS = [
  { brand: 'FabIndia', rating: 5, comment: 'Amazing content, great engagement!', date: '2024-03' },
  { brand: 'Nykaa', rating: 5, comment: 'Professional and timely delivery', date: '2024-02' },
  { brand: 'Zomato', rating: 4, comment: 'Good quality posts', date: '2024-01' },
]

const PORTFOLIO = [
  { type: 'image', url: 'https://picsum.photos/400/400?random=10' },
  { type: 'image', url: 'https://picsum.photos/400/400?random=11' },
  { type: 'image', url: 'https://picsum.photos/400/400?random=12' },
  { type: 'image', url: 'https://picsum.photos/400/400?random=13' },
  { type: 'image', url: 'https://picsum.photos/400/400?random=14' },
  { type: 'image', url: 'https://picsum.photos/400/400?random=15' },
]

export default function CreatorProfilePage({ params }: { params: { username: string } }) {
  const [activeTab, setActiveTab] = useState<'posts' | 'campaigns' | 'reviews'>('posts')
  const [showBooking, setShowBooking] = useState(false)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Cover */}
      <div className="h-48 relative">
        <img src={CREATOR.cover} alt="" className="w-full h-48 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Profile Info */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative">
        <div className="flex items-end gap-4">
          <img
            src={CREATOR.avatar}
            alt={CREATOR.display_name}
            className="w-32 h-32 rounded-full border-4 border-black"
          />
          <div className="pb-2 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{CREATOR.display_name}</h1>
              {CREATOR.verified && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500">✓ Verified</span>
              )}
            </div>
            <p className="text-white/60">@{params.username.replace('@', '')}</p>
          </div>
          <button
            onClick={() => setShowBooking(true)}
            className="px-6 py-2 rounded-lg font-bold"
            style={{ backgroundColor: '#f59e0b', color: '#000' }}
          >
            Book Now
          </button>
        </div>

        {/* Bio */}
        <p className="mt-4 text-white/80">{CREATOR.bio}</p>

        {/* Stats */}
        <div className="flex gap-6 mt-4 py-4 border-b border-white/10">
          <div className="text-center">
            <p className="text-xl font-bold">{(CREATOR.followers / 1000000).toFixed(1)}M</p>
            <p className="text-xs text-white/50">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{CREATOR.posts.toLocaleString()}</p>
            <p className="text-xs text-white/50">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-500">{CREATOR.engagement_rate}%</p>
            <p className="text-xs text-white/50">Engagement</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">₹{CREATOR.rates.sponsored_post.toLocaleString()}</p>
            <p className="text-xs text-white/50">Per Post</p>
          </div>
        </div>

        {/* Social Links */}
        <div className="flex gap-3 py-4">
          {CREATOR.socials.map((social) => (
            <a
              key={social.platform}
              href="#"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5"
            >
              <span className="text-lg">
                {social.platform === 'instagram' && '📷'}
                {social.platform === 'youtube' && '▶️'}
                {social.platform === 'twitter' && '🐦'}
              </span>
              <span className="text-sm">{(social.followers / 1000).toFixed(0)}K</span>
              {social.verified && <span className="text-blue-500 text-xs">✓</span>}
            </a>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-white/10">
          {(['posts', 'campaigns', 'reviews'] as const).map((tab) => (
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

        {/* Content */}
        <div className="py-6">
          {activeTab === 'posts' && (
            <div className="grid grid-cols-3 gap-1">
              {PORTFOLIO.map((item, i) => (
                <img key={i} src={item.url} alt="" className="aspect-square object-cover rounded" />
              ))}
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold">FabIndia Collection Launch</h3>
                    <p className="text-sm text-white/50">Fashion • Sponsored Post</p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-500">Completed</span>
                </div>
                <div className="flex gap-4 text-sm text-white/50">
                  <span>2.5M impressions</span>
                  <span>15K saves</span>
                  <span>₹50,000 earned</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {REVIEWS.map((review, i) => (
                <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                  <div className="flex justify-between">
                    <span className="font-medium">{review.brand}</span>
                    <span className="text-amber-500">{'★'.repeat(review.rating)}</span>
                  </div>
                  <p className="text-sm text-white/70 mt-2">{review.comment}</p>
                  <p className="text-xs text-white/40 mt-1">{review.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full rounded-2xl p-6" style={{ backgroundColor: '#1a1a1a' }}>
            <h2 className="text-xl font-bold mb-4">Book {CREATOR.display_name}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Campaign Name</label>
                <input type="text" placeholder="Your campaign name" className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>

              <div>
                <label className="block text-sm mb-1">Content Type</label>
                <select className="w-full p-3 rounded-lg bg-white/5 border border-white/10">
                  <option>Instagram Post - ₹{CREATOR.rates.sponsored_post.toLocaleString()}</option>
                  <option>Instagram Story - ₹{CREATOR.rates.sponsored_story.toLocaleString()}</option>
                  <option>Instagram Reel - ₹{CREATOR.rates.sponsored_reel.toLocaleString()}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">Campaign Budget</label>
                <input type="number" placeholder="50000" className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>

              <div>
                <label className="block text-sm mb-1">Brief</label>
                <textarea rows={3} placeholder="Tell the creator about your brand..." className="w-full p-3 rounded-lg bg-white/5 border border-white/10" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBooking(false)}
                className="flex-1 py-3 rounded-lg border border-white/20"
              >
                Cancel
              </button>
              <button
                className="flex-1 py-3 rounded-lg font-bold"
                style={{ backgroundColor: '#f59e0b', color: '#000' }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
