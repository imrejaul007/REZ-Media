'use client'

import { useState } from 'react'
import { WhatsApp, MessageSquare, ShoppingCart, Package, TrendingUp, Settings } from 'lucide-react'

interface Order {
  id: string
  customer: string
  items: number
  total: number
  status: 'pending' | 'processing' | 'delivered'
  time: string
}

const orders: Order[] = [
  { id: '1', customer: 'Rahul S.', items: 3, total: 450, status: 'pending', time: '2 min ago' },
  { id: '2', customer: 'Priya M.', items: 1, total: 199, status: 'processing', time: '5 min ago' },
  { id: '3', customer: 'Amit K.', items: 5, total: 890, status: 'delivered', time: '10 min ago' },
]

export default function WhatsAppStoreDashboard() {
  const [activeTab, setActiveTab] = useState('orders')

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WhatsApp className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp Store</h1>
              <p className="text-sm text-green-100">Manage orders & catalog</p>
            </div>
          </div>
          <button className="p-2 bg-green-700 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-green-700 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">12</p>
            <p className="text-xs text-green-100">Pending</p>
          </div>
          <div className="bg-green-700 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">₹8,450</p>
            <p className="text-xs text-green-100">Today's Sales</p>
          </div>
          <div className="bg-green-700 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">45</p>
            <p className="text-xs text-green-100">Messages</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b">
        {['orders', 'catalog', 'messages'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="p-4">
        {activeTab === 'orders' && (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{order.customer}</p>
                    <p className="text-sm text-gray-500">{order.items} items • ₹{order.total}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[order.status]}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium">
                    Accept
                  </button>
                  <button className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Your Products</h3>
                <button className="text-sm text-green-600 font-medium">+ Add Product</button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Customer {i}</p>
                  <p className="text-sm text-gray-500">Thanks for your order!</p>
                </div>
                <p className="text-xs text-gray-400">2m ago</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
