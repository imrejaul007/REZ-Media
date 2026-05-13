import mongoose, { Model, Query } from 'mongoose';
import { CRMProvider } from '../types/index.js';
export interface ICRMDeal {
    externalId: string;
    provider: CRMProvider;
    title: string;
    amount?: number;
    currency: string;
    stage: string;
    probability?: number;
    closeDate?: Date;
    contactId?: string;
    companyName?: string;
    description?: string;
    customFields: Record<string, unknown>;
    metadata: Record<string, unknown>;
}
export type ICRMDealDocument = mongoose.HydratedDocument<ICRMDeal>;
interface ICRMDealModel extends Model<ICRMDeal> {
    findByExternalId(externalId: string, provider: CRMProvider): Promise<ICRMDealDocument | null>;
    findByContactId(contactId: string, provider?: CRMProvider): Query<ICRMDealDocument[], ICRMDealDocument>;
    findByStage(stage: string, provider?: CRMProvider): Query<ICRMDealDocument[], ICRMDealDocument>;
}
export declare const CRMDeal: ICRMDealModel;
export default CRMDeal;
//# sourceMappingURL=CRMDeal.d.ts.map