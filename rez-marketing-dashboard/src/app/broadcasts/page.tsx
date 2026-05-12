'use client'

import { useState } from 'react'
import {
  Plus,
  Search,
  MessageSquare,
  Mail,
  Bell,
  Smartphone,
  Send,
  Clock,
  Users,
  BarChart3,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

const broadcasts = [
  {
    id: '1',
    name: 'Summer Sale Announcement',
    channel: 'WhatsApp',
    status: 'sent',
    sent: 2340,
    delivered: 2298,
    opened: 1872,
    clicked: 456,
    createdAt: '2024-06-15 10:30',
  },
  {
    id: '2',
    name: 'New Arrivals Alert',
    channel: 'Email',
    status: 'sent',
    sent: 1890,
    delivered: 1856,
    opened: 1245,
    clicked: 234,
    createdAt: '2024-06-14 09:00',
  },
  {
    id: '3',
    name: 'Flash Sale - 24 Hours Only',
    channel: 'SMS',
    status: 'scheduled',
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    scheduledFor: '2024-06-20 12:00',
  },
  {
    id: '4',
    name: 'App Update Reminder',
    channel: 'Push',
    status: 'sent',
    sent: 4500,
    delivered: 4320,
    opened: 1890,
    clicked: 567,
    createdAt: '2024-06-13 14:00',
  },
]

const channels = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', textColor: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'sms', name: 'SMS', icon: Bell, color: 'bg-blue-500', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'email', name: 'Email', icon: Mail, color: 'bg-purple-500', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'push', name: 'Push', icon: Smartphone, color: 'bg-orange-500', textColor: 'text-orange-600', bgColor: 'bg-orange-50' },
]

export default function BroadcastsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')

  const filteredBroadcasts = broadcasts.filter((b) => {
    if (activeTab !== 'all' && b.channel.toLowerCase() !== activeTab) return false
    if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-sm text-gray-500">Send messages to your audience</p>
        </div>
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {channels.map((channel) => (
          <Link
            key={channel.id}
            href={`/broadcasts/new?channel=${channel.id}`}
            className={`${channel.bgColor} rounded-xl p-5 border border-transparent hover:border-${channel.color.split('-')[1]}-200 transition-all group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${channel.color} p-3 rounded-xl`}>
                <channel.icon className="h-6 w-6 text-white" />
              </div>
              <ChevronRight className={`h-5 w-5 ${channel.textColor} group-hover:translate-x-1 transition-transform`} />
            </div>
            <h3 className="font-semibold text-gray-900">New {channel.name}</h3>
            <p className="text-sm text-gray-500 mt-1">Create {channel.name.toLowerCase()} broadcast</p>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search broadcasts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'all' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => setActiveTab(channel.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === channel.id ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <channel.icon className="h-4 w-4" />
              {channel.name}
            </button>
          ))}
        </div>
      </div>

      {/* Broadcast List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Broadcast</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Channel</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Delivered</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Opened</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Clicked</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredBroadcasts.map((broadcast) => {
              const channel = channels.find((c) => c.id === broadcast.channel.toLowerCase())
              return (
                <tr key={broadcast.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{broadcast.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {broadcast.status === 'scheduled' ? broadcast.scheduledFor : broadcast.createdAt}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`${channel?.color} p-1.5 rounded-lg`}>
                        <channel?.icon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm text-gray-700">{broadcast.channel}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      broadcast.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      broadcast.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {broadcast.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-gray-900">{broadcast.sent > 0 ? broadcast.sent.toLocaleString() : '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-gray-900">
                      {broadcast.delivered > 0 ? `${broadcast.delivered.toLocaleString()}` : '-'}
                      {broadcast.delivered > 0 && broadcast.sent > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({(broadcast.delivered / broadcast.sent * 100).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-gray-900">
                      {broadcast.opened > 0 ? broadcast.opened.toLocaleString() : '-'}
                      {broadcast.opened > 0 && broadcast.delivered > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({(broadcast.opened / broadcast.delivered * 100).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="font-medium text-gray-900">
                      {broadcast.clicked > 0 ? broadcast.clicked.toLocaleString() : '-'}
                      {broadcast.clicked > 0 && broadcast.opened > 0 && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({(broadcast.clicked / broadcast.opened * 100).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {broadcast.status === 'scheduled' && (
                        <button className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                          Send Now
                        </button>
                      )}
                      <Link
                        href={`/analytics?broadcast=${broadcast.id}`}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
