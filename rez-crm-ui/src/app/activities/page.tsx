'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  FileText,
  CheckCircle,
  Clock,
  User,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react'
import { getActivities, getContacts } from '@/lib/api'
import { Activity, ActivityType, Contact } from '@/types'

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

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [activitiesData, contactsData] = await Promise.all([
        getActivities(),
        getContacts(),
      ])
      setActivities(activitiesData)
      setContacts(contactsData.data)
    } catch (error) {
      console.error('Failed to load activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const getContactName = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId)
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact'
  }

  const getContact = (contactId: string) => {
    return contacts.find((c) => c.id === contactId)
  }

  const formatDate = (date: Date) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateGroup = (date: Date) => {
    const d = new Date(date)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const activityDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (activityDate.getTime() === today.getTime()) return 'Today'
    if (activityDate.getTime() === yesterday.getTime()) return 'Yesterday'
    if (activityDate > new Date(today.getTime() - 7 * 86400000)) return 'This Week'
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const filteredActivities = activities
    .filter((activity) => {
      if (typeFilter !== 'all' && activity.type !== typeFilter) return false
      if (search) {
        const query = search.toLowerCase()
        const contact = getContact(activity.contactId)
        return (
          activity.title.toLowerCase().includes(query) ||
          activity.description?.toLowerCase().includes(query) ||
          getContactName(activity.contactId).toLowerCase().includes(query) ||
          contact?.company?.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        const diff = new Date(b.date).getTime() - new Date(a.date).getTime()
        return sortOrder === 'desc' ? diff : -diff
      }
      return sortOrder === 'asc'
        ? a.type.localeCompare(b.type)
        : b.type.localeCompare(a.type)
    })

  // Group activities by time period
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const period = formatDateGroup(activity.date)
    if (!groups[period]) {
      groups[period] = []
    }
    groups[period].push(activity)
    return groups
  }, {} as Record<string, Activity[]>)

  const stats = {
    total: activities.length,
    emails: activities.filter((a) => a.type === 'email').length,
    calls: activities.filter((a) => a.type === 'call').length,
    meetings: activities.filter((a) => a.type === 'meeting').length,
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track all customer interactions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Activities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-gray-500">Emails</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.emails}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-600" />
            <p className="text-sm text-gray-500">Calls</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.calls}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-600" />
            <p className="text-sm text-gray-500">Meetings</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.meetings}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search activities..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivityType | 'all')}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Types</option>
          {(Object.keys(activityConfig) as ActivityType[]).map((type) => {
            const config = activityConfig[type]
            return (
              <option key={type} value={type}>
                {config.label}
              </option>
            )
          })}
        </select>
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowUpDown className="w-4 h-4" />
          {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading activities...</p>
            </div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Clock className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No activities found</h3>
            <p className="text-sm text-gray-500">
              {search || typeFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Activities will appear here when you interact with contacts'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([period, periodActivities]) => (
              <div key={period}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {period}
                </h3>
                <div className="space-y-3">
                  {periodActivities.map((activity) => {
                    const config = activityConfig[activity.type]
                    const Icon = config.icon
                    const contact = getContact(activity.contactId)

                    return (
                      <div
                        key={activity.id}
                        className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-purple-200 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {activity.title}
                                </p>
                                {contact && (
                                  <Link
                                    href={`/contacts/${contact.id}`}
                                    className="text-sm text-purple-600 hover:underline"
                                  >
                                    {contact.firstName} {contact.lastName}
                                    {contact.company && (
                                      <span className="text-gray-400">
                                        {' '}from {contact.company}
                                      </span>
                                    )}
                                  </Link>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 whitespace-nowrap">
                                {formatDate(activity.date)}
                              </span>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {activity.description}
                              </p>
                            )}
                            {activity.duration && (
                              <p className="text-xs text-gray-400 mt-1">
                                Duration: {activity.duration} minutes
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              by {activity.userName}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
