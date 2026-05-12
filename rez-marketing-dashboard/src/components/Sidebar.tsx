'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Megaphone,
  Radio,
  Users,
  Zap,
  BarChart3,
  Settings,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'AI Campaigns', href: '/campaigns/ai', icon: Sparkles, highlight: true },
  { name: 'Broadcasts', href: '/broadcasts', icon: Radio },
  { name: 'Audiences', href: '/audiences', icon: Users },
  { name: 'Automation', href: '/automation', icon: Zap },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]

const bottomNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="font-semibold text-gray-900">REZ Marketing</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className={clsx('h-5 w-5', isActive ? 'text-purple-600' : 'text-gray-400')} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-3 border-t border-gray-200 space-y-1">
        {bottomNav.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="h-5 w-5 text-gray-400" />
              {item.name}
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
