'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Users, PieChart } from 'lucide-react'
import SegmentBuilder, { SegmentCard } from '@/components/SegmentBuilder'
import { getSegments, createSegment, updateSegment, deleteSegment } from '@/lib/api'
import { Segment } from '@/types'

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    loadSegments()
  }, [])

  const loadSegments = async () => {
    setLoading(true)
    try {
      const data = await getSegments()
      setSegments(data)
    } catch (error) {
      console.error('Failed to load segments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (segmentData: Omit<Segment, 'id' | 'createdAt' | 'updatedAt' | 'contactCount'>) => {
    const result = await createSegment(segmentData)
    if (result.success && result.data) {
      setSegments([...segments, result.data])
      setShowCreateForm(false)
    }
  }

  const handleUpdate = async (segmentData: Omit<Segment, 'id' | 'createdAt' | 'updatedAt' | 'contactCount'>) => {
    if (!editingSegment) return
    const result = await updateSegment(editingSegment.id, segmentData)
    if (result.success && result.data) {
      setSegments(segments.map((s) => (s.id === editingSegment.id ? result.data! : s)))
      setEditingSegment(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return
    const result = await deleteSegment(id)
    if (result.success) {
      setSegments(segments.filter((s) => s.id !== id))
    }
  }

  const filteredSegments = segments.filter((segment) => {
    if (filter === 'active' && !segment.isActive) return false
    if (filter === 'inactive' && segment.isActive) return false
    if (search) {
      const query = search.toLowerCase()
      return (
        segment.name.toLowerCase().includes(query) ||
        segment.description?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const activeCount = segments.filter((s) => s.isActive).length
  const totalContacts = segments.reduce((sum, s) => sum + s.contactCount, 0)

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Segments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create groups of contacts based on rules
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          <Plus className="w-4 h-4" />
          Create Segment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{segments.length}</p>
              <p className="text-sm text-gray-500">Total Segments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-sm text-gray-500">Active Segments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalContacts}</p>
              <p className="text-sm text-gray-500">Total Contacts</p>
            </div>
          </div>
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
            placeholder="Search segments..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading segments...</p>
            </div>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <PieChart className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No segments found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {search || filter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first segment to group contacts'}
            </p>
            {!search && filter === 'all' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Create Segment
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSegments.map((segment) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                onEdit={() => setEditingSegment(segment)}
                onDelete={() => handleDelete(segment.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateForm || editingSegment) && (
        <>
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowCreateForm(false)
              setEditingSegment(null)
            }}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-auto animate-fade-in">
              <SegmentBuilder
                segment={editingSegment || undefined}
                onSave={editingSegment ? handleUpdate : handleCreate}
                onCancel={() => {
                  setShowCreateForm(false)
                  setEditingSegment(null)
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
