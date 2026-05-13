'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface KYCVendor {
  id: string
  name: string
  email: string
  company_name?: string
  phone?: string
  kyc_status: string
  created_at: string
  kyc_documents: Array<{
    id: string
    document_type: string
    document_url: string
    document_number?: string
    status: string
    submitted_at: string
    reviewed_at?: string
    rejection_reason?: string
  }>
}

export default function AdminKYCMgmtPage() {
  const [vendors, setVendors] = useState<KYCVendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null)

  useEffect(() => {
    loadVendors()
  }, [])

  async function loadVendors() {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/admin/kyc', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load KYC data')
        return
      }

      const data = await res.json()
      setVendors(data.vendors || [])
    } catch {
      setError('Failed to load KYC data')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(vendorId: string) {
    setProcessing(vendorId)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId, action: 'approve' }),
      })

      if (res.ok) {
        await loadVendors()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to approve KYC')
      }
    } catch {
      setError('Failed to approve KYC')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(vendorId: string) {
    if (!rejectReason.trim()) {
      setError('Please provide a rejection reason')
      return
    }

    setProcessing(vendorId)
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendorId, action: 'reject', reason: rejectReason }),
      })

      if (res.ok) {
        setShowRejectModal(null)
        setRejectReason('')
        await loadVendors()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to reject KYC')
      }
    } catch {
      setError('Failed to reject KYC')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[#2a2a2a] rounded"></div>
          <div className="h-64 bg-[#2a2a2a] rounded"></div>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    pending: { bg: '#7f1d1d22', text: '#f87171', border: '#7f1d1d' },
    submitted: { bg: '#1e3a5f22', text: '#60a5fa', border: '#1e3a5f' },
    verified: { bg: '#05291622', text: '#4ade80', border: '#14532d' },
    rejected: { bg: '#7f1d1d22', text: '#f87171', border: '#7f1d1d' },
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">KYC Management</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Review and manage vendor KYC verification requests
        </p>
      </div>

      {error && (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
        >
          {error}
        </div>
      )}

      {vendors.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p style={{ color: '#6b7280' }}>No vendors pending KYC review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
            >
              {/* Vendor info */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                  >
                    {vendor.name?.[0]?.toUpperCase() ?? 'V'}
                  </div>
                  <div>
                    <p className="font-medium text-white">{vendor.name}</p>
                    <p className="text-sm" style={{ color: '#6b7280' }}>{vendor.email}</p>
                    {vendor.company_name && (
                      <p className="text-xs" style={{ color: '#6b7280' }}>{vendor.company_name}</p>
                    )}
                  </div>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: statusColors[vendor.kyc_status]?.bg,
                    color: statusColors[vendor.kyc_status]?.text,
                    border: `1px solid ${statusColors[vendor.kyc_status]?.border}`,
                  }}
                >
                  {vendor.kyc_status?.toUpperCase() ?? 'PENDING'}
                </span>
              </div>

              {/* Documents */}
              {vendor.kyc_documents && vendor.kyc_documents.length > 0 && (
                <div className="pl-14 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6b7280' }}>
                    Submitted Documents
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {vendor.kyc_documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-lg text-sm"
                        style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white">
                            {doc.document_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              backgroundColor: doc.status === 'verified' ? '#05291622' : '#7f1d1d22',
                              color: doc.status === 'verified' ? '#4ade80' : '#f87171',
                            }}
                          >
                            {doc.status}
                          </span>
                        </div>
                        {doc.document_number && (
                          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                            Number: {doc.document_number}
                          </p>
                        )}
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs mt-1 inline-block"
                          style={{ color: '#f59e0b' }}
                        >
                          View document
                        </a>
                        {doc.rejection_reason && (
                          <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                            Rejection reason: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {vendor.kyc_status !== 'verified' && (
                <div className="flex items-center gap-3 pl-14">
                  <button
                    onClick={() => handleApprove(vendor.id)}
                    disabled={processing === vendor.id}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#052916', color: '#4ade80', border: '1px solid #14532d' }}
                  >
                    {processing === vendor.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setShowRejectModal(vendor.id)}
                    disabled={processing === vendor.id}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#7f1d1d', color: '#f87171', border: '1px solid #991b1b' }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Reject Modal */}
              {showRejectModal === vendor.id && (
                <div
                  className="mt-4 p-4 rounded-lg space-y-3"
                  style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
                >
                  <p className="text-sm font-medium" style={{ color: '#9ca3af' }}>
                    Rejection Reason
                  </p>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none"
                    style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowRejectModal(null)
                        setRejectReason('')
                      }}
                      className="flex-1 rounded-lg px-3 py-1.5 text-sm border"
                      style={{ borderColor: '#2a2a2a', color: '#9ca3af' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(vendor.id)}
                      disabled={processing === vendor.id || !rejectReason.trim()}
                      className="flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#7f1d1d', color: '#f87171' }}
                    >
                      {processing === vendor.id ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
