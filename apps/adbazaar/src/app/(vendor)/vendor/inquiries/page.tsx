'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Inquiry {
  id: string
  listing_id: string
  buyer_id: string
  message: string
  budget?: number | null
  start_date?: string | null
  end_date?: string | null
  requirements?: string | null
  status: 'pending' | 'quoted' | 'accepted' | 'declined'
  quote_amount?: number | null
  quote_message?: string | null
  quote_valid_until?: string | null
  created_at: string
  listings?: { title: string; city: string; area?: string | null } | { title: string; city: string; area?: string | null }[] | null
}

const STATUS_STYLE = {
  pending:  { label: 'Pending',  bg: '#1c1400', text: '#fbbf24', border: '#78350f' },
  quoted:   { label: 'Quoted',   bg: '#1e3a5f', text: '#93c5fd', border: '#1d4ed8' },
  accepted: { label: 'Accepted', bg: '#052e16', text: '#4ade80', border: '#14532d' },
  declined: { label: 'Declined', bg: '#27272a', text: '#71717a', border: '#3f3f46' },
}

export default function VendorInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [quoteForm, setQuoteForm] = useState<Record<string, { amount: string; message: string }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      if (!t) { window.location.href = '/login?next=/vendor/inquiries'; return }
      setToken(t)

      const authHeaders: Record<string, string> = { Authorization: `Bearer ${t}` }
      const res = await fetch('/api/inquiries?role=vendor', {
        headers: authHeaders,
      })
      const data = await res.json()
      setInquiries(data.inquiries ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function sendQuote(inquiryId: string) {
    const form = quoteForm[inquiryId]
    if (!form?.amount || Number(form.amount) <= 0) {
      setError(e => ({ ...e, [inquiryId]: 'Enter a valid quote amount' }))
      return
    }
    setSubmitting(inquiryId)
    setError(e => ({ ...e, [inquiryId]: '' }))

    const quoteHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) quoteHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/inquiries/${inquiryId}/quote`, {
      method: 'POST',
      headers: quoteHeaders,
      body: JSON.stringify({
        quoteAmount: Number(form.amount),
        quoteMessage: form.message || undefined,
        validDays: 7,
      }),
    })
    const data = await res.json()
    setSubmitting(null)

    if (!res.ok) {
      setError(e => ({ ...e, [inquiryId]: data.error ?? 'Failed to send quote' }))
      return
    }
    setInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, ...data.inquiry } : i))
    setExpanded(null)
  }

  async function declineInquiry(inquiryId: string) {
    if (!confirm('Decline this inquiry?')) return
    setSubmitting(inquiryId)
    const declineHeaders: Record<string, string> = {}
    if (token) declineHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch(`/api/inquiries/${inquiryId}/decline`, {
      method: 'POST',
      headers: declineHeaders,
    })
    setSubmitting(null)
    if (res.ok) {
      setInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, status: 'declined' } : i))
    }
  }

  const pending = inquiries.filter(i => i.status === 'pending')
  const others = inquiries.filter(i => i.status !== 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Inquiries</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Respond to buyer quote requests
          </p>
        </div>
        {pending.length > 0 && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
          >
            {pending.length} pending
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center" style={{ color: '#737373' }}>Loading…</div>
      ) : inquiries.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-white font-medium">No inquiries yet</p>
          <p className="text-sm mt-1" style={{ color: '#737373' }}>
            Inquiries appear when buyers request quotes on your listings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pending, ...others].map((inquiry) => {
            const st = STATUS_STYLE[inquiry.status]
            const isOpen = expanded === inquiry.id
            const form = quoteForm[inquiry.id] ?? { amount: '', message: '' }
            const listingData = Array.isArray(inquiry.listings) ? inquiry.listings[0] ?? null : (inquiry.listings ?? null)

            return (
              <div
                key={inquiry.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: `1px solid ${inquiry.status === 'pending' ? '#f59e0b33' : '#2a2a2a'}` }}
              >
                {/* Header row */}
                <button
                  className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : inquiry.id)}
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
                        {new Date(inquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {listingData?.title ?? 'Unknown listing'}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#9ca3af' }}>
                      {inquiry.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {inquiry.budget && (
                      <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
                        Budget: ₹{inquiry.budget.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid #2a2a2a' }}>
                    {/* Inquiry details */}
                    <div className="pt-4 space-y-3">
                      <div>
                        <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Message</p>
                        <p className="text-sm text-white">{inquiry.message}</p>
                      </div>
                      {inquiry.requirements && (
                        <div>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Requirements</p>
                          <p className="text-sm text-white">{inquiry.requirements}</p>
                        </div>
                      )}
                      <div className="flex gap-6">
                        {inquiry.start_date && (
                          <div>
                            <p className="text-xs" style={{ color: '#6b7280' }}>Start</p>
                            <p className="text-sm text-white">{new Date(inquiry.start_date).toLocaleDateString('en-IN')}</p>
                          </div>
                        )}
                        {inquiry.end_date && (
                          <div>
                            <p className="text-xs" style={{ color: '#6b7280' }}>End</p>
                            <p className="text-sm text-white">{new Date(inquiry.end_date).toLocaleDateString('en-IN')}</p>
                          </div>
                        )}
                        {inquiry.budget && (
                          <div>
                            <p className="text-xs" style={{ color: '#6b7280' }}>Their budget</p>
                            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                              ₹{inquiry.budget.toLocaleString('en-IN')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quote form — only for pending */}
                    {inquiry.status === 'pending' && (
                      <div
                        className="rounded-xl p-4 space-y-3"
                        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                          Send Quote
                        </p>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Amount (₹) *</label>
                            <input
                              type="number"
                              value={form.amount}
                              onChange={e => setQuoteForm(f => ({ ...f, [inquiry.id]: { ...form, amount: e.target.value } }))}
                              placeholder={inquiry.budget ? String(inquiry.budget) : 'e.g. 45000'}
                              className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                              style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a' }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs mb-1" style={{ color: '#6b7280' }}>Message (optional)</label>
                          <textarea
                            rows={2}
                            value={form.message}
                            onChange={e => setQuoteForm(f => ({ ...f, [inquiry.id]: { ...form, message: e.target.value } }))}
                            placeholder="Any details, inclusions, or conditions…"
                            className="w-full rounded-lg px-3 py-2 text-sm text-white resize-none outline-none"
                            style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a' }}
                          />
                        </div>
                        {error[inquiry.id] && (
                          <p className="text-xs" style={{ color: '#f87171' }}>{error[inquiry.id]}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => sendQuote(inquiry.id)}
                            disabled={submitting === inquiry.id}
                            className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                          >
                            {submitting === inquiry.id ? 'Sending…' : 'Send Quote'}
                          </button>
                          <button
                            onClick={() => declineInquiry(inquiry.id)}
                            disabled={submitting === inquiry.id}
                            className="rounded-lg px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                            style={{ backgroundColor: '#1a1a1a', color: '#6b7280', border: '1px solid #2a2a2a' }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quote sent */}
                    {inquiry.status === 'quoted' && (
                      <div
                        className="rounded-lg px-4 py-3"
                        style={{ backgroundColor: '#1e3a5f22', border: '1px solid #1e3a5f', color: '#93c5fd' }}
                      >
                        <p className="text-sm font-semibold">
                          Quote sent: ₹{(inquiry.quote_amount ?? 0).toLocaleString('en-IN')}
                        </p>
                        {inquiry.quote_message && (
                          <p className="text-xs mt-1 opacity-80">{inquiry.quote_message}</p>
                        )}
                        {inquiry.quote_valid_until && (
                          <p className="text-xs mt-1 opacity-60">
                            Valid until {new Date(inquiry.quote_valid_until).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Accepted */}
                    {inquiry.status === 'accepted' && (
                      <div
                        className="rounded-lg px-4 py-3 text-sm"
                        style={{ backgroundColor: '#052e16', border: '1px solid #14532d', color: '#4ade80' }}
                      >
                        ✓ Buyer accepted — booking created
                      </div>
                    )}
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
