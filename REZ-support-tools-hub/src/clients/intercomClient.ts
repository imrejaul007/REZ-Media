import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Platform,
  IntercomConversation,
  IntercomContact,
  IntercomMessage,
  IntercomTag,
  IntercomTeam,
  IntercomAdmin,
  PlatformError,
} from '../types';
import {
  INTERCOM_ENDPOINTS,
  INTERCOM_STATE_MAP,
  INTERCOM_PRIORITY_MAP,
  INTERCOM_REVERSE_STATE_MAP,
  INTERCOM_CONTENT_TYPES,
  createIntercomClientConfig,
} from '../constants/intercomFields';

export interface IntercomClientConfig {
  accessToken: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface IntercomPaginatedResponse<T> {
  type: string;
  data: T[];
  pages?: {
    type: string;
    next?: string;
    page: number;
    per_page: number;
    total_pages: number;
  };
  total_count?: number;
}

export interface IntercomSearchResponse<T> {
  type: string;
  data: T[];
  total_count: number;
  has_more: boolean;
  facets?: any;
}

export class IntercomClient {
  private client: AxiosInstance;
  private config: IntercomClientConfig;
  public readonly platform: Platform = 'intercom';

  constructor(config: IntercomClientConfig) {
    this.config = config;
    const clientConfig = createIntercomClientConfig(config.accessToken);

    this.client = axios.create({
      baseURL: clientConfig.baseUrl,
      headers: clientConfig.headers,
      timeout: config.timeout || 30000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const maxRetries = config.retryAttempts || 3;
        const retryCount = (error.config as any)?.__retryCount || 0;

        if (retryCount < maxRetries && this.shouldRetry(error)) {
          (error.config as any).__retryCount = retryCount + 1;
          const delay = Math.pow(2, retryCount) * 1000;
          await this.delay(delay);
          return this.client.request(error.config!);
        }

        throw this.handleError(error);
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) return true;
    const status = error.response.status;
    return status === 429 || status >= 500;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private handleError(error: AxiosError): PlatformError {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;
    const message = data?.errors?.[0]?.message || data?.message || error.message;

    return new PlatformError(
      `Intercom API Error: ${message}`,
      this.platform,
      status,
      error
    );
  }

  // Verify credentials
  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.adminMe);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Get current admin
  async getCurrentAdmin(): Promise<IntercomAdmin | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.adminMe);
      return response.data;
    } catch {
      return null;
    }
  }

  // Conversations
  async getConversations(params?: {
    page?: number;
    per_page?: number;
    state?: string;
  }): Promise<IntercomPaginatedResponse<IntercomConversation>> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.conversations, { params });
    return response.data;
  }

  async getConversation(id: string): Promise<IntercomConversation | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.conversationById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async searchConversations(query: {
    field: string;
    operator: string;
    value: string | number;
  }[]): Promise<IntercomSearchResponse<IntercomConversation>> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationsSearch, {
      query: {
        operator: 'AND',
        value,
      },
    });
    return response.data;
  }

  async replyToConversation(
    conversationId: string,
    body: string,
    adminId?: string
  ): Promise<IntercomMessage> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationAssign(conversationId), {
      message_type: 'comment',
      type: 'admin',
      admin_id: adminId,
      body,
    });
    return response.data;
  }

  async closeConversation(conversationId: string, adminId?: string): Promise<IntercomConversation> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationClose(conversationId), {
      message_type: 'close',
      type: 'admin',
      admin_id: adminId,
    });
    return response.data;
  }

  async snoozeConversation(
    conversationId: string,
    snoozedUntil: number,
    adminId?: string
  ): Promise<IntercomConversation> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationAssign(conversationId), {
      message_type: 'assignment',
      type: 'admin',
      admin_id: adminId,
      snoozed_until: snoozedUntil,
    });
    return response.data;
  }

  async assignConversation(
    conversationId: string,
    assigneeId: string,
    assigneeType: 'admin' | 'team' = 'admin',
    adminId?: string
  ): Promise<IntercomConversation> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationAssign(conversationId), {
      message_type: 'assignment',
      type: assigneeType,
      id: assigneeId,
      admin_id: adminId,
    });
    return response.data;
  }

  async addTag(conversationId: string, tagId: string): Promise<any> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.conversationTags(conversationId), {
      id: tagId,
    });
    return response.data;
  }

  async removeTag(conversationId: string, tagId: string): Promise<any> {
    const response = await this.client.delete(INTERCOM_ENDPOINTS.conversationTags(conversationId), {
      data: { id: tagId },
    });
    return response.data;
  }

  async getConversationParts(conversationId: string): Promise<IntercomPaginatedResponse<IntercomMessage>> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.conversationParts(conversationId));
    return response.data;
  }

  // Contacts
  async getContacts(params?: {
    page?: number;
    per_page?: number;
  }): Promise<IntercomPaginatedResponse<IntercomContact>> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.contacts, { params });
    return response.data;
  }

  async getContact(id: string): Promise<IntercomContact | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.contactById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async searchContacts(query: {
    field: string;
    operator: string;
    value: string | number;
  }[]): Promise<IntercomSearchResponse<IntercomContact>> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.contactsSearch, {
      query: {
        operator: 'AND',
        value,
      },
    });
    return response.data;
  }

  async getContactByEmail(email: string): Promise<IntercomContact | null> {
    try {
      const response = await this.client.post(INTERCOM_ENDPOINTS.contactsSearch, {
        query: {
          field: 'email',
          operator: '=',
          value: email,
        },
      });
      const contacts = response.data.data;
      return contacts.length > 0 ? contacts[0] : null;
    } catch {
      return null;
    }
  }

  async getContactByPhone(phone: string): Promise<IntercomContact | null> {
    try {
      const response = await this.client.post(INTERCOM_ENDPOINTS.contactsSearch, {
        query: {
          field: 'phone',
          operator: '=',
          value: phone,
        },
      });
      const contacts = response.data.data;
      return contacts.length > 0 ? contacts[0] : null;
    } catch {
      return null;
    }
  }

  async createContact(contact: Partial<IntercomContact>): Promise<IntercomContact> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.contacts, contact);
    return response.data;
  }

  async updateContact(
    id: string,
    updates: Partial<IntercomContact>
  ): Promise<IntercomContact> {
    const response = await this.client.put(INTERCOM_ENDPOINTS.contactById(id), updates);
    return response.data;
  }

  async mergeContacts(
    primaryId: string,
    secondaryId: string
  ): Promise<IntercomContact> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.contactMerge(primaryId), {
      id: secondaryId,
    });
    return response.data;
  }

  // Contact Tags
  async getContactTags(contactId: string): Promise<IntercomTag[]> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.contactTags(contactId));
    return response.data.data || [];
  }

  async addContactTag(contactId: string, tagId: string): Promise<IntercomTag[]> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.contactTags(contactId), {
      id: tagId,
    });
    return response.data.data || [];
  }

  async removeContactTag(contactId: string, tagId: string): Promise<void> {
    await this.client.delete(INTERCOM_ENDPOINTS.contactTags(contactId), {
      data: { id: tagId },
    });
  }

  // Contact Notes
  async getContactNotes(contactId: string): Promise<any[]> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.contactNotes(contactId));
    return response.data.data || [];
  }

  async addContactNote(contactId: string, body: string, adminId?: string): Promise<any> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.contactNotes(contactId), {
      body,
      admin_id: adminId,
    });
    return response.data;
  }

  // Contact Companies
  async getContactCompanies(contactId: string): Promise<any[]> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.contactCompanies(contactId));
    return response.data.data || [];
  }

  async attachCompanyToContact(contactId: string, companyId: string): Promise<void> {
    await this.client.post(INTERCOM_ENDPOINTS.contactCompanies(contactId), {
      id: companyId,
    });
  }

  async detachCompanyFromContact(contactId: string, companyId: string): Promise<void> {
    await this.client.delete(INTERCOM_ENDPOINTS.contactCompanies(contactId), {
      data: { id: companyId },
    });
  }

  // Companies
  async getCompanies(params?: {
    page?: number;
    per_page?: number;
  }): Promise<IntercomPaginatedResponse<any>> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.companies, { params });
    return response.data;
  }

  async getCompany(id: string): Promise<any | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.companyById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async getCompanyByName(name: string): Promise<any | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.companyByName(name));
      const companies = response.data.data;
      return companies.length > 0 ? companies[0] : null;
    } catch {
      return null;
    }
  }

  async createCompany(company: any): Promise<any> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.companies, company);
    return response.data;
  }

  async updateCompany(id: string, updates: any): Promise<any> {
    const response = await this.client.put(INTERCOM_ENDPOINTS.companyById(id), updates);
    return response.data;
  }

  // Tags
  async getTags(params?: {
    page?: number;
    per_page?: number;
  }): Promise<IntercomPaginatedResponse<IntercomTag>> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.tags, { params });
    return response.data;
  }

  async getTag(id: string): Promise<IntercomTag | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.tagById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async getTagByName(name: string): Promise<IntercomTag | null> {
    const tags = await this.getTags({ per_page: 100 });
    return tags.data.find((tag) => tag.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async createTag(name: string): Promise<IntercomTag> {
    const response = await this.client.post(INTERCOM_ENDPOINTS.tags, {
      name,
    });
    return response.data;
  }

  async updateTag(id: string, name: string): Promise<IntercomTag> {
    const response = await this.client.put(INTERCOM_ENDPOINTS.tagById(id), {
      name,
    });
    return response.data;
  }

  async deleteTag(id: string): Promise<void> {
    await this.client.delete(INTERCOM_ENDPOINTS.tagById(id));
  }

  // Admins
  async getAdmins(): Promise<IntercomAdmin[]> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.admins);
    return response.data.admins || [];
  }

  async getAdmin(id: string): Promise<IntercomAdmin | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.adminById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  // Teams
  async getTeams(): Promise<IntercomTeam[]> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.teams);
    return response.data.data || [];
  }

  async getTeam(id: string): Promise<IntercomTeam | null> {
    try {
      const response = await this.client.get(INTERCOM_ENDPOINTS.teamById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  // Counts
  async getConversationsCount(state?: string): Promise<number> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.conversationsCount, {
      params: state ? { state } : {},
    });
    return response.data.count || 0;
  }

  async getContactsCount(): Promise<number> {
    const response = await this.client.get(INTERCOM_ENDPOINTS.contactsCount);
    return response.data.count || 0;
  }

  // Utility methods for mapping
  mapState(state: string): string {
    return INTERCOM_STATE_MAP[state.toLowerCase()] || 'open';
  }

  mapPriority(priority: string): string {
    return INTERCOM_PRIORITY_MAP[priority.toLowerCase()] || 'normal';
  }

  reverseMapState(state: string): string {
    return INTERCOM_REVERSE_STATE_MAP[state as keyof typeof INTERCOM_REVERSE_STATE_MAP] || 'open';
  }

  // Transform Intercom conversation to unified ticket format
  transformConversation(conversation: IntercomConversation): {
    platformTicketId: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    customFields: Record<string, unknown>;
  } {
    const priority = conversation.statistics?.priority || 'not_priority';

    return {
      platformTicketId: conversation.id,
      subject: conversation.title || `Conversation ${conversation.id}`,
      description: conversation.source?.body || '',
      status: this.mapState(conversation.state),
      priority: this.mapPriority(priority),
      tags: conversation.tags?.tags.map((t) => t.name) || [],
      createdAt: new Date(conversation.created_at * 1000),
      updatedAt: new Date(conversation.updated_at * 1000),
      customFields: {
        waitingSince: conversation.waiting_since
          ? new Date(conversation.waiting_since * 1000)
          : null,
        statistics: conversation.statistics,
        customAttributes: conversation.custom_attributes,
      },
    };
  }

  // Transform Intercom contact to unified contact format
  transformContact(contact: IntercomContact): {
    platformContactId: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    tags: string[];
    metadata: Record<string, unknown>;
  } {
    return {
      platformContactId: contact.id,
      name: contact.name || contact.email || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      avatar: contact.avatar,
      tags: contact.tags?.data.map((t) => t.name) || [],
      metadata: {
        type: contact.type,
        ownerId: contact.owner_id,
        lastSeenAt: contact.last_seen_at ? new Date(contact.last_seen_at * 1000) : null,
        lastContactedAt: contact.last_contacted_at
          ? new Date(contact.last_contacted_at * 1000)
          : null,
        unsubscribedFromEmails: contact.unsubscribed_from_emails,
        languageOverride: contact.language_override,
        socialProfiles: contact.social_profiles,
      },
    };
  }

  // Transform Intercom message to unified comment format
  transformMessage(
    message: IntercomMessage,
    conversationId: string
  ): {
    id: string;
    ticketId: string;
    platformCommentId: string;
    author: {
      id: string;
      name: string;
      email?: string;
      type: 'agent' | 'customer' | 'system';
    };
    body: string;
    htmlBody: string;
    isPublic: boolean;
    attachments: any[];
    createdAt: Date;
    updatedAt: Date;
  } {
    const authorType =
      message.author.type === 'admin' || message.author.type === 'bot'
        ? 'agent'
        : message.author.type === 'user' || message.author.type === 'lead'
        ? 'customer'
        : 'system';

    return {
      id: `intercom-${message.id}`,
      ticketId: conversationId,
      platformCommentId: message.id,
      author: {
        id: message.author.id,
        name: message.author.name || '',
        email: message.author.email,
        type: authorType,
      },
      body: message.body,
      htmlBody: message.body,
      isPublic: message.type !== 'note',
      attachments:
        message.attachments?.map((att) => ({
          id: att.url,
          filename: att.name,
          contentType: att.content_type,
          size: att.filesize,
          url: att.url,
        })) || [],
      createdAt: new Date(message.created_at * 1000),
      updatedAt: new Date(message.updated_at * 1000),
    };
  }

  // Build external URL
  getConversationUrl(conversationId: string): string {
    return `https://app.intercom.com/a/apps/${this.config.accessToken}/inbox/conversation/${conversationId}`;
  }

  getContactUrl(contactId: string): Promise<string> {
    return Promise.resolve(
      `https://app.intercom.com/a/apps/${this.config.accessToken}/contacts/${contactId}`
    );
  }
}

// Factory function for creating client
export function createIntercomClient(config: IntercomClientConfig): IntercomClient {
  return new IntercomClient(config);
}

export default IntercomClient;
