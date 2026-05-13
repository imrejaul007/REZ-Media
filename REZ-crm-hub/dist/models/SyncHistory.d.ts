import mongoose, { Model } from 'mongoose';
import { SyncStatus, SyncDirection, CRMProvider } from '../types/index.js';
export interface SyncError {
    externalId: string;
    error: string;
    timestamp: Date;
}
export interface ISyncHistory {
    provider: CRMProvider;
    entityType: 'contact' | 'deal';
    direction: SyncDirection;
    status: SyncStatus;
    startedAt: Date;
    completedAt?: Date;
    totalRecords: number;
    successCount: number;
    errorCount: number;
    errors: SyncError[];
    details: Record<string, unknown>;
}
export interface ISyncHistoryMethods {
    markStarted(): void;
    markCompleted(successCount: number, errorCount: number): void;
    markFailed(error?: string): void;
    addError(externalId: string, error: string): void;
}
export type ISyncHistoryDocument = mongoose.HydratedDocument<ISyncHistory, ISyncHistoryMethods>;
interface ISyncHistoryModel extends Model<ISyncHistory, object, ISyncHistoryMethods> {
    findActiveSync(): Promise<ISyncHistoryDocument | null>;
    findRecent(provider?: CRMProvider, limit?: number): Promise<ISyncHistoryDocument[]>;
    cleanupOldRecords(daysToKeep?: number): Promise<number>;
}
export declare const SyncHistory: ISyncHistoryModel;
export default SyncHistory;
//# sourceMappingURL=SyncHistory.d.ts.map