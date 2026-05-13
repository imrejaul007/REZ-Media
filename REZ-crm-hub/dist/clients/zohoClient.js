"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.zohoClient = exports.ZohoClient = void 0;
const axios_1 = __importStar(require("axios"));
const index_js_1 = require("../config/index.js");
class ZohoClient {
    client;
    tokens = null;
    dataCenter;
    constructor() {
        this.dataCenter = index_js_1.config.zoho.dataCenter;
        this.client = axios_1.default.create({
            baseURL: `${index_js_1.config.zoho.apiBaseUrl}/crm/${this.getApiVersion()}`,
            timeout: 30000,
        });
    }
    getApiVersion() {
        return 'v2';
    }
    getAccountsUrl() {
        return `https://accounts.zoho.${this.getDataCenterTLD()}`;
    }
    getDataCenterTLD() {
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
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: index_js_1.config.zoho.clientId,
            redirect_uri: index_js_1.config.zoho.redirectUri,
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
    async exchangeCodeForTokens(code) {
        try {
            const response = await axios_1.default.post(`${this.getAccountsUrl()}/oauth/v2/token`, new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: index_js_1.config.zoho.clientId,
                client_secret: index_js_1.config.zoho.clientSecret,
                redirect_uri: index_js_1.config.zoho.redirectUri,
                code,
            }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const tokens = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresAt: Date.now() + response.data.expires_in * 1000,
                tokenType: response.data.token_type || 'Bearer',
                scope: response.data.scope,
            };
            this.tokens = tokens;
            return tokens;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    /**
     * Refresh the access token
     */
    async refreshTokens(refreshToken) {
        try {
            const response = await axios_1.default.post(`${this.getAccountsUrl()}/oauth/v2/token`, new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: index_js_1.config.zoho.clientId,
                client_secret: index_js_1.config.zoho.clientSecret,
                refresh_token: refreshToken,
            }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const tokens = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token || refreshToken,
                expiresAt: Date.now() + response.data.expires_in * 1000,
                tokenType: response.data.token_type || 'Bearer',
                scope: response.data.scope,
            };
            this.tokens = tokens;
            return tokens;
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    /**
     * Set the current tokens (e.g., from database)
     */
    setTokens(tokens) {
        this.tokens = tokens;
    }
    /**
     * Get the current access token, refreshing if necessary
     */
    async getValidToken(refreshToken) {
        if (!this.tokens) {
            throw new Error('No tokens set. Please authenticate first.');
        }
        // Check if token is expired or about to expire (5 min buffer)
        if (Date.now() >= this.tokens.expiresAt - 5 * 60 * 1000) {
            if (!refreshToken && !this.tokens.refreshToken) {
                throw new Error('Token expired and no refresh token available');
            }
            const newTokens = await this.refreshTokens(refreshToken || this.tokens.refreshToken);
            return newTokens.accessToken;
        }
        return this.tokens.accessToken;
    }
    /**
     * Make an authenticated API request
     */
    async request(method, path, data, params, refreshToken) {
        const accessToken = await this.getValidToken(refreshToken);
        try {
            const response = await this.client.request({
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
                const errorData = response.data;
                throw new Error(`Zoho API Error (${errorData.code}): ${errorData.message}`);
            }
            return response.data;
        }
        catch (error) {
            // If 401, try to refresh and retry once
            if (this.isAuthError(error) && refreshToken) {
                const newToken = await this.getValidToken(refreshToken);
                const retryResponse = await this.client.request({
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
    isAuthError(error) {
        if (error instanceof axios_1.AxiosError) {
            return error.response?.status === 401;
        }
        return false;
    }
    /**
     * Handle API errors
     */
    handleError(error) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
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
    async getContacts(page = 1, perPage = 200) {
        return this.request('GET', '/contacts', undefined, { page, per_page: perPage });
    }
    /**
     * Get a single contact by ID
     */
    async getContact(contactId) {
        return this.request('GET', `/contacts/${contactId}`, undefined);
    }
    /**
     * Create a new contact
     */
    async createContact(contactData) {
        return this.request('POST', '/contacts', { data: [contactData] });
    }
    /**
     * Update an existing contact
     */
    async updateContact(contactId, contactData) {
        return this.request('PUT', `/contacts/${contactId}`, { data: [contactData] });
    }
    /**
     * Upsert a contact (create or update)
     */
    async upsertContact(contactData) {
        // Try to find by email first
        const email = contactData.Email || contactData.Email;
        if (email) {
            try {
                const searchResponse = await this.searchContacts(email);
                if (searchResponse.data && searchResponse.data.length > 0) {
                    const existingContact = searchResponse.data[0];
                    return this.updateContact(existingContact.id, { ...contactData, id: existingContact.id });
                }
            }
            catch {
                // Search failed, proceed to create
            }
        }
        return this.createContact(contactData);
    }
    /**
     * Search contacts by email
     */
    async searchContacts(email) {
        return this.request('GET', '/contacts/search', undefined, { email });
    }
    // ============================================
    // Deals API
    // ============================================
    /**
     * Get all deals with pagination
     */
    async getDeals(page = 1, perPage = 200) {
        return this.request('GET', '/deals', undefined, { page, per_page: perPage });
    }
    /**
     * Get a single deal by ID
     */
    async getDeal(dealId) {
        return this.request('GET', `/deals/${dealId}`, undefined);
    }
    /**
     * Create a new deal
     */
    async createDeal(dealData) {
        return this.request('POST', '/deals', { data: [dealData] });
    }
    /**
     * Update an existing deal
     */
    async updateDeal(dealId, dealData) {
        return this.request('PUT', `/deals/${dealId}`, { data: [{ id: dealId, ...dealData }] });
    }
    /**
     * Search deals by name
     */
    async searchDeals(name) {
        return this.request('GET', '/deals/search', undefined, { criteria: `(Deal_Name:equals:${encodeURIComponent(name)})` });
    }
    // ============================================
    // Users API
    // ============================================
    /**
     * Get current user info
     */
    async getCurrentUser() {
        return this.request('GET', '/users', undefined, { type: 'CurrentUser' });
    }
    // ============================================
    // Activities API
    // ============================================
    /**
     * Create a task (activity)
     */
    async createTask(taskData) {
        return this.request('POST', '/tasks', { data: [taskData] });
    }
    /**
     * Create an event
     */
    async createEvent(eventData) {
        return this.request('POST', '/events', { data: [eventData] });
    }
    /**
     * Log a call
     */
    async logCall(callData) {
        return this.request('POST', '/calls', { data: [callData] });
    }
    // ============================================
    // Account Info
    // ============================================
    /**
     * Get organization info
     */
    async getOrgInfo() {
        return this.request('GET', '/settings/org', undefined);
    }
}
exports.ZohoClient = ZohoClient;
// Singleton instance
exports.zohoClient = new ZohoClient();
exports.default = exports.zohoClient;
//# sourceMappingURL=zohoClient.js.map