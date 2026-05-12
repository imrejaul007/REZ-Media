'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Filter,
  Download,
  Upload,
  Mail,
  Phone,
  MessageSquare,
  MoreVertical,
  ChevronDown,
  ArrowUpDown,
  UserPlus,
} from 'lucide-react'
import { Contact, ContactStatus } from '@/types'

interface ContactTableProps {
  contacts: Contact[]
  onSearch?: (query: string) => void
  onFilter?: (status: ContactStatus | 'all') => void
  onImport?: () => void
  onExport?: () => void
}

const statusConfig: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  hot: { label: 'Hot', color: 'text-red-700', bg: 'bg-red-100' },
  warm: { label: 'Warm', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  cold: { label: 'Cold', color: 'text-blue-700', bg: 'bg-blue-100' },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
  churned: { label: 'Churned', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const leadSourceLabels: Record<string, string> = {
  website: 'Website',
  referral: 'Referral',
  social: 'Social',
  campaign: 'Campaign',
  other: 'Other',
}

export default function ContactTable({
  contacts,
  onSearch,
  onFilter,
  onImport,
  onExport,
}: ContactTableProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ContactStatus | 'all'>('all')
  const [sortField, setSortField] = useState<keyof Contact>('lastContact')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const handleSearch = (value: string) => {
    setSearch(value)
    onSearch?.(value)
  }

  const handleFilter = (value: ContactStatus | 'all') => {
    setFilter(value)
    onFilter?.(value)
  }

  const handleSort = (field: keyof Contact) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)))
    }
  }

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

  const filteredContacts = contacts
    .filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false
      if (search) {
        const query = search.toLowerCase()
        return (
          c.firstName.toLowerCase().includes(query) ||
          c.lastName.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query)
        )
      }
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (aVal === undefined || bVal === undefined) return 0
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return sortOrder === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime()
      }
      return 0
    })

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {filteredContacts.length} Contacts
          </h2>
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-500">
              ({selectedIds.size} selected)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <Link
            href="/contacts/new"
            className="flex items-center gap-2 px-4 py-2 border border-purple-200 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Contact
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
              filter !== 'all'
                ? 'border-purple-200 bg-purple-50 text-purple-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {filter !== 'all' && (
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
            )}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showFilterMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
              <button
                onClick={() => {
                  handleFilter('all')
                  setShowFilterMenu(false)
                }}
                className={`w-full text-left px-4 py-2 text-sm ${
                  filter === 'all' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                All Status
              </button>
              {Object.entries(statusConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => {
                    handleFilter(key as ContactStatus)
                    setShowFilterMenu(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm ${
                    filter === key ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${config.bg.replace('bg-', 'bg-').replace('-100', '-500')}`} />
                  {config.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('firstName')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('lastContact')}
                >
                  <div className="flex items-center gap-1">
                    Last Contact
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContacts.map((contact) => {
                const status = statusConfig[contact.status]
                const isSelected = selectedIds.has(contact.id)
                return (
                  <tr
                    key={contact.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-purple-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(contact.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-gray-900 hover:text-purple-600"
                      >
                        {contact.firstName} {contact.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="text-gray-900">{contact.email}</div>
                        <div className="text-gray-400">{contact.phone}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {contact.company || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                            +{contact.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatLastContact(contact.lastContact)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={`mailto:${contact.email}`}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`sms:${contact.phone}`}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                          title="SMS"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                        <div className="relative group">
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 hidden group-hover:block">
                            <Link
                              href={`/contacts/${contact.id}`}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              View Details
                            </Link>
                            <Link
                              href={`/contacts/${contact.id}/edit`}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit Contact
                            </Link>
                            <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredContacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Users className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No contacts found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
