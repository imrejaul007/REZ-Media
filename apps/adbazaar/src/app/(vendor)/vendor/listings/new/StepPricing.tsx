'use client'

import { PricingModel, AvailabilityModel, DurationUnit } from '@/types'

const durationUnits = [
  { value: 'per_day',      label: 'Per Day' },
  { value: 'per_week',     label: 'Per Week' },
  { value: 'per_month',    label: 'Per Month' },
  { value: 'per_post',     label: 'Per Post' },
  { value: 'per_campaign', label: 'Per Campaign' },
  { value: 'per_slot',     label: 'Per Slot' },
]

const availabilityOptions = [
  {
    value: 'calendar',
    label: 'Calendar',
    desc: 'Buyers pick specific dates from a calendar. Best for OOH, billboards, physical spaces.',
  },
  {
    value: 'slot',
    label: 'Slot-based',
    desc: 'Time slots (e.g., 9am–11am). Best for screens, events, live promotions.',
  },
  {
    value: 'always_on',
    label: 'Always-On',
    desc: 'Always available with no date restrictions. Best for digital, influencer, print.',
  },
]

interface Props {
  data: {
    pricing_model: string
    price: string
    duration_unit: string
    availability_model: string
    min_booking_days: string
    bulk_discount_pct: string
    qr_enabled: boolean
  }
  onChange: (field: string, value: string | boolean) => void
  errors: Record<string, string>
}

export default function StepPricing({ data, onChange, errors }: Props) {
  const showPrice = data.pricing_model === 'fixed' || data.pricing_model === 'both'

  return (
    <div className="space-y-6">
      {/* Pricing model */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Pricing Model <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <div className="flex gap-3 flex-wrap">
          {(['fixed', 'quote', 'both'] as const).map((pm) => (
            <label
              key={pm}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                backgroundColor: data.pricing_model === pm ? '#f59e0b1a' : '#111111',
                border: `1px solid ${data.pricing_model === pm ? '#f59e0b' : '#2a2a2a'}`,
                color: data.pricing_model === pm ? '#f59e0b' : '#9ca3af',
              }}
            >
              <input
                type="radio"
                name="pricing_model"
                value={pm}
                checked={data.pricing_model === pm}
                onChange={() => onChange('pricing_model', pm)}
                className="sr-only"
              />
              {pm === 'fixed' ? 'Fixed Price' : pm === 'quote' ? 'Request Quote' : 'Fixed + Quote'}
            </label>
          ))}
        </div>
        {errors.pricing_model && <p className="mt-1 text-xs text-red-400">{errors.pricing_model}</p>}
      </div>

      {/* Price + duration */}
      {showPrice && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Price (₹) <span style={{ color: '#f59e0b' }}>*</span>
            </label>
            <input
              type="number"
              value={data.price}
              onChange={(e) => onChange('price', e.target.value)}
              placeholder="5000"
              min="0"
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            />
            {errors.price && <p className="mt-1 text-xs text-red-400">{errors.price}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Duration Unit</label>
            <select
              value={data.duration_unit}
              onChange={(e) => onChange('duration_unit', e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2"
              style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
            >
              {durationUnits.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Availability model */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Availability Model <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <div className="space-y-2">
          {availabilityOptions.map((opt) => {
            const selected = data.availability_model === opt.value
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl p-4 transition-all"
                style={{
                  backgroundColor: selected ? '#f59e0b1a' : '#111111',
                  border: `1px solid ${selected ? '#f59e0b' : '#2a2a2a'}`,
                }}
              >
                <input
                  type="radio"
                  name="availability_model"
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange('availability_model', opt.value)}
                  className="mt-0.5 accent-amber-400"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: selected ? '#f59e0b' : '#e5e7eb' }}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            )
          })}
        </div>
        {errors.availability_model && (
          <p className="mt-1 text-xs text-red-400">{errors.availability_model}</p>
        )}
      </div>

      {/* Min booking days + bulk discount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Min Booking Days</label>
          <input
            type="number"
            value={data.min_booking_days}
            onChange={(e) => onChange('min_booking_days', e.target.value)}
            placeholder="1"
            min="1"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bulk Discount %{' '}
            <span className="text-xs font-normal text-gray-500">optional</span>
          </label>
          <input
            type="number"
            value={data.bulk_discount_pct}
            onChange={(e) => onChange('bulk_discount_pct', e.target.value)}
            placeholder="10"
            min="0"
            max="100"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          />
        </div>
      </div>

      {/* QR toggle */}
      <div
        className="flex items-center justify-between rounded-xl p-4"
        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
      >
        <div>
          <p className="text-sm font-medium text-white">Enable QR Code</p>
          <p className="text-xs text-gray-500 mt-0.5">Enable QR code for REZ coin integration</p>
        </div>
        <button
          type="button"
          onClick={() => onChange('qr_enabled', !data.qr_enabled)}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
          style={{ backgroundColor: data.qr_enabled ? '#f59e0b' : '#374151' }}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
            style={{ transform: `translateX(${data.qr_enabled ? '1.375rem' : '0.125rem'})` }}
          />
        </button>
      </div>
    </div>
  )
}
