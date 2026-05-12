'use client'

import { useState } from 'react'
import {
  Zap,
  Clock,
  Users,
  MessageSquare,
  ShoppingCart,
  Gift,
  AlertCircle,
  Play,
  Pause,
  Settings,
} from 'lucide-react'

const automations = [
  {
    id: '1',
    name: 'Abandoned Cart Recovery',
    trigger: 'cart_abandoned',
    triggerLabel: 'User adds to cart but does not purchase',
    delay: '30 minutes',
    channels: ['sms', 'whatsapp'],
    status: 'active',
    stats: { triggered: 234, converted: 45, rate: '19.2%' },
  },
  {
    id: '2',
    name: 'Welcome Series',
    trigger: 'user_signup',
    triggerLabel: 'New user registration',
    delay: 'Immediate',
    channels: ['email', 'whatsapp'],
    status: 'active',
    stats: { triggered: 156, converted: 89, rate: '57.1%' },
  },
  {
    id: '3',
    name: 'Win-Back Campaign',
    trigger: 'churn_risk',
    triggerLabel: 'No activity for 30 days',
    delay: '7 days',
    channels: ['email', 'push'],
    status: 'paused',
    stats: { triggered: 89, converted: 12, rate: '13.5%' },
  },
  {
    id: '4',
    name: 'Purchase Thank You',
    trigger: 'purchase_complete',
    triggerLabel: 'After successful purchase',
    delay: 'Immediate',
    channels: ['whatsapp', 'push'],
    status: 'active',
    stats: { triggered: 567, converted: 234, rate: '41.3%' },
  },
  {
    id: '5',
    name: 'Loyalty Tier Upgrade',
    trigger: 'tier_upgrade',
    triggerLabel: 'User achieves higher tier',
    delay: 'Immediate',
    channels: ['push', 'email'],
    status: 'active',
    stats: { triggered: 78, converted: 45, rate: '57.7%' },
  },
]

const channelIcons = {
  whatsapp: { icon: MessageSquare, color: 'bg-green-500' },
  sms: { icon: MessageSquare, color: 'bg-blue-500' },
  email: { icon: MessageSquare, color: 'bg-purple-500' },
  push: { icon: MessageSquare, color: 'bg-orange-500' },
}

const triggerIcons = {
  cart_abandoned: ShoppingCart,
  user_signup: Users,
  churn_risk: AlertCircle,
  purchase_complete: Gift,
  tier_upgrade: Zap,
}

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'automations' | 'triggers' | 'templates'>('automations')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automation</h1>
          <p className="text-sm text-gray-500">Set up automated marketing flows</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
          <Zap className="h-4 w-4" />
          Create Automation
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        {[
          { id: 'automations', label: 'Automations', count: 5 },
          { id: 'triggers', label: 'Triggers', count: 12 },
          { id: 'templates', label: 'Templates', count: 8 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Automation List */}
      <div className="space-y-4">
        {automations.map((automation) => {
          const TriggerIcon = triggerIcons[automation.trigger as keyof typeof triggerIcons]
          return (
            <div key={automation.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <TriggerIcon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{automation.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          automation.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {automation.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{automation.triggerLabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                      <Settings className="h-5 w-5" />
                    </button>
                    <button className={`p-2 rounded-lg ${
                      automation.status === 'active'
                        ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                        : 'text-green-600 bg-green-50 hover:bg-green-100'
                    }`}>
                      {automation.status === 'active' ? (
                        <Pause className="h-5 w-5" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>Delay: {automation.delay}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {automation.channels.map((channel) => {
                      const ChannelIcon = channelIcons[channel as keyof typeof channelIcons]?.icon
                      const color = channelIcons[channel as keyof typeof channelIcons]?.color
                      return (
                        <div key={channel} className={`${color} p-1.5 rounded-lg`}>
                          <ChannelIcon className="h-4 w-4 text-white" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Triggered: </span>
                    <span className="font-medium text-gray-900">{automation.stats.triggered}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Converted: </span>
                    <span className="font-medium text-gray-900">{automation.stats.converted}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rate: </span>
                    <span className="font-medium text-green-600">{automation.stats.rate}</span>
                  </div>
                </div>
                <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                  View Details
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Suggestions */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <Zap className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">AI Automation Insights</h3>
            <p className="text-purple-100 mb-4">
              Your abandoned cart automation converts at 19.2%. Consider adding a WhatsApp follow-up after 2 hours for a potential 35% boost.
            </p>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-white text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50">
                Apply Suggestion
              </button>
              <button className="px-4 py-2 bg-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/30">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
