'use client'

import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Mail,
  Bell,
  Smartphone,
  Users,
  Eye,
  MousePointer,
  ShoppingCart,
  Calendar,
} from 'lucide-react'

const stats = [
  { label: 'Total Reach', value: '45,234', change: 12, icon: Users },
  { label: 'Impressions', value: '156,789', change: 8, icon: Eye },
  { label: 'Clicks', value: '8,456', change: 15, icon: MousePointer },
  { label: 'Conversions', value: '1,234', change: -3, icon: ShoppingCart },
]

const channelStats = [
  { channel: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', sent: 23400, delivered: 22800, opened: 18500, clicked: 4500, conversion: 234 },
  { channel: 'Email', icon: Mail, color: 'bg-purple-500', sent: 12300, delivered: 11900, opened: 8900, clicked: 2100, conversion: 89 },
  { channel: 'SMS', icon: Bell, color: 'bg-blue-500', sent: 8900, delivered: 8700, opened: 0, clicked: 1200, conversion: 156 },
  { channel: 'Push', icon: Smartphone, color: 'bg-orange-500', sent: 15600, delivered: 14200, opened: 7800, clicked: 2340, conversion: 67 },
]

const weeklyData = [
  { day: 'Mon', reach: 1200, clicks: 340, conversions: 45 },
  { day: 'Tue', reach: 1450, clicks: 420, conversions: 56 },
  { day: 'Wed', reach: 1100, clicks: 310, conversions: 38 },
  { day: 'Thu', reach: 1680, clicks: 490, conversions: 67 },
  { day: 'Fri', reach: 1890, clicks: 560, conversions: 78 },
  { day: 'Sat', reach: 2100, clicks: 620, conversions: 89 },
  { day: 'Sun', reach: 1950, clicks: 580, conversions: 72 },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Track your marketing performance</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-1">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                period === p ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <stat.icon className="h-5 w-5 text-purple-600" />
              </div>
              <span className={`flex items-center text-sm font-medium ${stat.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stat.change > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(stat.change)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Channel Performance */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Channel Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Delivered</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Open Rate</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Conversions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {channelStats.map((channel) => {
                const openRate = channel.delivered > 0 ? (channel.opened / channel.delivered * 100) : 0
                const ctr = channel.delivered > 0 ? (channel.clicked / channel.delivered * 100) : 0
                return (
                  <tr key={channel.channel} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`${channel.color} p-2 rounded-lg`}>
                          <channel.icon className="h-5 w-5 text-white" />
                        </div>
                        <span className="font-medium text-gray-900">{channel.channel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {channel.sent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-gray-900">{channel.delivered.toLocaleString()}</span>
                      <span className="text-gray-400 text-sm ml-1">
                        ({(channel.delivered / channel.sent * 100).toFixed(1)}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-gray-900">{openRate.toFixed(1)}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full mt-1 ml-auto">
                        <div
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${openRate}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-gray-900">{ctr.toFixed(1)}%</span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full mt-1 ml-auto">
                        <div
                          className="h-2 bg-purple-500 rounded-full"
                          style={{ width: `${ctr}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {channel.conversion.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Weekly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Performance</h2>
          <div className="space-y-4">
            {weeklyData.map((day, i) => {
              const maxReach = Math.max(...weeklyData.map((d) => d.reach))
              return (
                <div key={day.day} className="flex items-center gap-4">
                  <span className="w-8 text-sm text-gray-500">{day.day}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{day.reach.toLocaleString()} reach</span>
                      <span className="text-purple-600 font-medium">{day.conversions} conversions</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                        style={{ width: `${(day.reach / maxReach) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Segments</h2>
          <div className="space-y-4">
            {[
              { name: 'High Value Customers', conversions: 456, rate: 8.2 },
              { name: 'Loyal Users', conversions: 389, rate: 7.1 },
              { name: 'New Users (30d)', conversions: 234, rate: 6.5 },
              { name: 'Weekend Shoppers', conversions: 189, rate: 5.8 },
            ].map((segment, i) => (
              <div key={segment.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-300">#{i + 1}</span>
                  <div>
                    <p className="font-medium text-gray-900">{segment.name}</p>
                    <p className="text-sm text-gray-500">{segment.conversions} conversions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-600">{segment.rate}%</p>
                  <p className="text-xs text-gray-500">conversion rate</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
