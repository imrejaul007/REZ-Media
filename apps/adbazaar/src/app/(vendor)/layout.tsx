'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/NotificationBell'

const navLinks = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/vendor/listings', label: 'My Listings', icon: '≡' },
  { href: '/vendor/listings/new', label: 'New Listing', icon: '+' },
  { href: '/vendor/bookings', label: 'Bookings', icon: '📋' },
  { href: '/vendor/inquiries', label: 'Inquiries', icon: '💬' },
  { href: '/vendor/qr-campaigns', label: 'QR Campaigns', icon: '◫' },
  { href: '/vendor/dooh-screens', label: 'DOOH Screens', icon: '🖥' },
  { href: '/vendor/inapp-ads', label: 'In-App Ads', icon: '📱' },
  { href: '/vendor/earnings', label: 'Earnings', icon: '₹' },
  { href: '/vendor/analytics', label: 'Analytics', icon: '📊' },
  { href: '/vendor/attribution', label: 'Attribution', icon: '◎' },
  { href: '/vendor/rez-connect', label: 'REZ Connect', icon: '🔗' },
  { href: '/vendor/profile', label: 'Profile', icon: '⚙' },
]

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0f0f0f' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#111111', borderRight: '1px solid #2a2a2a' }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-6" style={{ borderBottom: '1px solid #2a2a2a' }}>
          <span className="text-xl font-bold" style={{ color: '#f59e0b' }}>
            AdBazaar
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? '#f59e0b1a' : 'transparent',
                  color: isActive ? '#f59e0b' : '#9ca3af',
                  border: isActive ? '1px solid #f59e0b33' : '1px solid transparent',
                }}
              >
                <span className="text-base">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid #2a2a2a' }}>
          <Link
            href="/vendor/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: '#f59e0b', color: '#0f0f0f' }}
            >
              V
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">Vendor Account</p>
              <span
                className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}
              >
                Vendor
              </span>
            </div>
            <span className="text-xs" style={{ color: '#4b5563' }}>⚙</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors hover:bg-white/[0.04]"
            style={{ color: '#9ca3af' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header
          className="flex h-16 items-center gap-4 px-4 lg:hidden"
          style={{ backgroundColor: '#111111', borderBottom: '1px solid #2a2a2a' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-400 hover:text-white"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <span className="sr-only">Open menu</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="flex-1 text-lg font-bold" style={{ color: '#f59e0b' }}>AdBazaar</span>
          <NotificationBell />
        </header>

        {/* Desktop topbar with notification bell */}
        <div
          className="hidden lg:flex h-16 items-center justify-end px-6"
          style={{ borderBottom: '1px solid #2a2a2a' }}
        >
          <NotificationBell />
        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
