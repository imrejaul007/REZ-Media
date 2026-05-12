export type ContactStatus = 'hot' | 'warm' | 'cold' | 'active' | 'churned'

export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'sms' | 'task'

export type LeadSource = 'website' | 'referral' | 'social' | 'campaign' | 'other'

export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company?: string
  jobTitle?: string
  tags: string[]
  status: ContactStatus
  leadSource: LeadSource
  lastContact: Date
  createdAt: Date
  updatedAt: Date
  notes?: string
  address?: {
    street?: string
    city?: string
    state?: string
    zip?: string
    country?: string
  }
  customFields?: Record<string, string>
}

export interface Activity {
  id: string
  contactId: string
  type: ActivityType
  title: string
  description?: string
  date: Date
  duration?: number // in minutes
  userId: string
  userName: string
  metadata?: Record<string, unknown>
}

export interface Segment {
  id: string
  name: string
  description?: string
  rules: SegmentRule[]
  logic: 'and' | 'or'
  contactCount: number
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface SegmentRule {
  id: string
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in'
  value: string | string[] | number | [number, number]
}

export interface Note {
  id: string
  contactId: string
  content: string
  createdAt: Date
  updatedAt: Date
  userId: string
  userName: string
  isPinned: boolean
}

export interface Tag {
  id: string
  name: string
  color: string
  contactCount: number
}

export interface FilterOptions {
  search?: string
  status?: ContactStatus[]
  tags?: string[]
  leadSource?: LeadSource[]
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface PaginationOptions {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json'
  fields?: string[]
  filters?: FilterOptions
}

export interface ImportResult {
  success: number
  failed: number
  errors: Array<{ row: number; error: string }>
}
