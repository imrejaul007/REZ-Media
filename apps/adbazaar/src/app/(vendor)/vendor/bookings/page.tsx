'use client'

import { useEffect, useRef, useState } from 'react'
import Image from '@/components/ui/Image'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import MessageThread from '@/components/booking/MessageThread'

interface BookingRow {
  id: string
  listing_title: string
  buyer_name?: string
  start_date?: string | null
  end_date?: string | null
  amount: number
  vendor_payout: number
  status: string
  proof_of_execution: string[]
  proof_approved: boolean
  created_at: string
  qr_slug?: string | null
  qr_image_url?: string | null
  has_messages?: boolean
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  inquiry:   { bg: '#27272a', text: '#a1a1aa' },
  confirmed: { bg: '#1e3a5f', text: '#93c5fd' },
  paid:      { bg: '#14532d', text: '#4ade80' },
  executing: { bg: '#713f12', text: '#fbbf24' },
  completed: { bg: '#052e16', text: '#86efac' },
  disputed:  { bg: '#7f1d1d', text: '#f87171' },
  cancelled: { bg: '#27272a', text: '#71717a' },
}

function ProofUploader({
  bookingId,
  existing,
  token,
  onUploaded,
}: {
  bookingId: string
  existing: string[]
  token: string
  onUploaded: (urls: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files: FileList) {
    setUploading(true)
    setError('')
    const form = new FormData()
    for (const f of files) form.append('files', f)
    const res = await fetch(`/api/bookings/${bookingId}/proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
    onUploaded(data.booking.proof_of_execution)
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Existing proof images */}
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existing.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <Image
                src={url}
                alt={`Proof ${i + 1}`}
                width={64}
                height={64}
                className="object-cover rounded-lg border"
                style={{ borderColor: '#2a2a2a' }}
              />
            </a>
          ))}
        </div>
      )}

      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a', color: '#d1d5db' }}
      >
        {uploading ? (
          <>
            <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
            Uploading…
          </>
        ) : (
          <>📷 Upload proof photo</>
        )}
      </button>
      <p className="text-xs" style={{ color: '#6b7280' }}>
        Geotagged photos work best. Max 10MB per image.
      </p>
    </div>
  )
}

// ─── QR Manager ──────────────────────────────────────────────────────────────

interface QrCodeItem {
  id: string
  qr_slug: string
  qr_label: string
  poster_index: number
  qr_image_url: string | null
  total_scans: number
  unique_scanners: number
  is_active: boolean
  scanUrl: string
}

function QrManager({ bookingId, token, bookingStatus }: { bookingId: string; token: string; bookingStatus: string }) {
  const [qrCodes, setQrCodes] = useState<QrCodeItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [viewQr, setViewQr] = useState<QrCodeItem | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/bookings/${bookingId}/qr`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setQrCodes(d.qrCodes ?? []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [bookingId, token])

  async function handleAdd() {
    if (!newLabel.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/bookings/${bookingId}/qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: newLabel.trim() }),
    })
    const data = await res.json()
    if (res.ok && data.qrCode) {
      setQrCodes(prev => [...prev, data.qrCode])
      setNewLabel('')
      setAdding(false)
    }
    setSubmitting(false)
  }

  const canAddQr = !['cancelled', 'inquiry', 'disputed'].includes(bookingStatus)

  if (!loaded) return (
    <div className="text-xs text-gray-500 py-2">Loading QR codes…</div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
          QR Codes ({qrCodes.length})
        </p>
        {canAddQr && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs px-3 py-1 rounded-lg transition-colors"
            style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b33' }}
          >
            + Add QR for new poster
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="e.g. MG Road Billboard – Creative B"
            className="flex-1 rounded-lg px-3 py-2 text-xs text-white outline-none"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !newLabel.trim()}
            className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#f59e0b', color: '#000' }}
          >
            {submitting ? '…' : 'Create'}
          </button>
          <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:text-gray-300 px-2">
            Cancel
          </button>
        </div>
      )}

      {qrCodes.length === 0 ? (
        <p className="text-xs text-gray-600 py-1">No QR codes yet.</p>
      ) : (
        <div className="space-y-2">
          {qrCodes.map(qr => (
            <div
              key={qr.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            >
              <span className="text-xs text-gray-600 w-4 text-center">{qr.poster_index}</span>
              {qr.qr_image_url && (
                <Image src={qr.qr_image_url} alt="QR" width={32} height={32} className="rounded object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{qr.qr_label}</p>
                <p className="text-xs text-gray-600">{qr.total_scans} scans · {qr.unique_scanners} unique</p>
              </div>
              <button
                onClick={() => setViewQr(qr)}
                className="text-xs px-2 py-1 rounded transition-colors flex-shrink-0"
                style={{ color: '#f59e0b', backgroundColor: '#f59e0b11' }}
              >
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* QR preview modal */}
      {viewQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          onClick={() => setViewQr(null)}
        >
          <div
            className="rounded-xl p-6 max-w-sm w-full space-y-4 text-center"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-white">{viewQr.qr_label}</p>
            {viewQr.qr_image_url ? (
              <div className="flex justify-center">
                <Image src={viewQr.qr_image_url} alt="QR Code" width={192} height={192} className="object-contain" />
              </div>
            ) : (
              <p className="text-sm text-gray-500">QR image generating…</p>
            )}
            <div className="flex gap-2 justify-center text-xs text-gray-400">
              <span>Scans: {viewQr.total_scans}</span>
              <span>·</span>
              <span>Unique: {viewQr.unique_scanners}</span>
            </div>
            <div className="flex gap-2">
              {viewQr.qr_image_url && (
                <a
                  href={viewQr.qr_image_url}
                  download={`qr-${viewQr.qr_slug}.png`}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: '#f59e0b', color: '#000' }}
                >
                  Download
                </a>
              )}
              <a
                href={`/scan/${viewQr.qr_slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 rounded-lg text-xs font-medium border"
                style={{ borderColor: '#2a2a2a', color: '#9ca3af' }}
              >
                Preview page
              </a>
              <button
                onClick={() => setViewQr(null)}
                className="flex-1 py-2 rounded-lg text-xs border"
                style={{ borderColor: '#2a2a2a', color: '#6b7280' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VendorBookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?next=/vendor/bookings')
        return
      }
      const t = session.access_token
      setToken(t)

      const authHeaders: Record<string, string> = {}
      if (t) authHeaders['Authorization'] = `Bearer ${t}`
      const res = await fetch('/api/bookings?role=vendor', {
        headers: authHeaders,
      })
      const data = await res.json()
      setBookings(data.bookings ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  function handleProofUploaded(bookingId: string, urls: string[]) {
    setBookings(prev =>
      prev.map(b => b.id === bookingId
        ? { ...b, proof_of_execution: urls, status: b.status === 'confirmed' || b.status === 'paid' ? 'executing' : b.status }
        : b
      )
    )
  }

  const canUploadProof = (status: string) =>
    ['confirmed', 'paid', 'executing'].includes(status)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Bookings</h1>

      {loading ? (
        <div className="py-16 text-center" style={{ color: '#737373' }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-white font-medium">No bookings yet</p>
          <p className="text-sm mt-1" style={{ color: '#737373' }}>Bookings will appear once buyers reserve your listings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.inquiry
            const isOpen = expanded === b.id
            return (
              <div
                key={b.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
              >
                {/* Row header */}
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0"
                      style={{ backgroundColor: sc.bg, color: sc.text }}
                    >
                      {b.status}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{b.listing_title}</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>
                        {b.start_date && b.end_date
                          ? `${new Date(b.start_date).toLocaleDateString('en-IN')} – ${new Date(b.end_date).toLocaleDateString('en-IN')}`
                          : new Date(b.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    {b.has_messages && !isOpen && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#f59e0b' }}
                        title="Has messages"
                      />
                    )}
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                        ₹{b.vendor_payout.toLocaleString('en-IN')}
                      </p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>your payout</p>
                    </div>
                    <span style={{ color: '#6b7280' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div
                    className="px-5 pb-5 space-y-4"
                    style={{ borderTop: '1px solid #2a2a2a' }}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                      <div>
                        <p className="text-xs" style={{ color: '#6b7280' }}>Booking total</p>
                        <p className="text-sm font-medium text-white">₹{b.amount.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#6b7280' }}>Your payout</p>
                        <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>₹{b.vendor_payout.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: '#6b7280' }}>Proof approved</p>
                        <p className="text-sm font-medium" style={{ color: b.proof_approved ? '#4ade80' : '#6b7280' }}>
                          {b.proof_approved ? '✓ Approved' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* QR Codes per poster */}
                    <QrManager bookingId={b.id} token={token} bookingStatus={b.status} />

                    {/* Proof upload section */}
                    {canUploadProof(b.status) && !b.proof_approved && (
                      <div
                        className="rounded-xl p-4"
                        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                          Proof of Execution
                        </p>
                        <p className="text-xs mt-1 mb-2" style={{ color: '#4b5563' }}>
                          Upload photos showing the ad is live at the location. Buyer approves to release your payout.
                        </p>
                        <ProofUploader
                          bookingId={b.id}
                          existing={b.proof_of_execution}
                          token={token}
                          onUploaded={(urls) => handleProofUploaded(b.id, urls)}
                        />
                      </div>
                    )}

                    {/* Proof uploaded, awaiting buyer */}
                    {b.proof_of_execution.length > 0 && !b.proof_approved && (
                      <div
                        className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                        style={{ backgroundColor: '#1c1400', border: '1px solid #78350f', color: '#fbbf24' }}
                      >
                        ⏳ {b.proof_of_execution.length} photo{b.proof_of_execution.length !== 1 ? 's' : ''} uploaded — awaiting buyer approval
                      </div>
                    )}

                    {/* Completed */}
                    {b.proof_approved && (
                      <div
                        className="rounded-lg px-4 py-3 text-sm flex items-center gap-2"
                        style={{ backgroundColor: '#052e16', border: '1px solid #14532d', color: '#4ade80' }}
                      >
                        ✓ Proof approved — payout queued
                      </div>
                    )}

                    {/* Message thread */}
                    <MessageThread
                      bookingId={b.id}
                      token={token}
                      currentRole="vendor"
                    />
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
