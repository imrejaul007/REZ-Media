/**
 * Type definitions for REZ Voice Billing Service
 */

export enum CallStatus {
  INITIATED = 'initiated',
  CONNECTING = 'connecting',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  ENDED = 'ended',
  FAILED = 'failed',
  MISSED = 'missed',
}

export enum CallType {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}

export enum BillingStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum CallDirection {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}

export interface ICallSession {
  sessionId: string;
  callerId: string;
  calleeId: string;
  callerPhone?: string;
  calleePhone?: string;
  status: CallStatus;
  callType: CallType;
  startTime?: Date;
  endTime?: Date;
  duration: number; // in seconds
  billableDuration: number; // in seconds (rounded up to billing interval)
  onHoldDuration: number; // in seconds
  actualDuration: number; // in seconds (excludes on-hold)
  ratePerMinute: number;
  totalCost: number;
  billingStatus: BillingStatus;
  connectionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICallRecord {
  recordId: string;
  userId: string;
  date: Date; // aggregated by day
  totalCalls: number;
  totalDuration: number; // in seconds
  totalBillableDuration: number;
  totalCost: number;
  outboundCalls: number;
  inboundCalls: number;
  missedCalls: number;
  failedCalls: number;
  averageDuration: number;
  peakHour?: number; // hour of day with most calls
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserCreditBalance {
  userId: string;
  balance: number;
  currency: string;
  reservedBalance: number;
  lastUpdated: Date;
}

export interface IBillingTransaction {
  transactionId: string;
  sessionId: string;
  userId: string;
  amount: number;
  currency: string;
  status: BillingStatus;
  processedAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

export interface IUsageStats {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  totalSessions: number;
  totalDuration: number;
  totalCost: number;
  averageCallDuration: number;
  peakUsageHour: number;
  mostCalledNumber?: string;
  callSuccessRate: number;
}

export interface IAnalyticsSummary {
  userId: string;
  totalCalls: number;
  totalDuration: number;
  totalCost: number;
  averageCostPerCall: number;
  averageDurationPerCall: number;
  mostActiveDay: string;
  mostActiveHour: number;
  callSuccessRate: number;
  topDestinations: Array<{ destination: string; count: number; totalDuration: number }>;
}

export interface ICallSessionCreate {
  callerId: string;
  calleeId: string;
  callerPhone?: string;
  calleePhone?: string;
  callType: CallType;
  connectionId?: string;
  metadata?: Record<string, unknown>;
}

export interface ICallSessionUpdate {
  status?: CallStatus;
  endTime?: Date;
  duration?: number;
  onHoldDuration?: number;
  ratePerMinute?: number;
  billingStatus?: BillingStatus;
  metadata?: Record<string, unknown>;
}

export interface IPaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface IRateConfig {
  perMinute: number;
  perSecond: number;
  minimumCharge: number; // minimum billable duration in seconds
  billingInterval: number; // in seconds (e.g., 60 = bill by minute)
  currency: string;
}

export interface IWalletCreditResponse {
  success: boolean;
  transactionId?: string;
  balance?: number;
  message?: string;
}

export interface IWalletBalanceResponse {
  userId: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  currency: string;
}
