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
exports.hubspotClient = exports.HubSpotClient = void 0;
const axios_1 = __importStar(require("axios"));
const index_js_1 = require("../config/index.js");
class HubSpotClient {
    client;
    tokens = null;
    constructor() {
        this.client = axios_1.default.create({
            baseURL: index_js_1.config.hubspot.apiBaseUrl,
            timeout: 30000,
        });
    }
    /**
     * Generate the OAuth authorization URL for HubSpot
     */
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: index_js_1.config.hubspot.clientId,
            redirect_uri: index_js_1.config.hubspot.redirectUri,
            scope: index_js_1.config.hubspot.scopes.join(' '),
            response_type: 'code',
        });
        if (state) {
            params.append('state', state);
        }
        return `${index_js_1.config.hubspot.authUrl}?${params.toString()}`;
    }
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code) {
        try {
            const response = await axios_1.default.post(index_js_1.config.hubspot.tokenUrl, new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: index_js_1.config.hubspot.clientId,
                client_secret: index_js_1.config.hubspot.clientSecret,
                redirect_uri: index_js_1.config.hubspot.redirectUri,
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
            const response = await axios_1.default.post(index_js_1.config.hubspot.tokenUrl, new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: index_js_1.config.hubspot.clientId,
                client_secret: index_js_1.config.hubspot.clientSecret,
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
    async request(method, path, data, refreshToken) {
        const accessToken = await this.getValidToken(refreshToken);
        try {
            const response = await this.client.request({
                method,
                url: path,
                data,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
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
    async getContacts(after, limit = 100) {
        const params = { limit };
        if (after) {
            params.after = after;
        }
        return this.request('POST', '/crm/v3/objects/contacts/search', {
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
        });
    }
    /**
     * Get a single contact by ID
     */
    async getContact(contactId) {
        return this.request('GET', `/crm/v3/objects/contacts/${contactId}`, undefined);
    }
    /**
     * Create a new contact
     */
    async createContact(properties) {
        return this.request('POST', '/crm/v3/objects/contacts', { properties });
    }
    /**
     * Update an existing contact
     */
    async updateContact(contactId, properties) {
        return this.request('PATCH', `/crm/v3/objects/contacts/${contactId}`, { properties });
    }
    /**
     * Upsert a contact (create or update by email)
     */
    async upsertContact(properties) {
        // First try to find by email
        const email = properties.email;
        if (email) {
            const searchResponse = await this.request('POST', '/crm/v3/objects/contacts/search', {
                filterGroups: [
                    {
                        filters: [
                            { propertyName: 'email', operator: 'EQ', value: email },
                        ],
                    },
                ],
                properties: ['id', 'email'],
                limit: 1,
            });
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
    async getDeals(after, limit = 100) {
        return this.request('POST', '/crm/v3/objects/deals/search', {
            properties: [
                'dealname', 'amount', 'dealstage', 'pipeline',
                'closedate', 'createdate', 'description',
                'hs_lastmodifieddate', 'hubspot_owner_id',
            ],
            filterGroups: [],
            sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
            after: after || '0',
            limit,
        });
    }
    /**
     * Get a single deal by ID
     */
    async getDeal(dealId) {
        return this.request('GET', `/crm/v3/objects/deals/${dealId}`, undefined);
    }
    /**
     * Create a new deal
     */
    async createDeal(properties) {
        return this.request('POST', '/crm/v3/objects/deals', { properties });
    }
    /**
     * Update an existing deal
     */
    async updateDeal(dealId, properties) {
        return this.request('PATCH', `/crm/v3/objects/deals/${dealId}`, { properties });
    }
    // ============================================
    // Activities API
    // ============================================
    /**
     * Create a note (activity)
     */
    async createNote(properties, associations) {
        return this.request('POST', '/crm/v3/objects/notes', {
            properties,
            associations,
        });
    }
    /**
     * Create an engagement (task, email, call)
     */
    async createEngagement(type, properties, associations) {
        const body = {
            engagement: {
                active: true,
                type,
            },
            associations,
            metadata: properties,
        };
        return this.request('POST', '/engagements/v1/engagements', body);
    }
    // ============================================
    // Account Info
    // ============================================
    /**
     * Get account information
     */
    async getAccountInfo() {
        return this.request('GET', '/account-info/v2/details');
    }
}
exports.HubSpotClient = HubSpotClient;
// Singleton instance
exports.hubspotClient = new HubSpotClient();
exports.default = exports.hubspotClient;
//# sourceMappingURL=hubspotClient.js.map