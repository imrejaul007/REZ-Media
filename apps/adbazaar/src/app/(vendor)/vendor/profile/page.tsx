'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// AB-SEC-KYC-01: Extended Profile interface with KYC fields
interface Profile {
  id: string
  name: string
  email: string
  phone?: string | null
  company_name?: string | null
  gst_number?: string | null
  pan_number?: string | null
  city?: string | null
  rez_merchant_id?: string | null
  role: string
  verified: boolean
  bank_account_name?: string | null
  bank_account_number?: string | null
  bank_ifsc?: string | null
  upi_id?: string | null
  // AB-SEC-KYC-01: KYC status tracking
  kyc_status?: 'pending' | 'submitted' | 'verified' | 'rejected'
  // AB-SEC-2FA-01: 2FA status
  totp_enabled?: boolean
}

interface KYCDocument {
  id: string
  document_type: string
  document_number?: string
  status: string
  submitted_at: string
  rejection_reason?: string
}

export default function VendorProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // AB-SEC-KYC-01: KYC state
  const [kycStatus, setKycStatus] = useState<string>('pending')
  const [kycDocuments, setKycDocuments] = useState<KYCDocument[]>([])
  const [showKycModal, setShowKycModal] = useState(false)
  const [kycForm, setKycForm] = useState({
    documentType: '',
    documentUrl: '',
    documentNumber: '',
  })
  const [kycSubmitting, setKycSubmitting] = useState(false)
  const [kycSuccess, setKycSuccess] = useState('')

  // AB-SEC-2FA-01: 2FA state
  const [show2faSetup, setShow2faSetup] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpSetupLoading, setTotpSetupLoading] = useState(false)
  const [totpVerifyLoading, setTotpVerifyLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    company_name: '',
    gst_number: '',
    pan_number: '',
    city: '',
    rez_merchant_id: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    upi_id: '',
  })

  // Check URL params for KYC requirement
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('kyc_required') === 'true') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization-only effect
      setShowKycModal(true)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const t = session?.access_token ?? ''
      setToken(t)

      const authHeaders: Record<string, string> = {}
      if (t) authHeaders['Authorization'] = `Bearer ${t}`
      const res = await fetch('/api/profile', {
        headers: authHeaders,
      })
      const data = await res.json()
      setLoading(false)
      if (!res.ok) { setError(data.error ?? 'Failed to load profile'); return }
      setProfile(data.profile)
      setForm({
        name: data.profile.name ?? '',
        phone: data.profile.phone ?? '',
        company_name: data.profile.company_name ?? '',
        gst_number: data.profile.gst_number ?? '',
        pan_number: data.profile.pan_number ?? '',
        city: data.profile.city ?? '',
        rez_merchant_id: data.profile.rez_merchant_id ?? '',
        bank_account_name: data.profile.bank_account_name ?? '',
        bank_account_number: data.profile.bank_account_number ?? '',
        bank_ifsc: data.profile.bank_ifsc ?? '',
        upi_id: data.profile.upi_id ?? '',
      })

      // AB-SEC-KYC-01: Load KYC status
      setKycStatus(data.profile.kyc_status || 'pending')

      // Fetch KYC documents
      try {
        const kycRes = await fetch('/api/vendor/kyc', { headers: authHeaders })
        const kycData = await kycRes.json()
        if (kycRes.ok) {
          setKycStatus(kycData.kycStatus || 'pending')
          setKycDocuments(kycData.documents || [])
        }
      } catch {
        // Non-critical, ignore
      }
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    setSaved(false)

    const saveHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) saveHeaders['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: saveHeaders,
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
    setProfile(data.profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // AB-SEC-KYC-01: Submit KYC document
  async function submitKyc(e: React.FormEvent) {
    e.preventDefault()
    if (!kycForm.documentType || !kycForm.documentUrl) {
      setError('Please select document type and upload a document')
      return
    }
    setKycSubmitting(true)
    setError('')

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/vendor/kyc', {
      method: 'POST',
      headers,
      body: JSON.stringify(kycForm),
    })
    const data = await res.json()
    setKycSubmitting(false)

    if (!res.ok) {
      setError(data.error || 'Failed to submit KYC')
      return
    }

    setKycStatus('submitted')
    setKycSuccess('KYC document submitted successfully!')
    setShowKycModal(false)
    setKycForm({ documentType: '', documentUrl: '', documentNumber: '' })
    setTimeout(() => setKycSuccess(''), 5000)
  }

  // AB-SEC-2FA-01: Setup 2FA
  async function start2faSetup() {
    setTotpSetupLoading(true)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/auth/2fa/setup', { headers })
    const data = await res.json()
    setTotpSetupLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to setup 2FA')
      return
    }

    setQrCode(data.qrCode)
    setShow2faSetup(true)
  }

  async function verify2fa(e: React.FormEvent) {
    e.preventDefault()
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }
    setTotpVerifyLoading(true)
    setError('')

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/auth/2fa/setup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: totpCode }),
    })
    const data = await res.json()
    setTotpVerifyLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to enable 2FA')
      return
    }

    setProfile({ ...profile!, totp_enabled: true })
    setShow2faSetup(false)
    setTotpCode('')
    setKycSuccess('2FA enabled successfully!')
    setTimeout(() => setKycSuccess(''), 5000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: '#737373' }}>Loading…</p>
      </div>
    )
  }

  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500'
  const inputStyle = { backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }
  const labelClass = 'block text-xs mb-1.5'
  const labelStyle = { color: '#6b7280' }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile & Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          Update your account details and business information
        </p>
      </div>

      {/* Account badge */}
      <div
        className="flex items-center gap-4 rounded-xl p-4"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          {form.name?.[0]?.toUpperCase() ?? 'V'}
        </div>
        <div>
          <p className="font-semibold text-white">{profile?.name}</p>
          <p className="text-sm" style={{ color: '#6b7280' }}>{profile?.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
            >
              Vendor
            </span>
            {profile?.verified && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
              >
                Verified
              </span>
            )}
            {/* AB-SEC-KYC-01: KYC status badge */}
            {kycStatus === 'verified' && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
              >
                KYC Verified
              </span>
            )}
            {kycStatus === 'submitted' && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#1e3a5f22', color: '#60a5fa', border: '1px solid #1e3a5f' }}
              >
                KYC Pending
              </span>
            )}
            {(kycStatus === 'pending' || !kycStatus) && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                style={{ backgroundColor: '#7f1d1d22', color: '#f87171', border: '1px solid #7f1d1d' }}
                onClick={() => setShowKycModal(true)}
              >
                KYC Required
              </span>
            )}
            {kycStatus === 'rejected' && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                style={{ backgroundColor: '#7f1d1d22', color: '#f87171', border: '1px solid #7f1d1d' }}
                onClick={() => setShowKycModal(true)}
              >
                KYC Rejected
              </span>
            )}
            {/* AB-SEC-2FA-01: 2FA status badge */}
            {profile?.totp_enabled && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
              >
                2FA Enabled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AB-SEC-KYC-01: Success message */}
      {kycSuccess && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#05291611', color: '#4ade80', border: '1px solid #14532d' }}
        >
          {kycSuccess}
        </div>
      )}

      <form onSubmit={save} className="space-y-5">
        {/* Basic */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
            Basic Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Full name *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>City</label>
              <input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="Mumbai"
              />
            </div>
          </div>
        </div>

        {/* Business */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
            Business Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={labelStyle}>Company name</label>
              <input
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="Acme Advertising Pvt Ltd"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>GST number</label>
              <input
                value={form.gst_number}
                onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="29AABCU9603R1ZV"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>PAN number</label>
              <input
                value={form.pan_number}
                onChange={e => setForm(f => ({ ...f, pan_number: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="AABCU9603R"
              />
            </div>
          </div>
        </div>

        {/* Payout Settings */}
        <div
          id="payout"
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
              Payout Settings
            </p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
              Add your bank account or UPI ID to receive payouts when bookings complete
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClass} style={labelStyle}>Account holder name</label>
              <input
                value={form.bank_account_name}
                onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="Full name as on bank account"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Account number</label>
              <input
                value={form.bank_account_number}
                onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="e.g. 12345678901234"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>IFSC code</label>
              <input
                value={form.bank_ifsc}
                onChange={e => setForm(f => ({ ...f, bank_ifsc: e.target.value.toUpperCase() }))}
                className={inputClass}
                style={inputStyle}
                placeholder="e.g. HDFC0001234"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: '#2a2a2a' }} />
            <span className="text-xs" style={{ color: '#6b7280' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#2a2a2a' }} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>UPI ID (alternative)</label>
            <input
              value={form.upi_id}
              onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="yourname@upi"
            />
          </div>
        </div>

        {/* REZ Connect */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #f59e0b33' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
              REZ Integration
            </p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
              Link your REZ merchant account to enable coin attribution and payout tracking
            </p>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>REZ Merchant ID</label>
            <input
              value={form.rez_merchant_id}
              onChange={e => setForm(f => ({ ...f, rez_merchant_id: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              placeholder="rez_merch_xxxxxxxx"
            />
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: '#ef444411', color: '#f87171', border: '1px solid #ef444433' }}
          >
            {error}
          </div>
        )}

        {saved && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: '#05291611', color: '#4ade80', border: '1px solid #14532d' }}
          >
            Profile updated successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* AB-SEC-2FA-01: 2FA Setup Section */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
              Security
            </p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
              Two-Factor Authentication adds an extra layer of security to your account
            </p>
          </div>
          {!profile?.totp_enabled && (
            <button
              onClick={start2faSetup}
              disabled={totpSetupLoading}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
            >
              {totpSetupLoading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          )}
          {profile?.totp_enabled && (
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
            >
              Enabled
            </span>
          )}
        </div>
      </div>

      {/* AB-SEC-KYC-01: KYC Section */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>
              KYC Verification
            </p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
              Submit identity documents to verify your vendor account
            </p>
          </div>
          {kycStatus !== 'verified' && (
            <button
              onClick={() => setShowKycModal(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
            >
              {kycStatus === 'submitted' ? 'Update KYC' : 'Submit KYC'}
            </button>
          )}
          {kycStatus === 'verified' && (
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
            >
              Verified
            </span>
          )}
        </div>
        {kycDocuments.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs" style={{ color: '#6b7280' }}>Submitted documents:</p>
            {kycDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between text-xs" style={{ color: '#9ca3af' }}>
                <span>{doc.document_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                <span
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: doc.status === 'verified' ? '#05291622' : '#7f1d1d22',
                    color: doc.status === 'verified' ? '#4ade80' : '#f87171',
                  }}
                >
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AB-SEC-KYC-01: KYC Modal */}
      {showKycModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 space-y-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Submit KYC Documents</h3>
              <button
                onClick={() => setShowKycModal(false)}
                className="text-gray-400 hover:text-white"
              >
                &#10005;
              </button>
            </div>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              Please submit one or more identity documents to verify your vendor account.
            </p>
            <form onSubmit={submitKyc} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Document Type</label>
                <select
                  value={kycForm.documentType}
                  onChange={e => setKycForm(f => ({ ...f, documentType: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  required
                >
                  <option value="">Select document type</option>
                  <option value="aadhar">Aadhar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="gst_certificate">GST Certificate</option>
                  <option value="address_proof">Address Proof</option>
                  <option value="business_certificate">Business Certificate</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Document Number (optional)</label>
                <input
                  value={kycForm.documentNumber}
                  onChange={e => setKycForm(f => ({ ...f, documentNumber: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="Enter document number"
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Document URL</label>
                <input
                  type="url"
                  value={kycForm.documentUrl}
                  onChange={e => setKycForm(f => ({ ...f, documentUrl: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="https://example.com/document.jpg"
                  required
                />
                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                  Upload your document first using the file upload option below, then paste the URL here.
                </p>
              </div>
              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#ef444411', color: '#f87171' }}>
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowKycModal(false)}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border"
                  style={{ borderColor: '#2a2a2a', color: '#9ca3af' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={kycSubmitting}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                >
                  {kycSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AB-SEC-2FA-01: 2FA Setup Modal */}
      {show2faSetup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 space-y-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Setup Two-Factor Authentication</h3>
              <button
                onClick={() => setShow2faSetup(false)}
                className="text-gray-400 hover:text-white"
              >
                &#10005;
              </button>
            </div>
            <div className="text-center">
              <p className="text-sm mb-4" style={{ color: '#9ca3af' }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              {qrCode && (
                <img src={qrCode} alt="2FA QR Code" className="mx-auto mb-4" style={{ maxWidth: '200px' }} />
              )}
            </div>
            <form onSubmit={verify2fa} className="space-y-4">
              <div>
                <label className={labelClass} style={labelStyle}>Enter the 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className={inputClass}
                  style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                  placeholder="000000"
                  required
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: '#ef444411', color: '#f87171' }}>
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShow2faSetup(false)}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border"
                  style={{ borderColor: '#2a2a2a', color: '#9ca3af' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totpVerifyLoading || totpCode.length !== 6}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
                >
                  {totpVerifyLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
