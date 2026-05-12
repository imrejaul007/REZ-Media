'use client'

import { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Mail,
  Bell,
  Megaphone,
  Zap,
  ArrowRight,
  Plus,
} from 'lucide-react'
import Link from 'next/link'

// Mock data
const stats = [
  { name: 'Active Campaigns', value: '12', change: '+2', trend: 'up', icon: Megaphone },
  { name: 'Total Reach', value: '45.2K', change: '+12%', trend: 'up', icon: Users },
  { name: 'Messages Sent', value: '8.4K', change: '+23%', trend: 'up', icon: MessageSquare },
  { name: 'Avg. Open Rate', value: '68%', change: '-3%', trend: 'down', icon: Mail },
]

const recentCampaigns = [
  { id: 1, name: 'Summer Sale 2024', channel: 'WhatsApp', status: 'Active', sent: 2340, opens: 1872, clicks: 456 },
  { id: 2, name: 'New User Welcome', channel: 'Email', status: 'Active', sent: 890, opens: 712, clicks: 234 },
  { id: 3, name: 'Abandoned Cart Recovery', channel: 'SMS', status: 'Scheduled', sent: 0, opens: 0, clicks: 0 },
]

const channels = [
  { name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', href: '/broadcasts?channel=whatsapp' },
  { name: 'SMS', icon: Bell, color: 'bg-blue-500', href: '/broadcasts?channel=sms' },
  { name: 'Email', icon: Mail, color: 'bg-purple-500', href: '/broadcasts?channel=email' },
  { name: 'Push', icon: Zap, color: 'bg-orange-500', href: '/broadcasts?channel=push' },
]

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back! Here is your marketing overview.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/campaigns/new"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
          <Link
            href="/broadcasts/new"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            <Zap className="h-4 w-4" />
            Quick Broadcast
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.icon === Megaphone ? 'bg-purple-100' : stat.icon === Users ? 'bg-blue-100' : stat.icon === MessageSquare ? 'bg-green-100' : 'bg-orange-100'}`}>
                <stat.icon className={`h-5 w-5 ${stat.icon === Megaphone ? 'text-purple-600' : stat.icon === Users ? 'text-blue-600' : stat.icon === MessageSquare ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <span className={`flex items-center text-xs font-medium ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {stat.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Campaigns */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Campaigns</h2>
            <Link href="/campaigns" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCampaigns.map((campaign) => (
              <div key={campaign.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    campaign.channel === 'WhatsApp' ? 'bg-green-100' :
                    campaign.channel === 'Email' ? 'bg-purple-100' : 'bg-blue-100'
                  }`}>
                    {campaign.channel === 'WhatsApp' ? <MessageSquare className="h-5 w-5 text-green-600" /> :
                     campaign.channel === 'Email' ? <Mail className="h-5 w-5 text-purple-600" /> :
                     <Bell className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{campaign.name}</p>
                    <p className="text-sm text-gray-500">{campaign.channel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{campaign.sent.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Sent</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{campaign.opens.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Opens</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    campaign.status === 'Active' ? 'bg-green-100 text-green-700' :
                    campaign.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {campaign.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - Channels */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Quick Broadcast</h2>
            <p className="text-sm text-gray-500 mt-1">Send to your audience instantly</p>
          </div>
          <div className="p-4 space-y-3">
            {channels.map((channel) => (
              <Link
                key={channel.name}
                href={channel.href}
                className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
              >
                <div className={`${channel.color} p-3 rounded-xl`}>
                  <channel.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{channel.name}</p>
                  <p className="text-sm text-gray-500">Send {channel.name.toLowerCase()} broadcast</p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Audience & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audience Segments */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Top Audiences</h2>
            <Link href="/audiences" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
              Manage <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-4 space-y-3">
            {[
              { name: 'High Value Customers', count: 1240, growth: '+8%' },
              { name: 'Loyal Users', count: 892, growth: '+12%' },
              { name: 'At Risk', count: 456, growth: '-3%' },
              { name: 'New Users (30d)', count: 234, growth: '+45%' },
            ].map((segment, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{segment.name}</p>
                    <p className="text-sm text-gray-500">{segment.count.toLocaleString()} users</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {segment.growth}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl text-white">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">AI Recommendations</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-sm text-purple-100">Best time to send</p>
                <p className="text-lg font-bold">Tomorrow 10-11 AM</p>
                <p className="text-xs text-purple-200 mt-1">Based on your audience engagement patterns</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-sm text-purple-100">Suggested segment</p>
                <p className="text-lg font-bold">"Loyal Users" + "High Value"</p>
                <p className="text-xs text-purple-200 mt-1">23% higher conversion expected</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-sm text-purple-100">Churn risk alert</p>
                <p className="text-lg font-bold">156 users at risk</p>
                <p className="text-xs text-purple-200 mt-1">Send win-back campaign recommended</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
