'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  MapPin,
  Building,
  Calendar,
  Tag,
  Edit,
  Trash2,
  MoreVertical,
  Plus,
  FileText,
  Star,
  X,
} from 'lucide-react'
import Timeline from '@/components/Timeline'
import { getContact, getActivities, updateContact, deleteContact, createActivity } from '@/lib/api'
import { Contact, Activity, ActivityType, ContactStatus } from '@/types'

const statusConfig: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  hot: { label: 'Hot', color: 'text-red-700', bg: 'bg-red-100' },
  warm: { label: 'Warm', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  cold: { label: 'Cold', color: 'text-blue-700', bg: 'bg-blue-100' },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
  churned: { label: 'Churned', color: 'text-gray-700', bg: 'bg-gray-100' },
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'details'>('timeline')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [newTag, setNewTag] = useState('')

  useEffect(() => {
    loadData()
  }, [resolvedParams.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [contactRes, activitiesRes] = await Promise.all([
        getContact(resolvedParams.id),
        getActivities(resolvedParams.id),
      ])
      if (contactRes.success && contactRes.data) {
        setContact(contactRes.data)
      }
      setActivities(activitiesRes)
    } catch (error) {
      console.error('Failed to load contact:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return
    const result = await deleteContact(resolvedParams.id)
    if (result.success) {
      router.push('/')
    }
  }

  const handleAddNote = async () => {
    if (!noteContent.trim() || !contact) return
    const result = await createActivity({
      contactId: contact.id,
      type: 'note',
      title: 'Added a note',
      description: noteContent,
      date: new Date(),
      userId: 'u1',
      userName: 'Current User',
    })
    if (result.success) {
      setNoteContent('')
      setShowAddNote(false)
      loadData()
    }
  }

  const handleAddTag = async () => {
    if (!newTag.trim() || !contact) return
    const updatedTags = [...contact.tags, newTag.trim()]
    const result = await updateContact(contact.id, { tags: updatedTags })
    if (result.success && result.data) {
      setContact(result.data)
      setNewTag('')
    }
  }

  const handleRemoveTag = async (tag: string) => {
    if (!contact) return
    const updatedTags = contact.tags.filter((t) => t !== tag)
    const result = await updateContact(contact.id, { tags: updatedTags })
    if (result.success && result.data) {
      setContact(result.data)
    }
  }

  const handleAddActivity = async (type: ActivityType) => {
    if (!contact) return
    const titleMap: Record<ActivityType, string> = {
      email: 'Sent email',
      call: 'Made a call',
      meeting: 'Had a meeting',
      note: 'Added a note',
      sms: 'Sent SMS',
      task: 'Completed task',
    }
    await createActivity({
      contactId: contact.id,
      type,
      title: titleMap[type],
      date: new Date(),
      userId: 'u1',
      userName: 'Current User',
    })
    loadData()
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
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Loading contact...</p>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Contact not found</h2>
          <Link href="/" className="text-purple-600 hover:underline mt-2 inline-block">
            Go back to contacts
          </Link>
        </div>
      </div>
    )
  }

  const status = statusConfig[contact.status]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div
              className={`w-14 h-14 rounded-full ${getAvatarColor(
                contact.firstName
              )} flex items-center justify-center text-white font-semibold text-lg`}
            >
              {getInitials(contact.firstName, contact.lastName)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">
                  {contact.firstName} {contact.lastName}
                </h1>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.color}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {contact.jobTitle}
                {contact.company && ` at ${contact.company}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
            <a
              href={`sms:${contact.phone}`}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <MessageSquare className="w-4 h-4" />
              SMS
            </a>
            <div className="relative group">
              <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 hidden group-hover:block">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4" />
                  Edit Contact
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          {(['timeline', 'notes', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'timeline' && (
          <div className="max-w-2xl">
            <Timeline
              activities={activities}
              contactId={contact.id}
              onAddActivity={handleAddActivity}
            />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Notes</h3>
                <button
                  onClick={() => setShowAddNote(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>

              {showAddNote && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Write a note..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => {
                        setShowAddNote(false)
                        setNoteContent('')
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              {activities.filter((a) => a.type === 'note').length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No notes yet. Add your first note above.
                </p>
              ) : (
                <div className="space-y-3">
                  {activities
                    .filter((a) => a.type === 'note')
                    .map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <p className="text-sm text-gray-700">{note.description}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(note.date).toLocaleDateString()} by{' '}
                          {note.userName}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="max-w-2xl space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Contact Information</h3>
              <dl className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <dt className="text-sm text-gray-500 w-24">Email</dt>
                  <dd className="text-sm text-gray-900">
                    <a href={`mailto:${contact.email}`} className="text-purple-600 hover:underline">
                      {contact.email}
                    </a>
                  </dd>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <dt className="text-sm text-gray-500 w-24">Phone</dt>
                  <dd className="text-sm text-gray-900">
                    <a href={`tel:${contact.phone}`} className="text-purple-600 hover:underline">
                      {contact.phone}
                    </a>
                  </dd>
                </div>
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-gray-400" />
                    <dt className="text-sm text-gray-500 w-24">Company</dt>
                    <dd className="text-sm text-gray-900">{contact.company}</dd>
                  </div>
                )}
                {contact.jobTitle && (
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 text-gray-400" />
                    <dt className="text-sm text-gray-500 w-24">Title</dt>
                    <dd className="text-sm text-gray-900">{contact.jobTitle}</dd>
                  </div>
                )}
                {contact.address?.city && (
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <dt className="text-sm text-gray-500 w-24">Location</dt>
                    <dd className="text-sm text-gray-900">
                      {[contact.address.city, contact.address.state, contact.address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </dd>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <dt className="text-sm text-gray-500 w-24">Created</dt>
                  <dd className="text-sm text-gray-900">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Tags</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {contact.tags.length === 0 && (
                  <p className="text-sm text-gray-500">No tags added yet.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleAddTag}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Lead Source */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Lead Source</h3>
              <p className="text-sm text-gray-700 capitalize">{contact.leadSource}</p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <>
          <div className="modal-backdrop" onClick={() => setShowEditModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto animate-fade-in">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Edit Contact</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  const formData = new FormData(form)
                  await updateContact(contact.id, {
                    firstName: formData.get('firstName') as string,
                    lastName: formData.get('lastName') as string,
                    email: formData.get('email') as string,
                    phone: formData.get('phone') as string,
                    company: formData.get('company') as string,
                    jobTitle: formData.get('jobTitle') as string,
                    status: formData.get('status') as ContactStatus,
                  })
                  setShowEditModal(false)
                  loadData()
                }}
                className="p-4 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      name="firstName"
                      defaultValue={contact.firstName}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      name="lastName"
                      defaultValue={contact.lastName}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={contact.email}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    name="phone"
                    defaultValue={contact.phone}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company
                  </label>
                  <input
                    name="company"
                    defaultValue={contact.company}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Title
                  </label>
                  <input
                    name="jobTitle"
                    defaultValue={contact.jobTitle}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={contact.status}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                    <option value="active">Active</option>
                    <option value="churned">Churned</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
