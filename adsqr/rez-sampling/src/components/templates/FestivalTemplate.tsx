'use client'

import { FESTIVAL_TEMPLATES, FestivalId, getFestivalEmoji } from '@/lib/templates/festivalConfig'
import type { FestivalTemplate } from '@/lib/templates/festivalConfig'

interface FestivalTemplateProps {
  selectedFestival?: FestivalId
  onSelect: (festivalId: FestivalId) => void
  showPreview?: boolean
}

export default function FestivalTemplate({
  selectedFestival,
  onSelect,
  showPreview = true
}: FestivalTemplateProps) {
  const festivals = Object.entries(FESTIVAL_TEMPLATES).map(([key, template]) => ({
    festivalId: key as FestivalId,
    ...template
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {festivals.map((festival) => (
          <button
            key={festival.id}
            onClick={() => onSelect(festival.id)}
            className={`
              p-4 rounded-xl border-2 text-left transition-all hover:scale-105
              ${selectedFestival === festival.id
                ? 'border-indigo-600 bg-indigo-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
            style={{
              background: selectedFestival === festival.id
                ? `linear-gradient(135deg, ${festival.colors[0]}20 0%, ${festival.colors[1]}20 100%)`
                : undefined
            }}
          >
            <div className="text-3xl mb-2">{getFestivalEmoji(festival.emoji)}</div>
            <div className="font-medium text-gray-900 text-sm">{festival.name}</div>
            <div className="text-xs text-gray-500 mt-1">{festival.description}</div>
            <div className="flex gap-1 mt-2">
              {festival.colors.map((color, idx) => (
                <div
                  key={idx}
                  className="w-4 h-4 rounded-full border border-gray-200"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      {showPreview && selectedFestival && (
        <FestivalPreview festivalId={selectedFestival} />
      )}
    </div>
  )
}

interface FestivalPreviewProps {
  festivalId: FestivalId
}

function FestivalPreview({ festivalId }: FestivalPreviewProps) {
  const festival = FESTIVAL_TEMPLATES[festivalId]

  if (!festival) return null

  return (
    <div className="mt-6 p-6 rounded-xl border border-gray-200">
      <h3 className="font-medium text-gray-900 mb-4">Campaign Preview</h3>

      <div className="relative rounded-xl overflow-hidden mb-4">
        <div
          className="h-48 flex items-center justify-center"
          style={{ background: festival.templates.banner.bgGradient }}
        >
          <div className="text-center">
            <div className="text-5xl mb-2">{getFestivalEmoji(festival.emoji)}</div>
            <h2 className="text-2xl font-bold" style={{ color: festival.templates.banner.textColor }}>
              {festival.name}
            </h2>
            <p className="mt-2" style={{ color: festival.templates.banner.textColor, opacity: 0.8 }}>
              Scan & Win Exciting Rewards!
            </p>
          </div>
        </div>

        {/* QR Code Placeholder with Frame */}
        <div className="absolute bottom-4 right-4">
          <div
            className="w-20 h-20 bg-white rounded-lg p-1"
            style={{ border: `3px solid ${festival.templates.qrFrame.borderColor}` }}
          >
            <div className="w-full h-full bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-bold text-indigo-600">
            {festival.suggestedRewards.scan}
          </div>
          <div className="text-xs text-gray-500">Scan Rewards</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-bold text-indigo-600">
            {festival.suggestedRewards.visit}
          </div>
          <div className="text-xs text-gray-500">Visit Rewards</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-lg font-bold text-indigo-600">
            {festival.suggestedRewards.purchase}
          </div>
          <div className="text-xs text-gray-500">Purchase Rewards</div>
        </div>
      </div>
    </div>
  )
}

// Component for displaying a single festival badge
interface FestivalBadgeProps {
  festivalId: FestivalId
  size?: 'sm' | 'md' | 'lg'
}

export function FestivalBadge({ festivalId, size = 'md' }: FestivalBadgeProps) {
  const festival = FESTIVAL_TEMPLATES[festivalId]

  if (!festival) return null

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(135deg, ${festival.colors[0]}20 0%, ${festival.colors[1]}20 100%)`,
        color: festival.templates.banner.textColor
      }}
    >
      <span>{getFestivalEmoji(festival.emoji)}</span>
      <span>{festival.name}</span>
    </span>
  )
}

// Component for festival countdown
interface FestivalCountdownProps {
  festivalId: FestivalId
}

export function FestivalCountdown({ festivalId }: FestivalCountdownProps) {
  const festival = FESTIVAL_TEMPLATES[festivalId]

  if (!festival) return null

  // Calculate days until festival
  const now = new Date()
  const currentYear = now.getFullYear()
  const festivalMonths: Record<string, number[]> = {
    diwali: [10, 11],
    holi: [2, 3],
    christmas: [12],
    newyear: [12, 1],
    valentine: [2],
    rakhi: [8],
    eid: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    independence: [8],
    pongal: [1],
    ganesh: [8, 9],
    navratri: [9, 10],
    easter: [3, 4],
    halloween: [10],
    blackfriday: [11]
  }

  const months = festivalMonths[festivalId] || []
  let daysUntil = 0

  // Simple countdown - find next occurrence
  for (let i = 0; i < 12; i++) {
    const checkMonth = ((now.getMonth() + i) % 12) + 1
    if (months.includes(checkMonth)) {
      // Approximate days calculation
      daysUntil = i * 30
      break
    }
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg"
      style={{ background: `linear-gradient(135deg, ${festival.colors[0]}15 0%, ${festival.colors[1]}15 100%)` }}
    >
      <span className="text-lg">{getFestivalEmoji(festival.emoji)}</span>
      <span className="text-sm font-medium text-gray-700">
        {festival.name}
      </span>
      <span className="text-xs text-gray-500">
        ~{daysUntil} days
      </span>
    </div>
  )
}
