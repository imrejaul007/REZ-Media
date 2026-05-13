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
export declare class HubSpotClient {
    private client;
    private tokens;
    constructor();
    /**
     * Generate the OAuth authorization URL for HubSpot
     */
    getAuthorizationUrl(state?: string): string;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForTokens(code: string): Promise<OAuthTokens>;
    /**
     * Refresh the access token
     */
    refreshTokens(refreshToken: string): Promise<OAuthTokens>;
    /**
     * Set the current tokens (e.g., from database)
     */
    setTokens(tokens: OAuthTokens): void;
    /**
     * Get the current access token, refreshing if necessary
     */
    getValidToken(refreshToken?: string): Promise<string>;
    /**
     * Make an authenticated API request
     */
    private request;
    /**
     * Check if error is an authentication error
     */
    private isAuthError;
    /**
     * Handle API errors
     */
    private handleError;
    /**
     * Get all contacts with pagination
     */
    getContacts(after?: string, limit?: number): Promise<HubSpotContactListResponse>;
    /**
     * Get a single contact by ID
     */
    getContact(contactId: string): Promise<HubSpotContact>;
    /**
     * Create a new contact
     */
    createContact(properties: Record<string, unknown>): Promise<HubSpotContact>;
    /**
     * Update an existing contact
     */
    updateContact(contactId: string, properties: Record<string, unknown>): Promise<HubSpotContact>;
    /**
     * Upsert a contact (create or update by email)
     */
    upsertContact(properties: Record<string, unknown>): Promise<HubSpotContact>;
    /**
     * Get all deals with pagination
     */
    getDeals(after?: string, limit?: number): Promise<HubSpotDealListResponse>;
    /**
     * Get a single deal by ID
     */
    getDeal(dealId: string): Promise<HubSpotDeal>;
    /**
     * Create a new deal
     */
    createDeal(properties: Record<string, unknown>): Promise<HubSpotDeal>;
    /**
     * Update an existing deal
     */
    updateDeal(dealId: string, properties: Record<string, unknown>): Promise<HubSpotDeal>;
    /**
     * Create a note (activity)
     */
    createNote(properties: Record<string, unknown>, associations?: Array<{
        to: {
            id: string;
        };
        types: Array<{
            associationCategory: string;
            associationTypeId: number;
        }>;
    }>): Promise<unknown>;
    /**
     * Create an engagement (task, email, call)
     */
    createEngagement(type: 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'TASK', properties: Record<string, unknown>, associations?: Array<{
        to: {
            id: string;
        };
        types: Array<{
            associationCategory: string;
            associationTypeId: number;
        }>;
    }>): Promise<unknown>;
    /**
     * Get account information
     */
    getAccountInfo(): Promise<Record<string, unknown>>;
}
export declare const hubspotClient: HubSpotClient;
export default hubspotClient;
//# sourceMappingURL=hubspotClient.d.ts.map