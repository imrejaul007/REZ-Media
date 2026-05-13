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
    users?: Array<{
        id: string;
        name: string;
        email: string;
    }>;
}
export interface ZohoError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export declare class ZohoClient {
    private client;
    private tokens;
    private dataCenter;
    constructor();
    private getApiVersion;
    private getAccountsUrl;
    private getDataCenterTLD;
    /**
     * Generate the OAuth authorization URL for Zoho
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
    getContacts(page?: number, perPage?: number): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Get a single contact by ID
     */
    getContact(contactId: string): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Create a new contact
     */
    createContact(contactData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Update an existing contact
     */
    updateContact(contactId: string, contactData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Upsert a contact (create or update)
     */
    upsertContact(contactData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Search contacts by email
     */
    searchContacts(email: string): Promise<ZohoApiResponse<ZohoContact>>;
    /**
     * Get all deals with pagination
     */
    getDeals(page?: number, perPage?: number): Promise<ZohoApiResponse<ZohoDeal>>;
    /**
     * Get a single deal by ID
     */
    getDeal(dealId: string): Promise<ZohoApiResponse<ZohoDeal>>;
    /**
     * Create a new deal
     */
    createDeal(dealData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoDeal>>;
    /**
     * Update an existing deal
     */
    updateDeal(dealId: string, dealData: Record<string, unknown>): Promise<ZohoApiResponse<ZohoDeal>>;
    /**
     * Search deals by name
     */
    searchDeals(name: string): Promise<ZohoApiResponse<ZohoDeal>>;
    /**
     * Get current user info
     */
    getCurrentUser(): Promise<{
        users?: Array<{
            id: string;
            name: string;
            email: string;
        }>;
    }>;
    /**
     * Create a task (activity)
     */
    createTask(taskData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>>;
    /**
     * Create an event
     */
    createEvent(eventData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>>;
    /**
     * Log a call
     */
    logCall(callData: Record<string, unknown>): Promise<ZohoApiResponse<unknown>>;
    /**
     * Get organization info
     */
    getOrgInfo(): Promise<Record<string, unknown>>;
}
export declare const zohoClient: ZohoClient;
export default zohoClient;
//# sourceMappingURL=zohoClient.d.ts.map