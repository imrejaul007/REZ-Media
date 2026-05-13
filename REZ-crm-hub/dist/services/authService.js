"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const CRMConnection_js_1 = require("../models/CRMConnection.js");
const hubspotClient_js_1 = require("../clients/hubspotClient.js");
const zohoClient_js_1 = require("../clients/zohoClient.js");
const index_js_1 = require("../types/index.js");
class AuthService {
    /**
     * Get the authorization URL for HubSpot OAuth
     */
    getHubSpotAuthUrl(state) {
        return hubspotClient_js_1.hubspotClient.getAuthorizationUrl(state);
    }
    /**
     * Get the authorization URL for Zoho OAuth
     */
    getZohoAuthUrl(state) {
        return zohoClient_js_1.zohoClient.getAuthorizationUrl(state);
    }
    /**
     * Handle HubSpot OAuth callback
     */
    async handleHubSpotCallback(code) {
        try {
            // Exchange code for tokens
            const tokens = await hubspotClient_js_1.hubspotClient.exchangeCodeForTokens(code);
            // Get account info
            let accountInfo = {};
            try {
                accountInfo = await hubspotClient_js_1.hubspotClient.getAccountInfo();
            }
            catch {
                // Account info is optional, continue even if it fails
            }
            // Save or update connection
            await this.saveConnection(index_js_1.CRMProvider.HUBSPOT, tokens, accountInfo);
            return {
                success: true,
                provider: index_js_1.CRMProvider.HUBSPOT,
                message: 'Successfully connected to HubSpot',
                accountInfo,
            };
        }
        catch (error) {
            return {
                success: false,
                provider: index_js_1.CRMProvider.HUBSPOT,
                message: error instanceof Error ? error.message : 'Failed to connect to HubSpot',
            };
        }
    }
    /**
     * Handle Zoho OAuth callback
     */
    async handleZohoCallback(code) {
        try {
            // Exchange code for tokens
            const tokens = await zohoClient_js_1.zohoClient.exchangeCodeForTokens(code);
            // Get account info
            let accountInfo = {};
            try {
                const orgInfo = await zohoClient_js_1.zohoClient.getOrgInfo();
                accountInfo = orgInfo;
            }
            catch {
                // Account info is optional, continue even if it fails
            }
            // Save or update connection
            await this.saveConnection(index_js_1.CRMProvider.ZOHO, tokens, accountInfo);
            return {
                success: true,
                provider: index_js_1.CRMProvider.ZOHO,
                message: 'Successfully connected to Zoho CRM',
                accountInfo,
            };
        }
        catch (error) {
            return {
                success: false,
                provider: index_js_1.CRMProvider.ZOHO,
                message: error instanceof Error ? error.message : 'Failed to connect to Zoho CRM',
            };
        }
    }
    /**
     * Save or update a CRM connection with tokens
     */
    async saveConnection(provider, tokens, accountInfo) {
        const connection = await CRMConnection_js_1.CRMConnection.findByProvider(provider);
        if (connection) {
            connection.setTokens(tokens);
            connection.accountInfo = accountInfo;
            await connection.save();
        }
        else {
            const newConnection = new CRMConnection_js_1.CRMConnection({
                provider,
                isConnected: true,
                tokens,
                accountInfo,
                syncEnabled: true,
            });
            await newConnection.save();
        }
    }
    /**
     * Disconnect a CRM provider
     */
    async disconnect(provider) {
        try {
            const connection = await CRMConnection_js_1.CRMConnection.findByProvider(provider);
            if (!connection) {
                return { success: false, message: `No connection found for ${provider}` };
            }
            connection.clearTokens();
            await connection.save();
            return { success: true, message: `Successfully disconnected from ${provider}` };
        }
        catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to disconnect',
            };
        }
    }
    /**
     * Get connection status for a provider
     */
    async getConnectionStatus(provider) {
        const connection = await CRMConnection_js_1.CRMConnection.findByProvider(provider);
        if (!connection) {
            return {
                connected: false,
                lastSync: null,
                syncEnabled: false,
            };
        }
        return {
            connected: connection.isConnected,
            lastSync: connection.lastSyncAt?.toISOString() || null,
            syncEnabled: connection.syncEnabled,
            accountInfo: connection.accountInfo,
        };
    }
    /**
     * Get all connection statuses
     */
    async getAllConnectionStatuses() {
        const [hubspotStatus, zohoStatus] = await Promise.all([
            this.getConnectionStatus(index_js_1.CRMProvider.HUBSPOT),
            this.getConnectionStatus(index_js_1.CRMProvider.ZOHO),
        ]);
        return {
            hubspot: {
                connected: hubspotStatus.connected,
                lastSync: hubspotStatus.lastSync,
                syncEnabled: hubspotStatus.syncEnabled,
            },
            zoho: {
                connected: zohoStatus.connected,
                lastSync: zohoStatus.lastSync,
                syncEnabled: zohoStatus.syncEnabled,
            },
        };
    }
    /**
     * Get valid tokens for a provider, refreshing if necessary
     */
    async getValidTokens(provider) {
        const connection = await CRMConnection_js_1.CRMConnection.findByProvider(provider);
        if (!connection || !connection.tokens) {
            return null;
        }
        // Check if token needs refresh
        if (connection.isTokenExpired()) {
            try {
                let newTokens;
                if (provider === index_js_1.CRMProvider.HUBSPOT) {
                    hubspotClient_js_1.hubspotClient.setTokens(connection.tokens);
                    newTokens = await hubspotClient_js_1.hubspotClient.refreshTokens(connection.tokens.refreshToken);
                }
                else {
                    zohoClient_js_1.zohoClient.setTokens(connection.tokens);
                    newTokens = await zohoClient_js_1.zohoClient.refreshTokens(connection.tokens.refreshToken);
                }
                // Update stored tokens
                connection.setTokens(newTokens);
                await connection.save();
                return newTokens;
            }
            catch {
                // Token refresh failed, clear connection
                connection.clearTokens();
                await connection.save();
                return null;
            }
        }
        return connection.tokens;
    }
    /**
     * Set tokens directly (used when loading from database)
     */
    async setClientTokens(provider) {
        const tokens = await this.getValidTokens(provider);
        if (tokens) {
            if (provider === index_js_1.CRMProvider.HUBSPOT) {
                hubspotClient_js_1.hubspotClient.setTokens(tokens);
            }
            else {
                zohoClient_js_1.zohoClient.setTokens(tokens);
            }
        }
    }
    /**
     * Initialize client tokens from database on startup
     */
    async initializeClientTokens() {
        const connections = await CRMConnection_js_1.CRMConnection.findAllConnected();
        for (const connection of connections) {
            if (connection.tokens) {
                if (connection.provider === index_js_1.CRMProvider.HUBSPOT) {
                    hubspotClient_js_1.hubspotClient.setTokens(connection.tokens);
                }
                else {
                    zohoClient_js_1.zohoClient.setTokens(connection.tokens);
                }
            }
        }
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
exports.default = exports.authService;
//# sourceMappingURL=authService.js.map