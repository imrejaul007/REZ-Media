'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Owner navigation - unified dashboard for all inventory types
const ownerNavLinks = [
  { href: '/owner', label: 'Dashboard', icon: '⊞' },
  { href: '/owner/inventory', label: 'Inventory', icon: '≡' },
  { href: '/owner/listings', label: 'Listings', icon: '📋' },
  { href: '/owner/qr-campaigns', label: 'QR Campaigns', icon: '◫' },
  { href: '/owner/dooh-screens', label: 'DOOH Screens', icon: '🖥' },
  { href: '/owner/inapp-ads', label: 'In-App Ads', icon: '📱' },
  { href: '/owner/earnings', label: 'Earnings', icon: '₹' },
  { href: '/owner/analytics', label: 'Analytics', icon: '📊' },
  { href: '/owner/settings', label: 'Settings', icon: '⚙' },
]

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0a0a0f' }}>
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
        style={{ backgroundColor: '#0d0d14', borderRight: '1px solid #1a1a2e' }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-6" style={{ borderBottom: '1px solid #1a1a2e' }}>
          <Link href="/owner" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">ReZ</span>
            </div>
            <span className="text-white font-bold text-lg">Owner</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {ownerNavLinks.map(link => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
                style={{
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                }}
              >
                <span className="text-lg">{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-4" style={{ borderTop: '1px solid #1a1a2e' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white font-medium text-sm">YO</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">Your Organization</p>
              <p className="text-gray-400 text-xs truncate">owner@example.com</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between px-6" style={{ borderBottom: '1px solid #1a1a2e' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search inventory..."
                className="w-64 pl-10 pr-4 py-2 rounded-lg text-sm text-white bg-white/5 border border-white/10 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
