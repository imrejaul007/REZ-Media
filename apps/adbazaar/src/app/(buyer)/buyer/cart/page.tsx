'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { COMMISSION_RATES, DEFAULT_COINS_PER_SCAN, DEFAULT_VISIT_BONUS_COINS } from '@/lib/constants'
import { Listing, AvailabilityModel } from '@/types'

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

interface AvailabilitySlot {
  id: string
  slot_start: string
  slot_end: string
  status: string
}

function CartContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const listingId = searchParams.get('listing')

  const [listing, setListing] = useState<Listing | null>(null)
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([])
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [coinsPerScan, setCoinsPerScan] = useState(DEFAULT_COINS_PER_SCAN)
  const [visitBonusCoins, setVisitBonusCoins] = useState(DEFAULT_VISIT_BONUS_COINS)
  const [rezMerchantId, setRezMerchantId] = useState('')
  const [creativeInstructions, setCreativeInstructions] = useState('')
  const [broadcastChannel, setBroadcastChannel] = useState<'whatsapp' | 'push' | 'sms'>('push')
  const [broadcastSegment, setBroadcastSegment] = useState<'all' | 'high_value' | 'at_risk' | 'new_users'>('all')
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastScheduledAt, setBroadcastScheduledAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [alwaysOnDays, setAlwaysOnDays] = useState(1)

  useEffect(() => {
    async function fetchListing() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          const next = listingId ? `/buyer/cart?listing=${listingId}` : '/buyer/cart'
          window.location.href = `/login?next=${encodeURIComponent(next)}`
          return
        }
        if (!listingId) { setLoading(false); return }
        const res = await fetch(`/api/listings/${listingId}`)
        if (!res.ok) throw new Error('Listing not found')
        const data = await res.json()
        setListing(data.listing)
        if (data.slots) setAvailableSlots(data.slots)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load listing')
      } finally {
        setLoading(false)
      }
    }
    fetchListing()
  }, [listingId])

  const isAlwaysOn = listing?.availability_model === AvailabilityModel.AlwaysOn

  const durationDays = (() => {
    if (isAlwaysOn) return alwaysOnDays > 0 ? alwaysOnDays : 0
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 0
  })()

  const pricePerDay = listing?.price ?? 0
  const isBroadcastType = listing?.subcategory === 'WhatsApp Broadcast' || listing?.type_tag === 'influencer'
  const isSlotBased = listing?.availability_model === AvailabilityModel.Slot
  const isCalendarBased = listing?.availability_model === AvailabilityModel.Calendar

  const subtotal = isSlotBased
    ? pricePerDay * selectedSlots.length
    : durationDays * pricePerDay

  const commissionRate = listing ? (COMMISSION_RATES[listing.category] ?? 15) : 15
  const commissionAmount = Math.round(subtotal * commissionRate / 100)
  const total = subtotal + commissionAmount
  const vendorPayout = subtotal

  async function handleSubmit() {
    if (!listing) return
    if (isCalendarBased && (!startDate || !endDate)) {
      setError('Please select start and end dates.')
      return
    }
    if (isSlotBased && selectedSlots.length === 0) {
      setError('Please select at least one slot.')
      return
    }
    if (isAlwaysOn && alwaysOnDays < 1) {
      setError('Please enter a valid number of days.')
      return
    }
    setSubmitting(true)
    setError('')

    let bookingRef: { id: string } | null = null // AB2-M12 FIX: declared outside try so catch can reference it

    try {
      // Get session token for authenticated API calls
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user: submitUser } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      const token = submitUser ? (session?.access_token ?? '') : ''
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) authHeaders['Authorization'] = `Bearer ${token}`

      // Step 1 — create booking + Razorpay order
      // For always_on: derive a start/end from today + duration
      let bookingStartDate = startDate || null
      let bookingEndDate = endDate || null
      if (isAlwaysOn) {
        const today = new Date()
        bookingStartDate = today.toISOString().slice(0, 10)
        const end = new Date(today)
        end.setDate(end.getDate() + alwaysOnDays)
        bookingEndDate = end.toISOString().slice(0, 10)
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          listingId: listing.id,
          startDate: bookingStartDate,
          endDate: bookingEndDate,
          slots: isSlotBased ? selectedSlots.map(id => ({ id })) : [],
          coinsPerScan,
          visitBonusCoins,
          rezMerchantId,
          creativeInstructions,
          ...(isBroadcastType && rezMerchantId ? {
            broadcastConfig: {
              channel: broadcastChannel,
              segment: broadcastSegment,
              broadcastTitle: broadcastTitle || undefined,
              broadcastBody: broadcastBody || undefined,
              scheduledAt: broadcastScheduledAt || undefined,
            },
          } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Booking failed')

      const { booking, razorpayOrder, razorpayKeyId } = data
      bookingRef = booking

      // Step 2 — open Razorpay checkout if order was created
      if (razorpayOrder?.id && razorpayKeyId) {
        const loaded = await loadRazorpayScript()
        if (!loaded) throw new Error('Failed to load payment SDK. Please try again.')

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: razorpayKeyId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency ?? 'INR',
            name: 'AdBazaar',
            description: listing.title,
            order_id: razorpayOrder.id,
            theme: { color: '#f59e0b' },
            handler: async (response: Record<string, string>) => {
              try {
                // Step 3 — verify payment on server
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
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled')),
            },
          })
          rzp.open()
        })
      }

      // Step 4 — redirect to bookings
      router.push(`/buyer/bookings?created=${booking.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create booking'
      // AB2-M12 FIX: payment cancelled means booking was already created (pending status).
      // Redirect to bookings with a clear UX message instead of silent nothing.
      if (msg === 'Payment cancelled' && bookingRef) {
        router.push(`/buyer/bookings?created=${bookingRef.id}&cancelled=1`)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function toggleSlot(slotId: string) {
    setSelectedSlots(prev =>
      prev.includes(slotId) ? prev.filter(s => s !== slotId) : [...prev, slotId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading listing...</p>
      </div>
    )
  }

  if (!listingId || !listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <p className="text-gray-400">No listing selected.</p>
        <a href="/browse" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}>Browse Listings</a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Book Ad Placement</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: configuration */}
        <div className="lg:col-span-3 space-y-5">
          {/* Listing card */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Selected Listing</h2>
            <p className="text-white font-semibold text-lg">{listing.title}</p>
            <p className="text-gray-400 text-sm mt-1">{listing.city}{listing.area ? `, ${listing.area}` : ''}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-sm text-gray-400">
                ₹{listing.price?.toLocaleString('en-IN')}
                {listing.duration_unit ? ` / ${listing.duration_unit.replace('per_', '')}` : ''}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
              >
                {listing.category.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Date / slot selector */}
          {isCalendarBased && (
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Booking Dates</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
                    style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">End Date</label>
                  <input
                    type="date"
                    min={startDate || new Date().toISOString().slice(0, 10)}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
                    style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', colorScheme: 'dark' }}
                  />
                </div>
              </div>
              {durationDays > 0 && (
                <p className="text-xs text-gray-500 mt-2">{durationDays} day{durationDays !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          {isAlwaysOn && (
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Booking Duration</h2>
              <p className="text-xs text-gray-600 mb-3">This listing is always available. Choose how many days you want to book.</p>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Number of Days</label>
                <input
                  type="number"
                  min={1}
                  value={alwaysOnDays}
                  onChange={e => setAlwaysOnDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', width: '120px' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">{alwaysOnDays} day{alwaysOnDays !== 1 ? 's' : ''} selected</p>
            </div>
          )}

          {isSlotBased && availableSlots.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Available Slots</h2>
              <div className="space-y-2">
                {availableSlots.map(slot => (
                  <label
                    key={slot.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
                    style={{
                      backgroundColor: selectedSlots.includes(slot.id) ? '#f59e0b11' : '#0f0f0f',
                      border: `1px solid ${selectedSlots.includes(slot.id) ? '#f59e0b55' : '#2a2a2a'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSlots.includes(slot.id)}
                      onChange={() => toggleSlot(slot.id)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm text-white">
                      {slot.slot_start} — {slot.slot_end}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* QR & Coins config */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">QR & Coins Configuration</h2>
            <p className="text-xs text-gray-600 mb-4">Consumers earn these coins in the REZ app when they scan your ad</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Coins per Scan</label>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={coinsPerScan}
                  onChange={e => setCoinsPerScan(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Visit Bonus Coins</label>
                <input
                  type="number"
                  min={0}
                  value={visitBonusCoins}
                  onChange={e => setVisitBonusCoins(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">REZ Merchant ID</label>
              <input
                type="text"
                placeholder="Your REZ merchant account ID"
                value={rezMerchantId}
                onChange={e => setRezMerchantId(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
                style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              />
            </div>
          </div>

          {/* Broadcast settings — shown for WhatsApp Broadcast and influencer listings */}
          {isBroadcastType && (
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Broadcast Settings</h2>
              <p className="text-xs text-gray-600 mb-4">This will send a broadcast to REZ users in the selected segment</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Channel</label>
                  <select
                    value={broadcastChannel}
                    onChange={e => setBroadcastChannel(e.target.value as 'whatsapp' | 'push' | 'sms')}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                    style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                  >
                    <option value="push">Push</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Audience</label>
                  <select
                    value={broadcastSegment}
                    onChange={e => setBroadcastSegment(e.target.value as 'all' | 'high_value' | 'at_risk' | 'new_users')}
                    className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                    style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                  >
                    <option value="all">All</option>
                    <option value="high_value">High Value</option>
                    <option value="at_risk">At Risk</option>
                    <option value="new_users">New Users</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1.5">Message Title</label>
                <input
                  type="text"
                  placeholder="Broadcast notification title"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1.5">Message Body</label>
                <textarea
                  rows={3}
                  placeholder="Broadcast message body"
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={broadcastScheduledAt}
                  onChange={e => setBroadcastScheduledAt(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a', colorScheme: 'dark' }}
                />
              </div>
            </div>
          )}

          {/* Creative instructions */}
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Creative Instructions</h2>
            <textarea
              rows={4}
              placeholder="Describe your ad creative, messaging guidelines, brand requirements..."
              value={creativeInstructions}
              onChange={e => setCreativeInstructions(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
            />
          </div>
        </div>

        {/* Right: order summary */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl p-5 sticky top-6"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Order Summary</h2>

            <p className="text-white font-medium text-sm mb-3">{listing.title}</p>

            <div className="space-y-2.5 text-sm">
              {isCalendarBased && (
                <div className="flex justify-between text-gray-400">
                  <span>{durationDays} days × ₹{pricePerDay.toLocaleString('en-IN')}/day</span>
                  <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}
              {isAlwaysOn && (
                <div className="flex justify-between text-gray-400">
                  <span>{alwaysOnDays} day{alwaysOnDays !== 1 ? 's' : ''} × ₹{pricePerDay.toLocaleString('en-IN')}/day</span>
                  <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}
              {isSlotBased && (
                <div className="flex justify-between text-gray-400">
                  <span>{selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''} × ₹{pricePerDay.toLocaleString('en-IN')}</span>
                  <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}
              {!isCalendarBased && !isSlotBased && !isAlwaysOn && (
                <div className="flex justify-between text-gray-400">
                  <span>Listing price</span>
                  <span className="text-white">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-400">
                <span>Platform commission ({commissionRate}%)</span>
                <span className="text-white">₹{commissionAmount.toLocaleString('en-IN')}</span>
              </div>

              <div
                className="flex justify-between font-semibold text-base pt-2.5 mt-1"
                style={{ borderTop: '1px solid #2a2a2a' }}
              >
                <span className="text-white">Total</span>
                <span style={{ color: '#f59e0b' }}>₹{total.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-xs pt-1" style={{ color: '#6b7280' }}>
                <span>Vendor payout</span>
                <span>₹{vendorPayout.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {error && (
              <div
                className="mt-4 rounded-lg px-3 py-2.5 text-sm"
                style={{ backgroundColor: '#ef44441a', color: '#f87171', border: '1px solid #ef444433' }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || total === 0 || (isAlwaysOn && alwaysOnDays < 1)}
              className="mt-5 w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
            >
              {submitting ? 'Processing...' : 'Proceed to Payment'}
            </button>

            <p className="text-center text-xs text-gray-600 mt-3">
              You will be redirected to Razorpay to complete payment
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CartPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    }>
      <CartContent />
    </Suspense>
  )
}
