const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

interface DashboardStats {
  totalMerchants: number;
  activeMerchants: number;
  pendingMerchants: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalRevenue: number;
  revenueChange: number;
  totalImpressions: number;
  impressionsChange: number;
  totalClicks: number;
  clicksChange: number;
}

interface Merchant {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  joinedAt: string;
  totalCampaigns: number;
  totalSpent: number;
  lastActiveAt: string;
}

interface Campaign {
  id: string;
  name: string;
  merchantId: string;
  merchantName: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'rejected';
  type: 'display' | 'video' | 'native' | 'sponsored';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

interface RevenueData {
  date: string;
  revenue: number;
  impressions: number;
  clicks: number;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: 'merchant' | 'campaign' | 'user' | 'system';
  entityId: string;
  performedBy: string;
  performedAt: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  ipAddress: string;
}

class AdminApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new AdminApiError(response.status, error.message || 'Request failed');
  }
  return response.json();
}

async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

async function put<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

async function del<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });
  return handleResponse<T>(response);
}

// Dashboard API
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return get<ApiResponse<DashboardStats>>('/admin/dashboard/stats');
}

// Merchant API
export async function getMerchants(
  params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ merchants: Merchant[]; total: number; page: number; totalPages: number }>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return get<ApiResponse<{ merchants: Merchant[]; total: number; page: number; totalPages: number }>>(
    `/admin/merchants${query ? `?${query}` : ''}`
  );
}

export async function getMerchantById(id: string): Promise<ApiResponse<Merchant>> {
  return get<ApiResponse<Merchant>>(`/admin/merchants/${id}`);
}

export async function approveMerchant(id: string): Promise<ApiResponse<Merchant>> {
  return put<ApiResponse<Merchant>>(`/admin/merchants/${id}/approve`, {});
}

export async function rejectMerchant(id: string, reason: string): Promise<ApiResponse<Merchant>> {
  return put<ApiResponse<Merchant>>(`/admin/merchants/${id}/reject`, { reason });
}

export async function suspendMerchant(id: string, reason: string): Promise<ApiResponse<Merchant>> {
  return put<ApiResponse<Merchant>>(`/admin/merchants/${id}/suspend`, { reason });
}

// Campaign API
export async function getCampaigns(
  params?: {
    status?: string;
    merchantId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ campaigns: Campaign[]; total: number; page: number; totalPages: number }>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.merchantId) searchParams.set('merchantId', params.merchantId);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return get<ApiResponse<{ campaigns: Campaign[]; total: number; page: number; totalPages: number }>>(
    `/admin/campaigns${query ? `?${query}` : ''}`
  );
}

export async function getCampaignById(id: string): Promise<ApiResponse<Campaign>> {
  return get<ApiResponse<Campaign>>(`/admin/campaigns/${id}`);
}

export async function approveCampaign(id: string): Promise<ApiResponse<Campaign>> {
  return put<ApiResponse<Campaign>>(`/admin/campaigns/${id}/approve`, {});
}

export async function rejectCampaign(id: string, reason: string): Promise<ApiResponse<Campaign>> {
  return put<ApiResponse<Campaign>>(`/admin/campaigns/${id}/reject`, { reason });
}

export async function pauseCampaign(id: string): Promise<ApiResponse<Campaign>> {
  return put<ApiResponse<Campaign>>(`/admin/campaigns/${id}/pause`, {});
}

export async function resumeCampaign(id: string): Promise<ApiResponse<Campaign>> {
  return put<ApiResponse<Campaign>>(`/admin/campaigns/${id}/resume`, {});
}

// Revenue API
export async function getRevenueStats(
  params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }
): Promise<ApiResponse<{ data: RevenueData[]; total: number; average: number }>> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.groupBy) searchParams.set('groupBy', params.groupBy);

  const query = searchParams.toString();
  return get<ApiResponse<{ data: RevenueData[]; total: number; average: number }>>(
    `/admin/revenue/stats${query ? `?${query}` : ''}`
  );
}

export async function getRevenueByMerchant(): Promise<ApiResponse<{ merchantId: string; name: string; revenue: number }[]>> {
  return get<ApiResponse<{ merchantId: string; name: string; revenue: number }[]>>('/admin/revenue/by-merchant');
}

export async function getRevenueByCampaignType(): Promise<ApiResponse<{ type: string; revenue: number }[]>> {
  return get<ApiResponse<{ type: string; revenue: number }[]>>('/admin/revenue/by-type');
}

// Audit Log API
export async function getAuditLogs(
  params?: {
    entityType?: string;
    action?: string;
    performedBy?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }
): Promise<ApiResponse<{ logs: AuditLog[]; total: number; page: number; totalPages: number }>> {
  const searchParams = new URLSearchParams();
  if (params?.entityType) searchParams.set('entityType', params.entityType);
  if (params?.action) searchParams.set('action', params.action);
  if (params?.performedBy) searchParams.set('performedBy', params.performedBy);
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return get<ApiResponse<{ logs: AuditLog[]; total: number; page: number; totalPages: number }>>(
    `/admin/audit${query ? `?${query}` : ''}`
  );
}

export { AdminApiError };
export type { DashboardStats, Merchant, Campaign, RevenueData, AuditLog };
