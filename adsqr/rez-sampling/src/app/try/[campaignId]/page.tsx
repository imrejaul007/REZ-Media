/**
 * REZ Try - Free Sample & Trial Landing Page
 *
 * User scans QR → lands here → chooses:
 * 1. Free Sample (shipped to address)
 * 2. Free Trial (book a slot)
 * 3. Branded Coins (instant credit)
 */

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { getFreeSamples, getFreeTrials, requestFreeSample, bookFreeTrial } from '@/lib/rezTry'
import { getStoredUser } from '@/lib/rezAuth'

interface PageProps {
  params: { campaignId: string }
  searchParams: { qr?: string; scan_id?: string }
}

interface FreeSample {
  id: string
  name: string
  description: string
  image_url?: string
  stock: number
  coin_cost: number
}

interface FreeTrial {
  id: string
  name: string
  description: string
  duration_minutes: number
  locations: string[]
  coin_cost: number
  slots_available: number
}

export default function TryPage({ params, searchParams }: PageProps) {
  const [user, setUser] = useState<any>(null)
  const [campaign, setCampaign] = useState<any>(null)
  const [samples, setSamples] = useState<FreeSample[]>([])
  const [trials, setTrials] = useState<FreeTrial[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'choose' | 'sample' | 'trial'>('choose')

  // Sample form state
  const [selectedSample, setSelectedSample] = useState<FreeSample | null>(null)
  const [shippingAddress, setShippingAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [sampleSuccess, setSampleSuccess] = useState(false)

  // Trial form state
  const [selectedTrial, setSelectedTrial] = useState<FreeTrial | null>(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [trialSuccess, setTrialSuccess] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.campaignId])

  async function loadData() {
    const supabase = createClient()
    const currentUser = getStoredUser()
    setUser(currentUser)

    // Get campaign
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.campaignId)
      .single()

    setCampaign(campaignData)

    // Get REZ Try items
    const [sampleData, trialData] = await Promise.all([
      getFreeSamples(params.campaignId),
      getFreeTrials(params.campaignId),
    ])

    setSamples(sampleData)
    setTrials(trialData)
    setLoading(false)
  }

  async function handleRequestSample() {
    if (!selectedSample || !user) return

    const result = await requestFreeSample(
      selectedSample.id,
      params.campaignId,
      user.id,
      shippingAddress,
      phone
    )

    if (result.success) {
      setSampleSuccess(true)
    } else {
      alert(result.error || 'Failed to request sample')
    }
  }

  async function handleBookTrial() {
    if (!selectedTrial || !user || !selectedSlot) return

    const result = await bookFreeTrial(
      selectedTrial.id,
      params.campaignId,
      user.id,
      selectedSlot,
      selectedLocation
    )

    if (result.success) {
      setTrialSuccess(true)
    } else {
      alert(result.error || 'Failed to book trial')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading rewards...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm py-6 px-4">
        <div className="max-w-lg mx-auto text-center text-white">
          <h1 className="text-3xl font-bold mb-2">
            🎁 {campaign?.brand_name || 'Brand'} Rewards
          </h1>
          <p className="opacity-90">
            Scan complete! Choose your reward below
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Success Messages */}
        {sampleSuccess && (
          <div className="bg-green-500 text-white p-6 rounded-2xl mb-6 text-center">
            <div className="text-4xl mb-2">✓</div>
            <h3 className="text-xl font-bold mb-2">Sample Requested!</h3>
            <p>We'll ship it to your address within 3-5 days.</p>
          </div>
        )}

        {trialSuccess && (
          <div className="bg-green-500 text-white p-6 rounded-2xl mb-6 text-center">
            <div className="text-4xl mb-2">✓</div>
            <h3 className="text-xl font-bold mb-2">Trial Booked!</h3>
            <p>Show up at {selectedLocation} at {selectedSlot}.</p>
          </div>
        )}

        {/* Choose Reward Tabs */}
        {!sampleSuccess && !trialSuccess && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
            {/* Tabs */}
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('choose')}
                className={`flex-1 py-4 text-center font-medium ${
                  activeTab === 'choose' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
                }`}
              >
                🎁 Choose Reward
              </button>
              <button
                onClick={() => setActiveTab('sample')}
                className={`flex-1 py-4 text-center font-medium ${
                  activeTab === 'sample' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
                }`}
              >
                📦 Free Samples
              </button>
              <button
                onClick={() => setActiveTab('trial')}
                className={`flex-1 py-4 text-center font-medium ${
                  activeTab === 'trial' ? 'bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
                }`}
              >
                🧪 Free Trials
              </button>
            </div>

            <div className="p-6">
              {/* Choose Reward Tab */}
              {activeTab === 'choose' && (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold mb-2">What would you like?</h2>
                    <p className="text-gray-500">Choose from our reward options below</p>
                  </div>

                  <button
                    onClick={() => setActiveTab('sample')}
                    className="w-full p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-transparent hover:border-purple-300 transition text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">📦</span>
                      <div>
                        <h3 className="font-bold text-lg">Free Product Sample</h3>
                        <p className="text-sm text-gray-500">{samples.length} samples available</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('trial')}
                    className="w-full p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-transparent hover:border-blue-300 transition text-left"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">🧪</span>
                      <div>
                        <h3 className="font-bold text-lg">Free Trial Experience</h3>
                        <p className="text-sm text-gray-500">{trials.length} trials available</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Free Samples Tab */}
              {activeTab === 'sample' && (
                <div>
                  <h2 className="text-xl font-bold mb-4">📦 Free Samples</h2>

                  {samples.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-4">📭</div>
                      <p>No samples available right now</p>
                      <p className="text-sm">Check back soon!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {samples.map(sample => (
                        <div
                          key={sample.id}
                          className={`p-4 rounded-xl border-2 transition ${
                            selectedSample?.id === sample.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedSample(sample)}
                        >
                          {sample.image_url && (
                            <img
                              src={sample.image_url}
                              alt={sample.name}
                              className="w-full h-40 object-cover rounded-lg mb-3"
                            />
                          )}
                          <h3 className="font-bold text-lg">{sample.name}</h3>
                          <p className="text-gray-500 text-sm">{sample.description}</p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-400">
                              {sample.stock} left
                            </span>
                            <span className="text-indigo-600 font-bold">
                              FREE
                            </span>
                          </div>
                        </div>
                      ))}

                      {selectedSample && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                          <h3 className="font-bold mb-3">Shipping Address</h3>
                          <textarea
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            placeholder="Enter your full address"
                            className="w-full p-3 rounded-lg border mb-3"
                            rows={3}
                          />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Phone number"
                            className="w-full p-3 rounded-lg border mb-3"
                          />
                          <button
                            onClick={handleRequestSample}
                            disabled={!shippingAddress || !phone}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                          >
                            Request Sample
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Free Trials Tab */}
              {activeTab === 'trial' && (
                <div>
                  <h2 className="text-xl font-bold mb-4">🧪 Free Trials</h2>

                  {trials.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-4">📭</div>
                      <p>No trials available right now</p>
                      <p className="text-sm">Check back soon!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {trials.map(trial => (
                        <div
                          key={trial.id}
                          className={`p-4 rounded-xl border-2 transition ${
                            selectedTrial?.id === trial.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedTrial(trial)}
                        >
                          <h3 className="font-bold text-lg">{trial.name}</h3>
                          <p className="text-gray-500 text-sm">{trial.description}</p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-sm text-gray-500">
                              {trial.duration_minutes} min
                            </span>
                            <span className="text-indigo-600 font-bold">
                              FREE
                            </span>
                          </div>
                        </div>
                      ))}

                      {selectedTrial && (
                        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                          <h3 className="font-bold mb-3">Select Location & Time</h3>

                          <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="w-full p-3 rounded-lg border mb-3"
                          >
                            <option value="">Select location</option>
                            {selectedTrial.locations.map((loc, i) => (
                              <option key={i} value={loc}>{loc}</option>
                            ))}
                          </select>

                          <input
                            type="datetime-local"
                            value={selectedSlot}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                            className="w-full p-3 rounded-lg border mb-3"
                          />

                          <button
                            onClick={handleBookTrial}
                            disabled={!selectedSlot || !selectedLocation}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-50"
                          >
                            Book Trial
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-white/60 text-sm mt-8">
          <p>Powered by REZ Try</p>
          <p>try.rez.money</p>
        </div>
      </div>
    </div>
  )
}
