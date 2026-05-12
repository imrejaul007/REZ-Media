/**
 * REZ Marketing Dashboard - API Integration
 *
 * Connects to:
 * - REZ-ads-service (Ad campaigns, AdBazaar)
 * - REZ-marketing (Broadcasts, segments)
 * - REZ-communications-platform (WhatsApp, SMS, Email, Push)
 * - REZ-intelligence (AI segments, recommendations)
 * - rez-whatsapp-store (WhatsApp commerce)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const ADS_SERVICE = process.env.NEXT_PUBLIC_ADS_SERVICE_URL || 'http://localhost:4007'
const COMMUNICATIONS = process.env.NEXT_PUBLIC_COMMUNICATIONS_URL || 'http://localhost:3009'
const WHATSAPP_STORE = process.env.NEXT_PUBLIC_WHATSAPP_STORE_URL || 'http://localhost:4005'

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

// ============================================================================
// AdBazaar API (via ads-service)
// ============================================================================

export interface AdBazaarAd {
  id: string
  merchantId: string
  title: string
  headline: string
  description: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  placement: 'home_banner' | 'explore_feed' | 'store_listing' | 'search_result'
  bidType: 'CPC' | 'CPM'
  bidAmount: number
  dailyBudget: number
  totalBudget: number
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'rejected' | 'completed'
  impressions: number
  clicks: number
  conversions: number
}

export const adbazaarAPI = {
  // Ads
  listAds: (params?: { status?: string; page?: number }) =>
    fetchAPI<{ data: AdBazaarAd[]; pagination: { total: number } }>(
      `${ADS_SERVICE}/api/ads?${new URLSearchParams(params as Record<string, string>)}`
    ),

  createAd: (data: Omit<AdBazaarAd, 'id' | 'merchantId' | 'status' | 'impressions' | 'clicks' | 'conversions'>) =>
    fetchAPI<AdBazaarAd>(`${ADS_SERVICE}/api/ads`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAd: (id: string, data: Partial<AdBazaarAd>) =>
    fetchAPI<AdBazaarAd>(`${ADS_SERVICE}/api/ads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  pauseAd: (id: string) =>
    fetchAPI<AdBazaarAd>(`${ADS_SERVICE}/api/ads/${id}/pause`, { method: 'PUT' }),

  activateAd: (id: string) =>
    fetchAPI<AdBazaarAd>(`${ADS_SERVICE}/api/ads/${id}/activate`, { method: 'PUT' }),

  deleteAd: (id: string) =>
    fetchAPI<void>(`${ADS_SERVICE}/api/ads/${id}`, { method: 'DELETE' }),

  // Analytics
  getAdAnalytics: (id: string) =>
    fetchAPI<{ impressions: number; clicks: number; conversions: number; ctr: number; spend: number }>(
      `${ADS_SERVICE}/api/ads/${id}/analytics`
    ),

  getMerchantAnalytics: () =>
    fetchAPI<{ totalImpressions: number; totalClicks: number; totalConversions: number; totalSpend: number }>(
      `${ADS_SERVICE}/api/ads/analytics`
    ),

  // Marketplace
  getMarketplaceAds: (params?: { placement?: string; segment?: string }) =>
    fetchAPI<AdBazaarAd[]>(
      `${ADS_SERVICE}/api/ads/marketplace?${new URLSearchParams(params as Record<string, string>)}`
    ),
}

// ============================================================================
// Wallet API (via rez-wallet-service)
// ============================================================================

export interface WalletBalance {
  available: number
  reserved: number
  total: number
}

export interface WalletReservation {
  reservationId: string
  amount: number
  purpose: string
  campaignId?: string
  createdAt: string
}

export interface WalletTransaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  reason: string
  balanceAfter: number
  createdAt: string
}

const WALLET_SERVICE = process.env.NEXT_PUBLIC_WALLET_SERVICE_URL || 'http://localhost:4002'

export const walletAPI = {
  // Get balance
  getBalance: (merchantId: string) =>
    fetchAPI<WalletBalance>(`${WALLET_SERVICE}/api/wallet/balance/${merchantId}`),

  // Reserve funds for campaign
  reserve: (data: {
    merchantId: string
    amount: number
    campaignId?: string
    purpose: string
  }) =>
    fetchAPI<WalletReservation>(`${WALLET_SERVICE}/api/wallet/reserve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Release reservation
  release: (reservationId: string) =>
    fetchAPI<{ success: boolean }>(`${WALLET_SERVICE}/api/wallet/release/${reservationId}`, {
      method: 'POST',
    }),

  // Deduct from wallet
  deduct: (data: {
    merchantId: string
    amount: number
    reason: string
    campaignId?: string
  }) =>
    fetchAPI<{ success: boolean; newBalance: number }>(`${WALLET_SERVICE}/api/wallet/deduct`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Add funds
  deposit: (data: {
    merchantId: string
    amount: number
    paymentMethod: string
  }) =>
    fetchAPI<{ success: boolean; newBalance: number }>(`${WALLET_SERVICE}/api/wallet/deposit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get transactions
  getTransactions: (merchantId: string, limit = 50) =>
    fetchAPI<{ transactions: WalletTransaction[] }>(
      `${WALLET_SERVICE}/api/wallet/transactions/${merchantId}?limit=${limit}`
    ),

  // Auto-recharge settings
  getAutoRecharge: (merchantId: string) =>
    fetchAPI<{ enabled: boolean; threshold: number; amount: number }>(
      `${WALLET_SERVICE}/api/wallet/auto-recharge/${merchantId}`
    ),

  setAutoRecharge: (merchantId: string, settings: { enabled: boolean; threshold: number; amount: number }) =>
    fetchAPI<{ success: boolean }>(`${WALLET_SERVICE}/api/wallet/auto-recharge/${merchantId}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
}

// ============================================================================
// Campaign Creator API (Create unified campaigns)
// ============================================================================

export interface UnifiedCampaignRequest {
  merchantId: string
  types: string[]
  channels: string[]
  budget: number
  duration: number
  location: string
  targeting: string
  name: string
  startDate: string
}

export interface UnifiedCampaignResponse {
  campaignId: string
  reservations: WalletReservation[]
  totalReserved: number
  estimatedCost: number
  channels: {
    type: string
    channelId: string
    budget: number
  }[]
}

export const campaignAPI = {
  // Create unified campaign (reserves wallet, creates all sub-campaigns)
  createUnified: (data: UnifiedCampaignRequest) =>
    fetchAPI<UnifiedCampaignResponse>('/api/campaigns/unified', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get unified campaign status
  getStatus: (campaignId: string) =>
    fetchAPI<{
      id: string
      status: string
      subCampaigns: { type: string; status: string; spent: number }[]
      walletUsage: { reserved: number; spent: number; remaining: number }
    }>(`/api/campaigns/${campaignId}/status`),

  // Pause campaign
  pause: (campaignId: string) =>
    fetchAPI<{ success: boolean }>(`/api/campaigns/${campaignId}/pause`, { method: 'POST' }),

  // Resume campaign
  resume: (campaignId: string) =>
    fetchAPI<{ success: boolean }>(`/api/campaigns/${campaignId}/resume`, { method: 'POST' }),

  // Cancel campaign (releases reservations)
  cancel: (campaignId: string) =>
    fetchAPI<{ success: boolean; refundedAmount: number }>(`/api/campaigns/${campaignId}/cancel`, {
      method: 'POST',
    }),
}

// ============================================================================
// WhatsApp Commerce API (via rez-whatsapp-store)
// ============================================================================

export interface WhatsAppProduct {
  id: string
  merchantId: string
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  inStock: boolean
}

export interface WhatsAppCart {
  id: string
  userId: string
  items: { productId: string; quantity: number }[]
  total: number
  deliveryFee: number
}

export const whatsappCommerceAPI = {
  // Catalog
  listProducts: (params?: { category?: string; search?: string }) =>
    fetchAPI<WhatsAppProduct[]>(
      `${WHATSAPP_STORE}/api/catalog?${new URLSearchParams(params as Record<string, string>)}`
    ),

  getProduct: (id: string) =>
    fetchAPI<WhatsAppProduct>(`${WHATSAPP_STORE}/api/catalog/${id}`),

  // Cart
  getCart: (userId: string) =>
    fetchAPI<WhatsAppCart>(`${WHATSAPP_STORE}/api/cart/${userId}`),

  addToCart: (userId: string, productId: string, quantity: number) =>
    fetchAPI<WhatsAppCart>(`${WHATSAPP_STORE}/api/cart/${userId}/add`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    }),

  // Checkout
  initiateCheckout: (userId: string, address: { line1: string; city: string; pincode: string }) =>
    fetchAPI<{ checkoutId: string; paymentUrl: string }>(`${WHATSAPP_STORE}/api/checkout/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  // Orders
  getOrders: (userId: string) =>
    fetchAPI<{ id: string; status: string; total: number; createdAt: string }[]>(
      `${WHATSAPP_STORE}/api/orders/${userId}`
    ),

  getOrderStatus: (orderId: string) =>
    fetchAPI<{ status: string; trackingUrl?: string }>(`${WHATSAPP_STORE}/api/orders/${orderId}/status`),
}
