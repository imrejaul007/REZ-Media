import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Platform,
  FreshdeskTicket,
  FreshdeskContact,
  FreshdeskCompany,
  FreshdeskConversation,
  FreshdeskProduct,
  PlatformError,
} from '../types';
import {
  FRESHDESK_ENDPOINTS,
  FRESHDESK_STATUS_MAP,
  FRESHDESK_PRIORITY_MAP,
  FRESHDESK_SATISFACTION_MAP,
  FRESHDESK_REVERSE_STATUS_MAP,
  FRESHDESK_REVERSE_PRIORITY_MAP,
  createFreshdeskClientConfig,
} from '../constants/freshdeskFields';

export interface FreshdeskClientConfig {
  domain: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface FreshdeskPaginatedResponse<T> {
  [key: string]: T[] | number | string | undefined;
}

export class FreshdeskClient {
  private client: AxiosInstance;
  private config: FreshdeskClientConfig;
  public readonly platform: Platform = 'freshdesk';

  constructor(config: FreshdeskClientConfig) {
    this.config = config;
    const clientConfig = createFreshdeskClientConfig(config.domain, config.apiKey);

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
    const message =
      error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

    return new PlatformError(
      `Freshdesk API Error: ${message}`,
      this.platform,
      status,
      error
    );
  }

  // Verify credentials
  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await this.client.get('/products', {
        params: { per_page: 1 },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Tickets
  async getTickets(params?: {
    page?: number;
    per_page?: number;
    order_by?: string;
    order_type?: string;
    filter_id?: number;
  }): Promise<FreshdeskTicket[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.tickets, { params });
    return response.data;
  }

  async getTicket(id: number): Promise<FreshdeskTicket | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.ticketById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async getTicketsUpdatedSince(since: string): Promise<FreshdeskTicket[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.ticketsUpdatedSince(since), {
      headers: { 'If-Modified-Since': since },
    });
    return response.data;
  }

  async createTicket(ticket: Partial<FreshdeskTicket>): Promise<FreshdeskTicket> {
    const response = await this.client.post(FRESHDESK_ENDPOINTS.tickets, ticket);
    return response.data;
  }

  async updateTicket(
    id: number,
    updates: Partial<FreshdeskTicket>
  ): Promise<FreshdeskTicket> {
    const response = await this.client.put(FRESHDESK_ENDPOINTS.ticketById(id), updates);
    return response.data;
  }

  async updateTicketStatus(id: number, status: number): Promise<FreshdeskTicket> {
    return this.updateTicket(id, { status } as Partial<FreshdeskTicket>);
  }

  async updateTicketPriority(id: number, priority: number): Promise<FreshdeskTicket> {
    return this.updateTicket(id, { priority } as Partial<FreshdeskTicket>);
  }

  async assignTicket(id: number, responderId: number): Promise<FreshdeskTicket> {
    return this.updateTicket(id, { responder_id: responderId } as Partial<FreshdeskTicket>);
  }

  async addTags(id: number, tags: string[]): Promise<FreshdeskTicket> {
    const ticket = await this.getTicket(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const existingTags = ticket.tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];
    return this.updateTicket(id, { tags: newTags } as Partial<FreshdeskTicket>);
  }

  async removeTags(id: number, tags: string[]): Promise<FreshdeskTicket> {
    const ticket = await this.getTicket(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const remainingTags = (ticket.tags || []).filter((tag) => !tags.includes(tag));
    return this.updateTicket(id, { tags: remainingTags } as Partial<FreshdeskTicket>);
  }

  // Conversations
  async getTicketConversations(ticketId: number): Promise<FreshdeskConversation[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.ticketConversations(ticketId));
    return response.data;
  }

  async addReply(
    ticketId: number,
    body: string,
    userId?: number,
    isPrivate: boolean = false
  ): Promise<FreshdeskConversation> {
    const conversation = {
      body,
      user_id: userId,
      incoming: false,
      private: isPrivate,
    };

    const response = await this.client.post(
      FRESHDESK_ENDPOINTS.ticketConversations(ticketId),
      conversation
    );
    return response.data;
  }

  async addNote(ticketId: number, body: string, userId?: number): Promise<FreshdeskConversation> {
    return this.addReply(ticketId, body, userId, true);
  }

  // Contacts
  async getContacts(params?: {
    page?: number;
    per_page?: number;
    email?: string;
  }): Promise<FreshdeskContact[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.contacts, { params });
    return response.data;
  }

  async getContact(id: number): Promise<FreshdeskContact | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.contactById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async searchContactByEmail(email: string): Promise<FreshdeskContact | null> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.contactByEmail(email));
    const contacts = response.data;
    return contacts.length > 0 ? contacts[0] : null;
  }

  async createContact(contact: Partial<FreshdeskContact>): Promise<FreshdeskContact> {
    const response = await this.client.post(FRESHDESK_ENDPOINTS.contacts, contact);
    return response.data;
  }

  async updateContact(
    id: number,
    updates: Partial<FreshdeskContact>
  ): Promise<FreshdeskContact> {
    const response = await this.client.put(FRESHDESK_ENDPOINTS.contactById(id), updates);
    return response.data;
  }

  // Companies
  async getCompanies(params?: {
    page?: number;
    per_page?: number;
  }): Promise<FreshdeskCompany[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.companies, { params });
    return response.data;
  }

  async getCompany(id: number): Promise<FreshdeskCompany | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.companyById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  async createCompany(company: Partial<FreshdeskCompany>): Promise<FreshdeskCompany> {
    const response = await this.client.post(FRESHDESK_ENDPOINTS.companies, company);
    return response.data;
  }

  async updateCompany(
    id: number,
    updates: Partial<FreshdeskCompany>
  ): Promise<FreshdeskCompany> {
    const response = await this.client.put(FRESHDESK_ENDPOINTS.companyById(id), updates);
    return response.data;
  }

  // Products
  async getProducts(params?: {
    page?: number;
    per_page?: number;
  }): Promise<FreshdeskProduct[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.products, { params });
    return response.data;
  }

  async getProduct(id: number): Promise<FreshdeskProduct | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.productById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  // Groups
  async getGroups(): Promise<any[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.groups);
    return response.data;
  }

  async getGroup(id: number): Promise<any | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.groupById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  // Agents
  async getAgents(params?: {
    page?: number;
    per_page?: number;
  }): Promise<any[]> {
    const response = await this.client.get(FRESHDESK_ENDPOINTS.agents, { params });
    return response.data;
  }

  async getAgent(id: number): Promise<any | null> {
    try {
      const response = await this.client.get(FRESHDESK_ENDPOINTS.agentById(id));
      return response.data;
    } catch {
      return null;
    }
  }

  // Utility methods for mapping
  mapStatus(status: number): string {
    return FRESHDESK_STATUS_MAP[status] || 'open';
  }

  mapPriority(priority: number): string {
    return FRESHDESK_PRIORITY_MAP[priority] || 'normal';
  }

  mapSatisfaction(rating: number): 'good' | 'bad' | null {
    return FRESHDESK_SATISFACTION_MAP[rating] || null;
  }

  reverseMapStatus(status: string): number {
    return FRESHDESK_REVERSE_STATUS_MAP[status as keyof typeof FRESHDESK_REVERSE_STATUS_MAP] || 2;
  }

  reverseMapPriority(priority: string): number {
    return FRESHDESK_REVERSE_PRIORITY_MAP[priority as keyof typeof FRESHDESK_REVERSE_PRIORITY_MAP] || 2;
  }

  // Transform Freshdesk ticket to unified format
  transformTicket(ticket: FreshdeskTicket): {
    platformTicketId: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    satisfaction: 'good' | 'bad' | null;
    customFields: Record<string, unknown>;
  } {
    return {
      platformTicketId: String(ticket.id),
      subject: ticket.subject || '',
      description: ticket.description || '',
      status: this.mapStatus(ticket.status),
      priority: this.mapPriority(ticket.priority),
      tags: ticket.tags || [],
      createdAt: new Date(ticket.created_at),
      updatedAt: new Date(ticket.updated_at),
      satisfaction: ticket.satisfaction_rating
        ? this.mapSatisfaction(ticket.satisfaction_rating.rating)
        : null,
      customFields: ticket.custom_fields || {},
    };
  }

  // Transform Freshdesk contact to unified contact format
  transformContact(contact: FreshdeskContact): {
    platformContactId: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    metadata: Record<string, unknown>;
  } {
    return {
      platformContactId: String(contact.id),
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone,
      avatar: contact.avatar,
      metadata: {
        companyId: contact.company_id,
        viewAllTickets: contact.view_all_tickets,
      },
    };
  }

  // Transform Freshdesk company to unified company format
  transformCompany(company: FreshdeskCompany): {
    id: string;
    name: string;
    domain?: string;
    metadata: Record<string, unknown>;
  } {
    return {
      id: String(company.id),
      name: company.name || '',
      domain: company.domains?.[0],
      metadata: {
        description: company.description,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      },
    };
  }

  // Transform Freshdesk conversation to unified comment format
  transformConversation(
    conversation: FreshdeskConversation,
    ticketId: string
  ): {
    id: string;
    ticketId: string;
    platformCommentId: string;
    author: {
      id: string;
      name: string;
      email: string;
      type: 'agent' | 'customer' | 'system';
    };
    body: string;
    htmlBody: string;
    isPublic: boolean;
    attachments: any[];
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: `freshdesk-${conversation.id}`,
      ticketId,
      platformCommentId: String(conversation.id),
      author: {
        id: String(conversation.user_id),
        name: '',
        email: '',
        type: conversation.incoming ? 'customer' : 'agent',
      },
      body: conversation.body_text || conversation.body || '',
      htmlBody: conversation.body || '',
      isPublic: !conversation.incoming,
      attachments:
        conversation.attachments?.map((att) => ({
          id: String(att.id),
          filename: att.name,
          contentType: att.content_type,
          size: att.size,
          url: att.attachment_url,
        })) || [],
      createdAt: new Date(conversation.created_at),
      updatedAt: new Date(conversation.updated_at),
    };
  }

  // Build external URL
  getTicketUrl(ticketId: number): string {
    return `https://${this.config.domain}/a/tickets/${ticketId}`;
  }

  getContactUrl(contactId: number): string {
    return `https://${this.config.domain}/a/contacts/${contactId}`;
  }

  getCompanyUrl(companyId: number): string {
    return `https://${this.config.domain}/a/companies/${companyId}`;
  }
}

// Factory function for creating client
export function createFreshdeskClient(config: FreshdeskClientConfig): FreshdeskClient {
  return new FreshdeskClient(config);
}

export default FreshdeskClient;
