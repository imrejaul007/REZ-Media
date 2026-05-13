import { ICRMDealDocument } from '../models/CRMDeal.js';
import { CRMProvider, DealQueryParams, CreateDealRequest } from '../types/index.js';
export interface SyncDealsResult {
    success: boolean;
    synced: number;
    errors: number;
    errorDetails: Array<{
        externalId: string;
        error: string;
    }>;
}
export declare class DealService {
    private transformHubSpotDeal;
    private transformZohoDeal;
    private transformToHubSpot;
    private transformToZoho;
    syncFromProvider(provider: CRMProvider): Promise<SyncDealsResult>;
    private syncFromHubSpot;
    private syncFromZoho;
    upsertDealFromHubSpot(hsDeal: {
        id: string;
        properties: Record<string, unknown>;
    }): Promise<ICRMDealDocument>;
    upsertDealFromZoho(zohoDeal: {
        id: string;
        Deal_Name?: string;
        Amount?: string | number;
        Stage?: string;
        Closing_Date?: string;
        Description?: string;
        Account_Name?: {
            name?: string;
        };
        Pipeline?: string;
        Probability?: string | number;
        Created_Time?: string;
        Modified_Time?: string;
    }): Promise<ICRMDealDocument>;
    createInCRM(request: CreateDealRequest, provider: CRMProvider): Promise<{
        success: boolean;
        deal?: ICRMDealDocument;
        error?: string;
    }>;
    getDeals(params: DealQueryParams): Promise<{
        deals: ICRMDealDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    getDealById(dealId: string): Promise<ICRMDealDocument | null>;
    getDealByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMDealDocument | null>;
    updateStage(dealId: string, stage: string): Promise<ICRMDealDocument | null>;
    getDealsByContact(contactId: string, provider?: CRMProvider): Promise<ICRMDealDocument[]>;
    getDealStats(provider?: CRMProvider): Promise<{
        totalDeals: number;
        totalValue: number;
        byStage: Record<string, {
            count: number;
            value: number;
        }>;
    }>;
    getPendingDealsCount(provider?: CRMProvider): Promise<number>;
}
export declare const dealService: DealService;
export default dealService;
//# sourceMappingURL=dealService.d.ts.map