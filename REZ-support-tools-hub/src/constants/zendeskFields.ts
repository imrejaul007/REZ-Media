import { Platform, TicketStatus, TicketPriority } from '../types';

// Zendesk to Unified Ticket status mapping
export const ZENDESK_STATUS_MAP: Record<string, TicketStatus> = {
  new: 'open',
  open: 'open',
  pending: 'pending',
  hold: 'on_hold',
  solved: 'solved',
  closed: 'closed',
};

// Unified Ticket status to Zendesk mapping
export const ZENDESK_REVERSE_STATUS_MAP: Record<TicketStatus, string> = {
  open: 'open',
  pending: 'pending',
  on_hold: 'hold',
  solved: 'solved',
  closed: 'closed',
};

// Zendesk to Unified Ticket priority mapping
export const ZENDESK_PRIORITY_MAP: Record<string, TicketPriority> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
};

// Unified Ticket priority to Zendesk mapping
export const ZENDESK_REVERSE_PRIORITY_MAP: Record<TicketPriority, string> = {
  low: 'low',
  normal: 'normal',
  high: 'high',
  urgent: 'urgent',
};

// Zendesk satisfaction rating mapping
export const ZENDESK_SATISFACTION_MAP: Record<string, 'good' | 'bad'> = {
  good: 'good',
  bad: 'bad',
};

// Field mappings from Zendesk ticket to Unified Ticket
export const ZENDESK_TICKET_FIELD_MAP = {
  subject: 'subject',
  description: 'description',
  status: 'status',
  priority: 'priority',
  requester_id: 'requester.platformContactId',
  assignee_id: 'assignee.platformAgentId',
  tags: 'tags',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  satisfaction_rating: 'satisfaction',
};

// Field mappings from Unified Ticket to Zendesk ticket
export const ZENDESK_TICKET_REVERSE_FIELD_MAP = {
  subject: 'ticket.subject',
  description: 'ticket.description',
  status: 'ticket.status',
  priority: 'ticket.priority',
  tags: 'ticket.tags',
};

// Zendesk comment types
export const ZENDESK_COMMENT_TYPES = {
  Comment: 'comment',
  VoiceComment: 'voice_comment',
};

// Zendesk ticket forms
export const ZENDESK_TICKET_FORMS = {
  default: 1,
};

// Custom field IDs (these would be configured per installation)
export const ZENDESK_CUSTOM_FIELDS = {
  linkedRezTicketId: 'rez_ticket_id',
  slaDeadline: 'sla_deadline',
  platform: 'source_platform',
};

// Zendesk API endpoints
export const ZENDESK_ENDPOINTS = {
  tickets: '/tickets',
  ticketById: (id: number) => `/tickets/${id}`,
  ticketComments: (id: number) => `/tickets/${id}/comments`,
  ticketSatisfactionRatings: (id: number) => `/tickets/${id}/satisfaction_rating`,
  users: '/users',
  userById: (id: number) => `/users/${id}`,
  userByEmail: (email: string) => `/users/search?query=email:${email}`,
  groups: '/groups',
  groupById: (id: number) => `/groups/${id}`,
  organizations: '/organizations',
  organizationById: (id: number) => `/organizations/${id}`,
  tags: '/tags',
  ticketsRecent: '/tickets/recent',
  ticketsIncremental: (startTime: number) => `/incremental/tickets/cursor?start_time=${startTime}`,
  usersIncremental: (startTime: number) => `/incremental/users/cursor?start_time=${startTime}`,
};

// Zendesk webhook event types
export const ZENDESK_WEBHOOK_EVENTS = {
  ticketCreated: 'ticket.created',
  ticketUpdated: 'ticket.updated',
  ticketDeleted: 'ticket.deleted',
  ticketCommentCreated: 'ticket.comment.created',
  ticketCommentUpdated: 'ticket.comment.updated',
  userCreated: 'user.created',
  userUpdated: 'user.updated',
};

// Create Zendesk API client configuration
export function createZendeskClientConfig(subdomain: string, email: string, apiToken: string) {
  const baseUrl = `https://${subdomain}.zendesk.com/api/v2`;
  const authHeader = `Basic ${Buffer.from(`${email}/token:${apiToken}`).toString('base64')}`;

  return {
    baseUrl,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
}

// Validate Zendesk credentials format
export function validateZendeskCredentials(credentials: {
  subdomain?: string;
  email?: string;
  apiToken?: string;
}): { valid: boolean; error?: string } {
  if (!credentials.subdomain || credentials.subdomain.trim() === '') {
    return { valid: false, error: 'Subdomain is required' };
  }

  if (!credentials.email || !credentials.email.includes('@')) {
    return { valid: false, error: 'Valid email is required' };
  }

  if (!credentials.apiToken || credentials.apiToken.length < 10) {
    return { valid: false, error: 'Valid API token is required (min 10 characters)' };
  }

  // Subdomain should only contain alphanumeric characters and hyphens
  if (!/^[a-zA-Z0-9-]+$/.test(credentials.subdomain)) {
    return { valid: false, error: 'Subdomain can only contain letters, numbers, and hyphens' };
  }

  return { valid: true };
}

// Default SLA mappings for Zendesk
export const ZENDESK_DEFAULT_SLA = {
  'Business Critical': {
    priority: 'urgent' as TicketPriority,
    responseTimeMinutes: 15,
    resolutionTimeMinutes: 240, // 4 hours
  },
  'High': {
    priority: 'high' as TicketPriority,
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 480, // 8 hours
  },
  'Medium': {
    priority: 'normal' as TicketPriority,
    responseTimeMinutes: 240,
    resolutionTimeMinutes: 1440, // 24 hours
  },
  'Low': {
    priority: 'low' as TicketPriority,
    responseTimeMinutes: 480,
    resolutionTimeMinutes: 2880, // 48 hours
  },
};
