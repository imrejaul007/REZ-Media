import { Document, Types } from 'mongoose';

// Platform Types
export type Platform = 'zendesk' | 'freshdesk' | 'intercom' | 'rez';
export type TicketStatus = 'open' | 'pending' | 'on_hold' | 'solved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type Satisfaction = 'good' | 'bad';

// Requester/Contact Types
export interface IRequester {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  platform: Platform;
  platformContactId: string;
  metadata?: Record<string, unknown>;
}

export interface IAssignee {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  platform: Platform;
  platformAgentId: string;
  group?: string;
}

// Comment Types
export interface IComment {
  id: string;
  ticketId: string;
  platform: Platform;
  platformCommentId: string;
  author: {
    id: string;
    name: string;
    email: string;
    type: 'agent' | 'customer' | 'system';
  };
  body: string;
  htmlBody?: string;
  attachments: IAttachment[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface IAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

// Ticket Types
export interface IUnifiedTicket extends Document {
  id: string;
  platform: Platform;
  platformTicketId: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  requester: IRequester;
  assignee?: IAssignee;
  tags: string[];
  comments: Types.DocumentArray<IComment>;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  slaDeadline?: Date;
  satisfaction?: Satisfaction;
  linkedRezTicketId?: string;
  externalUrls: {
    platform: Platform;
    url: string;
  }[];
  metadata: Record<string, unknown>;
  customFields: Record<string, unknown>;
  isDeleted: boolean;
  version: number;
}

// Contact Types
export interface IUnifiedContact extends Document {
  id: string;
  platforms: {
    platform: Platform;
    platformContactId: string;
    externalUrl?: string;
  }[];
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  company?: {
    id: string;
    name: string;
    domain?: string;
  };
  tags: string[];
  totalTickets: number;
  openTickets: number;
  solvedTickets: number;
  lastContactAt?: Date;
  linkedRezUserId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
}

// Sync Log Types
export type SyncType = 'full' | 'incremental' | 'webhook';
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type SyncEntity = 'tickets' | 'contacts' | 'conversations' | 'comments';

export interface ISyncLog extends Document {
  id: string;
  syncType: SyncType;
  platform: Platform;
  entity: SyncEntity;
  status: SyncStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors: {
    itemId: string;
    error: string;
    timestamp: Date;
  }[];
  metadata: Record<string, unknown>;
}

// Configuration Types
export interface IFieldMapping {
  id: string;
  platform: Platform;
  fieldName: string;
  targetField: string;
  transformType?: 'direct' | 'mapping' | 'function';
  transformConfig?: Record<string, unknown>;
  isActive: boolean;
}

export interface ISlaMapping {
  id: string;
  platform: Platform;
  platformSlaName: string;
  targetPriority: TicketPriority;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  isActive: boolean;
}

export interface IAgentMapping {
  id: string;
  platform: Platform;
  platformAgentId: string;
  platformAgentName: string;
  platformAgentEmail: string;
  rezUserId?: string;
  isActive: boolean;
}

export interface IPlatformCredentials {
  platform: Platform;
  isConnected: boolean;
  connectedAt?: Date;
  lastSyncAt?: Date;
  credentials: {
    [key: string]: string;
  };
  config: Record<string, unknown>;
}

// API Request/Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface SyncStatusResponse {
  platform: Platform;
  lastSyncAt?: Date;
  status: SyncStatus;
  itemsProcessed: number;
  errors: number;
}

export interface ConnectRequest {
  platform: Platform;
  credentials: {
    subdomain?: string;
    email?: string;
    apiToken?: string;
    domain?: string;
    apiKey?: string;
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export interface ConnectResponse {
  success: boolean;
  platform: Platform;
  message: string;
  connectedAt?: Date;
}

export interface CommentRequest {
  body: string;
  isPublic: boolean;
  attachments?: File[];
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface StatusUpdateRequest {
  status: TicketStatus;
  comment?: string;
}

export interface AssignRequest {
  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;
}

export interface LinkTicketRequest {
  rezTicketId: string;
  linkType?: 'related' | 'parent' | 'child';
}

export interface FieldMappingRequest {
  platform: Platform;
  fieldMappings: {
    fieldName: string;
    targetField: string;
    transformType?: 'direct' | 'mapping' | 'function';
    transformConfig?: Record<string, unknown>;
  }[];
}

export interface SlaMappingRequest {
  platform: Platform;
  slaMappings: {
    platformSlaName: string;
    targetPriority: TicketPriority;
    responseTimeMinutes: number;
    resolutionTimeMinutes: number;
  }[];
}

// Zendesk API Types
export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  requester_id: number;
  assignee_id: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  satisfaction_rating?: {
    score: string;
  };
  custom_fields?: Record<string, unknown>;
  url: string;
}

export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  phone?: string;
  photo?: {
    content_url: string;
  };
  organization_id?: number;
  user_fields?: Record<string, unknown>;
}

export interface ZendeskComment {
  id: number;
  type: string;
  author_id: number;
  body: string;
  html_body: string;
  public: boolean;
  created_at: string;
  attachments?: {
    id: number;
    file_name: string;
    content_type: string;
    size: number;
    content_url: string;
    thumbnail_url?: string;
  }[];
}

export interface ZendeskSatisfactionRating {
  id: number;
  score: 'good' | 'bad' | 'offered' | 'unoffered';
  comment?: string;
  created_at: string;
  updated_at: string;
}

// Freshdesk API Types
export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  status: number;
  priority: number;
  requester_id: number;
  responder_id?: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  satisfaction_rating?: {
    rating: number;
  };
  custom_fields?: Record<string, unknown>;
  url: string;
}

export interface FreshdeskContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  company_id?: number;
  view_all_tickets: boolean;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskCompany {
  id: number;
  name: string;
  description?: string;
  domains?: string[];
  created_at: string;
  updated_at: string;
}

export interface FreshdeskConversation {
  id: number;
  ticket_id: number;
  body: string;
  body_text: string;
  user_id: number;
  incoming: boolean;
  created_at: string;
  updated_at: string;
  attachments?: {
    id: number;
    name: string;
    content_type: string;
    size: number;
    attachment_url: string;
  }[];
}

export interface FreshdeskProduct {
  id: number;
  name: string;
  description?: string;
  status: number;
  created_at: string;
  updated_at: string;
}

// Intercom API Types
export interface IntercomConversation {
  id: string;
  state: string;
  title?: string;
  created_at: number;
  updated_at: number;
  waiting_since?: number;
  source: {
    type: string;
    id: string;
    delivered_as: string;
    subject?: string;
    body: string;
    author: {
      type: string;
      id: string;
      name?: string;
      email?: string;
    };
  };
  contacts: {
    type: string;
    contacts: Array<{
      type: string;
      id: string;
    }>;
  };
  assignee?: {
    type: string;
    id?: string;
    name?: string;
    email?: string;
  };
  tags?: {
    type: string;
    tags: Array<{
      type: string;
      id: string;
      name: string;
    }>;
  };
  custom_attributes?: Record<string, unknown>;
  statistics?: {
    type: string;
    time_to_assignment?: number;
    time_to_admin_reply?: number;
    time_to_first_close?: number;
    time_to_last_close?: number;
    median_time_to_reply?: number;
    first_contact_reply_at?: number;
    first_assignment_at?: number;
    first_admin_reply_at?: number;
    priority?: string;
  };
}

export interface IntercomContact {
  id: string;
  type: 'lead' | 'user';
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  owner_id?: number;
  social_profiles?: {
    data: Array<{
      type: string;
      name: string;
      url: string;
    }>;
  };
  tags?: {
    type: string;
    data: Array<{
      type: string;
      id: string;
      name: string;
    }>;
  };
  companies?: {
    type: string;
    companies: Array<{
      type: string;
      id: string;
      name: string;
    }>;
  };
  created_at: number;
  updated_at: number;
  last_seen_at?: number;
  last_contacted_at?: number;
  last_email_opened_at?: number;
  last_email_clicked_at?: number;
  language_override?: string;
  unsubscribed_from_emails: boolean;
}

export interface IntercomMessage {
  id: string;
  type: string;
  subject?: string;
  body: string;
  created_at: number;
  updated_at: number;
  read: boolean;
  author: {
    type: string;
    id: string;
    name?: string;
    email?: string;
  };
  attachments?: {
    type: string;
    name: string;
    url: string;
    content_type: string;
    filesize: number;
  }[];
}

export interface IntercomTag {
  id: string;
  name: string;
  type: string;
  created_at: number;
  updated_at: number;
}

export interface IntercomTeam {
  id: string;
  name: string;
  type: string;
  created_at: number;
  updated_at: number;
}

export interface IntercomAdmin {
  id: string;
  name: string;
  email: string;
  away_mode_enabled?: boolean;
  away_mode_reassign?: boolean;
  has_inbox_access: boolean;
  team_ids?: string[];
}

// Webhook Types
export interface WebhookPayload {
  platform: Platform;
  event: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ZendeskWebhookPayload {
  webhook_id: string;
  account_id: string;
  detail: {
    ticket_id: number;
    ticket_subject: string;
    event_type: string;
  };
}

export interface FreshdeskWebhookPayload {
  id: string;
  ticket_id: number;
  ticket_status: number;
  ticket_priority: number;
  ticket_updated_at: string;
}

export interface IntercomWebhookPayload {
  type: string;
  id: string;
  created_at: number;
  data: {
    type: string;
    id: string;
    item: Record<string, unknown>;
  };
  topic: string;
}

// Queue Types
export interface SyncJob {
  id: string;
  platform: Platform;
  entity: SyncEntity;
  type: SyncType;
  params?: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

// Error Types
export class PlatformError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public statusCode: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export class SyncError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public entity: SyncEntity,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export class MappingError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public fieldName: string
  ) {
    super(message);
    this.name = 'MappingError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
