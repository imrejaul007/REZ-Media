/**
 * REZ Marketing Dashboard - API Integration
 *
 * Connects to:
 * - REZ-ads-service (Ad campaigns)
 * - REZ-marketing (Broadcasts, segments)
 * - REZ-communications-platform (WhatsApp, SMS, Email, Push)
 * - REZ-intelligence (AI segments, recommendations)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const ADS_SERVICE = process.env.NEXT_PUBLIC_ADS_SERVICE_URL || 'http://localhost:4007'
const COMMUNICATIONS = process.env.NEXT_PUBLIC_COMMUNICATIONS_URL || 'http://localhost:3009'

// ============================================================================
// Types
// ============================================================================

export interface Campaign {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed'
  channel: 'whatsapp' | 'email' | 'sms' | 'push'
  budget: number
  spent: number
  impressions: number
  clicks: number
  conversions: number
  startDate: string
  endDate: string
}

export interface Broadcast {
  id: string
  name: string
  channel: 'whatsapp' | 'email' | 'sms' | 'push'
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  sent: number
  delivered: number
  opened: number
  clicked: number
  scheduledFor?: string
  createdAt: string
}

export interface Audience {
  id: string
  name: string
  description: string
  count: number
  source: 'ai' | 'rule' | 'behavior'
  rules?: SegmentRule[]
}

export interface SegmentRule {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: string | number
}

export interface CreateBroadcastRequest {
  name: string
  channel: 'whatsapp' | 'email' | 'sms' | 'push'
  audienceId: string
  content: {
    title?: string
    body: string
    imageUrl?: string
    ctaUrl?: string
  }
  scheduledFor?: string
}

export interface CreateCampaignRequest {
  name: string
  channel: 'whatsapp' | 'email' | 'sms' | 'push'
  audienceId: string
  budget: number
  startDate: string
  endDate: string
  content: {
    title: string
    body: string
    imageUrl?: string
    ctaUrl?: string
  }
}

// ============================================================================
// API Client
// ============================================================================

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('auth_token')
    : null

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// Campaign API
// ============================================================================

export const campaignAPI = {
  list: (params?: { status?: string; page?: number }) =>
    fetchAPI<{ data: Campaign[]; total: number }>(
      `/api/campaigns?${new URLSearchParams(params as Record<string, string>)}`
    ),

  get: (id: string) =>
    fetchAPI<Campaign>(`/api/campaigns/${id}`),

  create: (data: CreateCampaignRequest) =>
    fetchAPI<Campaign>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Campaign>) =>
    fetchAPI<Campaign>(`/api/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/campaigns/${id}`, { method: 'DELETE' }),

  pause: (id: string) =>
    fetchAPI<Campaign>(`/api/campaigns/${id}/pause`, { method: 'POST' }),

  resume: (id: string) =>
    fetchAPI<Campaign>(`/api/campaigns/${id}/resume`, { method: 'POST' }),
}

// ============================================================================
// Broadcast API
// ============================================================================

export const broadcastAPI = {
  list: (params?: { channel?: string; status?: string }) =>
    fetchAPI<{ data: Broadcast[] }>(
      `/api/broadcasts?${new URLSearchParams(params as Record<string, string>)}`
    ),

  get: (id: string) =>
    fetchAPI<Broadcast>(`/api/broadcasts/${id}`),

  create: (data: CreateBroadcastRequest) =>
    fetchAPI<Broadcast>('/api/broadcasts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  send: (id: string) =>
    fetchAPI<Broadcast>(`/api/broadcasts/${id}/send`, { method: 'POST' }),

  schedule: (id: string, scheduledFor: string) =>
    fetchAPI<Broadcast>(`/api/broadcasts/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledFor }),
    }),
}

// ============================================================================
// Audience API
// ============================================================================

export const audienceAPI = {
  list: () =>
    fetchAPI<{ data: Audience[] }>('/api/audiences'),

  get: (id: string) =>
    fetchAPI<Audience>(`/api/audiences/${id}`),

  create: (data: { name: string; description: string; rules: SegmentRule[] }) =>
    fetchAPI<Audience>('/api/audiences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<void>(`/api/audiences/${id}`, { method: 'DELETE' }),

  preview: (rules: SegmentRule[]) =>
    fetchAPI<{ count: number }>('/api/audiences/preview', {
      method: 'POST',
      body: JSON.stringify({ rules }),
    }),
}

// ============================================================================
// WhatsApp API (via Communications Platform)
// ============================================================================

export const whatsappAPI = {
  send: (data: { to: string; body: string; mediaUrl?: string }) =>
    fetchAPI<{ messageId: string }>(`${COMMUNICATIONS}/api/whatsapp/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendTemplate: (data: { to: string; templateId: string; variables: Record<string, string> }) =>
    fetchAPI<{ messageId: string }>(`${COMMUNICATIONS}/api/whatsapp/send-template`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// ============================================================================
// Analytics API
// ============================================================================

export const analyticsAPI = {
  overview: () =>
    fetchAPI<{
      reach: number
      impressions: number
      clicks: number
      conversions: number
    }>('/api/analytics/overview'),

  channelStats: () =>
    fetchAPI<Record<string, { sent: number; delivered: number; opened: number; clicked: number }>>(
      '/api/analytics/channels'
    ),

  weeklyStats: () =>
    fetchAPI<{ data: { day: string; reach: number; clicks: number; conversions: number }[] }>(
      '/api/analytics/weekly'
    ),
}

// ============================================================================
// AI Recommendations API
// ============================================================================

export const aiAPI = {
  recommendations: () =>
    fetchAPI<{
      suggestions: {
        type: 'segment' | 'timing' | 'content' | 'audience'
        title: string
        description: string
        confidence: number
      }[]
    }>('/api/ai/recommendations'),

  predictTiming: (audienceId: string) =>
    fetchAPI<{ optimalTime: string; reason: string }>(`/api/ai/predict-timing/${audienceId}`),
}
