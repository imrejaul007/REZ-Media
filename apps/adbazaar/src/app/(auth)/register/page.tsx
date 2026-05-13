'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies
import { Button } from '@/components/ui/Button'
import { UserRole } from '@/types'

// SECURITY: Now uses @supabase/ssr with HttpOnly cookies instead of localStorage
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune']

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [city, setCity] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!role) {
      setError('Please select your account type.')
      return
    }
    if (!termsAccepted) {
      setError('You must accept the terms and conditions.')
      return
    }

    setLoading(true)

    try {
      // AB-M3 FIX: Store profile data in auth metadata instead of inserting immediately.
      // The actual user profile will be created in /api/auth/callback after email verification.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const { data, error: signUpError } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          // Store profile data in auth metadata - retrieved by callback after email confirmation
          data: {
            name,
            role,
            phone: phone || null,
            company_name: companyName || null,
            city: city || null,
          },
          // Redirect to our callback URL after email confirmation
          emailRedirectTo: `${appUrl}/api/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (!data.user) {
        setError('Registration failed. Please try again.')
        return
      }

      // AB-M3 FIX: Do NOT insert user into users table here.
      // User profile is created in /api/auth/callback after email verification.
      // This prevents unverified users from existing in the system.

      if (data.session) {
        // Confirmed immediately — redirect to dashboard
        if (role === UserRole.Vendor) {
          router.push('/vendor/dashboard')
        } else if (role === UserRole.Buyer) {
          router.push('/buyer/dashboard')
        } else {
          router.push('/')
        }
      } else {
        // Email confirmation required
        setConfirming(true)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-500 tracking-tight">AdBazaar</h1>
          <p className="text-gray-400 text-sm mt-1">India&apos;s Ad Space Marketplace</p>
        </div>
        <div className="rounded-xl p-6 text-center space-y-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: '#f59e0b22', border: '1px solid #f59e0b44' }}
          >
            ✉
          </div>
          <h2 className="text-lg font-semibold text-white">Check your email</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            We sent a confirmation link to <span className="text-amber-400 font-medium">{email}</span>.
            Please confirm your account before logging in.
          </p>
          <p className="text-xs text-gray-600">Check your spam folder if you don&apos;t see it.</p>
        </div>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already confirmed?{' '}
          <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium transition-colors">
            Login
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-amber-500 tracking-tight">AdBazaar</h1>
        <p className="text-gray-400 text-sm mt-1">India&apos;s Ad Space Marketplace</p>
      </div>

      <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Role selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">I want to...</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole(UserRole.Vendor)}
              className={`p-4 rounded-xl border text-left transition-all ${
                role === UserRole.Vendor
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-[#2a2a2a] bg-[#0f0f0f] text-gray-400 hover:border-[#3a3a3a]'
              }`}
            >
              <div className="text-lg mb-1">🏪</div>
              <div className="font-medium text-sm">List Ad Space</div>
              <div className="text-xs text-gray-500 mt-0.5">Vendor</div>
            </button>
            <button
              type="button"
              onClick={() => setRole(UserRole.Buyer)}
              className={`p-4 rounded-xl border text-left transition-all ${
                role === UserRole.Buyer
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-[#2a2a2a] bg-[#0f0f0f] text-gray-400 hover:border-[#3a3a3a]'
              }`}
            >
              <div className="text-lg mb-1">📢</div>
              <div className="font-medium text-sm">Buy Ad Space</div>
              <div className="text-xs text-gray-500 mt-0.5">Buyer</div>
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1.5">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1.5">
            Phone <span className="text-gray-600">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Company Name */}
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-1.5">
            Company Name <span className="text-gray-600">(optional)</span>
          </label>
          <input
            id="company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company or brand"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* City */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-1.5">
            City
          </label>
          <select
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors appearance-none"
          >
            <option value="" className="text-gray-600">Select your city</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Terms */}
        <div className="flex items-start gap-3">
          <input
            id="terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#2a2a2a] bg-[#0f0f0f] accent-amber-500"
          />
          <label htmlFor="terms" className="text-sm text-gray-400">
            I agree to the{' '}
            <Link href="/terms" className="text-amber-500 hover:text-amber-400">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-amber-500 hover:text-amber-400">
              Privacy Policy
            </Link>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
        >
          Login
        </Link>
      </p>
    </>
  )
}
