'use client'

import { useState } from 'react'

export default function OwnerSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    weeklyReport: true,
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48">
          <nav className="space-y-1">
            {['profile', 'notifications', 'integrations', 'api', 'billing'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Organization Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Organization Name</label>
                  <input
                    type="text"
                    defaultValue="Your Organization"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue="owner@example.com"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Phone</label>
                  <input
                    type="tel"
                    defaultValue="+91 98765 43210"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications' },
                  { key: 'sms', label: 'SMS Notifications' },
                  { key: 'push', label: 'Push Notifications' },
                  { key: 'weeklyReport', label: 'Weekly Performance Report' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-white">{item.label}</span>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof notifications] }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        notifications[item.key as keyof typeof notifications] ? 'bg-blue-600' : 'bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        notifications[item.key as keyof typeof notifications] ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Connected Services</h2>
              <div className="space-y-3">
                {[
                  { name: 'AdBazaar', status: 'connected', icon: '📋' },
                  { name: 'DOOH Network', status: 'connected', icon: '🖥' },
                  { name: 'QR Campaign Service', status: 'connected', icon: '◫' },
                  { name: 'In-App Ad Network', status: 'disconnected', icon: '📱' },
                ].map(service => (
                  <div key={service.name} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#0d0d14' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{service.icon}</span>
                      <span className="text-white">{service.name}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      service.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {service.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">API Access</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value="rz_live_xxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono"
                    />
                    <button className="px-4 py-2 rounded-lg bg-gray-700 text-white">Regenerate</button>
                  </div>
                </div>
                <p className="text-gray-500 text-sm">
                  Use this key to authenticate API requests to the Owner Service.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#111118', border: '1px solid #2a2a3e' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Payout Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Bank Account</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white mb-2 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="IFSC Code"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">UPI ID (Optional)</label>
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
                  Save Payout Details
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
