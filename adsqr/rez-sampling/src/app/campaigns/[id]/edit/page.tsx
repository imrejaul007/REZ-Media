'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  description: string
  offer: {
    headline?: string
    details?: string
    terms?: string
  }
  scan_reward: number
  visit_reward: number
  purchase_reward: number
  brand_coins_reward: number
  coin_budget: number
  status: 'draft' | 'active' | 'paused' | 'ended'
  brand_color: string
  banner_url: string
  start_date: string | null
  end_date: string | null
  landing_template: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CampaignEditPage({ params }: PageProps) {
  const router = useRouter()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const [form, setForm] = useState<Campaign>({
    id: '',
    name: '',
    description: '',
    offer: {},
    scan_reward: 10,
    visit_reward: 25,
    purchase_reward: 50,
    brand_coins_reward: 0,
    coin_budget: 10000,
    status: 'draft',
    brand_color: '#6366F1',
    banner_url: '',
    start_date: null,
    end_date: null,
    landing_template: 'bold'
  })

  useEffect(() => {
    params.then(p => setCampaignId(p.id))
  }, [params])

  useEffect(() => {
    if (!campaignId) return

    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`)
        if (res.ok) {
          const { campaign } = await res.json()
          setForm({
            ...campaign,
            offer: typeof campaign.offer === 'string' ? JSON.parse(campaign.offer) : campaign.offer || {}
          })
        }
      } catch (error) {
        console.error('Failed to fetch campaign:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCampaign()
  }, [campaignId])

  const handleChange = (field: keyof Campaign, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleOfferChange = (field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      offer: { ...prev.offer, [field]: value }
    }))
    setHasChanges(true)
  }

  const handleSubmit = async (e: React.FormEvent, newStatus?: string) => {
    e.preventDefault()
    setSaving(true)

    const statusToSave = newStatus || form.status

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: statusToSave })
      })

      if (res.ok) {
        setHasChanges(false)
        if (newStatus) {
          router.push('/campaigns')
        } else {
          router.refresh()
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save campaign')
      }
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setForm(prev => ({ ...prev, status: newStatus as Campaign['status'] }))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading campaign...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href={`/campaigns/${campaignId}`} className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
                ← Back to Campaign
              </Link>
              <h1 className="text-2xl font-bold">Edit Campaign</h1>
            </div>
            <div className="flex gap-2 items-center">
              {hasChanges && (
                <span className="text-sm text-orange-500">Unsaved changes</span>
              )}
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                {previewMode ? 'Edit Mode' : 'Preview'}
              </button>
              <button
                onClick={() => handleStatusChange(form.status === 'active' ? 'paused' : 'active')}
                disabled={saving}
                className={`px-4 py-2 rounded-lg ${
                  form.status === 'active'
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {saving ? 'Saving...' : form.status === 'active' ? 'Pause' : 'Activate'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {previewMode ? (
          <PreviewPanel campaign={form} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Campaign Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => handleChange('name', e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Summer Special Offer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => handleChange('description', e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    rows={3}
                    placeholder="Get 20% off on all orders above ₹500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={form.brand_color}
                        onChange={e => handleChange('brand_color', e.target.value)}
                        className="w-12 h-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={form.brand_color}
                        onChange={e => handleChange('brand_color', e.target.value)}
                        className="flex-1 border rounded-lg px-4 py-2"
                        placeholder="#6366F1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Banner URL</label>
                    <input
                      type="url"
                      value={form.banner_url}
                      onChange={e => handleChange('banner_url', e.target.value)}
                      className="w-full border rounded-lg px-4 py-2"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Offer Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Offer Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Headline</label>
                  <input
                    type="text"
                    value={form.offer?.headline || ''}
                    onChange={e => handleOfferChange('headline', e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    placeholder="Get 20% OFF"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Details</label>
                  <textarea
                    value={form.offer?.details || ''}
                    onChange={e => handleOfferChange('details', e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    rows={3}
                    placeholder="Valid on all orders above ₹500. Cannot be combined with other offers."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Terms & Conditions</label>
                  <textarea
                    value={form.offer?.terms || ''}
                    onChange={e => handleOfferChange('terms', e.target.value)}
                    className="w-full border rounded-lg px-4 py-2"
                    rows={2}
                    placeholder="Valid until Dec 31, 2026. One use per customer."
                  />
                </div>
              </div>
            </div>

            {/* Rewards */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Rewards Configuration</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Scan Reward (coins)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.scan_reward}
                    onChange={e => handleChange('scan_reward', parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Visit Reward</label>
                  <input
                    type="number"
                    min="0"
                    value={form.visit_reward}
                    onChange={e => handleChange('visit_reward', parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Purchase Reward</label>
                  <input
                    type="number"
                    min="0"
                    value={form.purchase_reward}
                    onChange={e => handleChange('purchase_reward', parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Brand Coins</label>
                  <input
                    type="number"
                    min="0"
                    value={form.brand_coins_reward}
                    onChange={e => handleChange('brand_coins_reward', parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Budget */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Budget & Scheduling</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Total Coin Budget</label>
                  <input
                    type="number"
                    min="0"
                    value={form.coin_budget}
                    onChange={e => handleChange('coin_budget', parseInt(e.target.value) || 0)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Start Date</label>
                  <input
                    type="datetime-local"
                    value={form.start_date || ''}
                    onChange={e => handleChange('start_date', e.target.value || null)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Date</label>
                  <input
                    type="datetime-local"
                    value={form.end_date || ''}
                    onChange={e => handleChange('end_date', e.target.value || null)}
                    className="w-full border rounded-lg px-4 py-2"
                  />
                </div>
              </div>
            </div>

            {/* Landing Template */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Landing Page Template</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['bold', 'minimal', 'video', 'coupon', 'contest', 'lead'].map(template => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => handleChange('landing_template', template)}
                    className={`p-4 border rounded-lg text-center transition ${
                      form.landing_template === template
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'hover:border-gray-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {template === 'bold' && '🎯'}
                      {template === 'minimal' && '✨'}
                      {template === 'video' && '🎬'}
                      {template === 'coupon' && '🎟️'}
                      {template === 'contest' && '🏆'}
                      {template === 'lead' && '📝'}
                    </div>
                    <span className="text-sm capitalize">{template}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link
                href={`/campaigns/${campaignId}`}
                className="px-6 py-3 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

function PreviewPanel({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Preview</h2>
        <div
          className="rounded-lg overflow-hidden border"
          style={{ backgroundColor: campaign.brand_color + '10' }}
        >
          {campaign.banner_url && (
            <Image
              src={campaign.banner_url}
              alt="Banner"
              width={800}
              height={192}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-6">
            <h3 className="text-2xl font-bold mb-2" style={{ color: campaign.brand_color }}>
              {campaign.offer?.headline || campaign.name || 'Your Offer'}
            </h3>
            <p className="text-gray-600 mb-4">
              {campaign.offer?.details || campaign.description || 'Offer details will appear here'}
            </p>
            {campaign.offer?.terms && (
              <p className="text-sm text-gray-400">
                * {campaign.offer.terms}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Reward Preview</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-indigo-600">{campaign.scan_reward}</p>
            <p className="text-sm text-gray-500">Scan Reward</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{campaign.visit_reward}</p>
            <p className="text-sm text-gray-500">Visit Reward</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">{campaign.purchase_reward}</p>
            <p className="text-sm text-gray-500">Purchase Reward</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{campaign.coin_budget.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Budget</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Scheduling</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Start Date</p>
            <p className="font-medium">
              {campaign.start_date
                ? new Date(campaign.start_date).toLocaleString()
                : 'Not set (immediate)'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">End Date</p>
            <p className="font-medium">
              {campaign.end_date
                ? new Date(campaign.end_date).toLocaleString()
                : 'No end date'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
