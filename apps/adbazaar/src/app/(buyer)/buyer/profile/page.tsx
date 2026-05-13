'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface Profile {
  id: string
  name: string
  email: string
  phone?: string | null
  company_name?: string | null
  gst_number?: string | null
  city?: string | null
  role: string
  verified: boolean
}

export default function BuyerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    phone: '',
    company_name: '',
    gst_number: '',
    city: '',
  })

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
        city: data.profile.city ?? '',
      })
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
          Update your account details and notification preferences
        </p>
      </div>

      {/* Account badge */}
      <div
        className="flex items-center gap-4 rounded-xl p-4"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}
        >
          {form.name?.[0]?.toUpperCase() ?? 'B'}
        </div>
        <div>
          <p className="font-semibold text-white">{profile?.name}</p>
          <p className="text-sm" style={{ color: '#6b7280' }}>{profile?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#3b82f622', color: '#60a5fa', border: '1px solid #3b82f644' }}
            >
              Buyer
            </span>
            {profile?.verified && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: '#05291622', color: '#4ade80', border: '1px solid #14532d' }}
              >
                Verified
              </span>
            )}
          </div>
        </div>
      </div>

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
                placeholder="Bengaluru"
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Company / Brand name</label>
              <input
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                placeholder="Your brand name"
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
    </div>
  )
}
