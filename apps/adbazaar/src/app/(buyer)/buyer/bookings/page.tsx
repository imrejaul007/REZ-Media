'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from '@/components/ui/Image'
import { createClient } from '@supabase/supabase-js'
import { BookingStatus } from '@/types'
import MessageThread from '@/components/booking/MessageThread'

interface BookingRow {
  id: string
  listing_id?: string | null
  listing_title: string
  listing_city?: string | null
  vendor_name: string
  start_date: string | null
  end_date: string | null
  amount: number
  status: BookingStatus
  proof_of_execution: string[]
  proof_approved: boolean
  created_at: string
  reviewed: boolean
  qr_slug?: string | null
  qr_image_url?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  has_messages?: boolean
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-xl transition-colors"
          style={{ color: n <= (hover || value) ? '#f59e0b' : '#3f3f46' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function LeaveReviewForm({ bookingId, token, onDone }: { bookingId: string; token: string; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) { setErr('Please select a rating'); return }
    setSubmitting(true)
    setErr('')
    const reviewHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) reviewHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: reviewHeaders,
      body: JSON.stringify({ bookingId, rating, comment: comment || undefined }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setErr(data.error ?? 'Failed to submit'); return }
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 p-4 rounded-xl" style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Leave a Review</p>
      <StarRating value={rating} onChange={setRating} />
      <textarea
        rows={2}
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="How did the campaign perform? Was execution on time?"
        className="w-full rounded-lg px-3 py-2 text-sm text-white resize-none outline-none"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a' }}
      />
      {err && <p className="text-xs" style={{ color: '#f87171' }}>{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
      >
        {submitting ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}

const STATUS_STYLES: Record<BookingStatus, { label: string; bg: string; color: string; border: string }> = {
  [BookingStatus.Inquiry]:   { label: 'Inquiry',   bg: '#ffffff11', color: '#9ca3af', border: '#ffffff22' },
  [BookingStatus.Quoted]:    { label: 'Quoted',    bg: '#3b82f611', color: '#60a5fa', border: '#3b82f633' },
  [BookingStatus.Confirmed]: { label: 'Confirmed', bg: '#22c55e11', color: '#4ade80', border: '#22c55e33' },
  [BookingStatus.Paid]:      { label: 'Paid',      bg: '#f59e0b11', color: '#f59e0b', border: '#f59e0b33' },
  [BookingStatus.Executing]: { label: 'Executing', bg: '#a855f711', color: '#c084fc', border: '#a855f733' },
  [BookingStatus.Completed]: { label: 'Completed', bg: '#22c55e11', color: '#4ade80', border: '#22c55e33' },
  [BookingStatus.Disputed]:  { label: 'Disputed',  bg: '#ef444411', color: '#f87171', border: '#ef444433' },
  [BookingStatus.Cancelled]: { label: 'Cancelled', bg: '#ffffff11', color: '#6b7280', border: '#ffffff22' },
}

const ALL_STATUSES = Object.values(BookingStatus)

function BuyerBookingsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const createdId = searchParams.get('created')
  const cancelledId = searchParams.get('cancelled')
  const [banner, setBanner] = useState<string | null>(
    createdId
      ? cancelledId
        ? 'Payment was not completed — your booking is saved and waiting for payment.' // AB2-M12 FIX: informative message on cancelled payment
        : 'Booking confirmed! Your listing is now booked.'
      : null
  )
  const [qrModal, setQrModal] = useState<{ slug?: string | null; imageUrl?: string | null } | null>(null)
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [assignModal, setAssignModal] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | BookingStatus>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [proofModal, setProofModal] = useState<string[] | null>(null)
  const [reviewOpen, setReviewOpen] = useState<string | null>(null)
  const [msgOpen, setMsgOpen] = useState<string | null>(null)

  async function fetchBookings(t?: string) {
    setLoading(true)
    try {
      const authToken = t ?? token
      const fetchHeaders: Record<string, string> = {}
      if (authToken) fetchHeaders['Authorization'] = `Bearer ${authToken}`
      const res = await fetch('/api/bookings?role=buyer', {
        headers: fetchHeaders,
      })
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } catch {
      setError('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.push('/login?next=/buyer/bookings')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      setToken(t)
      await fetchBookings(t)
      // Load campaigns for assign modal
      fetch('/api/campaigns', { headers: { 'Authorization': `Bearer ${t}` } })
        .then(r => r.json())
        .then(d => setCampaigns((d.campaigns ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))))
        .catch(() => {})
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function approveProof(bookingId: string) {
    setActionLoading(bookingId)
    setError('')
    try {
      const approveHeaders: Record<string, string> = {}
      if (token) approveHeaders['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/bookings/${bookingId}/proof/approve`, {
        method: 'POST',
        headers: approveHeaders,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to approve')
      setBookings(prev =>
        prev.map(b => b.id === bookingId
          ? { ...b, proof_approved: true, status: BookingStatus.Completed }
          : b
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve proof')
    } finally {
      setActionLoading(null)
    }
  }

  async function raiseDispute(bookingId: string) {
    setActionLoading(bookingId)
    try {
      const disputeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) disputeHeaders['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: disputeHeaders,
        body: JSON.stringify({ action: 'raise_dispute' }),
      })
      if (!res.ok) throw new Error('Failed to raise dispute')
      await fetchBookings()
    } catch {
      setError('Failed to raise dispute')
    } finally {
      setActionLoading(null)
    }
  }

  async function assignToCampaign(bookingId: string, campaignId: string) {
    setAssigning(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ addBookingIds: [bookingId] }),
      })
      if (!res.ok) throw new Error('Failed to assign')
      setAssignModal(null)
    } catch {
      setError('Failed to assign booking to campaign')
    } finally {
      setAssigning(false)
    }
  }

  const filtered = activeTab === 'all'
    ? bookings
    : bookings.filter(b => b.status === activeTab)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Bookings</h1>
        <span className="text-sm text-gray-500">{bookings.length} total</span>
      </div>

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
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
        >
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('all')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: activeTab === 'all' ? '#f59e0b' : '#1a1a1a',
            color: activeTab === 'all' ? '#0f0f0f' : '#9ca3af',
            border: '1px solid #2a2a2a',
          }}
        >
          All ({bookings.length})
        </button>
        {ALL_STATUSES.map(status => {
          const count = bookings.filter(b => b.status === status).length
          if (count === 0) return null
          const style = STATUS_STYLES[status]
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: activeTab === status ? style.bg : '#1a1a1a',
                color: activeTab === status ? style.color : '#9ca3af',
                border: `1px solid ${activeTab === status ? style.border : '#2a2a2a'}`,
              }}
            >
              {style.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500 text-sm">Loading bookings...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-gray-500 text-sm">No bookings found</p>
            <a href="/browse" className="text-xs" style={{ color: '#f59e0b' }}>Browse listings</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                  {['Listing', 'Vendor', 'Dates', 'Amount', 'Status', 'Proof', 'QR', 'Actions'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: '#6b7280' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking, idx) => {
                  const style = STATUS_STYLES[booking.status]
                  const isLast = idx === filtered.length - 1
                  return (
                    <React.Fragment key={booking.id}>
                    <tr
                      style={{ borderBottom: reviewOpen === booking.id ? 'none' : isLast ? 'none' : '1px solid #2a2a2a' }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        {booking.listing_id ? (
                          <a
                            href={`/listing/${booking.listing_id}`}
                            className="text-white font-medium truncate max-w-[180px] block hover:underline"
                          >
                            {booking.listing_title}
                          </a>
                        ) : (
                          <p className="text-white font-medium truncate max-w-[180px]">{booking.listing_title}</p>
                        )}
                        {booking.listing_city && (
                          <p className="text-xs truncate max-w-[180px]" style={{ color: '#6b7280' }}>{booking.listing_city}</p>
                        )}
                        {booking.campaign_name && (
                          <p className="text-xs mt-0.5 truncate max-w-[180px]" style={{ color: '#f59e0b' }}>
                            &#9670; {booking.campaign_name}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-[120px]">{booking.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {booking.start_date && booking.end_date
                          ? `${booking.start_date} – ${booking.end_date}`
                          : booking.start_date ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        ₹{booking.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {booking.proof_of_execution.length > 0 ? (
                          <button
                            onClick={() => setProofModal(booking.proof_of_execution)}
                            className="flex items-center gap-1 text-xs"
                            style={{ color: '#f59e0b' }}
                          >
                            <Image
                              src={booking.proof_of_execution[0]}
                              alt="proof"
                              width={32}
                              height={32}
                              className="object-cover rounded"
                              style={{ border: '1px solid #2a2a2a' }}
                            />
                            {booking.proof_of_execution.length > 1 && (
                              <span>+{booking.proof_of_execution.length - 1}</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {booking.qr_image_url ? (
                          <button
                            onClick={() => setQrModal({ slug: booking.qr_slug, imageUrl: booking.qr_image_url })}
                            className="text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
                          >
                            View QR
                          </button>
                        ) : booking.qr_slug ? (
                          <a
                            href={`/scan/${booking.qr_slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded"
                            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
                          >
                            View QR
                          </a>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {booking.status === BookingStatus.Executing && !booking.proof_approved && booking.proof_of_execution.length > 0 && (
                            <button
                              onClick={() => approveProof(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="rounded px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: '#22c55e22', color: '#4ade80', border: '1px solid #22c55e44' }}
                            >
                              {actionLoading === booking.id ? '…' : 'Approve'}
                            </button>
                          )}
                          {booking.status === BookingStatus.Executing && !booking.proof_approved && booking.proof_of_execution.length === 0 && (
                            <span className="text-xs" style={{ color: '#6b7280' }}>Awaiting proof</span>
                          )}
                          {booking.status === BookingStatus.Executing && (
                            <button
                              onClick={() => raiseDispute(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="rounded px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
                            >
                              {actionLoading === booking.id ? '...' : 'Report Issue'}
                            </button>
                          )}
                          <button
                            onClick={() => setMsgOpen(msgOpen === booking.id ? null : booking.id)}
                            className="relative rounded px-2.5 py-1 text-xs font-medium transition-colors"
                            style={{ backgroundColor: '#1a1a1a', color: '#9ca3af', border: '1px solid #2a2a2a' }}
                          >
                            💬
                            {booking.has_messages && (
                              <span
                                className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                                style={{ backgroundColor: '#f59e0b' }}
                              />
                            )}
                          </button>
                          {campaigns.length > 0 && (
                            <button
                              onClick={() => setAssignModal(booking.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                              style={{ backgroundColor: '#1a1a1a', color: '#9ca3af', border: '1px solid #2a2a2a' }}
                            >
                              + Campaign
                            </button>
                          )}
                          {booking.status === BookingStatus.Completed && booking.proof_approved && !booking.reviewed && (
                            <button
                              onClick={() => setReviewOpen(reviewOpen === booking.id ? null : booking.id)}
                              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
                              style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
                            >
                              Review
                            </button>
                          )}
                          {booking.status === BookingStatus.Completed && booking.proof_approved && (
                            <button
                              onClick={() => raiseDispute(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="rounded px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-50"
                              style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
                            >
                              {actionLoading === booking.id ? '…' : 'Dispute'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {(reviewOpen === booking.id || msgOpen === booking.id) && (
                      <tr key={`${booking.id}-expand`} style={{ borderBottom: isLast ? 'none' : '1px solid #2a2a2a' }}>
                        <td colSpan={8} className="px-4 pb-4">
                          {reviewOpen === booking.id && (
                            <LeaveReviewForm
                              bookingId={booking.id}
                              token={token}
                              onDone={() => {
                                setReviewOpen(null)
                                setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, reviewed: true } : b))
                              }}
                            />
                          )}
                          {msgOpen === booking.id && (
                            <div className="mt-2">
                              <MessageThread
                                bookingId={booking.id}
                                token={token}
                                currentRole="buyer"
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Proof image modal */}
      {proofModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setProofModal(null)}
        >
          <div
            className="rounded-xl p-4 max-w-lg w-full space-y-3"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Proof of Execution ({proofModal.length} photo{proofModal.length !== 1 ? 's' : ''})</p>
              <button onClick={() => setProofModal(null)} style={{ color: '#6b7280' }} className="text-lg">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {proofModal.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <Image
                    src={url}
                    alt={`Proof ${i + 1}`}
                    width={300}
                    height={300}
                    className="object-cover rounded-lg"
                    style={{ border: '1px solid #2a2a2a' }}
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QR code modal */}
      {qrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setQrModal(null)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full space-y-4 text-center"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Your QR Code</p>
              <button onClick={() => setQrModal(null)} style={{ color: '#6b7280' }} className="text-lg">×</button>
            </div>
            {qrModal.imageUrl ? (
              <>
                <Image
                  src={qrModal.imageUrl}
                  alt="QR Code"
                  width={192}
                  height={192}
                  className="mx-auto rounded-lg"
                  style={{ border: '1px solid #2a2a2a' }}
                />
                <a
                  href={qrModal.imageUrl}
                  download="qr-code.png"
                  className="inline-block rounded-lg px-4 py-2 text-xs font-semibold"
                  style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                >
                  Download QR
                </a>
              </>
            ) : qrModal.slug ? (
              <a
                href={`/scan/${qrModal.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-lg px-4 py-2 text-xs font-semibold"
                style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
              >
                Open QR Preview
              </a>
            ) : null}
          </div>
        </div>
      )}

      {/* Assign to campaign modal */}
      {assignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setAssignModal(null)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full space-y-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Assign to Campaign</p>
              <button onClick={() => setAssignModal(null)} style={{ color: '#6b7280' }} className="text-lg">×</button>
            </div>
            <p className="text-xs text-gray-500">Select a campaign to add this booking to:</p>
            <div className="space-y-2">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => assignToCampaign(assignModal, c.id)}
                  disabled={assigning}
                  className="w-full text-left rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a', color: '#e5e7eb' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BuyerBookingsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray-500">Loading…</div>}>
      <BuyerBookingsContent />
    </Suspense>
  )
}
