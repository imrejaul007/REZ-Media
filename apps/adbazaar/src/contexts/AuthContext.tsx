'use client'

/**
 * Authentication Context Provider
 *
 * Provides centralized authentication state management for the application.
 * Uses @supabase/ssr with HttpOnly cookies for secure token storage.
 *
 * SECURITY: Tokens are stored in HttpOnly cookies, preventing XSS theft.
 *
 * Usage:
 *   import { AuthProvider, useAuth } from '@/contexts/AuthContext'
 *
 *   // In your layout:
 *   <AuthProvider>{children}</AuthProvider>
 *
 *   // In any component:
 *   const { user, loading, signIn, signOut } = useAuth()
 */

import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  refreshSession: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Initialize auth state
  useEffect(() => {
    // Get initial session from cookies
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('[AuthContext] Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error as Error | null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string, metadata?: Record<string, unknown>) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
      })
      return { error: error as Error | null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const signOut = useCallback(async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      return { error: error as Error | null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const resetPassword = useCallback(async (email: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return { error: error as Error | null }
    } catch (error) {
      return { error: error as Error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const refreshSession = useCallback(async () => {
    try {
      const { error } = await supabase.auth.refreshSession()
      return { error: error as Error | null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [supabase])

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to access authentication context
 *
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading, signOut } = useAuth()
 *
 *   if (loading) return <Spinner />
 *   if (!user) return <LoginPrompt />
 *
 *   return <div>Welcome, {user.email}!</div>
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

/**
 * Hook to get just the current user
 *
 * @example
 * ```tsx
 * const user = useUser()
 * ```
 */
export function useUser() {
  const { user } = useAuth()
  return user
}

/**
 * Hook to check if user is authenticated
 *
 * @example
 * ```tsx
 * const isAuthenticated = useIsAuthenticated()
 * if (!isAuthenticated) router.push('/login')
 * ```
 */
export function useIsAuthenticated() {
  const { user } = useAuth()
  return !!user
}
