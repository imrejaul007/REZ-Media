'use client'

import { useEffect, useState, Suspense } from 'react'
import Image from '@/components/ui/Image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Listing } from '@/types'
import { track } from '@/services/intentCaptureService'

function BuyerInquireContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingId = searchParams.get('listing') ?? ''

  const [listing, setListing] = useState<Listing | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')

  const [form, setForm] = useState({
    message: '',
    budget: '',
    startDate: '',
    endDate: '',
    requirements: '',
  })

  useEffect(() => {
    async function init() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login?next=' + encodeURIComponent('/buyer/inquire' + (listingId ? `?listing=${listingId}` : '')))
        return
      }
      setUserId(user.id)
      const { data: { session } } = await supabase.auth.getSession()
      setToken(session?.access_token ?? '')

      if (listingId) {
        const res = await fetch(`/api/listings/${listingId}`)
        if (res.ok) {
          const data = await res.json()
          setListing(data.listing)
        }
      }
      setLoading(false)
    }
    init()
  }, [listingId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.message.trim()) { setError('Please describe what you need'); return }
    setSubmitting(true)
    setError('')

    const inquireHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) inquireHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: inquireHeaders,
      body: JSON.stringify({
        listingId,
        message: form.message,
        budget: form.budget ? Number(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        requirements: form.requirements || undefined,
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(data.error ?? 'Failed to send inquiry'); return }
    setSuccess(true)

    // ReZ Mind intent capture — offer made (inquiry sent)
    track({
      userId,
      event: 'offer_made',
      appType: 'AdBazaar',
      intentKey: `listing:${listingId}`,
      properties: {
        listingId,
        budget: form.budget || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      },
    })

    setTimeout(() => router.push('/buyer/inquiries'), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="text-center space-y-3">
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: '#14532d22', border: '1px solid #14532d' }}
          >
            ✓
          </div>
          <p className="text-xl font-bold text-white">Inquiry sent!</p>
          <p className="text-sm" style={{ color: '#6b7280' }}>The vendor will respond with a quote shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      {/* Listing context */}
      {listing && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          {listing.images?.[0] && (
            <Image src={listing.images[0]} alt="" width={56} height={56} className="rounded-lg object-cover flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-white">{listing.title}</p>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              {listing.area ? `${listing.area}, ` : ''}{listing.city}
            </p>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-white mb-1">Send an Inquiry</h1>
      <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
        Describe your requirements and the vendor will respond with a quote.
      </p>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Message */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
            What do you need? *
          </label>
          <textarea
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={4}
            placeholder="Describe your campaign goals, target audience, creative format..."
            className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-amber-500 transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
        </div>

        {/* Budget */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
            Budget (₹) — optional
          </label>
          <input
            type="number"
            value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
            placeholder="e.g. 50000"
            className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
              Start date
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-colors"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
              End date
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              min={form.startDate || new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-500 transition-colors"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Special requirements */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#6b7280' }}>
            Creative requirements — optional
          </label>
          <textarea
            value={form.requirements}
            onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
            rows={3}
            placeholder="Dimensions, format, tone, brand guidelines..."
            className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none outline-none focus:border-amber-500 transition-colors"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          {submitting ? 'Sending…' : 'Send Inquiry'}
        </button>
      </form>
    </div>
  )
}

export default function BuyerInquirePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BuyerInquireContent />
    </Suspense>
  )
}
