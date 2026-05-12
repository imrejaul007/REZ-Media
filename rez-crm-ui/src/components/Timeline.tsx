'use client'

import { useState } from 'react'
import {
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  Plus,
  ChevronDown,
} from 'lucide-react'
import { Activity, ActivityType } from '@/types'

interface TimelineProps {
  activities: Activity[]
  contactId?: string
  onAddActivity?: (type: ActivityType) => void
  compact?: boolean
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  email: {
    icon: Mail,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    label: 'Email',
  },
  call: {
    icon: Phone,
    color: 'text-green-600',
    bg: 'bg-green-100',
    label: 'Call',
  },
  meeting: {
    icon: Calendar,
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    label: 'Meeting',
  },
  note: {
    icon: FileText,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    label: 'Note',
  },
  sms: {
    icon: MessageSquare,
    color: 'text-orange-600',
    bg: 'bg-orange-100',
    label: 'SMS',
  },
  task: {
    icon: CheckCircle,
    color: 'text-teal-600',
    bg: 'bg-teal-100',
    label: 'Task',
  },
}

export default function Timeline({
  activities,
  contactId,
  onAddActivity,
  compact = false,
}: TimelineProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)

    if (days === 0) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return `${days} days ago`
    } else {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }

  const groupActivitiesByDate = (activities: Activity[]) => {
    const groups: { [key: string]: Activity[] } = {}

    activities.forEach((activity) => {
      const date = new Date(activity.date)
      const key = date.toDateString()

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(activity)
    })

    return Object.entries(groups)
  }

  const groupedActivities = groupActivitiesByDate(activities)

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Clock className="w-10 h-10 mb-3 text-gray-300" />
        <p className="text-sm font-medium">No activities yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Track interactions by logging calls, emails, and meetings
        </p>
        {onAddActivity && (
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Log Activity
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'bg-white rounded-xl border border-gray-200 p-4'}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
          {onAddActivity && (
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Log Activity
                <ChevronDown className="w-4 h-4" />
              </button>

              {showAddMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                  {(Object.keys(activityConfig) as ActivityType[]).map((type) => {
                    const config = activityConfig[type]
                    const Icon = config.icon
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          onAddActivity(type)
                          setShowAddMenu(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        {config.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4">
        {groupedActivities.map(([dateStr, dateActivities]) => (
          <div key={dateStr}>
            {/* Date Header */}
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              {new Date(dateStr).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            {/* Activities for this date */}
            <div className="space-y-3">
              {dateActivities.map((activity, idx) => {
                const config = activityConfig[activity.type]
                const Icon = config.icon
                const isLast = idx === dateActivities.length - 1

                return (
                  <div key={activity.id} className="flex gap-3">
                    {/* Icon and line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}
                      >
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      {!isLast && (
                        <div className="w-px h-full bg-gray-200 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 pb-3 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {activity.title}
                          </p>
                          {activity.description && (
                            <p className="text-sm text-gray-500 mt-0.5">
                              {activity.description}
                            </p>
                          )}
                          {activity.duration && (
                            <p className="text-xs text-gray-400 mt-1">
                              Duration: {activity.duration} min
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDate(activity.date)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        by {activity.userName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
