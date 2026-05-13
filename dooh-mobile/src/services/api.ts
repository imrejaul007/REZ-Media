// dooh-mobile API service

import { Screen, Earnings, ApiResponse } from '../types';

const API_BASE = process.env.EXPO_PUBLIC_DOOH_API_URL || 'http://localhost:4004';

async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T> {
  const token = ''; // Would get from secure storage
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Mock data for development
const mockScreens: Screen[] = [
  { id: '1', name: 'Lobby Display', location: 'Hotel Reception', type: 'led', status: 'online', impressions: 12450, clicks: 234, earnings: 4500, todayEarnings: 234.50, lastUpdated: '2 min ago' },
  { id: '2', name: 'Restaurant Screen', location: 'Cafe Corner', type: 'tablet', status: 'online', impressions: 8920, clicks: 156, earnings: 2800, todayEarnings: 156.00, lastUpdated: '5 min ago' },
  { id: '3', name: 'Gym Entrance', location: 'Fitness Center', type: 'kiosk', status: 'offline', impressions: 0, clicks: 0, earnings: 0, todayEarnings: 0, lastUpdated: '1 hour ago' },
];

const mockEarnings: Earnings = {
  total: 12500,
  pending: 2340,
  paid: 10160,
  thisMonth: 4500,
  history: [
    { id: '1', amount: 500, date: '2026-05-01', type: 'credit', status: 'completed', description: 'Weekly payout' },
    { id: '2', amount: 234.50, date: '2026-05-13', type: 'credit', status: 'pending', description: 'Today earnings' },
  ],
};

export const api = {
  async getScreens(): Promise<Screen[]> {
    try {
      const res = await fetchAPI<ApiResponse<{ screens: Screen[] }>(`${API_BASE}/api/screens`);
      return res.data?.screens || mockScreens;
    } catch {
      return mockScreens;
    }
  },

  async getScreen(id: string): Promise<Screen | null> {
    try {
      const res = await fetchAPI<ApiResponse<Screen>>(`${API_BASE}/api/screens/${id}`);
      return res.data;
    } catch {
      return mockScreens.find(s => s.id === id) || null;
    }
  },

  async getEarnings(): Promise<Earnings> {
    try {
      const res = await fetchAPI<ApiResponse<Earnings>>(`${API_BASE}/api/earnings`);
      return res.data;
    } catch {
      return mockEarnings;
    }
  },

  async toggleScreen(id: string, status: 'online' | 'offline'): Promise<boolean> {
    try {
      await fetchAPI(`${API_BASE}/api/screens/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      return true;
    } catch {
      return true; // Mock success
    }
  },
};
