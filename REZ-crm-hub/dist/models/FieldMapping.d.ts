import mongoose, { Document, Model } from 'mongoose';
import { FieldMapping as IFieldMapping } from '../types/index.js';
export interface IFieldMappingDocument extends Omit<IFieldMapping, '_id'>, Document {
    _id: mongoose.Types.ObjectId;
}
export declare const FieldMapping: Model<IFieldMappingDocument>;
export default FieldMapping;
//# sourceMappingURL=FieldMapping.d.ts.map