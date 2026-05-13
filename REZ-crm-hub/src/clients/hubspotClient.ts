import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';
import { OAuthTokens } from '../types/index.js';

export interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    mobilephone?: string;
    company?: string;
    jobtitle?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    notes_last_updated?: string;
    createdate?: string;
    lastmodifieddate?: string;
    lifecyclestage?: string;
    hs_lead_status?: string;
    hubspot_owner_id?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    amount?: string;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    createdate?: string;
    description?: string;
    hs_lastmodifieddate?: string;
    hubspot_owner_id?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContactListResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
      link?: string;
    };
  };
  total: number;
}

export interface HubSpotDealListResponse {
  results: HubSpotDeal[];
  paging?: {
    next?: {
      after: string;
      link?: string;
    };
  };
  total: number;
}

export interface HubSpotError {
  message: string;
  category: string;
  status?: string;
}

export class HubSpotClient {
  private client: AxiosInstance;
  private tokens: OAuthTokens | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.hubspot.apiBaseUrl,
      timeout: 30000,
    });
  }

  /**
   * Generate the OAuth authorization URL for HubSpot
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.hubspot.clientId,
      redirect_uri: config.hubspot.redirectUri,
      scope: config.hubspot.scopes.join(' '),
      response_type: 'code',
    });

    if (state) {
      params.append('state', state);
    }

    return `${config.hubspot.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    try {
      const response = await axios.post(
        config.hubspot.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.hubspot.clientId,
          client_secret: config.hubspot.clientSecret,
          redirect_uri: config.hubspot.redirectUri,
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
        config.hubspot.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.hubspot.clientId,
          client_secret: config.hubspot.clientSecret,
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
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    data?: unknown,
    refreshToken?: string
  ): Promise<T> {
    const accessToken = await this.getValidToken(refreshToken);

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      // If 401, try to refresh and retry once
      if (this.isAuthError(error) && refreshToken) {
        const newToken = await this.getValidToken(refreshToken);
        const retryResponse = await this.client.request<T>({
          method,
          url: path,
          data,
          headers: {
            'Authorization': `Bearer ${newToken}`,
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
      const axiosError = error as AxiosError<HubSpotError>;

      if (axiosError.response?.data?.message) {
        return new Error(`HubSpot API Error: ${axiosError.response.data.message}`);
      }

      if (axiosError.response?.status) {
        return new Error(`HubSpot API Error (${axiosError.response.status}): ${axiosError.message}`);
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new Error('HubSpot API timeout');
      }
    }

    return error instanceof Error ? error : new Error('Unknown HubSpot error');
  }

  // ============================================
  // Contacts API
  // ============================================

  /**
   * Get all contacts with pagination
   */
  async getContacts(
    after?: string,
    limit = 100
  ): Promise<HubSpotContactListResponse> {
    const params: Record<string, string | number> = { limit };
    if (after) {
      params.after = after;
    }

    return this.request<HubSpotContactListResponse>(
      'POST',
      '/crm/v3/objects/contacts/search',
      {
        properties: [
          'email', 'firstname', 'lastname', 'phone', 'mobilephone',
          'company', 'jobtitle', 'address', 'city', 'state', 'zip', 'country',
          'notes_last_updated', 'createdate', 'lastmodifieddate',
          'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id',
        ],
        filterGroups: [],
        sorts: [{ propertyName: 'lastmodifieddate', direction: 'DESCENDING' }],
        after: after || '0',
        limit,
      }
    );
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: string): Promise<HubSpotContact> {
    return this.request<HubSpotContact>(
      'GET',
      `/crm/v3/objects/contacts/${contactId}`,
      undefined
    );
  }

  /**
   * Create a new contact
   */
  async createContact(properties: Record<string, unknown>): Promise<HubSpotContact> {
    return this.request<HubSpotContact>(
      'POST',
      '/crm/v3/objects/contacts',
      { properties }
    );
  }

  /**
   * Update an existing contact
   */
  async updateContact(
    contactId: string,
    properties: Record<string, unknown>
  ): Promise<HubSpotContact> {
    return this.request<HubSpotContact>(
      'PATCH',
      `/crm/v3/objects/contacts/${contactId}`,
      { properties }
    );
  }

  /**
   * Upsert a contact (create or update by email)
   */
  async upsertContact(properties: Record<string, unknown>): Promise<HubSpotContact> {
    // First try to find by email
    const email = properties.email as string;
    if (email) {
      const searchResponse = await this.request<HubSpotContactListResponse>(
        'POST',
        '/crm/v3/objects/contacts/search',
        {
          filterGroups: [
            {
              filters: [
                { propertyName: 'email', operator: 'EQ', value: email },
              ],
            },
          ],
          properties: ['id', 'email'],
          limit: 1,
        }
      );

      if (searchResponse.results.length > 0) {
        return this.updateContact(searchResponse.results[0].id, properties);
      }
    }

    return this.createContact(properties);
  }

  // ============================================
  // Deals API
  // ============================================

  /**
   * Get all deals with pagination
   */
  async getDeals(
    after?: string,
    limit = 100
  ): Promise<HubSpotDealListResponse> {
    return this.request<HubSpotDealListResponse>(
      'POST',
      '/crm/v3/objects/deals/search',
      {
        properties: [
          'dealname', 'amount', 'dealstage', 'pipeline',
          'closedate', 'createdate', 'description',
          'hs_lastmodifieddate', 'hubspot_owner_id',
        ],
        filterGroups: [],
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
        after: after || '0',
        limit,
      }
    );
  }

  /**
   * Get a single deal by ID
   */
  async getDeal(dealId: string): Promise<HubSpotDeal> {
    return this.request<HubSpotDeal>(
      'GET',
      `/crm/v3/objects/deals/${dealId}`,
      undefined
    );
  }

  /**
   * Create a new deal
   */
  async createDeal(properties: Record<string, unknown>): Promise<HubSpotDeal> {
    return this.request<HubSpotDeal>(
      'POST',
      '/crm/v3/objects/deals',
      { properties }
    );
  }

  /**
   * Update an existing deal
   */
  async updateDeal(
    dealId: string,
    properties: Record<string, unknown>
  ): Promise<HubSpotDeal> {
    return this.request<HubSpotDeal>(
      'PATCH',
      `/crm/v3/objects/deals/${dealId}`,
      { properties }
    );
  }

  // ============================================
  // Activities API
  // ============================================

  /**
   * Create a note (activity)
   */
  async createNote(
    properties: Record<string, unknown>,
    associations?: Array<{ to: { id: string }; types: Array<{ associationCategory: string; associationTypeId: number }> }>
  ): Promise<unknown> {
    return this.request(
      'POST',
      '/crm/v3/objects/notes',
      {
        properties,
        associations,
      }
    );
  }

  /**
   * Create an engagement (task, email, call)
   */
  async createEngagement(
    type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK',
    properties: Record<string, unknown>,
    associations?: Array<{ to: { id: string }; types: Array<{ associationCategory: string; associationTypeId: number }> }>
  ): Promise<unknown> {
    const body = {
      engagement: {
        active: true,
        type,
      },
      associations,
      metadata: properties,
    };

    return this.request(
      'POST',
      '/engagements/v1/engagements',
      body
    );
  }

  // ============================================
  // Account Info
  // ============================================

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      'GET',
      '/account-info/v2/details'
    );
  }
}

// Singleton instance
export const hubspotClient = new HubSpotClient();

export default hubspotClient;
