import { SyncHistory, ISyncHistoryDocument } from '../models/SyncHistory.js';
import { CRMConnection } from '../models/CRMConnection.js';
import { contactService } from './contactService.js';
import { dealService } from './dealService.js';
import { config } from '../config/index.js';
import {
  CRMProvider,
  SyncStatus,
  SyncDirection,
  SyncTriggerRequest,
  SyncStatusResponse,
} from '../types/index.js';

export interface SyncResult {
  success: boolean;
  provider: CRMProvider;
  contacts: {
    synced: number;
    errors: number;
  };
  deals: {
    synced: number;
    errors: number;
  };
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export class SyncService {
  private isSyncing = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the sync scheduler
   */
  startScheduler(): void {
    if (this.syncInterval) {
      return; // Already running
    }

    const intervalMs = config.sync.intervalMinutes * 60 * 1000;

    this.syncInterval = setInterval(async () => {
      await this.runScheduledSync();
    }, intervalMs);

    console.log(`Sync scheduler started. Running every ${config.sync.intervalMinutes} minutes.`);
  }

  /**
   * Stop the sync scheduler
   */
  stopScheduler(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Sync scheduler stopped.');
    }
  }

  /**
   * Run a scheduled sync for all connected providers
   */
  private async runScheduledSync(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping scheduled sync.');
      return;
    }

    console.log('Starting scheduled sync...');

    try {
      const connections = await CRMConnection.findAllConnected();

      for (const connection of connections) {
        await this.syncProvider(connection.provider, false);
      }

      console.log('Scheduled sync completed.');
    } catch (error) {
      console.error('Scheduled sync failed:', error);
    }
  }

  /**
   * Sync a specific provider
   */
  async syncProvider(
    provider: CRMProvider,
    recordHistory = true
  ): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        provider,
        contacts: { synced: 0, errors: 0 },
        deals: { synced: 0, errors: 0 },
        startedAt: new Date(),
        error: 'Sync already in progress',
      };
    }

    this.isSyncing = true;
    const startTime = new Date();

    // Create sync history records
    const contactSyncRecord = recordHistory ? await SyncHistory.create({
      provider,
      entityType: 'contact',
      direction: SyncDirection.IMPORT,
      status: SyncStatus.IN_PROGRESS,
      startedAt: startTime,
    }) : null;

    const dealSyncRecord = recordHistory ? await SyncHistory.create({
      provider,
      entityType: 'deal',
      direction: SyncDirection.IMPORT,
      status: SyncStatus.IN_PROGRESS,
      startedAt: startTime,
    }) : null;

    const result: SyncResult = {
      success: true,
      provider,
      contacts: { synced: 0, errors: 0 },
      deals: { synced: 0, errors: 0 },
      startedAt: startTime,
    };

    try {
      // Sync contacts
      const contactResult = await contactService.syncFromProvider(provider);
      result.contacts.synced = contactResult.synced;
      result.contacts.errors = contactResult.errors;

      if (contactSyncRecord) {
        if (contactResult.success) {
          contactSyncRecord.markCompleted(contactResult.synced, contactResult.errors);
        } else {
          contactSyncRecord.markFailed(contactResult.errorDetails[0]?.error);
        }
        await contactSyncRecord.save();
      }

      // Sync deals
      const dealResult = await dealService.syncFromProvider(provider);
      result.deals.synced = dealResult.synced;
      result.deals.errors = dealResult.errors;

      if (dealSyncRecord) {
        if (dealResult.success) {
          dealSyncRecord.markCompleted(dealResult.synced, dealResult.errors);
        } else {
          dealSyncRecord.markFailed(dealResult.errorDetails[0]?.error);
        }
        await dealSyncRecord.save();
      }

      // Update connection last sync time
      await this.updateConnectionLastSync(provider);

      result.success = contactResult.success && dealResult.success;
      result.completedAt = new Date();
    } catch (error) {
      result.success = false;
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.completedAt = new Date();

      if (contactSyncRecord) {
        contactSyncRecord.markFailed(result.error);
        await contactSyncRecord.save();
      }
      if (dealSyncRecord) {
        dealSyncRecord.markFailed(result.error);
        await dealSyncRecord.save();
      }
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Trigger a full sync manually
   */
  async triggerSync(request: SyncTriggerRequest): Promise<{
    success: boolean;
    results: SyncResult[];
    message: string;
  }> {
    if (this.isSyncing && !request.force) {
      return {
        success: false,
        results: [],
        message: 'Sync already in progress',
      };
    }

    const results: SyncResult[] = [];
    const providers = request.provider ? [request.provider] : [CRMProvider.HUBSPOT, CRMProvider.ZOHO];

    for (const provider of providers) {
      const connection = await CRMConnection.findOne({ provider, isConnected: true });
      if (!connection) {
        results.push({
          success: false,
          provider,
          contacts: { synced: 0, errors: 0 },
          deals: { synced: 0, errors: 0 },
          startedAt: new Date(),
          error: `${provider} is not connected`,
        });
        continue;
      }

      const result = await this.syncProvider(provider);
      results.push(result);
    }

    const allSuccess = results.every(r => r.success);

    return {
      success: allSuccess,
      results,
      message: allSuccess ? 'Sync completed successfully' : 'Sync completed with errors',
    };
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    const [hubspotConnection, zohoConnection, activeSync] = await Promise.all([
      CRMConnection.findOne({ provider: CRMProvider.HUBSPOT }),
      CRMConnection.findOne({ provider: CRMProvider.ZOHO }),
      SyncHistory.findActiveSync(),
    ]);

    const [hubspotPendingContacts, hubspotPendingDeals, zohoPendingContacts, zohoPendingDeals] = await Promise.all([
      contactService.getPendingContactsCount(CRMProvider.HUBSPOT),
      dealService.getPendingDealsCount(CRMProvider.HUBSPOT),
      contactService.getPendingContactsCount(CRMProvider.ZOHO),
      dealService.getPendingDealsCount(CRMProvider.ZOHO),
    ]);

    return {
      hubspot: {
        connected: hubspotConnection?.isConnected || false,
        lastSync: hubspotConnection?.lastSyncAt?.toISOString() || null,
        pendingContacts: hubspotPendingContacts,
        pendingDeals: hubspotPendingDeals,
      },
      zoho: {
        connected: zohoConnection?.isConnected || false,
        lastSync: zohoConnection?.lastSyncAt?.toISOString() || null,
        pendingContacts: zohoPendingContacts,
        pendingDeals: zohoPendingDeals,
      },
      activeSync: activeSync ? {
        _id: activeSync._id.toString(),
        provider: activeSync.provider,
        entityType: activeSync.entityType as 'contact' | 'deal',
        direction: activeSync.direction as SyncDirection,
        status: activeSync.status as SyncStatus,
        startedAt: activeSync.startedAt,
        completedAt: activeSync.completedAt,
        totalRecords: activeSync.totalRecords,
        successCount: activeSync.successCount,
        errorCount: activeSync.errorCount,
        errors: activeSync.errors.map((e: { externalId: string; error: string; timestamp: Date }) => ({
          externalId: e.externalId,
          error: e.error,
          timestamp: e.timestamp,
        })),
        details: activeSync.details as Record<string, unknown>,
      } : null,
    };
  }

  /**
   * Get sync history
   */
  async getSyncHistory(
    provider?: CRMProvider,
    limit = 20
  ): Promise<Array<{
    _id: string;
    provider: CRMProvider;
    entityType: 'contact' | 'deal';
    direction: SyncDirection;
    status: SyncStatus;
    startedAt: Date;
    completedAt?: Date;
    totalRecords: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ externalId: string; error: string; timestamp: Date }>;
    details: Record<string, unknown>;
  }>> {
    const records = await SyncHistory.findRecent(provider, limit);

    return records.map((r: ISyncHistoryDocument) => ({
      _id: r._id.toString(),
      provider: r.provider,
      entityType: r.entityType as 'contact' | 'deal',
      direction: r.direction as SyncDirection,
      status: r.status as SyncStatus,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      totalRecords: r.totalRecords,
      successCount: r.successCount,
      errorCount: r.errorCount,
      errors: r.errors.map((e: { externalId: string; error: string; timestamp: Date }) => ({
        externalId: e.externalId,
        error: e.error,
        timestamp: e.timestamp,
      })),
      details: r.details as Record<string, unknown>,
    }));
  }

  /**
   * Update connection last sync time
   */
  private async updateConnectionLastSync(provider: CRMProvider): Promise<void> {
    const connection = await CRMConnection.findByProvider(provider);
    if (connection) {
      connection.updateLastSync();
      await connection.save();
    }
  }

  /**
   * Cleanup old sync history records
   */
  async cleanupOldRecords(daysToKeep = 30): Promise<number> {
    return SyncHistory.cleanupOldRecords(daysToKeep);
  }

  /**
   * Check if sync is currently running
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();

export default syncService;
