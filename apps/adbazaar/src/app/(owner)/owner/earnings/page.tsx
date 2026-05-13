'use client'

import { useEffect, useState } from 'react'

interface EarningsData {
  total: number
  pending: number
  paid: number
  breakdown: {
    listings: number
    qrCampaigns: number
    dooh: number
    inAppAds: number
  }
  history: Array<{
    id: string
    date: string
    amount: number
    source: string
    status: string
  }>
}

export default function OwnerEarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadEarnings()
  }, [period])

  async function loadEarnings() {
    try {
      setLoading(true)
      // Mock earnings data
      setEarnings({
        total: 45680,
        pending: 8500,
        paid: 37180,
        breakdown: {
          listings: 24560,
          qrCampaigns: 8540,
          dooh: 9820,
          inAppAds: 2760,
        },
        history: [
          { id: '1', date: '2024-01-25', amount: 2500, source: 'Listings', status: 'paid' },
          { id: '2', date: '2024-01-24', amount: 890, source: 'QR Campaigns', status: 'paid' },
          { id: '3', date: '2024-01-23', amount: 1200, source: 'DOOH', status: 'paid' },
          { id: '4', date: '2024-01-22', amount: 450, source: 'In-App Ads', status: 'paid' },
          { id: '5', date: '2024-01-21', amount: 3200, source: 'Listings', status: 'paid' },
          { id: '6', date: '2024-01-20', amount: 1800, source: 'Listings', status: 'pending' },
          { id: '7', date: '2024-01-19', amount: 950, source: 'DOOH', status: 'pending' },
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Unified Earnings</h1>
          <p className="text-gray-400 text-sm">All your revenue streams in one view</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                period === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : earnings && (
        <>
          {/* Total Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-6 rounded-lg bg-gradient-to-br from-green-900/30 to-green-950/50" style={{ border: '1px solid #166534' }}>
              <p className="text-gray-400 text-sm mb-2">Total Earnings</p>
              <p className="text-3xl font-bold text-white">₹{earnings.total.toLocaleString()}</p>
            </div>
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-2">Pending Payout</p>
              <p className="text-3xl font-bold text-yellow-400">₹{earnings.pending.toLocaleString()}</p>
            </div>
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <p className="text-gray-400 text-sm mb-2">Paid Out</p>
              <p className="text-3xl font-bold text-green-400">₹{earnings.paid.toLocaleString()}</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Revenue Breakdown</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                <span className="text-xl mr-2">📋</span>
                <span className="text-gray-400 text-sm">Listings</span>
                <p className="text-xl font-bold text-white mt-2">₹{earnings.breakdown.listings.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((earnings.breakdown.listings / earnings.total) * 100).toFixed(0)}%</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                <span className="text-xl mr-2">◫</span>
                <span className="text-gray-400 text-sm">QR Campaigns</span>
                <p className="text-xl font-bold text-white mt-2">₹{earnings.breakdown.qrCampaigns.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((earnings.breakdown.qrCampaigns / earnings.total) * 100).toFixed(0)}%</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                <span className="text-xl mr-2">🖥</span>
                <span className="text-gray-400 text-sm">DOOH</span>
                <p className="text-xl font-bold text-white mt-2">₹{earnings.breakdown.dooh.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((earnings.breakdown.dooh / earnings.total) * 100).toFixed(0)}%</p>
              </div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                <span className="text-xl mr-2">📱</span>
                <span className="text-gray-400 text-sm">In-App Ads</span>
                <p className="text-xl font-bold text-white mt-2">₹{earnings.breakdown.inAppAds.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{((earnings.breakdown.inAppAds / earnings.total) * 100).toFixed(0)}%</p>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
            <div className="p-4" style={{ borderBottom: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white">Transaction History</h2>
            </div>
            <table className="w-full">
              <thead style={{ backgroundColor: '#0d0d14' }}>
                <tr>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Date</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Source</th>
                  <th className="text-left text-gray-400 text-sm font-medium px-4 py-3">Status</th>
                  <th className="text-right text-gray-400 text-sm font-medium px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#2a2a3e' }}>
                {earnings.history.map(item => (
                  <tr key={item.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white text-sm">{item.date}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{item.source}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-green-400 text-sm font-medium">
                      ₹{item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
