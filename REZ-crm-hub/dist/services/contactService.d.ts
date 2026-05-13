import { ICRMContactDocument } from '../models/CRMContact.js';
import { CRMProvider, ContactQueryParams } from '../types/index.js';
export interface SyncContactsResult {
    success: boolean;
    synced: number;
    errors: number;
    errorDetails: Array<{
        externalId: string;
        error: string;
    }>;
}
export declare class ContactService {
    private transformHubSpotContact;
    private transformZohoContact;
    private transformToHubSpot;
    private transformToZoho;
    syncFromProvider(provider: CRMProvider): Promise<SyncContactsResult>;
    private syncFromHubSpot;
    private syncFromZoho;
    upsertContactFromHubSpot(hsContact: {
        id: string;
        properties: Record<string, unknown>;
    }): Promise<ICRMContactDocument>;
    upsertContactFromZoho(zohoContact: {
        id: string;
        Email?: string;
        Phone?: string;
        Mobile?: string;
        First_Name?: string;
        Last_Name?: string;
        Full_Name?: string;
        Display_Name?: string;
        Account_Name?: {
            name?: string;
        };
        Designation?: string;
        Mailing_Street?: string;
        Mailing_City?: string;
        Mailing_State?: string;
        Mailing_Zip?: string;
        Mailing_Country?: string;
        Created_Time?: string;
        Modified_Time?: string;
    }): Promise<ICRMContactDocument>;
    exportToCRM(contactId: string, provider: CRMProvider): Promise<{
        success: boolean;
        externalId?: string;
        error?: string;
    }>;
    getContacts(params: ContactQueryParams): Promise<{
        contacts: ICRMContactDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getContactById(contactId: string): Promise<ICRMContactDocument | null>;
    getContactByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMContactDocument | null>;
    forceSyncContact(contactId: string, provider: CRMProvider): Promise<{
        success: boolean;
        externalId?: string;
        error?: string;
    }>;
    linkToRezUser(contactId: string, rezUserId: string): Promise<ICRMContactDocument | null>;
    unlinkFromRezUser(contactId: string): Promise<ICRMContactDocument | null>;
    getPendingContactsCount(provider?: CRMProvider): Promise<number>;
    markAsPending(contactIds: string[]): Promise<void>;
}
export declare const contactService: ContactService;
export default contactService;
//# sourceMappingURL=contactService.d.ts.map