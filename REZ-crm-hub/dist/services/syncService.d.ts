import { CRMProvider, SyncStatus, SyncDirection, SyncTriggerRequest, SyncStatusResponse } from '../types/index.js';
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
export declare class SyncService {
    private isSyncing;
    private syncInterval;
    /**
     * Start the sync scheduler
     */
    startScheduler(): void;
    /**
     * Stop the sync scheduler
     */
    stopScheduler(): void;
    /**
     * Run a scheduled sync for all connected providers
     */
    private runScheduledSync;
    /**
     * Sync a specific provider
     */
    syncProvider(provider: CRMProvider, recordHistory?: boolean): Promise<SyncResult>;
    /**
     * Trigger a full sync manually
     */
    triggerSync(request: SyncTriggerRequest): Promise<{
        success: boolean;
        results: SyncResult[];
        message: string;
    }>;
    /**
     * Get current sync status
     */
    getSyncStatus(): Promise<SyncStatusResponse>;
    /**
     * Get sync history
     */
    getSyncHistory(provider?: CRMProvider, limit?: number): Promise<Array<{
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
        errors: Array<{
            externalId: string;
            error: string;
            timestamp: Date;
        }>;
        details: Record<string, unknown>;
    }>>;
    /**
     * Update connection last sync time
     */
    private updateConnectionLastSync;
    /**
     * Cleanup old sync history records
     */
    cleanupOldRecords(daysToKeep?: number): Promise<number>;
    /**
     * Check if sync is currently running
     */
    isSyncInProgress(): boolean;
}
export declare const syncService: SyncService;
export default syncService;
//# sourceMappingURL=syncService.d.ts.map