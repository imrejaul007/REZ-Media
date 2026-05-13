'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import StepBasicInfo from './StepBasicInfo'
import StepMedia from './StepMedia'
import StepPricing from './StepPricing'
import StepAdvanced from './StepAdvanced'
import { track } from '@/services/intentCaptureService'

const STEPS = ['Basic Info', 'Media & Location', 'Pricing', 'Advanced']

type FormErrors = Record<string, string>

interface FormData {
  // Step 1
  category: string
  subcategory: string
  title: string
  description: string
  city: string
  area: string
  // Step 2
  images: string[]
  address: string
  lat: string
  lng: string
  // Step 3
  pricing_model: string
  price: string
  duration_unit: string
  availability_model: string
  min_booking_days: string
  bulk_discount_pct: string
  qr_enabled: boolean
  // Step 4
  non_competitor_exclusions: string[]
  specs: Record<string, string>
}

const initialData: FormData = {
  category: '',
  subcategory: '',
  title: '',
  description: '',
  city: '',
  area: '',
  images: [],
  address: '',
  lat: '',
  lng: '',
  pricing_model: 'fixed',
  price: '',
  duration_unit: 'per_month',
  availability_model: 'calendar',
  min_booking_days: '1',
  bulk_discount_pct: '',
  qr_enabled: true,
  non_competitor_exclusions: [],
  specs: {},
}

function validateStep(step: number, data: FormData): FormErrors {
  const errors: FormErrors = {}
  if (step === 0) {
    if (!data.category) errors.category = 'Please select a category'
    if (!data.subcategory) errors.subcategory = 'Please select a subcategory'
    if (!data.title.trim()) errors.title = 'Title is required'
    if (!data.city.trim()) errors.city = 'City is required'
  }
  if (step === 2) {
    if (!data.pricing_model) errors.pricing_model = 'Select a pricing model'
    if ((data.pricing_model === 'fixed' || data.pricing_model === 'both') && !data.price) {
      errors.price = 'Price is required for fixed pricing'
    }
    if (!data.availability_model) errors.availability_model = 'Select an availability model'
  }
  return errors
}

// Derive type_tag from category
function getTypeTag(category: string): string {
  if (category === 'influencer') return 'influencer'
  if (category === 'unconventional') return 'unconventional'
  if (category === 'digital') return 'online'
  return 'offline'
}

export default function NewListingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<FormData>(initialData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login?next=/vendor/listings/new')
        return
      }
      if (session.access_token) setAccessToken(session.access_token)
      if (session.user) setUserId(session.user.id)
    })
  }, [router])

  function onChange(field: string, value: unknown) {
    setData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleNext() {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }
    setErrors({})
    setStep((s) => s + 1)
  }

  function handleBack() {
    setErrors({})
    setStep((s) => s - 1)
  }

  async function handleSubmit() {
    const stepErrors = validateStep(step, data)
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      return
    }

    setSubmitting(true)
    setSubmitError('')

    const payload = {
      category: data.category,
      subcategory: data.subcategory,
      type_tag: getTypeTag(data.category),
      title: data.title.trim(),
      description: data.description.trim() || null,
      city: data.city.trim(),
      area: data.area.trim() || null,
      address: data.address.trim() || null,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      images: data.images.filter(Boolean),
      pricing_model: data.pricing_model,
      price: data.price ? parseFloat(data.price) : null,
      currency: 'INR',
      duration_unit: data.duration_unit || null,
      availability_model: data.availability_model,
      min_booking_days: parseInt(data.min_booking_days) || 1,
      bulk_discount_pct: data.bulk_discount_pct ? parseFloat(data.bulk_discount_pct) : 0,
      qr_enabled: data.qr_enabled,
      non_competitor_exclusions: data.non_competitor_exclusions,
      specs: data.specs,
    }

    try {
      const postHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) postHeaders['Authorization'] = `Bearer ${accessToken}`
      const res = await fetch('/api/vendor/listings', {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setSubmitError(err.error ?? 'Failed to create listing')
        setSubmitting(false)
        return
      }

      // ReZ Mind intent capture — campaign created (listing published)
      const json = await res.json()
      track({
        userId,
        event: 'campaign_created',
        appType: 'AdBazaar',
        intentKey: `listing:${json.listing?.id ?? ''}`,
        properties: {
          category: data.category,
          subcategory: data.subcategory,
          city: data.city,
          pricingModel: data.pricing_model,
        },
      })

      router.push('/vendor/listings?created=1')
    } catch {
      setSubmitError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Create New Listing</h1>
        <p className="text-sm text-gray-400">Fill in the details to publish your ad space</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-1" style={{ width: '22%' }}>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: i < step ? '#f59e0b' : i === step ? '#f59e0b1a' : '#1a1a1a',
                  border: `2px solid ${i <= step ? '#f59e0b' : '#2a2a2a'}`,
                  color: i <= step ? '#f59e0b' : '#6b7280',
                }}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className="hidden sm:block text-center text-xs leading-tight"
                style={{ color: i === step ? '#f59e0b' : '#6b7280' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1 rounded-full" style={{ backgroundColor: '#2a2a2a' }}>
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: '#f59e0b', width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        <h2 className="text-base font-semibold text-white mb-6">
          Step {step + 1}: {STEPS[step]}
        </h2>

        {step === 0 && (
          <StepBasicInfo
            data={{ category: data.category, subcategory: data.subcategory, title: data.title, description: data.description, city: data.city, area: data.area }}
            onChange={onChange}
            errors={errors}
          />
        )}
        {step === 1 && (
          <StepMedia
            data={{ images: data.images, address: data.address, lat: data.lat, lng: data.lng }}
            onChange={onChange}
            errors={errors}
            accessToken={accessToken}
          />
        )}
        {step === 2 && (
          <StepPricing
            data={{ pricing_model: data.pricing_model, price: data.price, duration_unit: data.duration_unit, availability_model: data.availability_model, min_booking_days: data.min_booking_days, bulk_discount_pct: data.bulk_discount_pct, qr_enabled: data.qr_enabled }}
            onChange={onChange}
            errors={errors}
          />
        )}
        {step === 3 && (
          <StepAdvanced
            category={data.category}
            data={{ non_competitor_exclusions: data.non_competitor_exclusions, specs: data.specs }}
            onChange={onChange}
            errors={errors}
          />
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <div
          className="mb-4 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#7f1d1d22', border: '1px solid #7f1d1d', color: '#f87171' }}
        >
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-30"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#d1d5db' }}
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
          >
            {submitting ? 'Creating…' : 'Create Listing'}
          </button>
        )}
      </div>
    </div>
  )
}
