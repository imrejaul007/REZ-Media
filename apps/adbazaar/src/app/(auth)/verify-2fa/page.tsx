'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/Button'
import { UserRole } from '@/types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function Verify2FAPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Get email from query params
  const email = searchParams.get('email') || ''

  useEffect(() => {
    if (!email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization-only effect
      setError('Email is required. Please log in again.')
    }
  }, [email])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    if (!email) {
      setError('Email is required')
      return
    }

    setLoading(true)

    try {
      // Verify the 2FA code
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Invalid verification code')
        setLoading(false)
        return
      }

      // 2FA verified, now complete the login
      // Sign in with password (user already entered password in login page)
      // For 2FA flow, we need to re-authenticate with Supabase
      // Since 2FA is verified, we can set a session or redirect

      // Store 2FA verified status in sessionStorage temporarily
      sessionStorage.setItem('2fa_verified', 'true')
      sessionStorage.setItem('2fa_user_id', data.userId)

      // Redirect back to login to complete the flow
      router.push(`/login?2fa_verified=true&email=${encodeURIComponent(email)}`)

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

      <div className="text-center mb-6">
        <div
          className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-4"
          style={{ backgroundColor: '#f59e0b22', border: '1px solid #f59e0b44' }}
        >
          &#128272;
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-gray-400">
          Enter the 6-digit code from your authenticator app
        </p>
        {email && (
          <p className="text-xs text-gray-500 mt-1">
            for {email}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-1.5">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!email || code.length !== 6}
          className="w-full"
        >
          Verify
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link
          href="/login"
          className="text-amber-500 hover:text-amber-400 font-medium transition-colors"
        >
          Back to login
        </Link>
      </p>

      <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}>
        <p className="text-xs text-gray-500 text-center">
          Lost access to your authenticator app?{' '}
          <a
            href="mailto:support@adbazaar.com"
            className="text-amber-500 hover:text-amber-400"
          >
            Contact support
          </a>
        </p>
      </div>
    </>
  )
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={null}>
      <Verify2FAPageContent />
    </Suspense>
  )
}
