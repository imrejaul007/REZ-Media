'use client'

import { useState } from 'react'

const DOOH_CAMPAIGNS = [
  {
    id: '1',
    title: 'Monsoon Collection',
    brand: 'FabIndia',
    screens: ['restaurant_tv', 'hotel_lobby'],
    rate_per_scan: 5,
    max_scans: 10000,
    deadline: '2024-04-15',
  },
  {
    id: '2',
    title: 'Tech Launch',
    brand: 'Apple Reseller',
    screens: ['mall_kiosk', 'office_lobby'],
    rate_per_scan: 8,
    max_scans: 5000,
    deadline: '2024-04-20',
  },
  {
    id: '3',
    title: 'Summer Sale',
    brand: 'Zara',
    screens: ['bus_shelter', 'mall_kiosk'],
    rate_per_scan: 3,
    max_scans: 20000,
    deadline: '2024-04-30',
  },
]

const SCREEN_TYPES = [
  { id: 'restaurant_tv', name: 'Restaurant TV', icon: '🍽️', rate: 5 },
  { id: 'hotel_lobby', name: 'Hotel Lobby', icon: '🏨', rate: 8 },
  { id: 'bus_shelter', name: 'Bus Shelter', icon: '🚌', rate: 3 },
  { id: 'mall_kiosk', name: 'Mall Kiosk', icon: '🛒', rate: 6 },
  { id: 'office_lobby', name: 'Office Lobby', icon: '🏢', rate: 7 },
  { id: 'gym_screen', name: 'Gym Screen', icon: '💪', rate: 4 },
  { id: 'cab_tablet', name: 'Cab Tablet', icon: '🚕', rate: 5 },
]

export default function DOOHContentPage() {
  const [activeTab, setActiveTab] = useState<'opportunities' | 'my_content' | 'earnings'>('opportunities')
  const [selectedCampaign, setSelectedCampaign] = useState<typeof DOOH_CAMPAIGNS[0] | null>(null)
  const [uploadedContent, setUploadedContent] = useState<string[]>([])

  const handleUpload = () => {
    // Demo: add placeholder
    setUploadedContent([...uploadedContent, `https://picsum.photos/800/600?random=${Date.now()}`])
  }

  const estimatedEarnings = uploadedContent.length * (selectedCampaign?.rate_per_scan || 0) * (selectedCampaign?.max_scans || 0) / 100

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Header */}
      <div className="border-b border-white/10" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold mb-2">DOOH Content</h1>
          <p className="text-sm text-white/50">Create content for digital screens & earn per scan</p>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-6">
          {(['opportunities', 'my_content', 'earnings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium ${
                activeTab === tab ? 'text-amber-500 border-b-2 border-amber-500' : 'text-white/50'
              }`}
            >
              {tab === 'opportunities' ? '📺 Opportunities' :
               tab === 'my_content' ? '📁 My Content' : '💰 Earnings'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Opportunities */}
        {activeTab === 'opportunities' && (
          <>
            <h2 className="text-lg font-semibold mb-4">Available Campaigns</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {DOOH_CAMPAIGNS.map(campaign => (
                <div
                  key={campaign.id}
                  className="p-4 rounded-xl cursor-pointer"
                  style={{ backgroundColor: '#1a1a1a' }}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{campaign.title}</h3>
                      <p className="text-sm text-white/50">{campaign.brand}</p>
                    </div>
                    <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-500">
                      ₹{campaign.rate_per_scan}/scan
                    </span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    {campaign.screens.map(screen => (
                      <span key={screen} className="px-2 py-1 rounded text-xs bg-white/10">
                        {SCREEN_TYPES.find(s => s.id === screen)?.icon} {screen}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm text-white/50">
                    <span>Max {campaign.max_scans.toLocaleString()} scans</span>
                    <span>Due {campaign.deadline}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Campaign Modal */}
            {selectedCampaign && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                <div className="max-w-lg w-full rounded-2xl p-6" style={{ backgroundColor: '#1a1a1a' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedCampaign.title}</h2>
                      <p className="text-white/50">{selectedCampaign.brand}</p>
                    </div>
                    <button onClick={() => setSelectedCampaign(null)} className="text-2xl">&times;</button>
                  </div>

                  {/* Upload */}
                  <div className="mb-4">
                    <label className="block text-sm mb-2">Upload Content</label>
                    <div
                      className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500"
                      onClick={handleUpload}
                    >
                      <p className="text-4xl mb-2">📁</p>
                      <p className="text-sm text-white/50">Click to upload or drag & drop</p>
                      <p className="text-xs text-white/30">PNG, JPG up to 10MB</p>
                    </div>
                  </div>

                  {/* Uploaded Content Preview */}
                  {uploadedContent.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {uploadedContent.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="w-full aspect-video rounded-lg object-cover" />
                          <button
                            onClick={() => setUploadedContent(uploadedContent.filter((_, idx) => idx !== i)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Caption */}
                  <div className="mb-4">
                    <label className="block text-sm mb-1">Caption (optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Add a caption for your content..."
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-sm"
                    />
                  </div>

                  {/* Earnings Estimate */}
                  <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#0a0a0a' }}>
                    <p className="text-sm text-white/50">Estimated Earnings</p>
                    <p className="text-2xl font-bold text-amber-500">
                      ₹{estimatedEarnings.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/30">
                      Based on {uploadedContent.length} pieces × {selectedCampaign.rate_per_scan}/scan × est. {selectedCampaign.max_scans / 100} scans
                    </p>
                  </div>

                  {/* Submit */}
                  <button
                    disabled={uploadedContent.length === 0}
                    className="w-full py-3 rounded-lg font-bold disabled:opacity-50"
                    style={{ backgroundColor: '#f59e0b', color: '#000' }}
                  >
                    Submit for Review
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* My Content */}
        {activeTab === 'my_content' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">My DOOH Content</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <div className="flex gap-4">
                  <img src="https://picsum.photos/200/150" alt="" className="w-32 h-24 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h3 className="font-medium">Monsoon Collection</h3>
                    <p className="text-sm text-white/50">Submitted 2 days ago</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 rounded text-xs bg-yellow-500/20 text-yellow-500">Under Review</span>
                      <span className="px-2 py-1 rounded text-xs bg-white/10">500 scans</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-500">₹2,500</p>
                    <p className="text-xs text-white/50">potential</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <div className="flex gap-4">
                  <img src="https://picsum.photos/200/150?random=2" alt="" className="w-32 h-24 rounded-lg object-cover" />
                  <div className="flex-1">
                    <h3 className="font-medium">Tech Launch</h3>
                    <p className="text-sm text-white/50">Approved 5 days ago</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-500">Active</span>
                      <span className="px-2 py-1 rounded text-xs bg-white/10">2,340 scans</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-500">₹18,720</p>
                    <p className="text-xs text-green-500">earned</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Earnings */}
        {activeTab === 'earnings' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">DOOH Earnings</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50">This Month</p>
                <p className="text-2xl font-bold text-amber-500">₹45,000</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">₹12,500</p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-sm text-white/50">Total Earned</p>
                <p className="text-2xl font-bold">₹1,25,000</p>
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#1a1a1a' }}>
              <h3 className="font-semibold mb-3">Earnings History</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span>FabIndia - Monsoon</span>
                  <span className="text-green-500">₹18,720</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span>Apple Reseller - Tech Launch</span>
                  <span className="text-green-500">₹15,600</span>
                </div>
                <div className="flex justify-between py-2">
                  <span>Zara - Summer Sale</span>
                  <span className="text-yellow-500">₹12,500</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Screen Types Info */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Screen Types</h3>
          <div className="grid grid-cols-4 gap-3">
            {SCREEN_TYPES.map(screen => (
              <div key={screen.id} className="p-3 rounded-xl text-center" style={{ backgroundColor: '#1a1a1a' }}>
                <p className="text-2xl mb-1">{screen.icon}</p>
                <p className="text-sm font-medium">{screen.name}</p>
                <p className="text-xs text-amber-500">₹{screen.rate}/scan</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
