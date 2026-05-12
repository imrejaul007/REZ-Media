'use client'

import { useState } from 'react'

const SCREEN_TYPES = [
  { value: 'cab_tablet', label: '🚕 Taxi/Cab Tablet', desc: 'Seat-back or dashboard tablet' },
  { value: 'bus_shelter', label: '🚌 Bus Shelter', desc: 'Street bus stop displays' },
  { value: 'bus_interior', label: '🚌 Bus Interior', desc: 'Inside bus TV screens' },
  { value: 'restaurant_tv', label: '🍽️ Restaurant TV', desc: 'Restaurant menu boards & ads' },
  { value: 'hotel_lobby', label: '🏨 Hotel Lobby', desc: 'Hotel reception displays' },
  { value: 'hotel_room', label: '🏨 Hotel Room TV', desc: 'Room TV advertising' },
  { value: 'mall_kiosk', label: '🛒 Mall Kiosk', desc: 'Mall directory & displays' },
  { value: 'gym_screen', label: '💪 Gym Screen', desc: 'Gym TV displays' },
  { value: 'office_lobby', label: '🏢 Office Lobby', desc: 'Reception displays' },
  { value: 'generic_display', label: '📺 Generic Display', desc: 'Any digital screen' },
  { value: 'flight_seatback', label: '✈️ Flight Seat-back', desc: 'Airline entertainment' },
  { value: 'airport_gate', label: '✈️ Airport Gate', desc: 'Gate boarding displays' },
  { value: 'airport_lounge', label: '✈️ Airport Lounge', desc: 'VIP lounge screens' },
]

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    type: '',
    email: '',
    phone: '',
    city: '',
    screens_count: '1',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [registeredId, setRegisteredId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const screenId = `screen_${Date.now()}`

      const res = await fetch('/api/screens/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: screenId,
          name: form.name,
          type: form.type,
          location: { city: form.city },
          owner_id: form.email,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setSuccess(true)
        setRegisteredId(screenId)
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="max-w-md w-full p-8 rounded-2xl" style={{ backgroundColor: '#1a1a1a' }}>
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2">Registration Complete!</h1>
            <p className="text-white/60">Your screen is now part of the DOOH network</p>
          </div>

          <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: '#0a0a0a' }}>
            <p className="text-xs text-white/40 mb-1">Screen ID</p>
            <p className="font-mono text-lg">{registeredId}</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Next Steps:</h3>
            <ol className="text-sm text-white/70 space-y-2">
              <li>1. Install DOOH Screen App on your display</li>
              <li>2. Configure: <code className="text-amber-400">NEXT_PUBLIC_SCREEN_ID={registeredId}</code></li>
              <li>3. Start earning from ads!</li>
            </ol>
          </div>

          <a
            href="/"
            className="block w-full mt-6 py-3 rounded-lg text-center font-semibold"
            style={{ backgroundColor: '#f59e0b', color: '#000' }}
          >
            Download Setup Guide
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: '#0a0a0a' }}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center py-8">
          <h1 className="text-3xl font-bold mb-2">Register Your Display</h1>
          <p className="text-white/60">Join the DOOH network and earn from your screens</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 rounded-2xl" style={{ backgroundColor: '#1a1a1a' }}>
          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Screen/Location Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Lobby Display, Main Screen"
              required
              className="w-full px-4 py-3 rounded-lg border"
              style={{ backgroundColor: '#0a0a0a', borderColor: '#333' }}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Screen Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg border"
              style={{ backgroundColor: '#0a0a0a', borderColor: '#333' }}
            >
              <option value="">Select screen type...</option>
              {SCREEN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} - {t.desc}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="e.g., Bangalore"
              required
              className="w-full px-4 py-3 rounded-lg border"
              style={{ backgroundColor: '#0a0a0a', borderColor: '#333' }}
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-lg border"
                style={{ backgroundColor: '#0a0a0a', borderColor: '#333' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3 rounded-lg border"
                style={{ backgroundColor: '#0a0a0a', borderColor: '#333' }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg text-red-400" style={{ backgroundColor: '#ef444420' }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-lg font-bold text-lg disabled:opacity-50"
            style={{ backgroundColor: '#f59e0b', color: '#000' }}
          >
            {submitting ? 'Registering...' : 'Register Screen'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-white/40 text-sm mt-6">
          Already registered? <a href="/dashboard" className="text-amber-400">View Dashboard</a>
        </p>
      </div>
    </div>
  )
}
