'use client'

import { useState } from 'react'
import { WhatsApp, MessageCircle, Send, Settings, BarChart3 } from 'lucide-react'

export default function WhatsAppManager() {
  const [activeTab, setActiveTab] = useState('numbers')

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111B21] text-white p-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
            <WhatsApp className="w-6 h-6" />
          </div>
          <span className="font-bold">WhatsApp Manager</span>
        </div>
        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab('numbers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'numbers' ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold">+</div>
            <span>My Numbers</span>
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'messages' ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>Message Templates</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${activeTab === 'analytics' ? 'bg-white/10' : 'hover:bg-white/5'}`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Analytics</span>
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">WhatsApp Business Manager</h1>
        <div className="bg-white rounded-xl p-6">
          <h2 className="font-semibold mb-4">Your WhatsApp Numbers</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">+91 98765 43210</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Active</span>
              </div>
              <p className="text-sm text-gray-500">Hotel Booking Support</p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Sessions: <span className="text-gray-900">1,234</span></p>
              </div>
            </div>
            <div className="border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">+91 87654 32109</span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">Pending</span>
              </div>
              <p className="text-sm text-gray-500">Restaurant Orders</p>
            </div>
            <div className="border rounded-xl p-4 border-dashed flex items-center justify-center cursor-pointer hover:border-green-500">
              <div className="text-center">
                <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl text-white">+</span>
                </div>
                <p className="text-sm text-gray-500">Add Number</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
