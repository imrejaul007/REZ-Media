"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const SyncHistory_js_1 = require("../models/SyncHistory.js");
const CRMConnection_js_1 = require("../models/CRMConnection.js");
const contactService_js_1 = require("./contactService.js");
const dealService_js_1 = require("./dealService.js");
const index_js_1 = require("../config/index.js");
const index_js_2 = require("../types/index.js");
class SyncService {
    isSyncing = false;
    syncInterval = null;
    /**
     * Start the sync scheduler
     */
    startScheduler() {
        if (this.syncInterval) {
            return; // Already running
        }
        const intervalMs = index_js_1.config.sync.intervalMinutes * 60 * 1000;
        this.syncInterval = setInterval(async () => {
            await this.runScheduledSync();
        }, intervalMs);
        console.log(`Sync scheduler started. Running every ${index_js_1.config.sync.intervalMinutes} minutes.`);
    }
    /**
     * Stop the sync scheduler
     */
    stopScheduler() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('Sync scheduler stopped.');
        }
    }
    /**
     * Run a scheduled sync for all connected providers
     */
    async runScheduledSync() {
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping scheduled sync.');
            return;
        }
        console.log('Starting scheduled sync...');
        try {
            const connections = await CRMConnection_js_1.CRMConnection.findAllConnected();
            for (const connection of connections) {
                await this.syncProvider(connection.provider, false);
            }
            console.log('Scheduled sync completed.');
        }
        catch (error) {
            console.error('Scheduled sync failed:', error);
        }
    }
    /**
     * Sync a specific provider
     */
    async syncProvider(provider, recordHistory = true) {
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
        const contactSyncRecord = recordHistory ? await SyncHistory_js_1.SyncHistory.create({
            provider,
            entityType: 'contact',
            direction: index_js_2.SyncDirection.IMPORT,
            status: index_js_2.SyncStatus.IN_PROGRESS,
            startedAt: startTime,
        }) : null;
        const dealSyncRecord = recordHistory ? await SyncHistory_js_1.SyncHistory.create({
            provider,
            entityType: 'deal',
            direction: index_js_2.SyncDirection.IMPORT,
            status: index_js_2.SyncStatus.IN_PROGRESS,
            startedAt: startTime,
        }) : null;
        const result = {
            success: true,
            provider,
            contacts: { synced: 0, errors: 0 },
            deals: { synced: 0, errors: 0 },
            startedAt: startTime,
        };
        try {
            // Sync contacts
            const contactResult = await contactService_js_1.contactService.syncFromProvider(provider);
            result.contacts.synced = contactResult.synced;
            result.contacts.errors = contactResult.errors;
            if (contactSyncRecord) {
                if (contactResult.success) {
                    contactSyncRecord.markCompleted(contactResult.synced, contactResult.errors);
                }
                else {
                    contactSyncRecord.markFailed(contactResult.errorDetails[0]?.error);
                }
                await contactSyncRecord.save();
            }
            // Sync deals
            const dealResult = await dealService_js_1.dealService.syncFromProvider(provider);
            result.deals.synced = dealResult.synced;
            result.deals.errors = dealResult.errors;
            if (dealSyncRecord) {
                if (dealResult.success) {
                    dealSyncRecord.markCompleted(dealResult.synced, dealResult.errors);
                }
                else {
                    dealSyncRecord.markFailed(dealResult.errorDetails[0]?.error);
                }
                await dealSyncRecord.save();
            }
            // Update connection last sync time
            await this.updateConnectionLastSync(provider);
            result.success = contactResult.success && dealResult.success;
            result.completedAt = new Date();
        }
        catch (error) {
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
        }
        finally {
            this.isSyncing = false;
        }
        return result;
    }
    /**
     * Trigger a full sync manually
     */
    async triggerSync(request) {
        if (this.isSyncing && !request.force) {
            return {
                success: false,
                results: [],
                message: 'Sync already in progress',
            };
        }
        const results = [];
        const providers = request.provider ? [request.provider] : [index_js_2.CRMProvider.HUBSPOT, index_js_2.CRMProvider.ZOHO];
        for (const provider of providers) {
            const connection = await CRMConnection_js_1.CRMConnection.findOne({ provider, isConnected: true });
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
    async getSyncStatus() {
        const [hubspotConnection, zohoConnection, activeSync] = await Promise.all([
            CRMConnection_js_1.CRMConnection.findOne({ provider: index_js_2.CRMProvider.HUBSPOT }),
            CRMConnection_js_1.CRMConnection.findOne({ provider: index_js_2.CRMProvider.ZOHO }),
            SyncHistory_js_1.SyncHistory.findActiveSync(),
        ]);
        const [hubspotPendingContacts, hubspotPendingDeals, zohoPendingContacts, zohoPendingDeals] = await Promise.all([
            contactService_js_1.contactService.getPendingContactsCount(index_js_2.CRMProvider.HUBSPOT),
            dealService_js_1.dealService.getPendingDealsCount(index_js_2.CRMProvider.HUBSPOT),
            contactService_js_1.contactService.getPendingContactsCount(index_js_2.CRMProvider.ZOHO),
            dealService_js_1.dealService.getPendingDealsCount(index_js_2.CRMProvider.ZOHO),
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
                entityType: activeSync.entityType,
                direction: activeSync.direction,
                status: activeSync.status,
                startedAt: activeSync.startedAt,
                completedAt: activeSync.completedAt,
                totalRecords: activeSync.totalRecords,
                successCount: activeSync.successCount,
                errorCount: activeSync.errorCount,
                errors: activeSync.errors.map((e) => ({
                    externalId: e.externalId,
                    error: e.error,
                    timestamp: e.timestamp,
                })),
                details: activeSync.details,
            } : null,
        };
    }
    /**
     * Get sync history
     */
    async getSyncHistory(provider, limit = 20) {
        const records = await SyncHistory_js_1.SyncHistory.findRecent(provider, limit);
        return records.map((r) => ({
            _id: r._id.toString(),
            provider: r.provider,
            entityType: r.entityType,
            direction: r.direction,
            status: r.status,
            startedAt: r.startedAt,
            completedAt: r.completedAt,
            totalRecords: r.totalRecords,
            successCount: r.successCount,
            errorCount: r.errorCount,
            errors: r.errors.map((e) => ({
                externalId: e.externalId,
                error: e.error,
                timestamp: e.timestamp,
            })),
            details: r.details,
        }));
    }
    /**
     * Update connection last sync time
     */
    async updateConnectionLastSync(provider) {
        const connection = await CRMConnection_js_1.CRMConnection.findByProvider(provider);
        if (connection) {
            connection.updateLastSync();
            await connection.save();
        }
    }
    /**
     * Cleanup old sync history records
     */
    async cleanupOldRecords(daysToKeep = 30) {
        return SyncHistory_js_1.SyncHistory.cleanupOldRecords(daysToKeep);
    }
    /**
     * Check if sync is currently running
     */
    isSyncInProgress() {
        return this.isSyncing;
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
exports.default = exports.syncService;
//# sourceMappingURL=syncService.js.map