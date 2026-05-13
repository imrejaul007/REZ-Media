'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser' // MIGRATED: Uses HttpOnly cookies
import { Button } from '@/components/ui/Button'

// SECURITY: Now uses @supabase/ssr with HttpOnly cookies instead of localStorage
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient()
  }
  return _supabase
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSent(true)
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

      {sent ? (
        <div className="space-y-4">
          <div
            className="rounded-xl p-6 text-center space-y-4"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#f59e0b22', border: '1px solid #f59e0b44' }}
            >
              ✉
            </div>
            <h2 className="text-lg font-semibold text-white">Check your email</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              We sent a password reset link to{' '}
              <span className="text-amber-400 font-medium">{email}</span>.
            </p>
            <p className="text-xs text-gray-600">Check your spam folder if you don&apos;t see it.</p>
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium transition-colors">
              Back to login
            </Link>
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white mb-2">Reset your password</h2>
          <p className="text-sm text-gray-400 mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Send reset link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/login" className="text-amber-500 hover:text-amber-400 font-medium transition-colors">
              Back to login
            </Link>
          </p>
        </>
      )}
    </>
  )
}
