'use client'

import { useState } from 'react'
import { Sparkles, Send, ChevronRight, Target, Wallet, TrendingUp, Clock, MapPin, Users, Loader2, Check, Zap } from 'lucide-react'

interface GeneratedCampaign {
  id: string
  name: string
  types: string[]
  channels: { type: string; channels: string[]; budget: number }[]
  creative: { headline: string; body: string; cta: string }
  estimated: { reach: number; impressions: number; clicks: number; conversions: number }
  aiReasoning: string[]
}

const merchantTypes = [
  { id: 'restaurant', name: 'Restaurant', emoji: '🍽️' },
  { id: 'hotel', name: 'Hotel', emoji: '🏨' },
  { id: 'retail', name: 'Retail', emoji: '🛍️' },
  { id: 'fitness', name: 'Fitness', emoji: '💪' },
  { id: 'general', name: 'General', emoji: '🏪' },
]

const locations = [
  'All India',
  'Mumbai',
  'Delhi NCR',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Pune',
]

export default function AICampaignPage() {
  const [goal, setGoal] = useState('')
  const [merchantType, setMerchantType] = useState('restaurant')
  const [location, setLocation] = useState('All India')
  const [budget, setBudget] = useState(10000)
  const [isGenerating, setIsGenerating] = useState(false)
  const [campaign, setCampaign] = useState<GeneratedCampaign | null>(null)
  const [step, setStep] = useState<'input' | 'preview' | 'launch'>('input')

  // Generate campaign using AI
  const generateCampaign = async () => {
    setIsGenerating(true)
    try {
      // Simulate AI generation (would call REZ-ai-campaign-builder)
      await new Promise(resolve => setTimeout(resolve, 2000))

      const generated: GeneratedCampaign = {
        id: `camp_${Date.now()}`,
        name: merchantType === 'restaurant' ? 'Lunch Rush 2026' : 'Growth Boost 2026',
        types: ['broadcast', 'dooh', 'qr', 'in-app'],
        channels: [
          { type: 'broadcast', channels: ['whatsapp', 'sms'], budget: Math.round(budget * 0.35) },
          { type: 'dooh', channels: ['restaurant_tv'], budget: Math.round(budget * 0.25) },
          { type: 'qr', channels: ['table_tent'], budget: Math.round(budget * 0.20) },
          { type: 'in-app', channels: ['feed'], budget: Math.round(budget * 0.20) },
        ],
        creative: {
          headline: merchantType === 'restaurant' ? 'Taste That Speaks!' : 'Discover Amazing Deals',
          body: merchantType === 'restaurant'
            ? 'Experience flavors that keep you coming back. Order now and get 15% off your first order!'
            : 'Check out our latest offerings. Quality you can trust, prices you\'ll love.',
          cta: merchantType === 'restaurant' ? 'Order Now' : 'Shop Now',
        },
        estimated: {
          reach: Math.round(budget / 2),
          impressions: Math.round(budget / 1.5),
          clicks: Math.round(budget / 10),
          conversions: Math.round(budget / 100),
        },
        aiReasoning: [
          `Selected 4 channels based on ${merchantType} industry patterns`,
          merchantType === 'restaurant' ? 'WhatsApp and SMS recommended for lunch/dinner rush timing' : 'Email recommended for advance planning',
          'Budget allocated with broadcast getting priority',
          `Targeting ${location} with office area focus for weekday traffic`,
        ],
      }

      setCampaign(generated)
      setStep('preview')
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // Launch campaign
  const launchCampaign = async () => {
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    alert(`Campaign "${campaign?.name}" launched! Budget reserved: ₹${budget.toLocaleString()}`)
    setStep('launch')
    setIsGenerating(false)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Campaign Builder</h1>
          <p className="text-gray-500">Tell us your goal, we'll create the campaign</p>
        </div>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="space-y-6">
          {/* Goal Input */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What is your marketing goal?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Get more lunch customers, Increase weekend footfall, Promote new menu items..."
              className="w-full p-4 border border-gray-300 rounded-xl resize-none h-32 text-lg"
            />
            <p className="text-sm text-gray-500 mt-2">
              Be specific! More details = better campaign
            </p>
          </div>

          {/* Merchant Type */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Business Type
            </label>
            <div className="flex flex-wrap gap-3">
              {merchantTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setMerchantType(type.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                    merchantType === type.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{type.emoji}</span>
                  <span className="font-medium">{type.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl"
              >
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Wallet className="w-4 h-4 inline mr-1" />
                Budget
              </label>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-purple-600">₹{budget.toLocaleString()}</span>
                <input
                  type="range"
                  min={5000}
                  max={100000}
                  step={1000}
                  value={budget}
                  onChange={(e) => setBudget(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateCampaign}
            disabled={!goal || isGenerating}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                AI is creating your campaign...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Campaign with AI
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && campaign && (
        <div className="space-y-6">
          {/* Generated Campaign */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium opacity-80">AI Generated</span>
            </div>
            <h2 className="text-2xl font-bold">{campaign.name}</h2>
            <p className="opacity-80 mt-1">{campaign.creative.headline}</p>
          </div>

          {/* Creative */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Ad Creative</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xl font-bold text-gray-900">{campaign.creative.headline}</p>
              <p className="text-gray-600 mt-2">{campaign.creative.body}</p>
              <button className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium">
                {campaign.creative.cta}
              </button>
            </div>
          </div>

          {/* Channels */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Channels & Budget</h3>
            <div className="space-y-3">
              {campaign.channels.map((channel, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{channel.type}</p>
                      <p className="text-sm text-gray-500">{channel.channels.join(', ')}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-purple-600">₹{channel.budget.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="font-semibold text-gray-900">Total Budget</span>
              <span className="text-2xl font-bold text-purple-600">₹{budget.toLocaleString()}</span>
            </div>
          </div>

          {/* Estimated Results */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Estimated Results</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{campaign.estimated.reach.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Reach</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{campaign.estimated.impressions.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Impressions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{campaign.estimated.clicks.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Clicks</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{campaign.estimated.conversions}</p>
                <p className="text-sm text-gray-500">Conversions</p>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">AI Recommendations</h3>
            <ul className="space-y-2">
              {campaign.aiReasoning.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={() => setStep('input')}
              className="flex-1 py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold"
            >
              Regenerate
            </button>
            <button
              onClick={launchCampaign}
              disabled={isGenerating}
              className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Launch Campaign
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Launched */}
      {step === 'launch' && (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Campaign Launched!</h2>
          <p className="text-gray-500 mb-8">Your AI-generated campaign is now live.</p>
          <button
            onClick={() => {
              setStep('input')
              setGoal('')
              setCampaign(null)
            }}
            className="px-8 py-3 bg-purple-600 text-white rounded-xl font-semibold"
          >
            Create Another Campaign
          </button>
        </div>
      )}
    </div>
  )
}
