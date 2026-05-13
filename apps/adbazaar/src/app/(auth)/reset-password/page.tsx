'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    // Parse the access_token and type from the URL hash
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const type = params.get('type')
    const accessToken = params.get('access_token')

    if (type === 'recovery' && accessToken) {
      // Set the session using the recovery token
      getSupabase().auth.setSession({
        access_token: accessToken,
        refresh_token: params.get('refresh_token') ?? '',
      }).then(({ error }) => {
        if (error) {
          setInvalidLink(true)
        } else {
          setReady(true)
        }
      })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialization-only effect
      setInvalidLink(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password: newPassword })

      if (updateError) {
        setError(updateError.message)
        return
      }

      router.push('/login')
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

      {invalidLink ? (
        <div className="space-y-4">
          <div
            className="rounded-xl p-6 text-center space-y-3"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <div
              className="mx-auto w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#ef444411', border: '1px solid #ef444433' }}
            >
              ✕
            </div>
            <h2 className="text-lg font-semibold text-white">Invalid or expired link</h2>
            <p className="text-sm text-gray-400">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
          <p className="text-center text-sm text-gray-500">
            <Link href="/forgot-password" className="text-amber-500 hover:text-amber-400 font-medium transition-colors">
              Request a new link
            </Link>
          </p>
        </div>
      ) : !ready ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-white mb-2">Set new password</h2>
          <p className="text-sm text-gray-400 mb-6">
            Choose a strong password for your account.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
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
              Set new password
            </Button>
          </form>
        </>
      )}
    </>
  )
}
