/* AdsQr MVP - Phase 1 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCampaign() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    scan_reward: 10,
    visit_reward: 25,
    purchase_reward: 50,
    coin_budget: 10000
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })

    if (res.ok) {
      const { campaign } = await res.json()
      router.push(`/campaigns/${campaign.id}`)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold mb-8">Create Campaign</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Campaign Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              placeholder="Summer Special Offer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-lg px-4 py-2"
              rows={3}
              placeholder="Get 20% off on all orders above ₹500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Scan Reward (coins)</label>
              <input
                type="number"
                value={form.scan_reward}
                onChange={e => setForm({ ...form, scan_reward: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Visit Reward</label>
              <input
                type="number"
                value={form.visit_reward}
                onChange={e => setForm({ ...form, visit_reward: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Purchase Reward</label>
              <input
                type="number"
                value={form.purchase_reward}
                onChange={e => setForm({ ...form, purchase_reward: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Total Coin Budget</label>
            <input
              type="number"
              value={form.coin_budget}
              onChange={e => setForm({ ...form, coin_budget: parseInt(e.target.value) })}
              className="w-full border rounded-lg px-4 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
        </form>
      </div>
    </div>
  )
}
