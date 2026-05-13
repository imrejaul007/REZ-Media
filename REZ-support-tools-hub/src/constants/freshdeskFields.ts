import { TicketStatus, TicketPriority } from '../types';

// Freshdesk status codes to Unified Ticket status mapping
export const FRESHDESK_STATUS_MAP: Record<number, TicketStatus> = {
  2: 'open',      // Open
  3: 'pending',    // Pending
  4: 'on_hold',    // On Hold
  5: 'solved',     // Resolved
  6: 'closed',     // Closed
};

// Unified Ticket status to Freshdesk status codes
export const FRESHDESK_REVERSE_STATUS_MAP: Record<TicketStatus, number> = {
  open: 2,
  pending: 3,
  on_hold: 4,
  solved: 5,
  closed: 6,
};

// Freshdesk priority codes to Unified Ticket priority mapping
export const FRESHDESK_PRIORITY_MAP: Record<number, TicketPriority> = {
  1: 'low',       // Low
  2: 'normal',    // Medium
  3: 'high',      // High
  4: 'urgent',    // Urgent
};

// Unified Ticket priority to Freshdesk priority codes
export const FRESHDESK_REVERSE_PRIORITY_MAP: Record<TicketPriority, number> = {
  low: 1,
  normal: 2,
  high: 3,
  urgent: 4,
};

// Freshdesk satisfaction rating mapping
export const FRESHDESK_SATISFACTION_MAP: Record<number, 'good' | 'bad'> = {
  1: 'good',  // Good
  2: 'bad',   // Bad
};

// Freshdesk conversation type mapping
export const FRESHDESK_CONVERSATION_TYPE_MAP = {
  0: 'reply',      // Reply
  1: 'note',       // Note (internal)
  2: 'forward',    // Forward
};

// Freshdesk product status
export const FRESHDESK_PRODUCT_STATUS = {
  1: 'active',
  2: 'inactive',
  3: 'draft',
};

// Field mappings from Freshdesk ticket to Unified Ticket
export const FRESHDESK_TICKET_FIELD_MAP = {
  subject: 'subject',
  description: 'description',
  status: 'status',
  priority: 'priority',
  requester_id: 'requester.platformContactId',
  responder_id: 'assignee.platformAgentId',
  tags: 'tags',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  satisfaction_rating: 'satisfaction',
  type: 'metadata.type',
  due_by: 'slaDeadline',
};

// Field mappings from Unified Ticket to Freshdesk ticket
export const FRESHDESK_TICKET_REVERSE_FIELD_MAP = {
  subject: 'ticket.subject',
  description: 'ticket.description',
  status: 'ticket.status',
  priority: 'ticket.priority',
  tags: 'ticket.tags',
  type: 'ticket.type',
  due_by: 'ticket.due_by',
};

// Freshdesk custom fields (common fields)
export const FRESHDESK_CUSTOM_FIELDS = {
  linkedRezTicketId: 'cf_rez_ticket_id',
  platform: 'cf_source_platform',
  customPriority: 'cf_custom_priority',
};

// Freshdesk API endpoints
export const FRESHDESK_ENDPOINTS = {
  tickets: '/tickets',
  ticketById: (id: number) => `/tickets/${id}`,
  ticketFields: '/ticket_fields',
  ticketConversations: (id: number) => `/tickets/${id}/conversations`,
  ticketAttachments: (id: number) => `/tickets/${id}/attachments`,
  contacts: '/contacts',
  contactById: (id: number) => `/contacts/${id}`,
  contactByEmail: (email: string) => `/contacts?email=${encodeURIComponent(email)}`,
  companies: '/companies',
  companyById: (id: number) => `/companies/${id}`,
  products: '/products',
  productById: (id: number) => `/products/${id}`,
  groups: '/groups',
  groupById: (id: number) => `/groups/${id}`,
  agents: '/agents',
  agentById: (id: number) => `/agents/${id}`,
  roles: '/roles',
  filters: '/filters',
  filterById: (id: number) => `/filters/${id}`,
  ticketsUpdatedSince: (since: string) => `/tickets?updated_since=${encodeURIComponent(since)}`,
  contactsUpdatedSince: (since: string) => `/contacts?updated_since=${encodeURIComponent(since)}`,
};

// Freshdesk webhook event types
export const FRESHDESK_WEBHOOK_EVENTS = {
  ticketCreated: 'create.ticket',
  ticketUpdated: 'update.ticket',
  ticketDeleted: 'delete.ticket',
  ticketStatusChanged: 'update.ticket_status',
  ticketPriorityChanged: 'update.ticket_priority',
  ticketReplyCreated: 'reply.ticket',
  noteCreated: 'note.ticket',
  contactCreated: 'create.user',
  contactUpdated: 'update.user',
};

// Freshdesk conversation channels
export const FRESHDESK_CHANNELS = {
  email: 'email',
  portal: 'portal',
  phone: 'phone',
  chat: 'chat',
  feedbackWidget: 'feedback_widget',
  outboundEmail: 'outbound_email',
  ecrm: 'ecrm',
  api: 'api',
};

// Freshdesk ticket sources
export const FRESHDESK_SOURCES = {
  email: 1,
  portal: 2,
  phone: 3,
  chat: 7,
  feedbackWidget: 9,
  outboundEmail: 10,
  eco: 11,
  api: 12,
};

// Create Freshdesk API client configuration
export function createFreshdeskClientConfig(domain: string, apiKey: string) {
  const baseUrl = `https://${domain}/api/v2`;
  const authHeader = `Basic ${Buffer.from(`${apiKey}:X`).toString('base64')}`;

  return {
    baseUrl,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
}

// Validate Freshdesk credentials format
export function validateFreshdeskCredentials(credentials: {
  domain?: string;
  apiKey?: string;
}): { valid: boolean; error?: string } {
  if (!credentials.domain || credentials.domain.trim() === '') {
    return { valid: false, error: 'Domain is required' };
  }

  if (!credentials.domain.includes('freshdesk.com')) {
    return { valid: false, error: 'Domain must be a Freshdesk domain (e.g., company.freshdesk.com)' };
  }

  if (!credentials.apiKey || credentials.apiKey.length < 10) {
    return { valid: false, error: 'Valid API key is required (min 10 characters)' };
  }

  return { valid: true };
}

// Default SLA mappings for Freshdesk
export const FRESHDESK_DEFAULT_SLA = {
  'Urgent': {
    priority: 'urgent' as TicketPriority,
    responseTimeMinutes: 15,
    resolutionTimeMinutes: 240,
  },
  'High': {
    priority: 'high' as TicketPriority,
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 480,
  },
  'Medium': {
    priority: 'normal' as TicketPriority,
    responseTimeMinutes: 240,
    resolutionTimeMinutes: 1440,
  },
  'Low': {
    priority: 'low' as TicketPriority,
    responseTimeMinutes: 480,
    resolutionTimeMinutes: 2880,
  },
};

// Freshdesk company domains
export const FRESHDESK_COMPANY_DOMAINS = {
  matchField: 'domains',
};
