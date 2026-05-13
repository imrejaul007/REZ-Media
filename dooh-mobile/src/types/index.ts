// dooh-mobile types

export interface Screen {
  id: string;
  name: string;
  location: string;
  type: 'led' | 'tablet' | 'kiosk';
  status: 'online' | 'offline' | 'maintenance';
  impressions: number;
  clicks: number;
  earnings: number;
  todayEarnings: number;
  lastUpdated: string;
}

export interface Earnings {
  total: number;
  pending: number;
  paid: number;
  thisMonth: number;
  history: Transaction[];
}

export interface Transaction {
  id: string;
  amount: number;
  date: string;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed';
  description: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
