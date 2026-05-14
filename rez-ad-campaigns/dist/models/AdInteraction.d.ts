import mongoose, { Document, Types } from 'mongoose';
export interface IAdInteraction extends Document {
    _id: Types.ObjectId;
    campaignId: Types.ObjectId;
    userId: string;
    type: 'impression' | 'click' | 'conversion';
    ip?: string;
    userAgent?: string;
    orderId?: string;
    isFraud: boolean;
    fraudReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const AdInteraction: mongoose.Model<IAdInteraction, {}, {}, {}, mongoose.Document<unknown, {}, IAdInteraction, {}, {}> & IAdInteraction & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default AdInteraction;
//# sourceMappingURL=AdInteraction.d.ts.map