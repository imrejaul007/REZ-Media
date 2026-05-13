'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-sdk')) { resolve(true); return }
    const script = document.createElement('script')
    script.id = 'razorpay-sdk'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

interface Inquiry {
  id: string
  listing_id: string
  message: string
  budget?: number | null
  start_date?: string | null
  end_date?: string | null
  status: 'pending' | 'quoted' | 'accepted' | 'declined'
  quote_amount?: number | null
  quote_message?: string | null
  quote_valid_until?: string | null
  created_at: string
  listings?: { title: string; city: string; area?: string | null } | { title: string; city: string; area?: string | null }[] | null
}

const STATUS_STYLE = {
  pending:  { label: 'Awaiting quote', bg: '#1c1400', text: '#fbbf24', border: '#78350f' },
  quoted:   { label: 'Quote received', bg: '#1e3a5f', text: '#93c5fd', border: '#1d4ed8' },
  accepted: { label: 'Accepted',       bg: '#052e16', text: '#4ade80', border: '#14532d' },
  declined: { label: 'Declined',       bg: '#27272a', text: '#71717a', border: '#3f3f46' },
}

function BuyerInquiriesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [banner, setBanner] = useState<string | null>(
    searchParams.get('accepted') === '1' ? 'Payment successful! Check your bookings.' : null
  )
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const t = user ? (session?.access_token ?? '') : ''
      setToken(t)

      const authHeaders: Record<string, string> = {}
      if (t) authHeaders['Authorization'] = `Bearer ${t}`
      const res = await fetch('/api/inquiries?role=buyer', {
        headers: authHeaders,
      })
      const data = await res.json()
      setInquiries(data.inquiries ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function acceptQuote(inquiryId: string) {
    setAccepting(inquiryId)
    setError('')
    try {
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) authHeaders.Authorization = `Bearer ${token}`

      const res = await fetch(`/api/inquiries/${inquiryId}/accept`, {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Failed to accept quote')

      const { booking, razorpayOrder, razorpayKeyId } = data

      if (razorpayOrder?.id && razorpayKeyId) {
        const loaded = await loadRazorpayScript()
        if (!loaded) throw new Error('Failed to load payment SDK. Please try again.')

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: razorpayKeyId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency ?? 'INR',
            name: 'AdBazaar',
            description: 'Ad placement booking',
            order_id: razorpayOrder.id,
            theme: { color: '#f59e0b' },
            handler: async (response: Record<string, string>) => {
              try {
                const verifyRes = await fetch(`/api/bookings/${booking.id}/verify-payment`, {
                  method: 'POST',
                  headers: authHeaders,
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                })
                const verifyData = await verifyRes.json()
                if (!verifyRes.ok) throw new Error(verifyData.error ?? 'Payment verification failed')
                resolve()
              } catch (err) {
                reject(err)
              }
            },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          })
          rzp.open()
        })
      }

      setInquiries(prev => prev.map(i => i.id === inquiryId ? { ...i, status: 'accepted' } : i))
      router.push(`/buyer/inquiries?accepted=1`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to process payment'
      if (msg !== 'Payment cancelled') setError(msg)
    } finally {
      setAccepting(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">My Inquiries</h1>

      {banner && (
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#052e16', border: '1px solid #14532d', color: '#4ade80' }}
        >
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="ml-4 text-base leading-none" style={{ color: '#4ade80' }}>×</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center" style={{ color: '#737373' }}>Loading…</div>
      ) : inquiries.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <p className="font-medium text-white">No inquiries yet</p>
          <p className="text-sm mt-1" style={{ color: '#737373' }}>
            Send an inquiry from any quote-based listing.{' '}
            <Link href="/browse" style={{ color: '#f59e0b' }}>Browse listings</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => {
            const st = STATUS_STYLE[inquiry.status]
            const listingData = Array.isArray(inquiry.listings) ? inquiry.listings[0] ?? null : (inquiry.listings ?? null)
            const isExpired = inquiry.quote_valid_until
              ? new Date(inquiry.quote_valid_until) < new Date()
              : false

            return (
              <div
                key={inquiry.id}
                className="rounded-xl p-5 space-y-3"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: `1px solid ${inquiry.status === 'quoted' && !isExpired ? '#1d4ed8' : '#2a2a2a'}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {listingData?.title ?? 'Unknown listing'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                      {listingData?.area ? `${listingData.area}, ` : ''}
                      {listingData?.city} ·{' '}
                      {new Date(inquiry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ backgroundColor: st.bg, color: st.text, border: `1px solid ${st.border}` }}
                  >
                    {st.label}
                  </span>
                </div>

                <p className="text-sm" style={{ color: '#9ca3af' }}>{inquiry.message}</p>

                {/* Quote received */}
                {inquiry.status === 'quoted' && !isExpired && (
                  <div
                    className="rounded-xl p-4 space-y-3"
                    style={{ backgroundColor: '#0f1a2e', border: '1px solid #1d4ed8' }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                        Vendor Quote
                      </p>
                      <p className="text-2xl font-bold" style={{ color: '#93c5fd' }}>
                        ₹{(inquiry.quote_amount ?? 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {inquiry.quote_message && (
                      <p className="text-sm" style={{ color: '#cbd5e1' }}>{inquiry.quote_message}</p>
                    )}
                    <p className="text-xs" style={{ color: '#4b5563' }}>
                      Valid until {new Date(inquiry.quote_valid_until!).toLocaleDateString('en-IN')}
                    </p>
                    <button
                      onClick={() => acceptQuote(inquiry.id)}
                      disabled={accepting === inquiry.id}
                      className="w-full rounded-lg py-2.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                    >
                      {accepting === inquiry.id ? 'Processing…' : 'Accept & Pay →'}
                    </button>
                  </div>
                )}

                {inquiry.status === 'quoted' && isExpired && (
                  <p className="text-xs" style={{ color: '#f87171' }}>Quote expired</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function BuyerInquiriesPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading…</div>}>
      <BuyerInquiriesContent />
    </Suspense>
  )
}
