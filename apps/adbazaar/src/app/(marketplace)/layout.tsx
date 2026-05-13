'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LISTING_CATEGORIES } from '@/lib/constants'
import NotificationBell from '@/components/NotificationBell'

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    router.push(`/browse?${params.toString()}`)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f0f0f', color: '#ffffff' }}>
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: '#1a1a1a', borderColor: '#2a2a2a' }}
      >
        <div className="mx-auto max-w-screen-xl px-4 py-3 flex items-center gap-4">
          {/* Logo */}
          <Link href="/browse" className="flex-shrink-0 text-xl font-bold tracking-tight" style={{ color: '#f59e0b' }}>
            AdBazaar
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center">
            <div className="relative w-full max-w-xl mx-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, city, category..."
                className="w-full rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 pr-10"
                style={{
                  backgroundColor: '#0f0f0f',
                  border: '1px solid #2a2a2a',
                  color: '#ffffff',
                  // @ts-expect-error -- CSS variable for ring color
                  '--tw-ring-color': '#f59e0b',
                }}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded"
                style={{ color: '#f59e0b' }}
              >
                &#128269;
              </button>
            </div>
          </form>

          {/* Right actions */}
          <div className="flex-shrink-0 flex items-center gap-3">
            <Link
              href="/vendor/listings/new"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
            >
              List Your Space
            </Link>
            <NotificationBell />
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-white/5"
              style={{ borderColor: '#2a2a2a', color: '#ffffff' }}
            >
              Login / Dashboard
            </Link>
          </div>
        </div>

        {/* Category filter pills */}
        <div
          className="border-t overflow-x-auto"
          style={{ borderColor: '#2a2a2a' }}
        >
          <div className="mx-auto max-w-screen-xl px-4 py-2 flex items-center gap-2 min-w-max">
            <CategoryPill href="/browse" label="All" />
            {Object.entries(LISTING_CATEGORIES).map(([key, { label }]) => (
              <CategoryPill key={key} href={`/browse?category=${key}`} label={label} />
            ))}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main>{children}</main>
    </div>
  )
}

function CategoryPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:border-amber-500 hover:text-amber-400 whitespace-nowrap"
      style={{ borderColor: '#2a2a2a', color: '#a3a3a3' }}
    >
      {label}
    </Link>
  )
}
