'use client'

import { LISTING_CATEGORIES } from '@/lib/constants'
import { ListingCategory } from '@/types'

const categoryIcons: Record<string, string> = {
  outdoor_ooh: '🪧',
  transit_infrastructure: '🚇',
  property_spaces: '🏢',
  local_business: '🏪',
  print_broadcast: '📰',
  influencer: '📱',
  digital: '💻',
  unconventional: '✨',
}

interface Props {
  data: {
    category: string
    subcategory: string
    title: string
    description: string
    city: string
    area: string
  }
  onChange: (field: string, value: string) => void
  errors: Record<string, string>
}

export default function StepBasicInfo({ data, onChange, errors }: Props) {
  const subcategories = data.category
    ? LISTING_CATEGORIES[data.category as keyof typeof LISTING_CATEGORIES]?.subcategories ?? []
    : []

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Category <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(LISTING_CATEGORIES).map(([key, cat]) => {
            const selected = data.category === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { onChange('category', key); onChange('subcategory', '') }}
                className="flex flex-col items-center gap-2 rounded-xl p-4 text-center transition-all"
                style={{
                  backgroundColor: selected ? '#f59e0b1a' : '#111111',
                  border: `1px solid ${selected ? '#f59e0b' : '#2a2a2a'}`,
                  color: selected ? '#f59e0b' : '#9ca3af',
                }}
              >
                <span className="text-2xl">{categoryIcons[key]}</span>
                <span className="text-xs font-medium leading-tight">{cat.label}</span>
              </button>
            )
          })}
        </div>
        {errors.category && <p className="mt-1 text-xs text-red-400">{errors.category}</p>}
      </div>

      {/* Subcategory */}
      {subcategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Subcategory <span style={{ color: '#f59e0b' }}>*</span>
          </label>
          <select
            value={data.subcategory}
            onChange={(e) => onChange('subcategory', e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2"
            style={{
              backgroundColor: '#111111',
              border: '1px solid #2a2a2a',
              ['--tw-ring-color' as string]: '#f59e0b',
            }}
          >
            <option value="">Select subcategory</option>
            {subcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
          {errors.subcategory && <p className="mt-1 text-xs text-red-400">{errors.subcategory}</p>}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Title <span style={{ color: '#f59e0b' }}>*</span>
        </label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onChange('title', e.target.value)}
          placeholder="e.g. Premium Billboard on MG Road"
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
          style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
        />
        {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange('description', e.target.value)}
          rows={4}
          placeholder="Describe your ad space, audience, visibility, etc."
          className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 resize-none"
          style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
        />
      </div>

      {/* City + Area */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            City <span style={{ color: '#f59e0b' }}>*</span>
          </label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="Mumbai"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          />
          {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Area / Locality</label>
          <input
            type="text"
            value={data.area}
            onChange={(e) => onChange('area', e.target.value)}
            placeholder="Bandra West"
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          />
        </div>
      </div>
    </div>
  )
}
