'use client'

import Link from 'next/link'
import { Mail, Phone, MessageSquare, MoreVertical, MapPin, Building } from 'lucide-react'
import { Contact, ContactStatus } from '@/types'

interface ContactCardProps {
  contact: Contact
  onClick?: () => void
}

const statusConfig: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  hot: { label: 'Hot', color: 'text-red-700', bg: 'bg-red-100' },
  warm: { label: 'Warm', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  cold: { label: 'Cold', color: 'text-blue-700', bg: 'bg-blue-100' },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
  churned: { label: 'Churned', color: 'text-gray-700', bg: 'bg-gray-100' },
}

export default function ContactCard({ contact, onClick }: ContactCardProps) {
  const status = statusConfig[contact.status]

  const formatLastContact = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-cyan-500',
      'bg-teal-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-orange-500',
      'bg-red-500',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full ${getAvatarColor(
              contact.firstName
            )} flex items-center justify-center text-white font-medium text-sm`}
          >
            {getInitials(contact.firstName, contact.lastName)}
          </div>
          <div>
            <Link
              href={`/contacts/${contact.id}`}
              className="font-semibold text-gray-900 hover:text-purple-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {contact.firstName} {contact.lastName}
            </Link>
            {contact.jobTitle && (
              <p className="text-sm text-gray-500">{contact.jobTitle}</p>
            )}
          </div>
        </div>
        <span
          className={`px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      {/* Contact Info */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Mail className="w-4 h-4 text-gray-400" />
          <a
            href={`mailto:${contact.email}`}
            className="hover:text-purple-600 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {contact.email}
          </a>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4 text-gray-400" />
          <a
            href={`tel:${contact.phone}`}
            className="hover:text-purple-600"
            onClick={(e) => e.stopPropagation()}
          >
            {contact.phone}
          </a>
        </div>
        {contact.company && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Building className="w-4 h-4 text-gray-400" />
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.address?.city && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="truncate">
              {contact.address.city}
              {contact.address.state && `, ${contact.address.state}`}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {contact.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              #{tag}
            </span>
          ))}
          {contact.tags.length > 4 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
              +{contact.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">
          Last contact: {formatLastContact(contact.lastContact)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={`mailto:${contact.email}`}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-purple-600"
            title="Send Email"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="w-4 h-4" />
          </a>
          <a
            href={`tel:${contact.phone}`}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-purple-600"
            title="Call"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-4 h-4" />
          </a>
          <a
            href={`sms:${contact.phone}`}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-purple-600"
            title="SMS"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageSquare className="w-4 h-4" />
          </a>
          <button
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            title="More Options"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
