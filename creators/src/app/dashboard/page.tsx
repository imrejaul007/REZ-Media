'use client'

import { useState } from 'react'

type Tab = 'overview' | 'requests' | 'disputes'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Creator Dashboard</h1>
          <button className="bg-amber-500 text-black px-6 py-2 rounded-lg font-bold">+ New Listing</button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Completion Rate</p>
            <p className="text-2xl font-bold text-green-400">94%</p>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Response Time</p>
            <p className="text-2xl font-bold">2.5h</p>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Rating</p>
            <p className="text-2xl font-bold text-amber-500">4.8</p>
          </div>
          <div className="bg-gray-900 p-4 rounded-xl">
            <p className="text-sm text-gray-400">Earnings</p>
            <p className="text-2xl font-bold text-amber-500">1.25L</p>
          </div>
        </div>

        <div className="flex gap-6 border-b border-gray-800 mb-6">
          <button onClick={() => setTab('overview')} className={`pb-3 ${tab === 'overview' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-500'}`}>
            Overview
          </button>
          <button onClick={() => setTab('requests')} className={`pb-3 ${tab === 'requests' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-500'}`}>
            Requests
          </button>
          <button onClick={() => setTab('disputes')} className={`pb-3 ${tab === 'disputes' ? 'border-b-2 border-amber-500 text-amber-500' : 'text-gray-500'}`}>
            Disputes
          </button>
        </div>

        <p className="text-gray-400">Creator Dashboard content</p>
      </div>
    </div>
  )
}
