'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface CampaignBooking {
  id: string
  amount: number
  status: string
  listings?: { title: string; city: string } | { title: string; city: string }[] | null
}

interface Campaign {
  id: string
  name: string
  budget?: number | null
  status: 'draft' | 'active' | 'completed'
  booking_ids: string[]
  total_spent: number
  created_at: string
  // enriched
  bookings: CampaignBooking[]
  totalSpend: number
  activeCount: number
}

const STATUS_STYLE = {
  active:    { label: 'Active',    bg: '#052e16', text: '#4ade80', border: '#14532d' },
  draft:     { label: 'Draft',     bg: '#27272a', text: '#a1a1aa', border: '#3f3f46' },
  completed: { label: 'Completed', bg: '#1e3a5f', text: '#93c5fd', border: '#1d4ed8' },
}

export default function BuyerCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', budget: '' })
  const [formError, setFormError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      if (!t) { window.location.href = '/login?next=/buyer/campaigns'; return }
      setToken(t)

      const authHeaders: Record<string, string> = { Authorization: `Bearer ${t}` }
      const res = await fetch('/api/campaigns', {
        headers: authHeaders,
      })
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Campaign name is required'); return }
    setCreating(true)
    setFormError('')

    const createHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) createHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        name: form.name,
        budget: form.budget ? Number(form.budget) : undefined,
      }),
    })
    const data = await res.json()
    setCreating(false)

    if (!res.ok) { setFormError(data.error ?? 'Failed to create'); return }
    setCampaigns(prev => [{ ...data.campaign, bookings: [], totalSpend: 0, activeCount: 0 }, ...prev])
    setForm({ name: '', budget: '' })
    setShowForm(false)
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign?')) return
    setDeleting(id)
    const deleteHeaders: Record<string, string> = {}
    if (token) deleteHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
      headers: deleteHeaders,
    })
    setDeleting(null)
    if (res.ok) setCampaigns(prev => prev.filter(c => c.id !== id))
  }

  async function toggleStatus(campaign: Campaign) {
    const newStatus = campaign.status === 'active' ? 'completed' : 'active'
    const patchHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) patchHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: patchHeaders,
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Bundle multiple ad placements into one tracked campaign
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          + New Campaign
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #f59e0b44' }}>
          <p className="text-sm font-semibold text-white mb-4">New Campaign</p>
          <form onSubmit={createCampaign} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Campaign name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Q2 Bengaluru Push"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  style={{ backgroundColor: '#111111', border: '1px solid #3a3a3a' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Budget (₹) — optional</label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="e.g. 200000"
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
                  style={{ backgroundColor: '#111111', border: '1px solid #3a3a3a' }}
                />
              </div>
            </div>
            {formError && <p className="text-xs" style={{ color: '#f87171' }}>{formError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
              >
                {creating ? 'Creating…' : 'Create Campaign'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError('') }}
                className="rounded-lg px-4 py-2.5 text-sm transition-colors"
                style={{ backgroundColor: '#27272a', color: '#9ca3af' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center" style={{ color: '#737373' }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: '#f59e0b11', border: '1px solid #f59e0b33' }}
          >
            ◈
          </div>
          <p className="font-medium text-white">No campaigns yet</p>
          <p className="text-sm mt-1" style={{ color: '#737373' }}>
            Create a campaign first, then assign bookings to it from your Bookings page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const st = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.active
            const isOpen = expanded === campaign.id
            const budgetUsedPct = campaign.budget && campaign.budget > 0
              ? Math.min(Math.round((campaign.totalSpend / campaign.budget) * 100), 100)
              : null

            return (
              <div
                key={campaign.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                {/* Header */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : campaign.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                      >
                        {st.label}
                      </span>
                      <span className="text-xs" style={{ color: '#6b7280' }}>
                        {campaign.booking_ids.length} placement{campaign.booking_ids.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">{campaign.name}</p>
                  </div>

                  <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                        ₹{campaign.totalSpend.toLocaleString('en-IN')}
                      </p>
                      {campaign.budget && (
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          of ₹{campaign.budget.toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Budget progress */}
                {budgetUsedPct !== null && (
                  <div className="px-5 pb-2">
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#2a2a2a' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${budgetUsedPct}%`,
                          backgroundColor: budgetUsedPct >= 90 ? '#f87171' : '#f59e0b',
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                      {budgetUsedPct}% of budget used
                    </p>
                  </div>
                )}

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #2a2a2a' }}>
                    {/* Bookings */}
                    <div className="pt-4">
                      <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
                        Placements ({campaign.bookings.length})
                      </p>
                      {campaign.bookings.length === 0 ? (
                        <p className="text-sm" style={{ color: '#4b5563' }}>
                          No bookings assigned yet. Go to your Bookings page and use &ldquo;Assign to Campaign&rdquo; to add bookings here.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {campaign.bookings.map((b) => {
                            const bl = Array.isArray(b.listings) ? b.listings[0] ?? null : (b.listings ?? null)
                            return (
                            <div
                              key={b.id}
                              className="flex items-center justify-between rounded-lg px-3 py-2"
                              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
                            >
                              <div>
                                <p className="text-sm text-white">
                                  {bl?.title ?? 'Unknown'}
                                </p>
                                <p className="text-xs" style={{ color: '#6b7280' }}>
                                  {bl?.city ?? ''} · {b.status}
                                </p>
                              </div>
                              <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                                ₹{Number(b.amount).toLocaleString('en-IN')}
                              </p>
                            </div>
                          )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleStatus(campaign)}
                        className="rounded-lg px-4 py-2 text-xs font-medium transition-colors"
                        style={{ backgroundColor: '#27272a', color: '#d1d5db' }}
                      >
                        {campaign.status === 'active' ? 'Mark Completed' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        disabled={deleting === campaign.id}
                        className="rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#27272a', color: '#f87171' }}
                      >
                        {deleting === campaign.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
