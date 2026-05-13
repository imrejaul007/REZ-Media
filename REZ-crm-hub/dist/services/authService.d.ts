import { CRMProvider, OAuthTokens } from '../types/index.js';
export interface AuthResult {
    success: boolean;
    provider: CRMProvider;
    message: string;
    accountInfo?: Record<string, unknown>;
}
export declare class AuthService {
    /**
     * Get the authorization URL for HubSpot OAuth
     */
    getHubSpotAuthUrl(state?: string): string;
    /**
     * Get the authorization URL for Zoho OAuth
     */
    getZohoAuthUrl(state?: string): string;
    /**
     * Handle HubSpot OAuth callback
     */
    handleHubSpotCallback(code: string): Promise<AuthResult>;
    /**
     * Handle Zoho OAuth callback
     */
    handleZohoCallback(code: string): Promise<AuthResult>;
    /**
     * Save or update a CRM connection with tokens
     */
    private saveConnection;
    /**
     * Disconnect a CRM provider
     */
    disconnect(provider: CRMProvider): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get connection status for a provider
     */
    getConnectionStatus(provider: CRMProvider): Promise<{
        connected: boolean;
        lastSync: string | null;
        syncEnabled: boolean;
        accountInfo?: Record<string, unknown>;
    }>;
    /**
     * Get all connection statuses
     */
    getAllConnectionStatuses(): Promise<{
        hubspot: {
            connected: boolean;
            lastSync: string | null;
            syncEnabled: boolean;
        };
        zoho: {
            connected: boolean;
            lastSync: string | null;
            syncEnabled: boolean;
        };
    }>;
    /**
     * Get valid tokens for a provider, refreshing if necessary
     */
    getValidTokens(provider: CRMProvider): Promise<OAuthTokens | null>;
    /**
     * Set tokens directly (used when loading from database)
     */
    setClientTokens(provider: CRMProvider): Promise<void>;
    /**
     * Initialize client tokens from database on startup
     */
    initializeClientTokens(): Promise<void>;
}
export declare const authService: AuthService;
export default authService;
//# sourceMappingURL=authService.d.ts.map