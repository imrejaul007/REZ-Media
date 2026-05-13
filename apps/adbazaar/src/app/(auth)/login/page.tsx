'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (!data.user) {
        setError('Login failed. Please try again.')
        return
      }

      // AB-SEC-EMAIL-01: Check email verification status
      if (!data.user.email_confirmed_at) {
        setError('Please verify your email before logging in. Check your inbox for the confirmation link.')
        await getSupabase().auth.signOut()
        setLoading(false)
        return
      }

      // Fetch user profile for role, verification status, and 2FA
      const { data: userData, error: userError } = await getSupabase()
        .from('users')
        .select('role, verified, totp_enabled, kyc_status')
        .eq('id', data.user.id)
        .single()

      if (userError || !userData) {
        setError('Could not retrieve user profile.')
        return
      }

      // AB-SEC-EMAIL-01: Check if user's email is marked as verified in users table
      if (!userData.verified) {
        setError('Please verify your email before logging in. Check your inbox for the confirmation link.')
        await getSupabase().auth.signOut()
        setLoading(false)
        return
      }

      // AB-SEC-2FA-02: If 2FA is enabled, redirect to 2FA verification page
      if (userData.totp_enabled) {
        router.push(`/verify-2fa?email=${encodeURIComponent(email)}`)
        return
      }

      // Check for ?next= or ?redirect= param and use it if present
      const nextUrl = searchParams.get('next') || searchParams.get('redirect')
      if (nextUrl && nextUrl.startsWith('/')) {
        router.push(nextUrl)
        return
      }

      // AB-SEC-KYC-01: Check KYC status for vendors
      if (userData.role === UserRole.Vendor) {
        if (userData.kyc_status === 'rejected') {
          setError('Your KYC has been rejected. Please resubmit your documents.')
          setLoading(false)
          return
        }
        if (!userData.kyc_status || userData.kyc_status === 'pending') {
          // Allow login but redirect to KYC submission
          router.push('/vendor/profile?kyc_required=true')
          return
        }
        router.push('/vendor/dashboard')
      } else if (userData.role === UserRole.Buyer) {
        router.push('/buyer/dashboard')
      } else if (userData.role === UserRole.Admin) {
        router.push('/admin/dashboard')
      } else {
        router.push('/')
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-amber-500 tracking-tight">AdBazaar</h1>
        <p className="text-gray-400 text-sm mt-1">India&apos;s Ad Space Marketplace</p>
      </div>

      <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
          />
        </div>

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-amber-500 hover:text-amber-400 transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full mt-2"
        >
          Login
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
        >
          Register
        </Link>
      </p>

      {/* AB-SEC-EMAIL-01: Resend confirmation email link */}
      <p className="mt-4 text-center text-xs text-gray-600">
        Didn&apos;t receive confirmation email?{' '}
        <ResendConfirmationLink email={email} />
      </p>
    </>
  )
}

// AB-SEC-EMAIL-01: Resend confirmation email component
function ResendConfirmationLink({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const handleResend = async () => {
    if (!email) {
      alert('Please enter your email address first')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStatus('sent')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return <span className="text-green-500">Email sent!</span>
  }

  if (status === 'error') {
    return (
      <button
        onClick={() => setStatus('idle')}
        className="text-red-500 hover:text-red-400"
      >
        Failed to send. Click to retry.
      </button>
    )
  }

  return (
    <button
      onClick={handleResend}
      disabled={status === 'sending'}
      className="text-amber-500 hover:text-amber-400 disabled:opacity-50"
    >
      {status === 'sending' ? 'Sending...' : 'Resend confirmation'}
    </button>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
