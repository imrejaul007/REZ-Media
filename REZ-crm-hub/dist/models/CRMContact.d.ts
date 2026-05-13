import mongoose, { Model, Query } from 'mongoose';
import { CRMProvider, ContactSyncStatus, Phone, Email, Address } from '../types/index.js';
export interface ICRMContact {
    externalId: string;
    provider: CRMProvider;
    email?: string;
    firstName: string;
    lastName: string;
    phone?: Phone;
    phones: Phone[];
    emails: Email[];
    company?: string;
    jobTitle?: string;
    address?: Address;
    tags: string[];
    notes?: string;
    lifecycleStage?: string;
    leadSource?: string;
    customFields: Record<string, unknown>;
    syncStatus: ContactSyncStatus;
    lastSyncedAt?: Date;
    syncError?: string;
    linkedRezUserId?: string;
    metadata: Record<string, unknown>;
}
export interface ICRMContactMethods {
    markSynced(): Promise<void>;
    markSyncError(error: string): Promise<void>;
}
export type ICRMContactDocument = mongoose.HydratedDocument<ICRMContact, ICRMContactMethods>;
interface ICRMContactModel extends Model<ICRMContact, object, ICRMContactMethods> {
    findByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMContactDocument | null>;
    findPendingContacts(provider?: CRMProvider): Query<ICRMContactDocument[], ICRMContactDocument>;
}
export declare const CRMContact: ICRMContactModel;
export default CRMContact;
//# sourceMappingURL=CRMContact.d.ts.map