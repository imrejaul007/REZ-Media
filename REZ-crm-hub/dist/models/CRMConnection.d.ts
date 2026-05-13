import mongoose, { Model } from 'mongoose';
import { CRMProvider, OAuthTokens } from '../types/index.js';
export interface ICRMConnection {
    provider: CRMProvider;
    isConnected: boolean;
    tokens?: OAuthTokens;
    accountInfo?: Record<string, unknown>;
    lastSyncAt?: Date;
    syncEnabled: boolean;
}
export interface ICRMConnectionMethods {
    setTokens(tokens: OAuthTokens): void;
    clearTokens(): void;
    isTokenExpired(): boolean;
    updateLastSync(): void;
}
export type ICRMConnectionDocument = mongoose.HydratedDocument<ICRMConnection, ICRMConnectionMethods>;
interface ICRMConnectionModel extends Model<ICRMConnection, object, ICRMConnectionMethods> {
    findByProvider(provider: CRMProvider): Promise<ICRMConnectionDocument | null>;
    findAllConnected(): Promise<ICRMConnectionDocument[]>;
}
export declare const CRMConnection: ICRMConnectionModel;
export default CRMConnection;
//# sourceMappingURL=CRMConnection.d.ts.map