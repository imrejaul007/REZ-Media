import { v4 as uuidv4 } from 'uuid';
import { Platform, PlatformError } from '../types';
import config, { platformConfig } from '../config';
import { ZendeskClient, createZendeskClient, ZendeskClientConfig } from '../clients/zendeskClient';
import { FreshdeskClient, createFreshdeskClient, FreshdeskClientConfig } from '../clients/freshdeskClient';
import { IntercomClient, createIntercomClient, IntercomClientConfig } from '../clients/intercomClient';
import {
  validateZendeskCredentials,
} from '../constants/zendeskFields';
import {
  validateFreshdeskCredentials,
} from '../constants/freshdeskFields';
import {
  validateIntercomCredentials,
} from '../constants/intercomFields';

export interface PlatformConnectionStatus {
  platform: Platform;
  isConnected: boolean;
  connectedAt?: Date;
  lastSyncAt?: Date;
  credentials: {
    configured: boolean;
    verified?: boolean;
    error?: string;
  };
}

export interface ConnectionResult {
  success: boolean;
  platform: Platform;
  message: string;
  connectedAt?: Date;
  error?: string;
}

// In-memory store for platform credentials (in production, use encrypted storage/DB)
const platformCredentials = new Map<Platform, Map<string, string>>();

// In-memory store for connection status
const connectionStatus = new Map<Platform, { connectedAt?: Date; lastSyncAt?: Date }>();

export class AuthService {
  private zendeskClient: ZendeskClient | null = null;
  private freshdeskClient: FreshdeskClient | null = null;
  private intercomClient: IntercomClient | null = null;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize with config credentials if available
    if (platformConfig.isZendeskConfigured()) {
      this.zendeskClient = createZendeskClient({
        subdomain: config.platforms.zendesk.subdomain,
        email: config.platforms.zendesk.email,
        apiToken: config.platforms.zendesk.apiToken,
        timeout: config.platforms.zendesk.timeout,
        retryAttempts: config.platforms.zendesk.retryAttempts,
      });
      connectionStatus.set('zendesk', {});
    }

    if (platformConfig.isFreshdeskConfigured()) {
      this.freshdeskClient = createFreshdeskClient({
        domain: config.platforms.freshdesk.domain,
        apiKey: config.platforms.freshdesk.apiKey,
        timeout: config.platforms.freshdesk.timeout,
        retryAttempts: config.platforms.freshdesk.retryAttempts,
      });
      connectionStatus.set('freshdesk', {});
    }

    if (platformConfig.isIntercomConfigured()) {
      this.intercomClient = createIntercomClient({
        accessToken: config.platforms.intercom.accessToken,
        timeout: config.platforms.intercom.timeout,
        retryAttempts: config.platforms.intercom.retryAttempts,
      });
      connectionStatus.set('intercom', {});
    }
  }

  // Get client for a specific platform
  getClient(platform: Platform): ZendeskClient | FreshdeskClient | IntercomClient | null {
    switch (platform) {
      case 'zendesk':
        return this.zendeskClient;
      case 'freshdesk':
        return this.freshdeskClient;
      case 'intercom':
        return this.intercomClient;
      default:
        return null;
    }
  }

  // Check if a platform client is configured
  isPlatformConfigured(platform: Platform): boolean {
    switch (platform) {
      case 'zendesk':
        return !!this.zendeskClient;
      case 'freshdesk':
        return !!this.freshdeskClient;
      case 'intercom':
        return !!this.intercomClient;
      default:
        return false;
    }
  }

  // Get all connection statuses
  getAllConnectionStatuses(): PlatformConnectionStatus[] {
    const statuses: PlatformConnectionStatus[] = [];

    // Zendesk
    statuses.push({
      platform: 'zendesk',
      isConnected: this.isPlatformConfigured('zendesk'),
      ...connectionStatus.get('zendesk'),
      credentials: {
        configured: platformConfig.isZendeskConfigured(),
        verified: this.zendeskClient ? true : undefined,
      },
    });

    // Freshdesk
    statuses.push({
      platform: 'freshdesk',
      isConnected: this.isPlatformConfigured('freshdesk'),
      ...connectionStatus.get('freshdesk'),
      credentials: {
        configured: platformConfig.isFreshdeskConfigured(),
        verified: this.freshdeskClient ? true : undefined,
      },
    });

    // Intercom
    statuses.push({
      platform: 'intercom',
      isConnected: this.isPlatformConfigured('intercom'),
      ...connectionStatus.get('intercom'),
      credentials: {
        configured: platformConfig.isIntercomConfigured(),
        verified: this.intercomClient ? true : undefined,
      },
    });

    return statuses;
  }

  // Connect Zendesk
  async connectZendesk(credentials: {
    subdomain?: string;
    email?: string;
    apiToken?: string;
  }): Promise<ConnectionResult> {
    // Validate credentials
    const validation = validateZendeskCredentials(credentials);
    if (!validation.valid) {
      return {
        success: false,
        platform: 'zendesk',
        message: validation.error!,
        error: validation.error,
      };
    }

    // Create client
    const clientConfig: ZendeskClientConfig = {
      subdomain: credentials.subdomain!,
      email: credentials.email!,
      apiToken: credentials.apiToken!,
      timeout: config.platforms.zendesk.timeout,
      retryAttempts: config.platforms.zendesk.retryAttempts,
    };

    const client = createZendeskClient(clientConfig);

    // Verify credentials
    const isValid = await client.verifyCredentials();
    if (!isValid) {
      return {
        success: false,
        platform: 'zendesk',
        message: 'Failed to verify Zendesk credentials. Please check your subdomain, email, and API token.',
        error: 'Invalid credentials',
      };
    }

    // Store client
    this.zendeskClient = client;

    // Store credentials securely
    const creds = new Map<string, string>();
    creds.set('subdomain', credentials.subdomain!);
    creds.set('email', credentials.email!);
    creds.set('apiToken', credentials.apiToken!);
    platformCredentials.set('zendesk', creds);

    // Update connection status
    const now = new Date();
    connectionStatus.set('zendesk', { connectedAt: now });

    return {
      success: true,
      platform: 'zendesk',
      message: 'Successfully connected to Zendesk',
      connectedAt: now,
    };
  }

  // Connect Freshdesk
  async connectFreshdesk(credentials: {
    domain?: string;
    apiKey?: string;
  }): Promise<ConnectionResult> {
    // Validate credentials
    const validation = validateFreshdeskCredentials(credentials);
    if (!validation.valid) {
      return {
        success: false,
        platform: 'freshdesk',
        message: validation.error!,
        error: validation.error,
      };
    }

    // Create client
    const clientConfig: FreshdeskClientConfig = {
      domain: credentials.domain!,
      apiKey: credentials.apiKey!,
      timeout: config.platforms.freshdesk.timeout,
      retryAttempts: config.platforms.freshdesk.retryAttempts,
    };

    const client = createFreshdeskClient(clientConfig);

    // Verify credentials
    const isValid = await client.verifyCredentials();
    if (!isValid) {
      return {
        success: false,
        platform: 'freshdesk',
        message: 'Failed to verify Freshdesk credentials. Please check your domain and API key.',
        error: 'Invalid credentials',
      };
    }

    // Store client
    this.freshdeskClient = client;

    // Store credentials securely
    const creds = new Map<string, string>();
    creds.set('domain', credentials.domain!);
    creds.set('apiKey', credentials.apiKey!);
    platformCredentials.set('freshdesk', creds);

    // Update connection status
    const now = new Date();
    connectionStatus.set('freshdesk', { connectedAt: now });

    return {
      success: true,
      platform: 'freshdesk',
      message: 'Successfully connected to Freshdesk',
      connectedAt: now,
    };
  }

  // Connect Intercom
  async connectIntercom(credentials: {
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
  }): Promise<ConnectionResult> {
    // Validate credentials
    const validation = validateIntercomCredentials(credentials);
    if (!validation.valid) {
      return {
        success: false,
        platform: 'intercom',
        message: validation.error!,
        error: validation.error,
      };
    }

    // Use access token if provided, otherwise OAuth would be needed
    let accessToken = credentials.accessToken;

    if (!accessToken && credentials.clientId && credentials.clientSecret) {
      // In a real implementation, this would exchange the code for a token
      // For now, we'll require the access token directly
      return {
        success: false,
        platform: 'intercom',
        message: 'OAuth token exchange not implemented. Please provide an access token.',
        error: 'OAuth not implemented',
      };
    }

    // Create client
    const clientConfig: IntercomClientConfig = {
      accessToken: accessToken!,
      timeout: config.platforms.intercom.timeout,
      retryAttempts: config.platforms.intercom.retryAttempts,
    };

    const client = createIntercomClient(clientConfig);

    // Verify credentials
    const isValid = await client.verifyCredentials();
    if (!isValid) {
      return {
        success: false,
        platform: 'intercom',
        message: 'Failed to verify Intercom credentials. Please check your access token.',
        error: 'Invalid credentials',
      };
    }

    // Store client
    this.intercomClient = client;

    // Store credentials securely
    const creds = new Map<string, string>();
    creds.set('accessToken', accessToken!);
    if (credentials.clientId) creds.set('clientId', credentials.clientId);
    if (credentials.clientSecret) creds.set('clientSecret', credentials.clientSecret);
    platformCredentials.set('intercom', creds);

    // Update connection status
    const now = new Date();
    connectionStatus.set('intercom', { connectedAt: now });

    return {
      success: true,
      platform: 'intercom',
      message: 'Successfully connected to Intercom',
      connectedAt: now,
    };
  }

  // Disconnect a platform
  disconnect(platform: Platform): ConnectionResult {
    switch (platform) {
      case 'zendesk':
        this.zendeskClient = null;
        platformCredentials.delete('zendesk');
        connectionStatus.delete('zendesk');
        break;
      case 'freshdesk':
        this.freshdeskClient = null;
        platformCredentials.delete('freshdesk');
        connectionStatus.delete('freshdesk');
        break;
      case 'intercom':
        this.intercomClient = null;
        platformCredentials.delete('intercom');
        connectionStatus.delete('intercom');
        break;
    }

    return {
      success: true,
      platform,
      message: `Successfully disconnected from ${platform}`,
    };
  }

  // Update last sync time
  updateLastSyncTime(platform: Platform): void {
    const status = connectionStatus.get(platform);
    if (status) {
      status.lastSyncAt = new Date();
    } else {
      connectionStatus.set(platform, { lastSyncAt: new Date() });
    }
  }

  // Get last sync time
  getLastSyncTime(platform: Platform): Date | undefined {
    return connectionStatus.get(platform)?.lastSyncAt;
  }

  // Get stored credentials for a platform (use carefully - these are sensitive)
  getStoredCredentials(platform: Platform): Map<string, string> | undefined {
    return platformCredentials.get(platform);
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}

export function resetAuthService(): void {
  authServiceInstance = null;
}

export default AuthService;
