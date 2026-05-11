'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Template {
  id: string
  name: string
  description: string
  icon: string
  features: string[]
  recommended: boolean
  landing_template: string
}

const templates: Template[] = [
  {
    id: 'quick-promo',
    name: 'Quick Promo',
    description: 'Simple promotion with scan reward',
    icon: '🎯',
    features: ['Instant scan reward', 'Basic analytics', 'Single QR code'],
    recommended: false,
    landing_template: 'bold'
  },
  {
    id: 'discount-offer',
    name: 'Discount Offer',
    description: 'Drive purchases with percentage or flat discount',
    icon: '💰',
    features: ['Discount display', 'Coupon code', 'Purchase tracking', 'Multiple QR codes'],
    recommended: true,
    landing_template: 'coupon'
  },
  {
    id: 'loyalty-program',
    name: 'Loyalty Program',
    description: 'Build customer loyalty with points system',
    icon: '⭐',
    features: ['Points accumulation', 'Tier rewards', 'Customer profiles', 'Unlimited QR codes'],
    recommended: false,
    landing_template: 'minimal'
  },
  {
    id: 'contest-entry',
    name: 'Contest Entry',
    description: 'Run contests and sweepstakes',
    icon: '🏆',
    features: ['Entry form', 'Random draw', 'Winner notification', 'Social sharing'],
    recommended: false,
    landing_template: 'contest'
  },
  {
    id: 'video-launch',
    name: 'Video Launch',
    description: 'Showcase product launches with video content',
    icon: '🎬',
    features: ['Video header', 'Product showcase', 'Pre-order capture', 'Social proof'],
    recommended: false,
    landing_template: 'video'
  },
  {
    id: 'lead-gen',
    name: 'Lead Generation',
    description: 'Capture leads with interest selection',
    icon: '📝',
    features: ['Custom form fields', 'Interest selection', 'CRM integration', 'Follow-up automation'],
    recommended: false,
    landing_template: 'lead'
  }
]

export default function CampaignTemplatesPage() {
  const router = useRouter()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [step, setStep] = useState<'select' | 'configure'>('select')

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
    setStep('configure')
  }

  const handleCreateCampaign = async () => {
    if (!campaignName.trim() || !selectedTemplate) return

    setCreating(true)

    try {
      const template = templates.find(t => t.id === selectedTemplate)
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          landing_template: template?.landing_template || 'bold',
          status: 'draft'
        })
      })

      if (res.ok) {
        const { campaign } = await res.json()
        router.push(`/campaigns/${campaign.id}/edit`)
      } else {
        alert('Failed to create campaign')
      }
    } catch (error) {
      console.error('Failed to create:', error)
      alert('Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  const handleQuickCreate = async (templateId: string) => {
    setSelectedTemplate(templateId)
    setCreating(true)

    try {
      const template = templates.find(t => t.id === templateId)
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template?.name || 'Campaign'} - ${new Date().toLocaleDateString()}`,
          landing_template: template?.landing_template || 'bold',
          status: 'draft'
        })
      })

      if (res.ok) {
        const { campaign } = await res.json()
        router.push(`/campaigns/${campaign.id}/edit`)
      }
    } catch (error) {
      console.error('Failed to create:', error)
    } finally {
      setCreating(false)
    }
  }

  if (step === 'configure' && selectedTemplate) {
    const template = templates.find(t => t.id === selectedTemplate)
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <button
              onClick={() => setStep('select')}
              className="text-sm text-gray-500 hover:text-gray-700 mb-1"
            >
              ← Back to Templates
            </button>
            <h1 className="text-2xl font-bold">Configure {template?.name}</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">{template?.icon}</span>
              <div>
                <h2 className="text-xl font-semibold">{template?.name}</h2>
                <p className="text-gray-500">{template?.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2"
                  placeholder="Enter a name for your campaign"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Included Features</label>
                <ul className="space-y-2">
                  {template?.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={handleCreateCampaign}
                  disabled={!campaignName.trim() || creating}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 mb-1 block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold">Campaign Templates</h1>
              <p className="text-gray-500 text-sm">Choose a template to start your campaign</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <div
              key={template.id}
              className={`bg-white rounded-lg shadow overflow-hidden ${
                template.recommended ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              {template.recommended && (
                <div className="bg-indigo-500 text-white text-center text-sm py-1">
                  Recommended
                </div>
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{template.icon}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{template.description}</p>

                <ul className="space-y-2 mb-6">
                  {template.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleTemplateSelect(template.id)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Customize
                  </button>
                  <button
                    onClick={() => handleQuickCreate(template.id)}
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Quick Start
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Blank Template */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Start from Scratch</h2>
          <button
            onClick={() => router.push('/campaigns/new')}
            className="w-full bg-white rounded-lg shadow p-6 border-2 border-dashed hover:border-indigo-400 transition text-center"
          >
            <span className="text-3xl mb-2 block">+</span>
            <span className="font-medium">Blank Campaign</span>
            <p className="text-sm text-gray-500 mt-1">Create a custom campaign with no template</p>
          </button>
        </div>
      </main>
    </div>
  )
}
