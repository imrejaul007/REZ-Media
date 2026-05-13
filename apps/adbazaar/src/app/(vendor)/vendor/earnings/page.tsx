'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

interface MonthEntry { month: string; booked: number; released: number; count: number }
interface RecentPayout { bookingId: string; listingTitle: string; city: string; amount: number; bookingTotal: number; date: string; payoutId: string | null; proofApproved: boolean }
interface EarningsData {
  totalRevenue: number
  pendingPayout: number
  releasedPayout: number
  totalBookings: number
  monthlyTrend: MonthEntry[]
  statusBreakdown: Record<string, { count: number; amount: number }>
  recentPayouts: RecentPayout[]
}

interface PayoutProfile {
  bank_account_name?: string | null
  bank_account_number?: string | null
  bank_ifsc?: string | null
  upi_id?: string | null
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function monthLabel(ym: string) {
  const [, m] = ym.split('-')
  return MONTH_NAMES[parseInt(m, 10) - 1] ?? ym
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: `1px solid ${accent ? '#f59e0b44' : '#2a2a2a'}` }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>{label}</p>
      <p className="mt-2 text-3xl font-bold" style={{ color: accent ? '#f59e0b' : '#ffffff' }}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

export default function VendorEarningsPage() {
  const [data, setData] = useState<EarningsData | null>(null)
  const [payoutProfile, setPayoutProfile] = useState<PayoutProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payoutLoading, setPayoutLoading] = useState<string | null>(null)
  const [payoutMsg, setPayoutMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  const [token, setToken] = useState('')

  async function requestPayout(bookingId: string) {
    setPayoutLoading(bookingId)
    setPayoutMsg(null)
    try {
      const res = await fetch('/api/vendor/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPayoutMsg({ id: bookingId, msg: json.error ?? 'Payout failed', ok: false })
      } else {
        setPayoutMsg({ id: bookingId, msg: json.message ?? 'Payout initiated!', ok: true })
        // Update local data to reflect payout_id set
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            recentPayouts: prev.recentPayouts.map(p =>
              p.bookingId === bookingId ? { ...p, payoutId: json.payoutId ?? 'initiated' } : p,
            ),
          }
        })
      }
    } catch {
      setPayoutMsg({ id: bookingId, msg: 'Network error', ok: false })
    } finally {
      setPayoutLoading(null)
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const tok = session?.access_token ?? ''
      setToken(tok)

      const authHeaders: Record<string, string> = {}
      if (tok) authHeaders['Authorization'] = `Bearer ${tok}`

      const [earningsRes, profileRes] = await Promise.all([
        fetch('/api/vendor/earnings', { headers: authHeaders }),
        fetch('/api/profile', { headers: authHeaders }),
      ])

      const json = await earningsRes.json()
      if (!earningsRes.ok) { setError(json.error ?? 'Failed to load'); setLoading(false); return }
      setData(json)

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setPayoutProfile({
          bank_account_name: profileData.profile?.bank_account_name ?? null,
          bank_account_number: profileData.profile?.bank_account_number ?? null,
          bank_ifsc: profileData.profile?.bank_ifsc ?? null,
          upi_id: profileData.profile?.upi_id ?? null,
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Earnings</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Your payout summary across all bookings</p>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}>
          {error}
        </div>
      )}

      {/* Payout Method card */}
      {!loading && payoutProfile !== null && (
        (() => {
          const hasBankAccount = payoutProfile.bank_account_number && payoutProfile.bank_ifsc
          const hasUpi = payoutProfile.upi_id
          const hasPayoutMethod = hasBankAccount || hasUpi
          return (
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: '#1a1a1a',
                border: `1px solid ${hasPayoutMethod ? '#2a2a2a' : '#f59e0b44'}`,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#6b7280' }}>
                Payout Method
              </p>
              {hasPayoutMethod ? (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{hasBankAccount ? '🏦' : '📱'}</span>
                    <div>
                      {hasBankAccount && (
                        <>
                          <p className="text-sm font-medium text-white">
                            {payoutProfile.bank_account_name ?? 'Bank Account'}
                          </p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>
                            ****{payoutProfile.bank_account_number?.slice(-4)} &bull; {payoutProfile.bank_ifsc}
                          </p>
                        </>
                      )}
                      {!hasBankAccount && hasUpi && (
                        <>
                          <p className="text-sm font-medium text-white">UPI</p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>{payoutProfile.upi_id}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/vendor/profile#payout"
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: '#27272a', color: '#9ca3af' }}
                  >
                    Edit
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-sm" style={{ color: '#9ca3af' }}>
                    Set up payout to receive funds when bookings complete
                  </p>
                  <Link
                    href="/vendor/profile#payout"
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    Set up payout &rarr;
                  </Link>
                </div>
              )}
            </div>
          )
        })()
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Earnings" value={`₹${data.totalRevenue.toLocaleString('en-IN')}`} sub="Net across all bookings" accent />
            <StatCard label="Released" value={`₹${data.releasedPayout.toLocaleString('en-IN')}`} sub="Proof approved" />
            <StatCard label="In Escrow" value={`₹${data.pendingPayout.toLocaleString('en-IN')}`} sub="Confirmed/executing" />
            <StatCard label="Bookings" value={String(data.totalBookings)} sub="Total non-cancelled" />
          </div>

          {/* Monthly bar chart */}
          {data.monthlyTrend.length > 0 && (
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
                Monthly Earnings Trend
              </h2>
              <div className="flex items-end gap-3 h-36">
                {(() => {
                  const maxVal = Math.max(...data.monthlyTrend.map(m => m.booked), 1)
                  return data.monthlyTrend.map((m) => {
                    const bookedPct = Math.max((m.booked / maxVal) * 100, 3)
                    const relPct = m.booked > 0 ? Math.max((m.released / m.booked) * bookedPct, 0) : 0
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs" style={{ color: '#4b5563' }}>
                          {m.booked >= 1000 ? `${(m.booked/1000).toFixed(0)}k` : m.booked}
                        </span>
                        <div className="w-full flex-1 flex flex-col justify-end relative" style={{ backgroundColor: '#0f0f0f', borderRadius: 6 }}>
                          <div style={{ height: `${bookedPct}%`, backgroundColor: '#f59e0b33', borderRadius: 6 }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${relPct}%`, backgroundColor: '#f59e0b', borderRadius: 6 }} />
                        </div>
                        <span className="text-xs" style={{ color: '#6b7280' }}>{monthLabel(m.month)}</span>
                      </div>
                    )
                  })
                })()}
              </div>
              <div className="flex gap-4 mt-3 text-xs" style={{ color: '#6b7280' }}>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f59e0b' }} /> Released</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#f59e0b33' }} /> Booked</span>
              </div>
            </div>
          )}

          {/* Status breakdown */}
          {Object.keys(data.statusBreakdown).length > 0 && (
            <div className="rounded-xl p-5" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#6b7280' }}>
                Breakdown by Status
              </h2>
              <div className="space-y-2">
                {Object.entries(data.statusBreakdown).map(([status, info]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-white">{status}</span>
                    <div className="flex items-center gap-4">
                      <span style={{ color: '#6b7280' }}>{info.count} booking{info.count !== 1 ? 's' : ''}</span>
                      <span className="font-medium" style={{ color: '#f59e0b' }}>
                        ₹{info.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed bookings — payout requests */}
          {data.recentPayouts.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #2a2a2a' }}>
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
                  Completed Bookings
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: '#2a2a2a' }}>
                {data.recentPayouts.map((p) => {
                  const canRequest = p.proofApproved && !p.payoutId
                  const isRequesting = payoutLoading === p.bookingId
                  const msg = payoutMsg?.id === p.bookingId ? payoutMsg : null
                  return (
                    <div key={p.bookingId} className="px-5 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">{p.listingTitle}</p>
                          <p className="text-xs" style={{ color: '#6b7280' }}>
                            {p.city} · {new Date(p.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                              ₹{p.amount.toLocaleString('en-IN')}
                            </p>
                            <p className="text-xs" style={{ color: '#6b7280' }}>of ₹{p.bookingTotal.toLocaleString('en-IN')}</p>
                          </div>
                          {p.payoutId ? (
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#16a34a22', color: '#4ade80' }}>
                              Paid out
                            </span>
                          ) : canRequest ? (
                            <button
                              onClick={() => requestPayout(p.bookingId)}
                              disabled={isRequesting}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                            >
                              {isRequesting ? 'Sending…' : 'Request Payout'}
                            </button>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#27272a', color: '#6b7280' }}>
                              Pending approval
                            </span>
                          )}
                        </div>
                      </div>
                      {msg && (
                        <p className="text-xs" style={{ color: msg.ok ? '#4ade80' : '#f87171' }}>
                          {msg.msg}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {data.totalBookings === 0 && (
            <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
              <p className="font-medium text-white">No earnings yet</p>
              <p className="text-sm mt-1" style={{ color: '#737373' }}>Earnings appear once your bookings are confirmed.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
