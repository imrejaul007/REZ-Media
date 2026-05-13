import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';
import { OAuthTokens } from '../types/index.js';

export interface ZohoContact {
  Display_Name?: string;
  Email?: string;
  Phone?: string;
  Mobile?: string;
  Designation?: string;
  Department?: string;
  Account_Name?: {
    name?: string;
    id?: string;
  };
  Mailing_Street?: string;
  Mailing_City?: string;
  Mailing_State?: string;
  Mailing_Zip?: string;
  Mailing_Country?: string;
  Full_Name?: string;
  First_Name?: string;
  Last_Name?: string;
  id: string;
  Created_Time?: string;
  Modified_Time?: string;
  Created_By?: {
    name?: string;
    id?: string;
  };
  Modified_By?: {
    name?: string;
    id?: string;
  };
  [key: string]: unknown;
}

export interface ZohoDeal {
  Deal_Name?: string;
  Amount?: string;
  Stage?: string;
  Closing_Date?: string;
  Description?: string;
  Account_Name?: {
    name?: string;
    id?: string;
  };
  Contact_Name?: {
    name?: string;
    id?: string;
  };
  Pipeline?: string;
  Probability?: string;
  id: string;
  Created_Time?: string;
  Modified_Time?: string;
  Created_By?: {
    name?: string;
    id?: string;
  };
  Modified_By?: {
    name?: string;
    id?: string;
  };
  [key: string]: unknown;
}

export interface ZohoApiResponse<T> {
  data?: T[];
  info?: {
    per_page: number;
    count: number;
    page: number;
    more_records: boolean;
  };
  users?: Array<{ id: string; name: string; email: string }>;
}

export interface ZohoError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ZohoClient {
  private client: AxiosInstance;
  private tokens: OAuthTokens | null = null;
  private dataCenter: string;

  constructor() {
    this.dataCenter = config.zoho.dataCenter;
    this.client = axios.create({
      baseURL: `${config.zoho.apiBaseUrl}/crm/${this.getApiVersion()}`,
      timeout: 30000,
    });
  }

  private getApiVersion(): string {
    return 'v2';
  }

  private getAccountsUrl(): string {
    return `https://accounts.zoho.${this.getDataCenterTLD()}`;
  }

  private getDataCenterTLD(): string {
    switch (this.dataCenter) {
      case 'us':
        return 'com';
      case 'eu':
        return 'eu';
      case 'in':
        return 'in';
      case 'au':
        return 'com.au';
      default:
        return 'com';
    }
  }

  /**
   * Generate the OAuth authorization URL for Zoho
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.zoho.clientId,
      redirect_uri: config.zoho.redirectUri,
      scope: 'ZohoCRM.modules.contacts.READ,ZohoCRM.modules.contacts.UPDATE,ZohoCRM.modules.deals.READ,ZohoCRM.modules.deals.UPDATE,ZohoCRM.modules.deals.CREATE,ZohoCRM.modules.activities.ALL',
      access_type: 'offline',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.getAccountsUrl()}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        `${this.getAccountsUrl()}/oauth/v2/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.zoho.clientId,
          client_secret: config.zoho.clientSecret,
          redirect_uri: config.zoho.redirectUri,
          code,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokens: OAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      this.tokens = tokens;
      return tokens;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Refresh the access token
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        `${this.getAccountsUrl()}/oauth/v2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.zoho.clientId,
          client_secret: config.zoho.clientSecret,
          refresh_token: refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokens: OAuthTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        expiresAt: Date.now() + response.data.expires_in * 1000,
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope,
      };

      this.tokens = tokens;
      return tokens;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Set the current tokens (e.g., from database)
   */
  setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get the current access token, refreshing if necessary
   */
  async getValidToken(refreshToken?: string): Promise<string> {
    if (!this.tokens) {
      throw new Error('No tokens set. Please authenticate first.');
    }

    // Check if token is expired or about to expire (5 min buffer)
    if (Date.now() >= this.tokens.expiresAt - 5 * 60 * 1000) {
      if (!refreshToken && !this.tokens.refreshToken) {
        throw new Error('Token expired and no refresh token available');
      }

      const newTokens = await this.refreshTokens(refreshToken || this.tokens.refreshToken!);
      return newTokens.accessToken;
    }

    return this.tokens.accessToken;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    params?: Record<string, string | number>,
    refreshToken?: string
  ): Promise<T> {
    const accessToken = await this.getValidToken(refreshToken);

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        params,
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // Check for Zoho-specific errors in response
      if (response.data && typeof response.data === 'object' && 'code' in response.data) {
        const errorData = response.data as unknown as { code: string; message: string };
        throw new Error(`Zoho API Error (${errorData.code}): ${errorData.message}`);
      }

      return response.data;
    } catch (error) {
      // If 401, try to refresh and retry once
      if (this.isAuthError(error) && refreshToken) {
        const newToken = await this.getValidToken(refreshToken);
        const retryResponse = await this.client.request<T>({
          method,
          url: path,
          data,
          params,
          headers: {
            'Authorization': `Zoho-oauthtoken ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return retryResponse.data;
      }

      throw this.handleError(error);
    }
  }

  /**
   * Check if error is an authentication error
   */
  private isAuthError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      return error.response?.status === 401;
    }
    return false;
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;

      if (axiosError.response?.data) {
        const data = axiosError.response.data;
        if (typeof data === 'object' && 'message' in data && data.message) {
          return new Error(`Zoho API Error: ${data.message}`);
        }
      }

      if (axiosError.response?.status) {
        return new Error(`Zoho API Error (${axiosError.response.status}): ${axiosError.message}`);
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new Error('Zoho API timeout');
      }
    }

    return error instanceof Error ? error : new Error('Unknown Zoho error');
  }

  // ============================================
  // Contacts API
  // ============================================

  /**
   * Get all contacts with pagination
   */
  async getContacts(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoContact>> {
    return this.request<ZohoApiResponse<ZohoContact>>(
      'GET',
      '/contacts',
      undefined,
      { page, per_page: perPage }
    );
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: string): Promise<ZohoApiResponse<ZohoContact>> {
    return this.request<ZohoApiResponse<ZohoContact>>(
      'GET',
      `/contacts/${contactId}`,
      undefined
    );
  }

  /**
   * Create a new contact
   */
  async createContact(contactData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoContact>> {
    return this.request<ZohoApiResponse<ZohoContact>>(
      'POST',
      '/contacts',
      { data: [contactData] }
    );
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    contactId: string,
    contactData: Record<string, unknown>
  ): Promise<ZohoApiResponse<ZohoContact>> {
    return this.request<ZohoApiResponse<ZohoContact>>(
      'PUT',
      `/contacts/${contactId}`,
      { data: [contactData] }
    );
  }

  /**
   * Upsert a contact (create or update)
   */
  async upsertContact(contactData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoContact>> {
    // Try to find by email first
    const email = contactData.Email as string || contactData.Email as string;
    if (email) {
      try {
        const searchResponse = await this.searchContacts(email);
        if (searchResponse.data && searchResponse.data.length > 0) {
          const existingContact = searchResponse.data[0];
          return this.updateContact(existingContact.id, { ...contactData, id: existingContact.id });
        }
      } catch {
        // Search failed, proceed to create
      }
    }

    return this.createContact(contactData);
  }

  /**
   * Search contacts by email
   */
  async searchContacts(email: string): Promise<ZohoApiResponse<ZohoContact>> {
    return this.request<ZohoApiResponse<ZohoContact>>(
      'GET',
      '/contacts/search',
      undefined,
      { email }
    );
  }

  // ============================================
  // Deals API
  // ============================================

  /**
   * Get all deals with pagination
   */
  async getDeals(page = 1, perPage = 200): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.request<ZohoApiResponse<ZohoDeal>>(
      'GET',
      '/deals',
      undefined,
      { page, per_page: perPage }
    );
  }

  /**
   * Get a single deal by ID
   */
  async getDeal(dealId: string): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.request<ZohoApiResponse<ZohoDeal>>(
      'GET',
      `/deals/${dealId}`,
      undefined
    );
  }

  /**
   * Create a new deal
   */
  async createDeal(dealData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.request<ZohoApiResponse<ZohoDeal>>(
      'POST',
      '/deals',
      { data: [dealData] }
    );
  }

  /**
   * Update an existing deal
   */
  async updateDeal(
    dealId: string,
    dealData: Record<string, unknown>
  ): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.request<ZohoApiResponse<ZohoDeal>>(
      'PUT',
      `/deals/${dealId}`,
      { data: [{ id: dealId, ...dealData }] }
    );
  }

  /**
   * Search deals by name
   */
  async searchDeals(name: string): Promise<ZohoApiResponse<ZohoDeal>> {
    return this.request<ZohoApiResponse<ZohoDeal>>(
      'GET',
      '/deals/search',
      undefined,
      { criteria: `(Deal_Name:equals:${encodeURIComponent(name)})` }
    );
  }

  // ============================================
  // Users API
  // ============================================

  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<{ users?: Array<{ id: string; name: string; email: string }> }> {
    return this.request<{ users?: Array<{ id: string; name: string; email: string }> }>(
      'GET',
      '/users',
      undefined,
      { type: 'CurrentUser' }
    );
  }

  // ============================================
  // Activities API
  // ============================================

  /**
   * Create a task (activity)
   */
  async createTask(taskData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>> {
    return this.request<ZohoApiResponse<unknown>>(
      'POST',
      '/tasks',
      { data: [taskData] }
    );
  }

  /**
   * Create an event
   */
  async createEvent(eventData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>> {
    return this.request<ZohoApiResponse<unknown>>(
      'POST',
      '/events',
      { data: [eventData] }
    );
  }

  /**
   * Log a call
   */
  async logCall(callData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>> {
    return this.request<ZohoApiResponse<unknown>>(
      'POST',
      '/calls',
      { data: [callData] }
    );
  }

  // ============================================
  // Account Info
  // ============================================

  /**
   * Get organization info
   */
  async getOrgInfo(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      '/settings/org',
      undefined
    );
  }
}

// Singleton instance
export const zohoClient = new ZohoClient();

export default zohoClient;
