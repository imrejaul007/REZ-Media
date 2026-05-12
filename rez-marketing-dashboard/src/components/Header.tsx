'use client'

import { Bell, Search, Plus, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export function Header() {
  const [showCreateMenu, setShowCreateMenu] = useState(false)

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns, audiences, templates..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Create Button */}
        <div className="relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create
            <ChevronDown className="h-4 w-4" />
          </button>

          {showCreateMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <a href="/campaigns/new" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Ad Campaign
              </a>
              <a href="/broadcasts/new?channel=whatsapp" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                WhatsApp Broadcast
              </a>
              <a href="/broadcasts/new?channel=sms" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                SMS Broadcast
              </a>
              <a href="/broadcasts/new?channel=email" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Email Campaign
              </a>
              <a href="/broadcasts/new?channel=push" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Push Notification
              </a>
              <div className="border-t border-gray-100 my-1" />
              <a href="/audiences/new" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                New Audience Segment
              </a>
            </div>
          )}
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Profile */}
        <button className="flex items-center gap-2 pl-3 pr-2 py-1.5 hover:bg-gray-100 rounded-lg">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-purple-600 font-medium text-sm">M</span>
          </div>
        </button>
      </div>
    </header>
  )
}
