'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Users,
  Activity,
  PieChart,
  Settings,
  Tag,
  FileText,
  UserPlus,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  stats?: {
    totalContacts: number
    hotLeads: number
    warmLeads: number
    coldLeads: number
  }
}

const navItems = [
  { name: 'All Contacts', href: '/', icon: Users },
  { name: 'Activities', href: '/activities', icon: Activity },
  { name: 'Segments', href: '/segments', icon: PieChart },
]

const statusGroups = [
  { name: 'Hot Leads', key: 'hot', icon: Zap, color: 'text-red-500', count: 2 },
  { name: 'Warm Leads', key: 'warm', icon: Users, color: 'text-yellow-500', count: 2 },
  { name: 'Cold Leads', key: 'cold', icon: Users, color: 'text-blue-500', count: 1 },
  { name: 'Active', key: 'active', icon: Users, color: 'text-green-500', count: 1 },
]

const commonTags = ['hotel', 'restaurant', 'retail', 'fitness', 'premium', 'enterprise']

export default function Sidebar({ stats }: SidebarProps) {
  const pathname = usePathname()
  const [showTags, setShowTags] = useState(true)

  return (
    <aside className="w-64 bg-white border-r flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          ReZ CRM
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Customer Relationship Management</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          )
        })}

        {/* Quick Add */}
        <Link
          href="/contacts/new"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors mt-4"
        >
          <UserPlus className="w-4 h-4" />
          Add Contact
        </Link>

        {/* Status Groups */}
        <div className="pt-4 pb-2">
          <button
            onClick={() => setShowTags(!showTags)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            <span>Status</span>
            {showTags ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {statusGroups.map((group) => {
          const Icon = group.icon
          return (
            <Link
              key={group.key}
              href={`/?status=${group.key}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === '/' && typeof window !== 'undefined' && window.location.search.includes(`status=${group.key}`)
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50'
              } text-gray-600`}
            >
              <Icon className={`w-4 h-4 ${group.color}`} />
              <span className="flex-1">{group.name}</span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {stats?.[`${group.key}Leads` as keyof typeof stats] ?? group.count}
              </span>
            </Link>
          )
        })}

        {/* Tags Section */}
        <div className="pt-4 pb-2">
          <button
            onClick={() => setShowTags(!showTags)}
            className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
          >
            <span>Tags</span>
            {showTags ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {showTags && (
          <div className="space-y-1">
            {commonTags.map((tag) => (
              <Link
                key={tag}
                href={`/?tag=${tag}`}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                <Tag className="w-3 h-3 text-gray-400" />
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Reports Section */}
        <div className="pt-6">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Reports
          </div>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            <FileText className="w-4 h-4" />
            Export Data
          </Link>
        </div>
      </nav>

      {/* Settings */}
      <div className="p-3 border-t">
        <Link
          href="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
