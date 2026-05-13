export type WebSocketEvent =
  | 'campaign:updated'
  | 'metrics:refreshed'
  | 'alert:triggered'
  | 'broadcast:complete';

export interface WebSocketMessage<T = unknown> {
  event: WebSocketEvent;
  data: T;
  timestamp: string;
  roomId?: string;
}

export interface RoomSubscription {
  roomId: string;
  userId?: string;
  subscribedAt: Date;
}

export interface CampaignMetrics {
  campaignId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  budget: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  roi: number;
  lastUpdated: Date;
}

export interface Alert {
  id: string;
  type: 'budget_warning' | 'performance_drop' | 'anomaly_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  campaignId?: string;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
}

export interface BroadcastStatus {
  broadcastId: string;
  status: 'in_progress' | 'completed' | 'failed';
  totalRooms: number;
  roomsCompleted: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface LiveMetricsSnapshot {
  timestamp: Date;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
  activeCampaigns: number;
  campaigns: CampaignMetrics[];
}
