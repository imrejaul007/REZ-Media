import { z } from 'zod';

// ============================================
// Enums
// ============================================

export enum CRMProvider {
  HUBSPOT = 'hubspot',
  ZOHO = 'zoho',
}

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SyncDirection {
  IMPORT = 'import',
  EXPORT = 'export',
  BIDIRECTIONAL = 'bidirectional',
}

export enum ContactSyncStatus {
  SYNCED = 'synced',
  PENDING = 'pending',
  CONFLICT = 'conflict',
  ERROR = 'error',
}

export enum DealStage {
  APPOINTMENT_SCHEDULED = 'appointment_scheduled',
  QUALIFIED_TO_BUY = 'qualified_to_buy',
  PRESENTATION_SCHEDULED = 'presentation_scheduled',
  DECISION_MAKER_BOUGHT_IN = 'decision_maker_bought_in',
  CONTRACT_SENT = 'contract_sent',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',
}

// ============================================
// Basic Types
// ============================================

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Phone {
  type?: 'work' | 'home' | 'mobile' | 'other';
  number: string;
  isPrimary: boolean;
}

export interface Email {
  type?: 'work' | 'home' | 'other';
  address: string;
  isPrimary: boolean;
}

// ============================================
// Zod Schemas
// ============================================

export const AddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export const PhoneSchema = z.object({
  type: z.enum(['work', 'home', 'mobile', 'other']).optional(),
  number: z.string(),
  isPrimary: z.boolean().default(false),
});

export const EmailSchema = z.object({
  type: z.enum(['work', 'home', 'other']).optional(),
  address: z.string().email(),
  isPrimary: z.boolean().default(false),
});

// ============================================
// OAuth Tokens
// ============================================

export const OAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number(),
  tokenType: z.string().default('Bearer'),
  scope: z.string().optional(),
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

// ============================================
// Unified Contact Model
// ============================================

export const CRMContactSchema = z.object({
  _id: z.string().optional(),
  externalId: z.string(),
  provider: z.nativeEnum(CRMProvider),
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: PhoneSchema.optional(),
  phones: z.array(PhoneSchema).default([]),
  emails: z.array(EmailSchema).default([]),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  address: AddressSchema.optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  lifecycleStage: z.string().optional(),
  leadSource: z.string().optional(),
  customFields: z.record(z.unknown()).default({}),
  syncStatus: z.nativeEnum(ContactSyncStatus).default(ContactSyncStatus.PENDING),
  lastSyncedAt: z.date().optional(),
  syncError: z.string().optional(),
  linkedRezUserId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type CRMContact = z.infer<typeof CRMContactSchema>;

// ============================================
// Unified Deal Model
// ============================================

export const CRMDealSchema = z.object({
  _id: z.string().optional(),
  externalId: z.string(),
  provider: z.nativeEnum(CRMProvider),
  title: z.string().min(1),
  amount: z.number().optional(),
  currency: z.string().default('USD'),
  stage: z.string(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.date().optional(),
  contactId: z.string().optional(),
  companyName: z.string().optional(),
  description: z.string().optional(),
  customFields: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type CRMDeal = z.infer<typeof CRMDealSchema>;

// ============================================
// Field Mapping Configuration
// ============================================

export const FieldMappingSchema = z.object({
  _id: z.string().optional(),
  provider: z.nativeEnum(CRMProvider),
  entityType: z.enum(['contact', 'deal']),
  crmToUnified: z.record(z.string()),
  unifiedToCrm: z.record(z.string()),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type FieldMapping = z.infer<typeof FieldMappingSchema>;

// ============================================
// Sync History
// ============================================

export const SyncHistorySchema = z.object({
  _id: z.string().optional(),
  provider: z.nativeEnum(CRMProvider),
  entityType: z.enum(['contact', 'deal']),
  direction: z.nativeEnum(SyncDirection),
  status: z.nativeEnum(SyncStatus),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  totalRecords: z.number().default(0),
  successCount: z.number().default(0),
  errorCount: z.number().default(0),
  errors: z.array(z.object({
    externalId: z.string(),
    error: z.string(),
    timestamp: z.date(),
  })).default([]),
  details: z.record(z.unknown()).default({}),
});

export type SyncHistory = z.infer<typeof SyncHistorySchema>;

// ============================================
// CRM Connection
// ============================================

export const CRMConnectionSchema = z.object({
  _id: z.string().optional(),
  provider: z.nativeEnum(CRMProvider),
  isConnected: z.boolean().default(false),
  tokens: OAuthTokensSchema.optional(),
  accountInfo: z.record(z.unknown()).optional(),
  lastSyncAt: z.date().optional(),
  syncEnabled: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type CRMConnection = z.infer<typeof CRMConnectionSchema>;

// ============================================
// API Request/Response Types
// ============================================

export interface CreateDealRequest {
  title: string;
  amount?: number;
  currency?: string;
  stage?: string;
  probability?: number;
  closeDate?: string;
  contactId?: string;
  companyName?: string;
  description?: string;
  provider?: CRMProvider;
}

export interface SyncTriggerRequest {
  provider?: CRMProvider;
  entityType?: 'contact' | 'deal';
  force?: boolean;
}

export interface LinkContactRequest {
  contactId: string;
  rezUserId: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ContactQueryParams extends PaginationParams {
  provider?: CRMProvider;
  syncStatus?: string;
  search?: string;
  linkedRezUserId?: string;
}

export interface DealQueryParams extends PaginationParams {
  provider?: CRMProvider;
  stage?: string;
  minAmount?: number;
  maxAmount?: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SyncStatusResponse {
  hubspot: {
    connected: boolean;
    lastSync: string | null;
    pendingContacts: number;
    pendingDeals: number;
  };
  zoho: {
    connected: boolean;
    lastSync: string | null;
    pendingContacts: number;
    pendingDeals: number;
  };
  activeSync: SyncHistory | null;
}
