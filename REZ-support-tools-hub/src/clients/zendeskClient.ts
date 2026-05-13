import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  Platform,
  ZendeskTicket,
  ZendeskUser,
  ZendeskComment,
  ZendeskSatisfactionRating,
  PlatformError,
} from '../types';
import {
  ZENDESK_ENDPOINTS,
  ZENDESK_STATUS_MAP,
  ZENDESK_PRIORITY_MAP,
  ZENDESK_SATISFACTION_MAP,
  createZendeskClientConfig,
} from '../constants/zendeskFields';

export interface ZendeskClientConfig {
  subdomain: string;
  email: string;
  apiToken: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface ZendeskPaginatedResponse<T> {
  tickets?: T[];
  users?: T[];
  comments?: T[];
  count?: number;
  next_page?: string;
  previous_page?: string;
  page?: number;
  page_count?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface ZendeskTicketsResponse extends ZendeskPaginatedResponse<ZendeskTicket> {}

export interface ZendeskUsersResponse extends ZendeskPaginatedResponse<ZendeskUser> {}

export interface ZendeskCommentsResponse {
  comments: ZendeskComment[];
  count: number;
  next_page?: string;
  previous_page?: string;
}

export class ZendeskClient {
  private client: AxiosInstance;
  private config: ZendeskClientConfig;
  public readonly platform: Platform = 'zendesk';

  constructor(config: ZendeskClientConfig) {
    this.config = config;
    const clientConfig = createZendeskClientConfig(
      config.subdomain,
      config.email,
      config.apiToken
    );

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
      `Zendesk API Error: ${message}`,
      this.platform,
      status,
      error
    );
  }

  // Verify credentials
  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await this.client.get('/tickets/recent', {
        params: { per_page: 1 },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Get current user (for verification)
  async getCurrentUser(): Promise<ZendeskUser | null> {
    try {
      const response = await this.client.get('/users/me');
      return response.data.users?.[0] || response.data.user || null;
    } catch {
      return null;
    }
  }

  // Tickets
  async getTickets(params?: {
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: string;
    status?: string;
  }): Promise<ZendeskTicketsResponse> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.tickets, { params });
    return response.data;
  }

  async getTicket(id: number): Promise<ZendeskTicket | null> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.ticketById(id));
    return response.data.ticket || null;
  }

  async getTicketsSince(timestamp: number): Promise<ZendeskTicket[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.ticketsIncremental(timestamp));
    return response.data.tickets || [];
  }

  async getRecentTickets(): Promise<ZendeskTicket[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.ticketsRecent);
    return response.data.tickets || [];
  }

  async createTicket(ticket: Partial<ZendeskTicket>): Promise<ZendeskTicket> {
    const response = await this.client.post(ZENDESK_ENDPOINTS.tickets, {
      ticket,
    });
    return response.data.ticket;
  }

  async updateTicket(
    id: number,
    updates: Partial<ZendeskTicket>
  ): Promise<ZendeskTicket> {
    const response = await this.client.put(ZENDESK_ENDPOINTS.ticketById(id), {
      ticket: updates,
    });
    return response.data.ticket;
  }

  async updateTicketStatus(id: number, status: string): Promise<ZendeskTicket> {
    return this.updateTicket(id, { status });
  }

  async updateTicketPriority(id: number, priority: string): Promise<ZendeskTicket> {
    return this.updateTicket(id, { priority });
  }

  async assignTicket(id: number, assigneeId: number): Promise<ZendeskTicket> {
    return this.updateTicket(id, { assignee_id: assigneeId });
  }

  async addTags(id: number, tags: string[]): Promise<ZendeskTicket> {
    const ticket = await this.getTicket(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const newTags = [...new Set([...ticket.tags, ...tags])];
    return this.updateTicket(id, { tags: newTags });
  }

  async removeTags(id: number, tags: string[]): Promise<ZendeskTicket> {
    const ticket = await this.getTicket(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const remainingTags = ticket.tags.filter((tag) => !tags.includes(tag));
    return this.updateTicket(id, { tags: remainingTags });
  }

  // Comments
  async getTicketComments(ticketId: number): Promise<ZendeskCommentsResponse> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.ticketComments(ticketId));
    return response.data;
  }

  async addComment(
    ticketId: number,
    body: string,
    isPublic: boolean = true,
    authorId?: number
  ): Promise<ZendeskComment> {
    const comment = {
      body,
      public: isPublic,
      ...(authorId && { author_id: authorId }),
    };

    const response = await this.client.post(ZENDESK_ENDPOINTS.ticketComments(ticketId), {
      comment,
    });

    return response.data.comment;
  }

  // Satisfaction Ratings
  async getSatisfactionRating(ticketId: number): Promise<ZendeskSatisfactionRating | null> {
    try {
      const response = await this.client.get(
        ZENDESK_ENDPOINTS.ticketSatisfactionRatings(ticketId)
      );
      return response.data.satisfaction_rating || null;
    } catch {
      return null;
    }
  }

  // Users
  async getUsers(params?: {
    page?: number;
    per_page?: number;
    role?: string;
  }): Promise<ZendeskUsersResponse> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.users, { params });
    return response.data;
  }

  async getUser(id: number): Promise<ZendeskUser | null> {
    try {
      const response = await this.client.get(ZENDESK_ENDPOINTS.userById(id));
      return response.data.users?.[0] || response.data.user || null;
    } catch {
      return null;
    }
  }

  async searchUserByEmail(email: string): Promise<ZendeskUser | null> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.userByEmail(email));
    const users = response.data.users || [];
    return users.length > 0 ? users[0] : null;
  }

  async getUsersSince(timestamp: number): Promise<ZendeskUser[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.usersIncremental(timestamp));
    return response.data.users || [];
  }

  // Groups
  async getGroups(): Promise<any[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.groups);
    return response.data.groups || [];
  }

  async getGroup(id: number): Promise<any | null> {
    try {
      const response = await this.client.get(ZENDESK_ENDPOINTS.groupById(id));
      return response.data.group || null;
    } catch {
      return null;
    }
  }

  // Organizations
  async getOrganizations(): Promise<any[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.organizations);
    return response.data.organizations || [];
  }

  async getOrganization(id: number): Promise<any | null> {
    try {
      const response = await this.client.get(ZENDESK_ENDPOINTS.organizationById(id));
      return response.data.organization || null;
    } catch {
      return null;
    }
  }

  // Tags
  async getTags(): Promise<any[]> {
    const response = await this.client.get(ZENDESK_ENDPOINTS.tags);
    return response.data.tags || [];
  }

  // Utility methods for mapping
  mapStatus(status: string): string {
    return ZENDESK_STATUS_MAP[status.toLowerCase()] || status;
  }

  mapPriority(priority: string): string {
    return ZENDESK_PRIORITY_MAP[priority.toLowerCase()] || priority;
  }

  mapSatisfaction(score: string): 'good' | 'bad' | null {
    return ZENDESK_SATISFACTION_MAP[score.toLowerCase()] || null;
  }

  // Transform Zendesk ticket to unified format
  transformTicket(ticket: ZendeskTicket): {
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
        ? this.mapSatisfaction(ticket.satisfaction_rating.score)
        : null,
      customFields: ticket.custom_fields || {},
    };
  }

  // Transform Zendesk user to unified contact format
  transformUser(user: ZendeskUser): {
    platformContactId: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    metadata: Record<string, unknown>;
  } {
    return {
      platformContactId: String(user.id),
      name: user.name || '',
      email: user.email || '',
      phone: user.phone,
      avatar: user.photo?.content_url,
      metadata: {
        organizationId: user.organization_id,
        userFields: user.user_fields,
      },
    };
  }

  // Transform Zendesk comment to unified comment format
  transformComment(
    comment: ZendeskComment,
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
      id: `zendesk-${comment.id}`,
      ticketId,
      platformCommentId: String(comment.id),
      author: {
        id: String(comment.author_id),
        name: '',
        email: '',
        type: comment.type === 'Comment' ? 'customer' : 'agent',
      },
      body: comment.body || '',
      htmlBody: comment.html_body || '',
      isPublic: comment.public,
      attachments:
        comment.attachments?.map((att) => ({
          id: String(att.id),
          filename: att.file_name,
          contentType: att.content_type,
          size: att.size,
          url: att.content_url,
          thumbnailUrl: att.thumbnail_url,
        })) || [],
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.created_at),
    };
  }

  // Build external URL
  getTicketUrl(ticketId: number): string {
    return `https://${this.config.subdomain}.zendesk.com/agent/tickets/${ticketId}`;
  }

  getUserUrl(userId: number): string {
    return `https://${this.config.subdomain}.zendesk.com/agent/users/${userId}`;
  }
}

// Factory function for creating client
export function createZendeskClient(config: ZendeskClientConfig): ZendeskClient {
  return new ZendeskClient(config);
}

export default ZendeskClient;
