import { TicketStatus, TicketPriority } from '../types';

// Intercom conversation states to Unified Ticket status mapping
export const INTERCOM_STATE_MAP: Record<string, TicketStatus> = {
  open: 'open',
  closed: 'closed',
  snoozed: 'on_hold',
};

// Unified Ticket status to Intercom conversation state mapping
export const INTERCOM_REVERSE_STATE_MAP: Record<TicketStatus, string> = {
  open: 'open',
  pending: 'open',
  on_hold: 'snoozed',
  solved: 'closed',
  closed: 'closed',
};

// Intercom conversation priority to Unified Ticket priority mapping
export const INTERCOM_PRIORITY_MAP: Record<string, TicketPriority> = {
  priority: 'urgent',
  not_priority: 'normal',
};

// Intercom admin assignment type
export const INTERCOM_ASSIGNEE_TYPE = {
  admin: 'admin',
  team: 'team',
};

// Intercom conversation source type
export const INTERCOM_SOURCE_TYPE = {
  conversation: 'conversation',
  email: 'email',
  chat: 'chat',
  api: 'api',
  operator: 'operator',
  nudge: 'nudge',
  force_reply: 'force_reply',
};

// Field mappings from Intercom conversation to Unified Ticket
export const INTERCOM_CONVERSATION_FIELD_MAP = {
  id: 'platformTicketId',
  state: 'status',
  title: 'subject',
  source_body: 'description',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  waiting_since: 'metadata.waitingSince',
};

// Field mappings from Unified Ticket to Intercom conversation
export const INTERCOM_CONVERSATION_REVERSE_FIELD_MAP = {
  subject: 'conversation.title',
  status: 'conversation.state',
  description: 'conversation.source.body',
};

// Intercom message part types
export const INTERCOM_MESSAGE_TYPES = {
  text: 'text',
  comment: 'comment',
  note: 'note',
};

// Intercom user type
export const INTERCOM_USER_TYPE = {
  user: 'user',
  lead: 'lead',
  contact: 'contact',
};

// Intercom admin presence
export const INTERCOM_ADMIN_PRESENCE = {
  available: 'available',
  away: 'away',
};

// Create Intercom API client configuration
export function createIntercomClientConfig(accessToken: string) {
  return {
    baseUrl: 'https://api.intercom.io',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Intercom-Version': '2.10',
    },
  };
}

// Create Intercom OAuth configuration
export function createIntercomOAuthConfig(clientId: string, clientSecret: string, redirectUri: string) {
  return {
    authUrl: 'https://app.intercom.io/oauth',
    tokenUrl: 'https://api.intercom.io/auth/easy/token',
    clientId,
    clientSecret,
    redirectUri,
  };
}

// Validate Intercom credentials format
export function validateIntercomCredentials(credentials: {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}): { valid: boolean; error?: string } {
  // Must have either access token OR both client ID and client secret
  if (credentials.accessToken) {
    if (credentials.accessToken.length < 10) {
      return { valid: false, error: 'Valid access token is required' };
    }
    return { valid: true };
  }

  if (credentials.clientId && credentials.clientSecret) {
    if (credentials.clientId.length < 5) {
      return { valid: false, error: 'Valid client ID is required' };
    }
    if (credentials.clientSecret.length < 10) {
      return { valid: false, error: 'Valid client secret is required' };
    }
    return { valid: true };
  }

  return {
    valid: false,
    error: 'Either access token or OAuth credentials (client ID + client secret) are required',
  };
}

// Intercom API endpoints
export const INTERCOM_ENDPOINTS = {
  // Conversations
  conversations: '/conversations',
  conversationById: (id: string) => `/conversations/${id}`,
  conversationParts: (id: string) => `/conversations/${id}/parts`,
  conversationTags: (id: string) => `/conversations/${id}/tags`,
  conversationAssign: (id: string) => `/conversations/${id}/parts`,
  conversationClose: (id: string) => `/conversations/${id}/parts`,

  // Contacts
  contacts: '/contacts',
  contactById: (id: string) => `/contacts/${id}`,
  contactByEmail: (email: string) => `/contacts/search`,
  contactByPhone: (phone: string) => `/contacts/search`,
  contactMerge: (id: string) => `/contacts/${id}/merge`,
  contactTags: (id: string) => `/contacts/${id}/tags`,
  contactNotes: (id: string) => `/contacts/${id}/notes`,
  contactCompanies: (id: string) => `/contacts/${id}/companies`,

  // Companies
  companies: '/companies',
  companyById: (id: string) => `/companies/${id}`,
  companyByName: (name: string) => `/companies?name=${encodeURIComponent(name)}`,

  // Tags
  tags: '/tags',
  tagById: (id: string) => `/tags/${id}`,

  // Admins
  admins: '/admins',
  adminById: (id: string) => `/admins/${id}`,
  adminMe: '/admins/me',

  // Teams
  teams: '/teams',
  teamById: (id: string) => `/teams/${id}`,

  // Webhooks
  webhooks: '/webhooks',
  webhookById: (id: string) => `/webhooks/${id}`,

  // OAuth
  oauthToken: '/auth/easy/token',
  oauthAuthorize: '/oauth',

  // Search
  contactsSearch: '/contacts/search',
  conversationsSearch: '/conversations/search',

  // Counts
  conversationsCount: '/conversations/count',
  contactsCount: '/contacts/count',
};

// Intercom webhook event types
export const INTERCOM_WEBHOOK_EVENTS = {
  // Conversation events
  conversationCreated: 'conversation.created',
  conversationOpened: 'conversation.opened',
  conversationUpdated: 'conversation.updated',
  conversationClosed: 'conversation.closed',
  conversationSnoozed: 'conversation.snoozed',
  conversationUnsnoozed: 'conversation.unsnoozed',

  // Message events
  conversationUserCreated: 'conversation.user.created',
  conversationUserPartCreated: 'conversation.user.part.created',
  conversationAdminCreated: 'conversation.admin.created',
  conversationAdminPartCreated: 'conversation.admin.part.created',
  conversationAdminNotified: 'conversation.admin.notified',

  // Contact events
  contactCreated: 'contact.created',
  contactUpdated: 'contact.updated',
  contactDeleted: 'contact.deleted',
  contactEmailVerified: 'contact.email_verified',
  contactEmailChanged: 'contact.email_changed',

  // Tag events
  tagCreated: 'tag.created',
  tagUpdated: 'tag.updated',
  tagDeleted: 'tag.deleted',

  // Team events
  teamCreated: 'team.created',
  teamUpdated: 'team.updated',
};

// Intercom conversation statistics
export const INTERCOM_STATS = {
  timeToAssignment: 'time_to_assignment',
  timeToAdminReply: 'time_to_admin_reply',
  timeToFirstClose: 'time_to_first_close',
  timeToLastClose: 'time_to_last_close',
  medianTimeToReply: 'median_time_to_reply',
  firstContactReplyAt: 'first_contact_reply_at',
  firstAssignmentAt: 'first_assignment_at',
  firstAdminReplyAt: 'first_admin_reply_at',
};

// Intercom custom attributes for linking to ReZ
export const INTERCOM_CUSTOM_ATTRIBUTES = {
  linkedRezTicketId: 'rez_ticket_id',
  linkedRezUserId: 'rez_user_id',
  platform: 'source_platform',
  slaDeadline: 'sla_deadline',
};

// Default SLA mappings for Intercom
export const INTERCOM_DEFAULT_SLA = {
  'Urgent': {
    priority: 'urgent' as TicketPriority,
    responseTimeMinutes: 15,
    resolutionTimeMinutes: 60,
  },
  'High': {
    priority: 'high' as TicketPriority,
    responseTimeMinutes: 30,
    resolutionTimeMinutes: 240,
  },
  'Medium': {
    priority: 'normal' as TicketPriority,
    responseTimeMinutes: 120,
    resolutionTimeMinutes: 480,
  },
  'Low': {
    priority: 'low' as TicketPriority,
    responseTimeMinutes: 480,
    resolutionTimeMinutes: 1440,
  },
};

// Intercom content types for attachments
export const INTERCOM_CONTENT_TYPES = {
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  video: [
    'video/mp4',
    'video/webm',
  ],
};

// Intercom available language codes
export const INTERCOM_LANGUAGES = [
  'af', 'ar', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en',
  'es', 'et', 'fa', 'fi', 'fr', 'ga', 'he', 'hi', 'hr', 'hu',
  'id', 'is', 'it', 'ja', 'ka', 'ko', 'lo', 'lt', 'lv', 'mr',
  'ms', 'nb', 'nl', 'pl', 'pt', 'pt-br', 'ro', 'ru', 'sk', 'sl',
  'sr', 'sv', 'sw', 'th', 'tl', 'tr', 'uk', 'vi', 'zh', 'zh-tw',
];
