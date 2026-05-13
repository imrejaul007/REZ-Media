'use client'

import { useState } from 'react'
import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  BookOpen,
  Users,
  BarChart3,
  QrCode,
  Shield, // AB-SEC-KYC-01: KYC icon
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/listings', label: 'Listings Review', icon: ListChecks },
  { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/stats', label: 'Platform Stats', icon: BarChart3 },
  { href: '/admin/qr-scans', label: 'QR Scans', icon: QrCode },
  { href: '/admin/kyc', label: 'KYC Review', icon: Shield }, // AB-SEC-KYC-01: KYC management
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-[#1a1a1a] border-r border-[#2a2a2a] transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-[#2a2a2a]">
          <h1 className="text-xl font-bold text-amber-500">AdBazaar</h1>
          <p className="text-xs text-gray-500 mt-0.5">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group"
                style={{
                  backgroundColor: isActive ? '#f59e0b1a' : 'transparent',
                  color: isActive ? '#f59e0b' : '#9ca3af',
                  border: isActive ? '1px solid #f59e0b33' : '1px solid transparent',
                }}
              >
                <Icon className="h-4 w-4 shrink-0 transition-colors" style={{ color: isActive ? '#f59e0b' : undefined }} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-[#2a2a2a] space-y-2">
          <div className="text-xs text-gray-600 px-2">Logged in as Admin</div>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors hover:bg-white/[0.04] text-gray-400"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header
          className="flex h-16 items-center gap-4 px-4 lg:hidden border-b border-[#2a2a2a]"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-400 hover:text-white"
            style={{ backgroundColor: '#222222' }}
          >
            <span className="sr-only">Open menu</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-bold text-amber-500">AdBazaar</span>
          <span className="text-xs text-gray-500 ml-1">Admin</span>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
