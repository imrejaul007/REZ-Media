'use client'

const COMPETITOR_OPTIONS = [
  'Fashion', 'Food & Beverage', 'Technology', 'Automotive',
  'Finance', 'Healthcare', 'Education', 'Real Estate',
  'Travel', 'Entertainment', 'FMCG', 'Telecom',
]

interface SpecFields {
  [key: string]: string
}

interface Props {
  category: string
  data: {
    non_competitor_exclusions: string[]
    specs: SpecFields
  }
  onChange: (field: string, value: string[] | SpecFields) => void
  errors: Record<string, string>
}

function SpecInput({
  label,
  field,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  field: string
  value: string
  onChange: (field: string, value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2"
        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
      />
    </div>
  )
}

function CategorySpecs({
  category,
  specs,
  onSpecChange,
}: {
  category: string
  specs: SpecFields
  onSpecChange: (field: string, value: string) => void
}) {
  if (category === 'outdoor_ooh') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <SpecInput label="Dimensions (W x H)" field="dimensions" value={specs.dimensions ?? ''} onChange={onSpecChange} placeholder="10ft x 20ft" />
        <SpecInput label="Material" field="material" value={specs.material ?? ''} onChange={onSpecChange} placeholder="Flex / Metal / Vinyl" />
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Illumination</label>
          <select
            value={specs.illuminated ?? ''}
            onChange={(e) => onSpecChange('illuminated', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          >
            <option value="">Select</option>
            <option value="yes">Illuminated</option>
            <option value="no">Non-illuminated</option>
          </select>
        </div>
        <SpecInput label="Est. Daily Traffic" field="traffic_count" value={specs.traffic_count ?? ''} onChange={onSpecChange} placeholder="50000" type="number" />
      </div>
    )
  }

  if (category === 'influencer') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Platform</label>
          <select
            value={specs.platform ?? ''}
            onChange={(e) => onSpecChange('platform', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          >
            <option value="">Select</option>
            {['Instagram', 'YouTube', 'LinkedIn', 'Twitter/X', 'Facebook', 'Snapchat', 'Moj', 'ShareChat'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <SpecInput label="Follower Count" field="followers" value={specs.followers ?? ''} onChange={onSpecChange} placeholder="100000" type="number" />
        <SpecInput label="Engagement Rate (%)" field="engagement_rate" value={specs.engagement_rate ?? ''} onChange={onSpecChange} placeholder="3.5" type="number" />
        <SpecInput label="Niche / Category" field="niche" value={specs.niche ?? ''} onChange={onSpecChange} placeholder="Lifestyle, Tech, Food..." />
      </div>
    )
  }

  if (category === 'digital') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <SpecInput label="Monthly Traffic / Subscribers" field="monthly_traffic" value={specs.monthly_traffic ?? ''} onChange={onSpecChange} placeholder="50000" type="number" />
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Ad Format</label>
          <select
            value={specs.format ?? ''}
            onChange={(e) => onSpecChange('format', e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
          >
            <option value="">Select</option>
            {['Banner', 'Native', 'Video', 'Interstitial', 'Sponsored Post', 'Newsletter'].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <SpecInput label="Ad Dimensions (px)" field="dimensions" value={specs.dimensions ?? ''} onChange={onSpecChange} placeholder="728x90" />
      </div>
    )
  }

  if (category === 'local_business') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <SpecInput label="Surface Type" field="surface_type" value={specs.surface_type ?? ''} onChange={onSpecChange} placeholder="Window, Counter, Table..." />
        <SpecInput label="Daily Customers" field="daily_customers" value={specs.daily_customers ?? ''} onChange={onSpecChange} placeholder="300" type="number" />
        <SpecInput label="Business Type" field="business_type" value={specs.business_type ?? ''} onChange={onSpecChange} placeholder="Restaurant, Salon, Pharmacy..." />
      </div>
    )
  }

  // Generic fallback
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">Additional Specs</label>
      <textarea
        value={specs.additional ?? ''}
        onChange={(e) => onSpecChange('additional', e.target.value)}
        rows={3}
        placeholder="Enter any additional specifications..."
        className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
      />
    </div>
  )
}

export default function StepAdvanced({ category, data, onChange, errors }: Props) {
  function toggleExclusion(item: string) {
    const current = data.non_competitor_exclusions
    const updated = current.includes(item)
      ? current.filter((e) => e !== item)
      : [...current, item]
    onChange('non_competitor_exclusions', updated)
  }

  function onSpecChange(field: string, value: string) {
    onChange('specs', { ...data.specs, [field]: value })
  }

  return (
    <div className="space-y-6">
      {/* Non-competitor exclusions */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Non-Competitor Exclusions{' '}
          <span className="text-xs font-normal text-gray-500">optional</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Prevent competing brands in these sectors from booking this space.
        </p>
        <div className="flex flex-wrap gap-2">
          {COMPETITOR_OPTIONS.map((item) => {
            const selected = data.non_competitor_exclusions.includes(item)
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleExclusion(item)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                style={{
                  backgroundColor: selected ? '#f59e0b22' : '#1a1a1a',
                  color: selected ? '#f59e0b' : '#9ca3af',
                  border: `1px solid ${selected ? '#f59e0b' : '#2a2a2a'}`,
                }}
              >
                {selected ? '✓ ' : ''}{item}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category specs */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: '#111111', border: '1px solid #2a2a2a' }}
      >
        <h3 className="text-sm font-medium text-gray-300 mb-4">Category-Specific Details</h3>
        <CategorySpecs
          category={category}
          specs={data.specs}
          onSpecChange={onSpecChange}
        />
      </div>
    </div>
  )
}
