'use client'

import { useEffect, useState } from 'react'
import Image from '@/components/ui/Image'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

interface ListingFormData {
  title: string
  description: string
  price: string
  city: string
  area: string
  address: string
  min_booking_days: string
  availability_model: string
  pricing_model: string
  images: string[]
}

export default function EditListingPage() {
  const params = useParams()
  const router = useRouter()
  const listingId = params.id as string

  const [form, setForm] = useState<ListingFormData>({
    title: '',
    description: '',
    price: '',
    city: '',
    area: '',
    address: '',
    min_booking_days: '1',
    availability_model: 'calendar',
    pricing_model: 'fixed',
    images: [],
  })
  const [newImageUrl, setNewImageUrl] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadListing() {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token ?? ''
        setToken(accessToken)

        const headers: Record<string, string> = {}
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

        const res = await fetch(`/api/vendor/listings/${listingId}`, { headers })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error ?? 'Failed to load listing')
          return
        }
        const data = await res.json()
        const l = data.listing
        setForm({
          title: l.title ?? '',
          description: l.description ?? '',
          price: l.price != null ? String(l.price) : '',
          city: l.city ?? '',
          area: l.area ?? '',
          address: l.address ?? '',
          min_booking_days: l.min_booking_days != null ? String(l.min_booking_days) : '1',
          availability_model: l.availability_model ?? 'calendar',
          pricing_model: l.pricing_model ?? 'fixed',
          images: l.images ?? [],
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load listing')
      } finally {
        setLoading(false)
      }
    }
    loadListing()
  }, [listingId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        city: form.city.trim(),
        area: form.area.trim() || null,
        address: form.address.trim() || null,
        availability_model: form.availability_model,
        pricing_model: form.pricing_model,
        min_booking_days: parseInt(form.min_booking_days) || 1,
        images: form.images.filter(Boolean),
      }
      if (form.price) payload.price = parseFloat(form.price)

      const res = await fetch(`/api/vendor/listings/${listingId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to update listing')
        return
      }

      router.push('/vendor/listings?updated=1')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  function onChange(field: keyof ListingFormData, value: string | string[]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 text-sm">Loading listing...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Edit Listing</h1>
        <p className="text-sm text-gray-400">Update your listing details</p>
        <div
          className="mt-3 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#1c1400', border: '1px solid #78350f', color: '#fbbf24' }}
        >
          Note: Category and subcategory cannot be changed after creation.
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          className="rounded-xl p-6 space-y-5 mb-6"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Title <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => onChange('title', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="Listing title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => onChange('description', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="Describe your ad space..."
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Price (INR)</label>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={e => onChange('price', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="e.g. 5000"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              City <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={form.city}
              onChange={e => onChange('city', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="e.g. Mumbai"
            />
          </div>

          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Area / Locality</label>
            <input
              type="text"
              value={form.area}
              onChange={e => onChange('area', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="e.g. Bandra West"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={e => onChange('address', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="Full address"
            />
          </div>

          {/* Availability model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Availability Model</label>
            <select
              value={form.availability_model}
              onChange={e => onChange('availability_model', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
            >
              <option value="calendar">Calendar (date range)</option>
              <option value="slot">Slot-based</option>
              <option value="always_on">Always On</option>
            </select>
          </div>

          {/* Pricing model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Pricing Model</label>
            <select
              value={form.pricing_model}
              onChange={e => onChange('pricing_model', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
            >
              <option value="fixed">Fixed price</option>
              <option value="quote">Quote only</option>
              <option value="both">Fixed + Quote</option>
            </select>
          </div>

          {/* Min booking days */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Minimum Booking Days</label>
            <input
              type="number"
              min={1}
              value={form.min_booking_days}
              onChange={e => onChange('min_booking_days', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-amber-500"
              style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              placeholder="e.g. 7"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Images</label>
            {form.images.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.images.map((url, i) => (
                  <div key={i} className="relative">
                    <Image
                      src={url}
                      alt={`Image ${i + 1}`}
                      width={80}
                      height={80}
                      className="object-cover rounded-lg"
                      style={{ border: '1px solid #2a2a2a' }}
                    />
                    <button
                      type="button"
                      onClick={() => onChange('images', form.images.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: '#ef4444', color: '#fff' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="url"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder="https://... image URL"
                className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
                style={{ backgroundColor: '#0f0f0f', border: '1px solid #2a2a2a' }}
              />
              <button
                type="button"
                onClick={() => {
                  if (newImageUrl.trim()) {
                    onChange('images', [...form.images, newImageUrl.trim()])
                    setNewImageUrl('')
                  }
                }}
                className="rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{ backgroundColor: '#27272a', color: '#d1d5db', border: '1px solid #3a3a3a' }}
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1">Add image URLs. Remove existing ones with the × button.</p>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: '#7f1d1d22', border: '1px solid #7f1d1d', color: '#f87171' }}
          >
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/vendor/listings')}
            className="rounded-lg px-5 py-2.5 text-sm font-medium"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#d1d5db' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
