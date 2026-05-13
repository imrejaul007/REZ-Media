import { CRMConnection } from '../models/CRMConnection.js';
import { hubspotClient } from '../clients/hubspotClient.js';
import { zohoClient } from '../clients/zohoClient.js';
import { CRMProvider, OAuthTokens } from '../types/index.js';

export interface AuthResult {
  success: boolean;
  provider: CRMProvider;
  message: string;
  accountInfo?: Record<string, unknown>;
}

export class AuthService {
  /**
   * Get the authorization URL for HubSpot OAuth
   */
  getHubSpotAuthUrl(state?: string): string {
    return hubspotClient.getAuthorizationUrl(state);
  }

  /**
   * Get the authorization URL for Zoho OAuth
   */
  getZohoAuthUrl(state?: string): string {
    return zohoClient.getAuthorizationUrl(state);
  }

  /**
   * Handle HubSpot OAuth callback
   */
  async handleHubSpotCallback(code: string): Promise<AuthResult> {
    try {
      // Exchange code for tokens
      const tokens = await hubspotClient.exchangeCodeForTokens(code);

      // Get account info
      let accountInfo: Record<string, unknown> = {};
      try {
        accountInfo = await hubspotClient.getAccountInfo();
      } catch {
        // Account info is optional, continue even if it fails
      }

      // Save or update connection
      await this.saveConnection(CRMProvider.HUBSPOT, tokens, accountInfo);

      return {
        success: true,
        provider: CRMProvider.HUBSPOT,
        message: 'Successfully connected to HubSpot',
        accountInfo,
      };
    } catch (error) {
      return {
        success: false,
        provider: CRMProvider.HUBSPOT,
        message: error instanceof Error ? error.message : 'Failed to connect to HubSpot',
      };
    }
  }

  /**
   * Handle Zoho OAuth callback
   */
  async handleZohoCallback(code: string): Promise<AuthResult> {
    try {
      // Exchange code for tokens
      const tokens = await zohoClient.exchangeCodeForTokens(code);

      // Get account info
      let accountInfo: Record<string, unknown> = {};
      try {
        const orgInfo = await zohoClient.getOrgInfo();
        accountInfo = orgInfo;
      } catch {
        // Account info is optional, continue even if it fails
      }

      // Save or update connection
      await this.saveConnection(CRMProvider.ZOHO, tokens, accountInfo);

      return {
        success: true,
        provider: CRMProvider.ZOHO,
        message: 'Successfully connected to Zoho CRM',
        accountInfo,
      };
    } catch (error) {
      return {
        success: false,
        provider: CRMProvider.ZOHO,
        message: error instanceof Error ? error.message : 'Failed to connect to Zoho CRM',
      };
    }
  }

  /**
   * Save or update a CRM connection with tokens
   */
  private async saveConnection(
    provider: CRMProvider,
    tokens: OAuthTokens,
    accountInfo: Record<string, unknown>
  ): Promise<void> {
    const connection = await CRMConnection.findByProvider(provider);

    if (connection) {
      connection.setTokens(tokens);
      connection.accountInfo = accountInfo;
      await connection.save();
    } else {
      const newConnection = new CRMConnection({
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
  async disconnect(provider: CRMProvider): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await CRMConnection.findByProvider(provider);

      if (!connection) {
        return { success: false, message: `No connection found for ${provider}` };
      }

      connection.clearTokens();
      await connection.save();

      return { success: true, message: `Successfully disconnected from ${provider}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Get connection status for a provider
   */
  async getConnectionStatus(provider: CRMProvider): Promise<{
    connected: boolean;
    lastSync: string | null;
    syncEnabled: boolean;
    accountInfo?: Record<string, unknown>;
  }> {
    const connection = await CRMConnection.findByProvider(provider);

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
      accountInfo: connection.accountInfo as Record<string, unknown> | undefined,
    };
  }

  /**
   * Get all connection statuses
   */
  async getAllConnectionStatuses(): Promise<{
    hubspot: { connected: boolean; lastSync: string | null; syncEnabled: boolean };
    zoho: { connected: boolean; lastSync: string | null; syncEnabled: boolean };
  }> {
    const [hubspotStatus, zohoStatus] = await Promise.all([
      this.getConnectionStatus(CRMProvider.HUBSPOT),
      this.getConnectionStatus(CRMProvider.ZOHO),
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
  async getValidTokens(provider: CRMProvider): Promise<OAuthTokens | null> {
    const connection = await CRMConnection.findByProvider(provider);

    if (!connection || !connection.tokens) {
      return null;
    }

    // Check if token needs refresh
    if (connection.isTokenExpired()) {
      try {
        let newTokens: OAuthTokens;

        if (provider === CRMProvider.HUBSPOT) {
          hubspotClient.setTokens(connection.tokens);
          newTokens = await hubspotClient.refreshTokens(connection.tokens.refreshToken!);
        } else {
          zohoClient.setTokens(connection.tokens);
          newTokens = await zohoClient.refreshTokens(connection.tokens.refreshToken!);
        }

        // Update stored tokens
        connection.setTokens(newTokens);
        await connection.save();

        return newTokens;
      } catch {
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
  async setClientTokens(provider: CRMProvider): Promise<void> {
    const tokens = await this.getValidTokens(provider);

    if (tokens) {
      if (provider === CRMProvider.HUBSPOT) {
        hubspotClient.setTokens(tokens);
      } else {
        zohoClient.setTokens(tokens);
      }
    }
  }

  /**
   * Initialize client tokens from database on startup
   */
  async initializeClientTokens(): Promise<void> {
    const connections = await CRMConnection.findAllConnected();

    for (const connection of connections) {
      if (connection.tokens) {
        if (connection.provider === CRMProvider.HUBSPOT) {
          hubspotClient.setTokens(connection.tokens);
        } else {
          zohoClient.setTokens(connection.tokens);
        }
      }
    }
  }
}

export const authService = new AuthService();

export default authService;
