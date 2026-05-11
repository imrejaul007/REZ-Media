// Lead Capture Landing Template - AdsQr MVP Phase 4
'use client'

import { useState } from 'react'

interface Interest {
  id: string
  label: string
  icon: string
}

interface LeadCaptureTemplateProps {
  campaignName: string
  headline: string
  details?: string
  terms?: string
  scanReward: number
  visitReward: number
  purchaseReward: number
  brandColor?: string
  bannerUrl?: string
  interests?: Interest[]
  customFields?: string[]
}

export default function LeadCaptureTemplate({
  campaignName,
  headline,
  details,
  terms,
  scanReward,
  visitReward,
  purchaseReward,
  brandColor = '#6366F1',
  bannerUrl,
  interests,
  customFields
}: LeadCaptureTemplateProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    customAnswers: {} as Record<string, string>,
    interests: [] as string[]
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const defaultInterests: Interest[] = interests || [
    { id: 'products', label: 'Products', icon: '🛍️' },
    { id: 'services', label: 'Services', icon: '⚙️' },
    { id: 'promotions', label: 'Promotions', icon: '🎁' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'newsletter', label: 'Newsletter', icon: '📧' },
    { id: 'partnership', label: 'Partnership', icon: '🤝' }
  ]

  const defaultCustomFields = customFields || []

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Name is required'
    if (!formData.email.trim()) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    // In production, this would call an API
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSubmitted(true)
    setSubmitting(false)
  }

  const toggleInterest = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id]
    }))
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: brandColor + '20' }}
          >
            <svg className="w-10 h-10" style={{ color: brandColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">
            We've received your information. We'll be in touch soon!
          </p>

          <div className="bg-gradient-to-r p-1 rounded-xl" style={{ backgroundColor: brandColor }}>
            <div className="bg-white rounded-xl p-4">
              <p className="text-sm text-gray-500">You've earned</p>
              <p className="text-3xl font-bold" style={{ color: brandColor }}>
                +{scanReward} Coins
              </p>
            </div>
          </div>

          {formData.interests.length > 0 && (
            <div className="mt-6 text-left">
              <p className="text-sm text-gray-500 mb-2">Your interests:</p>
              <div className="flex flex-wrap gap-2">
                {formData.interests.map(id => {
                  const interest = defaultInterests.find(i => i.id === id)
                  return (
                    <span
                      key={id}
                      className="px-3 py-1 rounded-full text-sm"
                      style={{ backgroundColor: brandColor + '20', color: brandColor }}
                    >
                      {interest?.icon} {interest?.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <span className="text-sm text-gray-500">{campaignName}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          {bannerUrl && (
            <img
              src={bannerUrl}
              alt={campaignName}
              className="w-full h-40 object-cover rounded-2xl mb-6"
            />
          )}
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: brandColor }}>
            {headline}
          </h1>
          {details && (
            <p className="text-gray-600">{details}</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className={`w-full border rounded-xl px-4 py-3 ${errors.name ? 'border-red-500' : ''}`}
                placeholder="John Doe"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={`w-full border rounded-xl px-4 py-3 ${errors.email ? 'border-red-500' : ''}`}
                placeholder="john@example.com"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border rounded-xl px-4 py-3"
                placeholder="+1 234 567 8900"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company (Optional)
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
                className="w-full border rounded-xl px-4 py-3"
                placeholder="Your Company Inc."
              />
            </div>

            {/* Custom Fields */}
            {defaultCustomFields.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field}
                </label>
                <input
                  type="text"
                  value={formData.customAnswers[field] || ''}
                  onChange={e => setFormData({
                    ...formData,
                    customAnswers: { ...formData.customAnswers, [field]: e.target.value }
                  })}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>
            ))}

            {/* Interest Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What are you interested in?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {defaultInterests.map(interest => (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-3 rounded-xl border text-left transition ${
                      formData.interests.includes(interest.id)
                        ? 'border-2'
                        : 'hover:border-gray-400'
                    }`}
                    style={{
                      borderColor: formData.interests.includes(interest.id) ? brandColor : undefined,
                      backgroundColor: formData.interests.includes(interest.id) ? brandColor + '10' : undefined
                    }}
                  >
                    <span className="text-xl mr-2">{interest.icon}</span>
                    <span className="text-sm">{interest.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3 pt-2">
              <input
                type="checkbox"
                id="marketing-consent"
                className="mt-1"
              />
              <label htmlFor="marketing-consent" className="text-sm text-gray-600">
                I'd like to receive updates about products, services, and promotions
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full font-semibold text-white transition hover:scale-105 disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>

            {terms && (
              <p className="text-xs text-gray-400 text-center">
                * {terms}
              </p>
            )}
          </form>
        </div>

        {/* Rewards Preview */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Earn Coins
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{scanReward}</p>
              <p className="text-xs text-gray-500">Submit Coins</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{visitReward}</p>
              <p className="text-xs text-gray-500">Engagement</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: brandColor }}>+{purchaseReward}</p>
              <p className="text-xs text-gray-500">Referral Bonus</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
