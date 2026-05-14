"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInterestProfile = void 0;
const mongoose_1 = require("mongoose");
const InterestTagSchema = new mongoose_1.Schema({
    tag: { type: String, required: true },
    score: { type: Number, default: 0, min: 0, max: 100 },
    orderCount: { type: Number, default: 0 },
    lastOrderAt: Date,
}, { _id: false });
const LocationSignalSchema = new mongoose_1.Schema({
    city: String,
    area: String,
    pincode: String,
    coordinates: { type: [Number] },
    source: { type: String, enum: ['order_address', 'profile', 'checkin'] },
    updatedAt: Date,
}, { _id: false });
const UserInterestProfileSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    interests: [InterestTagSchema],
    primaryLocation: LocationSignalSchema,
    locationHistory: [LocationSignalSchema],
    institution: {
        name: String,
        type: { type: String, enum: ['college', 'school', 'office', 'hospital', 'other'] },
        area: String,
        confidence: { type: String, enum: ['user_set', 'inferred'] },
    },
    recentSearches: [
        {
            term: { type: String },
            searchedAt: { type: Date },
            _id: false,
        },
    ],
    lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Targeting indexes
UserInterestProfileSchema.index({ 'interests.tag': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.city': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.area': 1 });
UserInterestProfileSchema.index({ 'primaryLocation.pincode': 1 });
UserInterestProfileSchema.index({ 'institution.name': 1 });
UserInterestProfileSchema.index({ 'recentSearches.term': 1, 'recentSearches.searchedAt': -1 });
exports.UserInterestProfile = (0, mongoose_1.model)('UserInterestProfile', UserInterestProfileSchema);
exports.default = exports.UserInterestProfile;
//# sourceMappingURL=UserInterestProfile.js.map