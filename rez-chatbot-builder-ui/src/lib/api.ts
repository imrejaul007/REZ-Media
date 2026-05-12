import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { Flow, WhatsAppConnection, ApiResponse } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

class ChatbotApi {
  private client: AxiosInstance
  private internalToken: string

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.internalToken = process.env.INTERNAL_SERVICE_TOKEN || ''

    this.client.interceptors.request.use((config) => {
      if (this.internalToken) {
        config.headers['X-Internal-Token'] = this.internalToken
      }
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown>>) => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  setAuthToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token)
    }
  }

  clearAuthToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken')
    }
  }

  // Flow CRUD operations
  async getFlows(): Promise<ApiResponse<Flow[]>> {
    const response = await this.client.get('/api/chatbot/flows')
    return response.data
  }

  async getFlow(id: string): Promise<ApiResponse<Flow>> {
    const response = await this.client.get(`/api/chatbot/flows/${id}`)
    return response.data
  }

  async createFlow(flow: Omit<Flow, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Flow>> {
    const response = await this.client.post('/api/chatbot/flows', flow)
    return response.data
  }

  async updateFlow(id: string, flow: Partial<Flow>): Promise<ApiResponse<Flow>> {
    const response = await this.client.put(`/api/chatbot/flows/${id}`, flow)
    return response.data
  }

  async deleteFlow(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/api/chatbot/flows/${id}`)
    return response.data
  }

  async saveFlow(flow: Flow): Promise<ApiResponse<Flow>> {
    const existing = await this.getFlow(flow.id).catch(() => null)
    if (existing?.success && existing.data) {
      return this.updateFlow(flow.id, flow)
    }
    return this.createFlow(flow)
  }

  async publishFlow(id: string): Promise<ApiResponse<Flow>> {
    const response = await this.client.post(`/api/chatbot/flows/${id}/publish`)
    return response.data
  }

  async unpublishFlow(id: string): Promise<ApiResponse<Flow>> {
    const response = await this.client.post(`/api/chatbot/flows/${id}/unpublish`)
    return response.data
  }

  // WhatsApp integration
  async getWhatsAppConnection(): Promise<ApiResponse<WhatsAppConnection>> {
    const response = await this.client.get('/api/chatbot/whatsapp')
    return response.data
  }

  async connectWhatsApp(phoneNumberId: string): Promise<ApiResponse<WhatsAppConnection>> {
    const response = await this.client.post('/api/chatbot/whatsapp/connect', { phoneNumberId })
    return response.data
  }

  async disconnectWhatsApp(): Promise<ApiResponse<void>> {
    const response = await this.client.post('/api/chatbot/whatsapp/disconnect')
    return response.data
  }

  async linkFlowToWhatsApp(flowId: string, phoneNumberId: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/api/chatbot/whatsapp/link', { flowId, phoneNumberId })
    return response.data
  }

  async unlinkFlowFromWhatsApp(phoneNumberId: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/api/chatbot/whatsapp/unlink', { phoneNumberId })
    return response.data
  }

  // Webhook simulation for preview
  async testWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    const response = await this.client.post('/api/chatbot/test-webhook', { webhookUrl, payload })
    return response.data
  }

  // Export flow
  async exportFlow(id: string, format: 'json' | 'yaml' = 'json'): Promise<ApiResponse<string>> {
    const response = await this.client.get(`/api/chatbot/flows/${id}/export`, {
      params: { format },
    })
    return response.data
  }

  // Import flow
  async importFlow(data: string, format: 'json' | 'yaml' = 'json'): Promise<ApiResponse<Flow>> {
    const response = await this.client.post('/api/chatbot/flows/import', { data, format })
    return response.data
  }
}

export const api = new ChatbotApi()

// React Query hooks
export const flowKeys = {
  all: ['flows'] as const,
  detail: (id: string) => ['flows', id] as const,
  whatsapp: ['whatsapp'] as const,
}

export function getFlowsQueryOptions() {
  return {
    queryKey: flowKeys.all,
    queryFn: () => api.getFlows(),
    staleTime: 1000 * 60 * 5,
  }
}

export function getFlowQueryOptions(id: string) {
  return {
    queryKey: flowKeys.detail(id),
    queryFn: () => api.getFlow(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  }
}

export function getWhatsAppQueryOptions() {
  return {
    queryKey: flowKeys.whatsapp,
    queryFn: () => api.getWhatsAppConnection(),
    staleTime: 1000 * 60 * 5,
  }
}
