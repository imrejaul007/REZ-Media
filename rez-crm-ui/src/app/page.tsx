'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ContactTable from '@/components/ContactTable'
import ContactCard from '@/components/ContactCard'
import { getContacts, exportContacts } from '@/lib/api'
import { Contact, ContactStatus } from '@/types'
import { LayoutGrid, List, Upload } from 'lucide-react'

export default function ContactsPage() {
  const searchParams = useSearchParams()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'all'>(
    (searchParams.get('status') as ContactStatus) || 'all'
  )
  const [tagFilter, setTagFilter] = useState<string | null>(searchParams.get('tag'))
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    loadContacts()
  }, [search, statusFilter, tagFilter])

  const loadContacts = async () => {
    setLoading(true)
    try {
      const response = await getContacts({
        search: search || undefined,
        status: statusFilter !== 'all' ? [statusFilter] : undefined,
        tags: tagFilter ? [tagFilter] : undefined,
      })
      setContacts(response.data)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const blob = await exportContacts({ format: 'csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const handleImport = () => {
    setShowImportModal(true)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Handle file upload
      console.log('Uploading file:', file.name)
      setShowImportModal(false)
    }
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your customer relationships
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-purple-100 text-purple-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Table view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-purple-100 text-purple-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Filters */}
      {(statusFilter !== 'all' || tagFilter || search) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Filters:</span>
          {statusFilter !== 'all' && (
            <button
              onClick={() => setStatusFilter('all')}
              className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-200"
            >
              Status: {statusFilter}
              <span className="ml-1">x</span>
            </button>
          )}
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200"
            >
              #{tagFilter}
              <span className="ml-1">x</span>
            </button>
          )}
          {search && (
            <button
              onClick={() => setSearch('')}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200"
            >
              Search: {search}
              <span className="ml-1">x</span>
            </button>
          )}
          <button
            onClick={() => {
              setStatusFilter('all')
              setTagFilter(null)
              setSearch('')
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading contacts...</p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <ContactTable
            contacts={contacts}
            onSearch={setSearch}
            onFilter={setStatusFilter}
            onExport={handleExport}
            onImport={handleImport}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => {
                  window.location.href = `/contacts/${contact.id}`
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setShowImportModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Import Contacts
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Upload a CSV file to import contacts. The file should have columns
                for name, email, phone, and other contact information.
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop your file here, or
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 cursor-pointer">
                    Browse Files
                  </span>
                </label>
                <p className="text-xs text-gray-400 mt-2">
                  Supports CSV files up to 10MB
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
