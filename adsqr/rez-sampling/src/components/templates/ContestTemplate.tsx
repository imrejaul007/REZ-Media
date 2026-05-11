// Contest Landing Template - AdsQr MVP Phase 4
'use client'

import { useState } from 'react'

interface Prize {
  place: string
  reward: string
  icon: string
}

interface ContestTemplateProps {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
  bannerUrl?: string
  prizes?: Prize[]
  deadline?: string
}

export default function ContestTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1',
  bannerUrl,
  prizes,
  deadline
}: ContestTemplateProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    agreeTerms: false
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const defaultPrizes: Prize[] = prizes || [
    { place: '1st Place', reward: 'Grand Prize', icon: '🏆' },
    { place: '2nd Place', reward: 'Runner Up', icon: '🥈' },
    { place: '3rd Place', reward: 'Third Place', icon: '🥉' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.agreeTerms) {
      alert('Please agree to the terms and conditions')
      return
    }

    setSubmitting(true)
    // In production, this would call an API
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: brandColor + '20' }}
          >
            <span className="text-4xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">You're In!</h2>
          <p className="text-gray-600 mb-6">
            Thank you for entering the contest. Good luck! We'll notify winners via email.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-gray-500">You've earned</p>
            <p className="text-2xl font-bold" style={{ color: brandColor }}>
              +{scanReward} Coins
            </p>
          </div>
          <p className="text-sm text-gray-400">
            Contest ends: {deadline || 'TBD'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div
        className="bg-cover bg-center"
        style={{
          backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
          backgroundColor: bannerUrl ? undefined : brandColor
        }}
      >
        <div className="bg-black/50">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <span className="text-sm text-white/75">{campaignName}</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Prize Display */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <div className="text-center mb-6">
            <span className="text-5xl mb-4 block">🏆</span>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{headline}</h1>
            {deadline && (
              <p className="text-sm text-gray-500">
                Ends: {new Date(deadline).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Prizes List */}
          <div className="space-y-3 mb-6">
            {defaultPrizes.map((prize, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ backgroundColor: idx === 0 ? brandColor + '10' : 'bg-gray-50' }}
              >
                <span className="text-3xl">{prize.icon}</span>
                <div>
                  <p className="font-semibold">{prize.place}</p>
                  <p className="text-sm text-gray-500">{prize.reward}</p>
                </div>
              </div>
            ))}
          </div>

          {details && (
            <p className="text-gray-600 text-center mb-4">{details}</p>
          )}
        </div>

        {/* Entry Form */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h2 className="text-xl font-bold mb-4 text-center">Enter to Win!</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-xl px-4 py-3 focus:ring-2 focus:ring-offset-0"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full border rounded-xl px-4 py-3"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border rounded-xl px-4 py-3"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={formData.agreeTerms}
                onChange={e => setFormData({ ...formData, agreeTerms: e.target.checked })}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-gray-600">
                I agree to the contest terms and conditions and privacy policy
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Submitting...' : 'Enter Contest'}
            </button>
          </form>

          {terms && (
            <p className="text-xs text-gray-400 text-center mt-4">
              * {terms}
            </p>
          )}
        </div>

        {/* Rewards */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{scanReward}</p>
              <p className="text-xs text-gray-500">Entry Coins</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{visitReward}</p>
              <p className="text-xs text-gray-500">Share Coins</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{purchaseReward}</p>
              <p className="text-xs text-gray-500">Purchase Bonus</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
