import { Document, Types } from 'mongoose';
/**
 * UserInterestProfile — computed interest tags per user.
 *
 * Built nightly by interestSyncWorker from Order history.
 * Also tracks location signals and institution affiliation.
 *
 * Interests are scored: higher score = stronger signal.
 * Decayed weekly so stale interests don't dominate targeting.
 */
export interface IInterestTag {
    tag: string;
    score: number;
    orderCount: number;
    lastOrderAt: Date;
}
export interface ILocationSignal {
    city?: string;
    area?: string;
    pincode?: string;
    coordinates?: [number, number];
    source: 'order_address' | 'profile' | 'checkin';
    updatedAt: Date;
}
export interface IUserInterestProfile extends Document {
    userId: Types.ObjectId;
    interests: IInterestTag[];
    primaryLocation?: ILocationSignal;
    locationHistory: ILocationSignal[];
    institution?: {
        name: string;
        type: 'college' | 'school' | 'office' | 'hospital' | 'other';
        area?: string;
        confidence: 'user_set' | 'inferred';
    };
    recentSearches: Array<{
        term: string;
        searchedAt: Date;
    }>;
    lastSyncedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserInterestProfile: import("mongoose").Model<IUserInterestProfile, {}, {}, {}, Document<unknown, {}, IUserInterestProfile, {}, {}> & IUserInterestProfile & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default UserInterestProfile;
//# sourceMappingURL=UserInterestProfile.d.ts.map