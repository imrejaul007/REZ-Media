'use client'

import { useState } from 'react'
import {
  Smartphone,
  Tv,
  QrCode,
  Radio,
  Users,
  Store,
  ChevronRight,
  ChevronLeft,
  Check,
  Wallet,
  Zap,
  MapPin,
  Target,
  Calendar,
  IndianRupee,
  AlertCircle,
} from 'lucide-react'

// Types
interface AdType {
  id: string
  name: string
  icon: React.ElementType
  color: string
  bgColor: string
  description: string
  minBudget: number
  pricingUnit: string
}

interface Channel {
  id: string
  name: string
  icon: React.ElementType
  minBudget: number
  selected: boolean
}

interface CampaignConfig {
  types: string[]
  channels: string[]
  budget: number
  duration: number
  location: string
  targeting: string
}

// Ad Types Available
const adTypes: AdType[] = [
  { id: 'in-app', name: 'In-App Ads', icon: Smartphone, color: 'text-blue-600', bgColor: 'bg-blue-100', description: 'Banners, feeds, search in mobile apps', minBudget: 500, pricingUnit: 'CPM' },
  { id: 'dooh', name: 'DOOH Screens', icon: Tv, color: 'text-purple-600', bgColor: 'bg-purple-100', description: 'Digital screens in malls, restaurants, gyms', minBudget: 3000, pricingUnit: 'Daily Rate' },
  { id: 'qr', name: 'QR Campaigns', icon: QrCode, color: 'text-green-600', bgColor: 'bg-green-100', description: 'Scannable posters and displays', minBudget: 500, pricingUnit: 'CPS' },
  { id: 'broadcast', name: 'Broadcast', icon: Radio, color: 'text-orange-600', bgColor: 'bg-orange-100', description: 'WhatsApp, SMS, Email, Push', minBudget: 1000, pricingUnit: 'Per Message' },
  { id: 'influencer', name: 'Influencer', icon: Users, color: 'text-pink-600', bgColor: 'bg-pink-100', description: 'Partner with creators', minBudget: 5000, pricingUnit: 'Per Post' },
  { id: 'offline', name: 'Offline Ads', icon: Store, color: 'text-indigo-600', bgColor: 'bg-indigo-100', description: 'Standees, posters, billboards', minBudget: 5000, pricingUnit: 'Weekly' },
]

// Broadcast Channels
const broadcastChannels = [
  { id: 'whatsapp', name: 'WhatsApp', minBudget: 1000 },
  { id: 'sms', name: 'SMS', minBudget: 300 },
  { id: 'email', name: 'Email', minBudget: 300 },
  { id: 'push', name: 'Push', minBudget: 300 },
]

// Locations
const locations = [
  'All India',
  'Mumbai',
  'Delhi NCR',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
]

// Targeting Options
const targetingOptions = [
  { id: 'all', name: 'All Users', description: 'Reach everyone' },
  { id: 'new', name: 'New Users', description: 'Users who joined in 30 days' },
  { id: 'loyal', name: 'Loyal Customers', description: '3+ purchases' },
  { id: 'nearby', name: 'Nearby', description: 'Within 5km radius' },
  { id: 'high-value', name: 'High Value', description: 'Top 10% by spend' },
]

// Duration Options
const durations = [
  { days: 7, label: '1 Week', discount: 0 },
  { days: 14, label: '2 Weeks', discount: 5 },
  { days: 30, label: '1 Month', discount: 10 },
  { days: 90, label: '3 Months', discount: 20 },
]

export default function NewCampaignPage() {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<CampaignConfig>({
    types: [],
    channels: [],
    budget: 0,
    duration: 7,
    location: 'All India',
    targeting: 'all',
  })
  const [walletBalance, setWalletBalance] = useState(25000)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calculate total minimum budget
  const calculateMinBudget = () => {
    let min = 0
    config.types.forEach(typeId => {
      const type = adTypes.find(t => t.id === typeId)
      if (type) min += type.minBudget
    })
    return min
  }

  // Calculate estimated cost
  const calculateEstimatedCost = () => {
    const minBudget = calculateMinBudget()
    const durationDiscount = durations.find(d => d.days === config.duration)?.discount || 0
    return config.budget * (1 - durationDiscount / 100)
  }

  // Toggle ad type selection
  const toggleType = (typeId: string) => {
    setConfig(prev => ({
      ...prev,
      types: prev.types.includes(typeId)
        ? prev.types.filter(t => t !== typeId)
        : [...prev.types, typeId]
    }))
  }

  // Toggle broadcast channel
  const toggleChannel = (channelId: string) => {
    setConfig(prev => ({
      ...prev,
      channels: prev.channels.includes(channelId)
        ? prev.channels.filter(c => c !== channelId)
        : [...prev.channels, channelId]
    }))
  }

  // Check if can proceed
  const canProceed = () => {
    switch (step) {
      case 1: return config.types.length > 0
      case 2: return config.budget >= calculateMinBudget()
      case 3: return config.location !== '' && config.targeting !== ''
      default: return true
    }
  }

  // Submit campaign
  const submitCampaign = async () => {
    setIsSubmitting(true)
    const estimatedCost = calculateEstimatedCost()

    if (walletBalance < estimatedCost) {
      alert('Insufficient wallet balance. Please add funds.')
      setIsSubmitting(false)
      return
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))

    alert(`Campaign created! ₹${estimatedCost.toFixed(0)} reserved from wallet.`)
    setIsSubmitting(false)
    // Redirect to campaigns list
    window.location.href = '/campaigns'
  }

  const minBudget = calculateMinBudget()
  const estimatedCost = calculateEstimatedCost()
  const hasEnoughBalance = walletBalance >= estimatedCost

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Campaign</h1>
        <p className="text-gray-500 mt-1">Set up your marketing campaign in minutes</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
              step >= s ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s ? <Check className="w-5 h-5" /> : s}
            </div>
            <span className={`ml-2 text-sm font-medium ${step >= s ? 'text-purple-600' : 'text-gray-400'}`}>
              {s === 1 ? 'Type' : s === 2 ? 'Budget' : s === 3 ? 'Target' : 'Review'}
            </span>
            {i < 3 && <div className={`w-16 h-0.5 mx-4 ${step > s ? 'bg-purple-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Ad Types */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select Campaign Type</h2>
            <p className="text-gray-500 text-sm">Choose one or more ad types for your campaign</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adTypes.map(type => {
              const Icon = type.icon
              const isSelected = config.types.includes(type.id)
              return (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${type.bgColor}`}>
                      <Icon className={`w-6 h-6 ${type.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{type.name}</h3>
                        {isSelected && <Check className="w-5 h-5 text-purple-600" />}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                      <p className="text-xs text-gray-400 mt-2">Min: ₹{type.minBudget.toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 2: Set Budget */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Set Your Budget</h2>
            <p className="text-gray-500 text-sm">Choose your campaign budget and duration</p>
          </div>

          {/* Wallet Balance */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-8 h-8" />
                <div>
                  <p className="text-purple-100 text-sm">Available Balance</p>
                  <p className="text-2xl font-bold">₹{walletBalance.toLocaleString()}</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30">
                Add Funds
              </button>
            </div>
          </div>

          {/* Broadcast Channels (if selected) */}
          {config.types.includes('broadcast') && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-medium text-gray-900 mb-3">Select Broadcast Channels</h3>
              <div className="flex flex-wrap gap-2">
                {broadcastChannels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => toggleChannel(channel.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                      config.channels.includes(channel.id)
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {channel.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Budget Slider */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">Budget</span>
              <span className="text-2xl font-bold text-purple-600">₹{config.budget.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={minBudget}
              max={walletBalance}
              step={100}
              value={config.budget}
              onChange={(e) => setConfig(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Min: ₹{minBudget.toLocaleString()}</span>
              <span>Max: ₹{walletBalance.toLocaleString()}</span>
            </div>
          </div>

          {/* Duration */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-medium text-gray-900 mb-3">Campaign Duration</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {durations.map(d => (
                <button
                  key={d.days}
                  onClick={() => setConfig(prev => ({ ...prev, duration: d.days }))}
                  className={`p-3 rounded-lg border text-center ${
                    config.duration === d.days
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-gray-900">{d.label}</p>
                  {d.discount > 0 && (
                    <p className="text-xs text-green-600 mt-1">Save {d.discount}%</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Targeting */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Target Your Audience</h2>
            <p className="text-gray-500 text-sm">Choose who will see your ads</p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Location</h3>
            </div>
            <select
              value={config.location}
              onChange={(e) => setConfig(prev => ({ ...prev, location: e.target.value }))}
              className="w-full p-3 border rounded-lg"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Targeting */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-gray-400" />
              <h3 className="font-medium text-gray-900">Audience</h3>
            </div>
            <div className="space-y-3">
              {targetingOptions.map(option => (
                <label
                  key={option.id}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer ${
                    config.targeting === option.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="targeting"
                      value={option.id}
                      checked={config.targeting === option.id}
                      onChange={(e) => setConfig(prev => ({ ...prev, targeting: e.target.value }))}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{option.name}</p>
                      <p className="text-sm text-gray-500">{option.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review & Launch</h2>
            <p className="text-gray-500 text-sm">Confirm your campaign details</p>
          </div>

          {/* Campaign Summary */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-5 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Campaign Summary</h3>
            </div>
            <div className="p-5 space-y-4">
              {/* Types */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Campaign Types</span>
                <div className="flex gap-2">
                  {config.types.map(typeId => {
                    const type = adTypes.find(t => t.id === typeId)
                    if (!type) return null
                    const Icon = type.icon
                    return (
                      <span key={typeId} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${type.bgColor} ${type.color}`}>
                        <Icon className="w-3 h-3" />
                        {type.name}
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Broadcast Channels */}
              {config.types.includes('broadcast') && config.channels.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Channels</span>
                  <span className="text-gray-900">{config.channels.join(', ')}</span>
                </div>
              )}

              {/* Budget */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Budget</span>
                <span className="text-xl font-bold text-purple-600">₹{config.budget.toLocaleString()}</span>
              </div>

              {/* Duration */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="text-gray-900">{durations.find(d => d.days === config.duration)?.label}</span>
              </div>

              {/* Location */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Location</span>
                <span className="text-gray-900">{config.location}</span>
              </div>

              {/* Targeting */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Audience</span>
                <span className="text-gray-900">{targetingOptions.find(t => t.id === config.targeting)?.name}</span>
              </div>

              {/* Estimated Cost */}
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="font-semibold text-gray-900">Estimated Cost</span>
                <div className="text-right">
                  {estimatedCost !== config.budget && (
                    <span className="text-sm text-gray-400 line-through mr-2">₹{config.budget.toLocaleString()}</span>
                  )}
                  <span className="text-2xl font-bold text-purple-600">₹{estimatedCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Warning */}
          {!hasEnoughBalance && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Insufficient Balance</p>
                <p className="text-sm text-red-600 mt-1">
                  You need ₹{(estimatedCost - walletBalance).toLocaleString()} more in your wallet.
                </p>
              </div>
            </div>
          )}

          {/* Estimated Results */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5" />
              <h3 className="font-semibold">Estimated Results</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{Math.round(config.budget / 100).toLocaleString()}</p>
                <p className="text-sm text-purple-200">Reach</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(config.budget / 5).toLocaleString()}</p>
                <p className="text-sm text-purple-200">Clicks</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(config.budget / 50).toLocaleString()}</p>
                <p className="text-sm text-purple-200">Conversions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 px-6 py-3 text-gray-600 disabled:opacity-50"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
          >
            Continue
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={submitCampaign}
            disabled={!hasEnoughBalance || isSubmitting}
            className="flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700"
          >
            {isSubmitting ? (
              <>Processing...</>
            ) : (
              <>
                <Wallet className="w-5 h-5" />
                Launch Campaign (₹{estimatedCost.toLocaleString()})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
