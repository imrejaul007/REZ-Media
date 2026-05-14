import mongoose, { Document } from 'mongoose';
import { ActionFeedback } from '../types';
export interface IFeedbackDocument extends ActionFeedback, Document {
}
export declare const FeedbackModel: mongoose.Model<IFeedbackDocument, {}, {}, {}, mongoose.Document<unknown, {}, IFeedbackDocument, {}, {}> & IFeedbackDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=feedback.d.ts.map