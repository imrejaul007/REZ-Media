import { Contact, Activity, Segment, Note, Tag, FilterOptions, PaginatedResponse, ExportOptions, ImportResult, ApiResponse } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

// Simulated delay for demo purposes
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// In-memory storage for demo
let contacts: Contact[] = [
  {
    id: '1',
    firstName: 'Rahul',
    lastName: 'Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98765 43210',
    company: 'TechCorp India',
    jobTitle: 'CTO',
    tags: ['hotel', 'premium', 'decision-maker'],
    status: 'hot',
    leadSource: 'website',
    lastContact: new Date(Date.now() - 2 * 60 * 60 * 1000),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date(),
    notes: 'Interested in enterprise plan',
    address: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  },
  {
    id: '2',
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@example.com',
    phone: '+91 87654 32109',
    company: 'Foodies Restaurant',
    jobTitle: 'Owner',
    tags: ['restaurant', 'smb'],
    status: 'warm',
    leadSource: 'referral',
    lastContact: new Date(Date.now() - 24 * 60 * 60 * 1000),
    createdAt: new Date('2024-02-20'),
    updatedAt: new Date(),
    address: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
  },
  {
    id: '3',
    firstName: 'Amit',
    lastName: 'Kumar',
    email: 'amit.kumar@example.com',
    phone: '+91 76543 21098',
    company: 'RetailMax',
    jobTitle: 'Procurement Head',
    tags: ['retail', 'enterprise'],
    status: 'warm',
    leadSource: 'campaign',
    lastContact: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date(),
    address: { city: 'Delhi', state: 'Delhi', country: 'India' },
  },
  {
    id: '4',
    firstName: 'Sneha',
    lastName: 'Reddy',
    email: 'sneha.reddy@example.com',
    phone: '+91 65432 10987',
    company: 'FitLife Gym',
    jobTitle: 'Manager',
    tags: ['fitness', 'smb'],
    status: 'cold',
    leadSource: 'social',
    lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date(),
    address: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
  },
  {
    id: '5',
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'vikram.singh@example.com',
    phone: '+91 54321 09876',
    company: 'Hotel Grand',
    jobTitle: 'GM',
    tags: ['hotel', 'vip', 'premium'],
    status: 'active',
    leadSource: 'referral',
    lastContact: new Date(Date.now() - 4 * 60 * 60 * 1000),
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date(),
    notes: 'Long-term client, renews annually',
    address: { city: 'Jaipur', state: 'Rajasthan', country: 'India' },
  },
  {
    id: '6',
    firstName: 'Ananya',
    lastName: 'Gupta',
    email: 'ananya.gupta@example.com',
    phone: '+91 43210 98765',
    company: 'EduFirst Academy',
    jobTitle: 'Director',
    tags: ['education', 'enterprise'],
    status: 'hot',
    leadSource: 'website',
    lastContact: new Date(Date.now() - 30 * 60 * 1000),
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date(),
    address: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  },
]

let activities: Activity[] = [
  { id: '1', contactId: '1', type: 'email', title: 'Sent proposal', description: 'Sent enterprise plan proposal', date: new Date(Date.now() - 2 * 60 * 60 * 1000), userId: 'u1', userName: 'John Doe' },
  { id: '2', contactId: '1', type: 'call', title: 'Discovery call', description: 'Initial discovery call lasted 45 minutes', date: new Date(Date.now() - 24 * 60 * 60 * 1000), duration: 45, userId: 'u1', userName: 'John Doe' },
  { id: '3', contactId: '2', type: 'meeting', title: 'Product demo', description: 'Online demo of POS system', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), duration: 30, userId: 'u2', userName: 'Jane Smith' },
  { id: '4', contactId: '3', type: 'note', title: 'Budget discussion', description: 'Client mentioned budget constraints for Q2', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), userId: 'u1', userName: 'John Doe' },
  { id: '5', contactId: '4', type: 'sms', title: 'Follow-up SMS', description: 'Sent promotional SMS for new features', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), userId: 'u2', userName: 'Jane Smith' },
  { id: '6', contactId: '5', type: 'task', title: 'Contract renewal', description: 'Annual contract renewal discussion', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), userId: 'u1', userName: 'John Doe' },
  { id: '7', contactId: '6', type: 'email', title: 'Welcome email', description: 'Sent onboarding sequence', date: new Date(Date.now() - 30 * 60 * 1000), userId: 'u2', userName: 'Jane Smith' },
  { id: '8', contactId: '6', type: 'call', title: 'Welcome call', description: 'Introduction call with new customer', date: new Date(Date.now() - 2 * 60 * 60 * 1000), duration: 20, userId: 'u1', userName: 'John Doe' },
]

let segments: Segment[] = [
  { id: '1', name: 'Hot Leads', description: 'Recently contacted hot leads', rules: [{ id: 'r1', field: 'status', operator: 'equals', value: 'hot' }], logic: 'and', contactCount: 2, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '2', name: 'Enterprise Customers', description: 'Enterprise tier customers', rules: [{ id: 'r2', field: 'tags', operator: 'contains', value: 'enterprise' }], logic: 'or', contactCount: 2, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '3', name: 'Needs Follow-up', description: 'Contacts not reached in 7+ days', rules: [{ id: 'r3', field: 'lastContact', operator: 'less_than', value: -7 }], logic: 'and', contactCount: 1, createdAt: new Date(), updatedAt: new Date(), isActive: false },
]

let tags: Tag[] = [
  { id: '1', name: 'hotel', color: '#9333ea', contactCount: 2 },
  { id: '2', name: 'restaurant', color: '#f97316', contactCount: 1 },
  { id: '3', name: 'retail', color: '#3b82f6', contactCount: 1 },
  { id: '4', name: 'fitness', color: '#22c55e', contactCount: 1 },
  { id: '5', name: 'premium', color: '#eab308', contactCount: 2 },
  { id: '6', name: 'enterprise', color: '#ec4899', contactCount: 2 },
  { id: '7', name: 'smb', color: '#06b6d4', contactCount: 2 },
  { id: '8', name: 'decision-maker', color: '#8b5cf6', contactCount: 1 },
]

// Contact API
export async function getContacts(filters?: FilterOptions): Promise<PaginatedResponse<Contact>> {
  await delay(300)

  let filtered = [...contacts]

  if (filters?.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(c =>
      c.firstName.toLowerCase().includes(search) ||
      c.lastName.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search) ||
      c.company?.toLowerCase().includes(search)
    )
  }

  if (filters?.status?.length) {
    filtered = filtered.filter(c => filters.status!.includes(c.status))
  }

  if (filters?.tags?.length) {
    filtered = filtered.filter(c => c.tags.some(t => filters.tags!.includes(t)))
  }

  if (filters?.leadSource?.length) {
    filtered = filtered.filter(c => filters.leadSource!.includes(c.leadSource))
  }

  return {
    data: filtered,
    total: filtered.length,
    page: 1,
    limit: filtered.length,
    totalPages: 1,
  }
}

export async function getContact(id: string): Promise<ApiResponse<Contact>> {
  await delay(200)
  const contact = contacts.find(c => c.id === id)
  if (!contact) {
    return { success: false, error: 'Contact not found' }
  }
  return { success: true, data: contact }
}

export async function createContact(data: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Contact>> {
  await delay(300)
  const newContact: Contact = {
    ...data,
    id: String(contacts.length + 1),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  contacts.push(newContact)
  return { success: true, data: newContact, message: 'Contact created successfully' }
}

export async function updateContact(id: string, data: Partial<Contact>): Promise<ApiResponse<Contact>> {
  await delay(300)
  const index = contacts.findIndex(c => c.id === id)
  if (index === -1) {
    return { success: false, error: 'Contact not found' }
  }
  contacts[index] = { ...contacts[index], ...data, updatedAt: new Date() }
  return { success: true, data: contacts[index], message: 'Contact updated successfully' }
}

export async function deleteContact(id: string): Promise<ApiResponse<void>> {
  await delay(200)
  const index = contacts.findIndex(c => c.id === id)
  if (index === -1) {
    return { success: false, error: 'Contact not found' }
  }
  contacts.splice(index, 1)
  return { success: true, message: 'Contact deleted successfully' }
}

export async function addTagToContact(contactId: string, tag: string): Promise<ApiResponse<Contact>> {
  const contact = contacts.find(c => c.id === contactId)
  if (!contact) {
    return { success: false, error: 'Contact not found' }
  }
  if (!contact.tags.includes(tag)) {
    contact.tags.push(tag)
    contact.updatedAt = new Date()
  }
  return { success: true, data: contact }
}

export async function removeTagFromContact(contactId: string, tag: string): Promise<ApiResponse<Contact>> {
  const contact = contacts.find(c => c.id === contactId)
  if (!contact) {
    return { success: false, error: 'Contact not found' }
  }
  contact.tags = contact.tags.filter(t => t !== tag)
  contact.updatedAt = new Date()
  return { success: true, data: contact }
}

// Activity API
export async function getActivities(contactId?: string): Promise<Activity[]> {
  await delay(200)
  if (contactId) {
    return activities.filter(a => a.contactId === contactId).sort((a, b) => b.date.getTime() - a.date.getTime())
  }
  return [...activities].sort((a, b) => b.date.getTime() - a.date.getTime())
}

export async function createActivity(data: Omit<Activity, 'id'>): Promise<ApiResponse<Activity>> {
  await delay(300)
  const newActivity: Activity = {
    ...data,
    id: String(activities.length + 1),
  }
  activities.unshift(newActivity)

  // Update contact's lastContact
  const contact = contacts.find(c => c.id === data.contactId)
  if (contact) {
    contact.lastContact = data.date
  }

  return { success: true, data: newActivity, message: 'Activity logged successfully' }
}

// Note API
export async function getNotes(contactId: string): Promise<Note[]> {
  await delay(200)
  return []
}

export async function createNote(contactId: string, content: string): Promise<ApiResponse<Note>> {
  await delay(300)
  const newNote: Note = {
    id: String(Date.now()),
    contactId,
    content,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: 'u1',
    userName: 'Current User',
    isPinned: false,
  }
  return { success: true, data: newNote }
}

// Segment API
export async function getSegments(): Promise<Segment[]> {
  await delay(200)
  return [...segments]
}

export async function createSegment(data: Omit<Segment, 'id' | 'createdAt' | 'updatedAt' | 'contactCount'>): Promise<ApiResponse<Segment>> {
  await delay(300)
  const newSegment: Segment = {
    ...data,
    id: String(segments.length + 1),
    contactCount: Math.floor(Math.random() * 50) + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  segments.push(newSegment)
  return { success: true, data: newSegment, message: 'Segment created successfully' }
}

export async function updateSegment(id: string, data: Partial<Segment>): Promise<ApiResponse<Segment>> {
  await delay(300)
  const index = segments.findIndex(s => s.id === id)
  if (index === -1) {
    return { success: false, error: 'Segment not found' }
  }
  segments[index] = { ...segments[index], ...data, updatedAt: new Date() }
  return { success: true, data: segments[index], message: 'Segment updated successfully' }
}

export async function deleteSegment(id: string): Promise<ApiResponse<void>> {
  await delay(200)
  const index = segments.findIndex(s => s.id === id)
  if (index === -1) {
    return { success: false, error: 'Segment not found' }
  }
  segments.splice(index, 1)
  return { success: true, message: 'Segment deleted successfully' }
}

// Tag API
export async function getTags(): Promise<Tag[]> {
  await delay(100)
  return [...tags]
}

// Export/Import
export async function exportContacts(options: ExportOptions): Promise<Blob> {
  await delay(500)
  const { data } = await getContacts()

  let csv = ''
  const fields = options.fields || ['firstName', 'lastName', 'email', 'phone', 'company', 'status', 'tags']

  csv += fields.join(',') + '\n'

  data.forEach(contact => {
    const row = fields.map(field => {
      const value = contact[field as keyof Contact]
      if (Array.isArray(value)) return `"${value.join(';')}"`
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`
      return value
    })
    csv += row.join(',') + '\n'
  })

  return new Blob([csv], { type: 'text/csv' })
}

export async function importContacts(file: File): Promise<ImportResult> {
  await delay(1000)
  // Simplified demo - just return success
  return { success: 10, failed: 0, errors: [] }
}

// Stats
export async function getStats() {
  await delay(200)
  return {
    totalContacts: contacts.length,
    hotLeads: contacts.filter(c => c.status === 'hot').length,
    warmLeads: contacts.filter(c => c.status === 'warm').length,
    coldLeads: contacts.filter(c => c.status === 'cold').length,
    activeContacts: contacts.filter(c => c.status === 'active').length,
    activitiesThisWeek: activities.filter(a => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return a.date > weekAgo
    }).length,
  }
}
