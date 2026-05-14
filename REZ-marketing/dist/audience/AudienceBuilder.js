"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.audienceBuilder = exports.AudienceBuilder = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserInterestProfile_1 = require("../models/UserInterestProfile");
const logger_1 = require("../config/logger");
/**
 * AudienceBuilder — translates IAudienceFilter into MongoDB queries
 * and returns arrays of { userId, phone, email, pushTokens } for dispatch.
 *
 * Data sources:
 *   - MerchantCustomerSnapshot (same DB as rez-backend) — base merchant audience
 *   - UserInterestProfile (this service's DB) — interest + location + institution
 *   - User (same DB as rez-backend) — birthday, profile data
 *   - Order (same DB as rez-backend) — purchase history targeting
 *
 * All queries are batched and paginated — never loads full audience into memory.
 */
// Shared models (read from rez-backend's MongoDB)
const Snapshot = mongoose_1.default.model('MerchantCustomerSnapshot', new mongoose_1.default.Schema({}, { strict: false, collection: 'merchantcustomersnapshots' }));
const User = mongoose_1.default.model('User', new mongoose_1.default.Schema({}, { strict: false, collection: 'users' }));
const Order = mongoose_1.default.model('Order', new mongoose_1.default.Schema({}, { strict: false, collection: 'orders' }));
const BATCH_SIZE = 200;
class AudienceBuilder {
    /**
     * Estimate audience size without loading full data.
     * Used by the UI to show "~1,200 customers will receive this" before launch.
     * Uses a count query rather than loading IDs into memory.
     */
    async estimate(merchantId, filter) {
        // BE-MKT-004 FIX: Validate segment exists before estimation
        const validSegments = ['all', 'recent', 'lapsed', 'high_value', 'stamp_card', 'location', 'interest', 'birthday', 'purchase_history', 'institution', 'keyword', 'custom'];
        if (!validSegments.includes(filter.segment)) {
            throw new Error(`Invalid audience segment: '${filter.segment}'. Valid segments are: ${validSegments.join(', ')}`);
        }
        const count = await this.countUserIds(merchantId, filter);
        return count;
    }
    /**
     * Resolve full audience as paginated batches using a cursor-based approach.
     * Streams user IDs in batches from MongoDB — never loads the full set into memory.
     */
    async *buildAudience(merchantId, filter, channel) {
        const optInField = channelOptInField(channel);
        for await (const idBatch of this.resolveUserIdsBatched(merchantId, filter)) {
            if (idBatch.length === 0)
                continue;
            const batchIds = idBatch.map((id) => new mongoose_1.default.Types.ObjectId(id));
            const records = await Snapshot.find({
                merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
                userId: { $in: batchIds },
                [optInField]: true,
            })
                .select('userId phone email pushTokens hasAppInstalled smsOptIn pushOptIn emailOptIn whatsappOptIn')
                .lean();
            if (records.length === 0)
                continue;
            // For push channel: enrich push tokens directly from User model.
            // The consumer app registers Expo push tokens to User.pushTokens (array of
            // {token, platform, lastUsed}), not to the Snapshot. This ensures we always
            // have the latest tokens even if the Snapshot was built before the user installed the app.
            let enrichedRecords = records.map((r) => ({
                userId: r.userId.toString(),
                phone: r.phone,
                email: r.email,
                firstName: undefined,
                pushTokens: r.pushTokens ?? [],
                hasAppInstalled: r.hasAppInstalled,
                smsOptIn: r.smsOptIn,
                pushOptIn: r.pushOptIn,
                emailOptIn: r.emailOptIn,
                whatsappOptIn: r.whatsappOptIn,
            }));
            if (channel === 'push') {
                // Fetch live push tokens and firstName from User model for this batch
                const userDocs = await User.find({ _id: { $in: batchIds } })
                    .select('_id pushTokens profile.name firstName')
                    .lean();
                const tokenMap = new Map();
                const nameMap = new Map();
                for (const u of userDocs) {
                    const tokens = (u.pushTokens ?? []).map((t) => (typeof t === 'string' ? t : t.token)).filter(Boolean);
                    tokenMap.set(u._id.toString(), tokens);
                    const firstName = u.profile?.name
                        ? u.profile.name.trim().split(/\s+/)[0] || undefined
                        : u.firstName || undefined;
                    if (firstName)
                        nameMap.set(u._id.toString(), firstName);
                }
                enrichedRecords = enrichedRecords.map((r) => ({
                    ...r,
                    pushTokens: tokenMap.get(r.userId) ?? r.pushTokens,
                    hasAppInstalled: (tokenMap.get(r.userId)?.length ?? 0) > 0 || r.hasAppInstalled,
                    firstName: nameMap.get(r.userId) ?? r.firstName,
                }));
                // BE-MKT-005 FIX: Filter out records with empty tokens and log warning if high percentage lacks tokens
                const recordsWithTokens = enrichedRecords.filter((r) => r.pushTokens && r.pushTokens.length > 0);
                const recordsWithoutTokens = enrichedRecords.length - recordsWithTokens.length;
                if (enrichedRecords.length > 0) {
                    const emptyTokenPercentage = (recordsWithoutTokens / enrichedRecords.length) * 100;
                    if (emptyTokenPercentage > 5) {
                        logger_1.logger.warn(`[AudienceBuilder] High percentage of push records lack tokens`, {
                            percentage: emptyTokenPercentage.toFixed(1),
                            recordsWithoutTokens,
                            totalRecords: enrichedRecords.length,
                        });
                    }
                }
                enrichedRecords = recordsWithTokens;
            }
            yield enrichedRecords;
        }
    }
    // ── Private: resolve matching userIds across all targeting modes ─────────
    /**
     * Count distinct user IDs matching the filter without loading into memory.
     */
    async countUserIds(merchantId, filter) {
        switch (filter.segment) {
            case 'all':
            case 'recent':
            case 'lapsed':
            case 'high_value':
            case 'stamp_card':
                return this.countSnapshotSegment(merchantId, filter.segment);
            case 'location':
                return this.countLocation(merchantId, filter);
            case 'interest':
                return this.countInterest(merchantId, filter);
            case 'birthday':
                return this.countBirthday(merchantId, filter);
            case 'purchase_history':
                return this.countPurchaseHistory(merchantId, filter);
            case 'institution':
                return this.countInstitution(merchantId, filter);
            case 'keyword':
                return this.countKeyword(merchantId, filter);
            case 'custom':
                return this.countCustom(merchantId, filter);
            default:
                return 0;
        }
    }
    /**
     * Stream user IDs in batches using MongoDB cursor pagination.
     * Yields arrays of up to BATCH_SIZE ObjectIds at a time — O(1) memory.
     */
    async *resolveUserIdsBatched(merchantId, filter) {
        switch (filter.segment) {
            case 'all':
            case 'recent':
            case 'lapsed':
            case 'high_value':
            case 'stamp_card':
                yield* this.resolveSnapshotSegmentBatched(merchantId, filter.segment);
                return;
            case 'location':
                yield* this.resolveLocationBatched(merchantId, filter);
                return;
            case 'interest':
                yield* this.resolveInterestBatched(merchantId, filter);
                return;
            case 'birthday':
                yield* this.resolveBirthdayBatched(merchantId, filter);
                return;
            case 'purchase_history':
                yield* this.resolvePurchaseHistoryBatched(merchantId, filter);
                return;
            case 'institution':
                yield* this.resolveInstitutionBatched(merchantId, filter);
                return;
            case 'keyword':
                yield* this.resolveKeywordBatched(merchantId, filter);
                return;
            case 'custom':
                yield* this.resolveCustomBatched(merchantId, filter);
                return;
            default:
                return;
        }
    }
    async resolveUserIds(merchantId, filter) {
        switch (filter.segment) {
            case 'all':
            case 'recent':
            case 'lapsed':
            case 'high_value':
            case 'stamp_card':
                return this.resolveSnapshotSegment(merchantId, filter.segment);
            case 'location':
                return this.resolveLocation(merchantId, filter);
            case 'interest':
                return this.resolveInterest(merchantId, filter);
            case 'birthday':
                return this.resolveBirthday(merchantId, filter);
            case 'purchase_history':
                return this.resolvePurchaseHistory(merchantId, filter);
            case 'institution':
                return this.resolveInstitution(merchantId, filter);
            case 'keyword':
                return this.resolveKeyword(merchantId, filter);
            case 'custom':
                return this.resolveCustom(merchantId, filter);
            default:
                return new Set();
        }
    }
    // ── Standard snapshot-based segments ─────────────────────────────────────
    async countSnapshotSegment(merchantId, segment) {
        const flagMap = {
            recent: { isRecent: true },
            lapsed: { isLapsed: true },
            high_value: { isHighValue: true },
            stamp_card: { hasActiveStampCard: true },
            all: {},
        };
        const dateFilter = this.buildSegmentDateFilter(segment);
        return Snapshot.countDocuments({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            ...flagMap[segment],
            ...dateFilter,
        });
    }
    async *resolveSnapshotSegmentBatched(merchantId, segment) {
        const flagMap = {
            recent: { isRecent: true },
            lapsed: { isLapsed: true },
            high_value: { isHighValue: true },
            stamp_card: { hasActiveStampCard: true },
            all: {},
        };
        const dateFilter = this.buildSegmentDateFilter(segment);
        const query = { merchantId: new mongoose_1.default.Types.ObjectId(merchantId), ...flagMap[segment], ...dateFilter };
        const cursor = Snapshot.collection.find(query, { projection: { _id: 1 } }).batchSize(BATCH_SIZE);
        for await (const doc of cursor) {
            yield [doc._id];
        }
    }
    async resolveSnapshotSegment(merchantId, segment) {
        const flagMap = {
            recent: { isRecent: true },
            lapsed: { isLapsed: true },
            high_value: { isHighValue: true },
            stamp_card: { hasActiveStampCard: true },
            all: {},
        };
        const dateFilter = this.buildSegmentDateFilter(segment);
        const docs = await Snapshot.find({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            ...flagMap[segment],
            ...dateFilter,
        })
            .select('userId')
            .lean();
        return new Set(docs.map((d) => d.userId.toString()));
    }
    /**
     * MRS-H7: Apply a date filter to the 'all' segment so that only customers
     * with recent activity (updated within 90 days) are included. This prevents
     * campaigns from broadcasting to lapsed/inactive users who should not receive
     * notifications. Other segments already have their own implicit date semantics.
     */
    buildSegmentDateFilter(segment) {
        if (segment !== 'all')
            return {};
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
        return { updatedAt: { $gte: cutoff } };
    }
    // ── Location targeting ────────────────────────────────────────────────────
    // Strategy: find users whose primaryLocation matches, then intersect with merchant's customer base
    async countLocation(merchantId, filter) {
        const { location } = filter;
        if (!location)
            return 0;
        const candidates = await this.getLocationUserIds(location);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveLocationBatched(merchantId, filter) {
        const { location } = filter;
        if (!location)
            return;
        const candidates = await this.getLocationUserIds(location);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveLocation(merchantId, filter) {
        const { location } = filter;
        if (!location)
            return new Set();
        const locationQuery = {};
        if (location.city)
            locationQuery['primaryLocation.city'] = new RegExp(location.city, 'i');
        if (location.area)
            locationQuery['primaryLocation.area'] = new RegExp(location.area, 'i');
        if (location.pincode)
            locationQuery['primaryLocation.pincode'] = location.pincode;
        if (location.coordinates && location.radiusKm) {
            locationQuery['primaryLocation.coordinates'] = {
                $geoWithin: {
                    $centerSphere: [location.coordinates, location.radiusKm / 6371],
                },
            };
        }
        const profiles = await UserInterestProfile_1.UserInterestProfile.find(locationQuery)
            .select('userId')
            .lean();
        const locationUserIds = new Set(profiles.map((p) => p.userId.toString()));
        // Intersect with merchant's existing customer base
        return this.intersectWithMerchantCustomers(merchantId, locationUserIds);
    }
    async getLocationUserIds(location) {
        const locationQuery = {};
        if (location.city)
            locationQuery['primaryLocation.city'] = new RegExp(location.city, 'i');
        if (location.area)
            locationQuery['primaryLocation.area'] = new RegExp(location.area, 'i');
        if (location.pincode)
            locationQuery['primaryLocation.pincode'] = location.pincode;
        if (location.coordinates && location.radiusKm) {
            locationQuery['primaryLocation.coordinates'] = {
                $geoWithin: { $centerSphere: [location.coordinates, location.radiusKm / 6371] },
            };
        }
        const profiles = await UserInterestProfile_1.UserInterestProfile.find(locationQuery)
            .select('userId')
            .lean();
        return new Set(profiles.map((p) => p.userId.toString()));
    }
    // ── Interest targeting ────────────────────────────────────────────────────
    // Finds users whose interest tags match, then intersects with merchant customers
    async countInterest(merchantId, filter) {
        const { interests } = filter;
        if (!interests?.length)
            return 0;
        const candidates = await this.getInterestUserIds(interests);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveInterestBatched(merchantId, filter) {
        const { interests } = filter;
        if (!interests?.length)
            return;
        const candidates = await this.getInterestUserIds(interests);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveInterest(merchantId, filter) {
        const { interests } = filter;
        if (!interests?.length)
            return new Set();
        const profiles = await UserInterestProfile_1.UserInterestProfile.find({
            'interests.tag': { $in: interests },
            'interests.score': { $gte: 20 }, // minimum signal strength
        })
            .select('userId')
            .lean();
        const interestUserIds = new Set(profiles.map((p) => p.userId.toString()));
        return this.intersectWithMerchantCustomers(merchantId, interestUserIds);
    }
    async getInterestUserIds(interests) {
        const profiles = await UserInterestProfile_1.UserInterestProfile.find({
            'interests.tag': { $in: interests },
            'interests.score': { $gte: 20 },
        })
            .select('userId')
            .lean();
        return new Set(profiles.map((p) => p.userId.toString()));
    }
    // ── Birthday targeting ────────────────────────────────────────────────────
    // Finds users whose birthday is N days from today, in merchant's customer base
    async countBirthday(merchantId, filter) {
        const candidates = await this.getBirthdayUserIds(filter.birthday?.daysAhead ?? 0);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveBirthdayBatched(merchantId, filter) {
        const candidates = await this.getBirthdayUserIds(filter.birthday?.daysAhead ?? 0);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveBirthday(merchantId, filter) {
        const daysAhead = filter.birthday?.daysAhead ?? 0;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const month = targetDate.getMonth() + 1; // 1-12
        const day = targetDate.getDate();
        // MongoDB: match users where month(dob) = month AND day(dob) = day
        const users = await User.find({
            $expr: {
                $and: [
                    { $eq: [{ $month: '$profile.dateOfBirth' }, month] },
                    { $eq: [{ $dayOfMonth: '$profile.dateOfBirth' }, day] },
                ],
            },
        })
            .select('_id')
            .lean();
        const birthdayUserIds = new Set(users.map((u) => u._id.toString()));
        return this.intersectWithMerchantCustomers(merchantId, birthdayUserIds);
    }
    async getBirthdayUserIds(daysAhead) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysAhead);
        const month = targetDate.getMonth() + 1;
        const day = targetDate.getDate();
        const users = await User.find({
            $expr: {
                $and: [
                    { $eq: [{ $month: '$profile.dateOfBirth' }, month] },
                    { $eq: [{ $dayOfMonth: '$profile.dateOfBirth' }, day] },
                ],
            },
        })
            .select('_id')
            .lean();
        return new Set(users.map((u) => u._id.toString()));
    }
    // ── Purchase history targeting ────────────────────────────────────────────
    // Finds users who bought a specific product/category in the last N days
    async countPurchaseHistory(merchantId, filter) {
        const ph = filter.purchaseHistory;
        if (!ph)
            return 0;
        const candidates = await this.getPurchaseHistoryUserIds(merchantId, ph);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolvePurchaseHistoryBatched(merchantId, filter) {
        const ph = filter.purchaseHistory;
        if (!ph)
            return;
        const candidates = await this.getPurchaseHistoryUserIds(merchantId, ph);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolvePurchaseHistory(merchantId, filter) {
        const ph = filter.purchaseHistory;
        if (!ph)
            return new Set();
        const since = new Date();
        since.setDate(since.getDate() - ph.withinDays);
        const orderQuery = {
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            createdAt: { $gte: since },
            status: { $nin: ['cancelled', 'refunded'] },
        };
        // Category or keyword match on order items
        if (ph.categoryIds?.length) {
            orderQuery['items.categoryId'] = { $in: ph.categoryIds };
        }
        if (ph.productKeywords?.length) {
            orderQuery['items.name'] = {
                $in: ph.productKeywords.map((kw) => new RegExp(kw, 'i')),
            };
        }
        const pipeline = [
            { $match: orderQuery },
            { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
        ];
        if (ph.minOrderCount && ph.minOrderCount > 1) {
            pipeline.push({ $match: { orderCount: { $gte: ph.minOrderCount } } });
        }
        const results = await Order.aggregate(pipeline);
        return new Set(results.map((r) => r._id.toString()));
    }
    async getPurchaseHistoryUserIds(merchantId, ph) {
        const since = new Date();
        since.setDate(since.getDate() - ph.withinDays);
        const orderQuery = {
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            createdAt: { $gte: since },
            status: { $nin: ['cancelled', 'refunded'] },
        };
        if (ph.categoryIds?.length)
            orderQuery['items.categoryId'] = { $in: ph.categoryIds };
        if (ph.productKeywords?.length) {
            orderQuery['items.name'] = { $in: ph.productKeywords.map((kw) => new RegExp(kw, 'i')) };
        }
        const pipeline = [
            { $match: orderQuery },
            { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
        ];
        if (ph.minOrderCount && ph.minOrderCount > 1)
            pipeline.push({ $match: { orderCount: { $gte: ph.minOrderCount } } });
        const results = await Order.aggregate(pipeline);
        return new Set(results.map((r) => r._id.toString()));
    }
    // ── Institution targeting ─────────────────────────────────────────────────
    async countInstitution(merchantId, filter) {
        const { institution } = filter;
        if (!institution)
            return 0;
        const candidates = await this.getInstitutionUserIds(institution);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveInstitutionBatched(merchantId, filter) {
        const { institution } = filter;
        if (!institution)
            return;
        const candidates = await this.getInstitutionUserIds(institution);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveInstitution(merchantId, filter) {
        const { institution } = filter;
        if (!institution)
            return new Set();
        const query = {};
        if (institution.name)
            query['institution.name'] = new RegExp(institution.name, 'i');
        if (institution.type)
            query['institution.type'] = institution.type;
        if (institution.area)
            query['institution.area'] = new RegExp(institution.area, 'i');
        const profiles = await UserInterestProfile_1.UserInterestProfile.find(query)
            .select('userId')
            .lean();
        const institutionUserIds = new Set(profiles.map((p) => p.userId.toString()));
        return this.intersectWithMerchantCustomers(merchantId, institutionUserIds);
    }
    async getInstitutionUserIds(institution) {
        const query = {};
        if (institution.name)
            query['institution.name'] = new RegExp(institution.name, 'i');
        if (institution.type)
            query['institution.type'] = institution.type;
        if (institution.area)
            query['institution.area'] = new RegExp(institution.area, 'i');
        const profiles = await UserInterestProfile_1.UserInterestProfile.find(query)
            .select('userId')
            .lean();
        return new Set(profiles.map((p) => p.userId.toString()));
    }
    // ── Keyword targeting ─────────────────────────────────────────────────────
    // Users who recently searched these terms in the REZ consumer app
    async countKeyword(merchantId, filter) {
        const kw = filter.keyword;
        if (!kw?.terms?.length)
            return 0;
        const candidates = await this.getKeywordUserIds(kw);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveKeywordBatched(merchantId, filter) {
        const kw = filter.keyword;
        if (!kw?.terms?.length)
            return;
        const candidates = await this.getKeywordUserIds(kw);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveKeyword(merchantId, filter) {
        const kw = filter.keyword;
        if (!kw?.terms?.length)
            return new Set();
        const since = new Date();
        since.setDate(since.getDate() - (kw.withinDays ?? 30));
        const profiles = await UserInterestProfile_1.UserInterestProfile.find({
            recentSearches: {
                $elemMatch: {
                    term: { $in: kw.terms.map((t) => new RegExp(t, 'i')) },
                    searchedAt: { $gte: since },
                },
            },
        })
            .select('userId')
            .lean();
        const keywordUserIds = new Set(profiles.map((p) => p.userId.toString()));
        return this.intersectWithMerchantCustomers(merchantId, keywordUserIds);
    }
    async getKeywordUserIds(kw) {
        const since = new Date();
        since.setDate(since.getDate() - (kw.withinDays ?? 30));
        const profiles = await UserInterestProfile_1.UserInterestProfile.find({
            recentSearches: {
                $elemMatch: {
                    term: { $in: kw.terms.map((t) => new RegExp(t, 'i')) },
                    searchedAt: { $gte: since },
                },
            },
        })
            .select('userId')
            .lean();
        return new Set(profiles.map((p) => p.userId.toString()));
    }
    // ── Custom filter ─────────────────────────────────────────────────────────
    async countCustom(merchantId, filter) {
        if (!filter.customFilter)
            return 0;
        const candidates = await this.getCustomUserIds(filter);
        return this.countIntersectWithMerchantCustomers(merchantId, candidates);
    }
    async *resolveCustomBatched(merchantId, filter) {
        if (!filter.customFilter)
            return;
        const candidates = await this.getCustomUserIds(filter);
        yield* this.intersectMerchantCustomersBatched(merchantId, candidates);
    }
    async resolveCustom(merchantId, filter) {
        if (!filter.customFilter)
            return new Set();
        // Sanitise: strip any MongoDB operator keys (keys starting with '$') from the
        // caller-supplied filter to prevent NoSQL injection / server-side JS execution.
        const safeFilter = this.sanitizeMongoFilter(filter.customFilter);
        const users = await User.find(safeFilter)
            .select('_id')
            .lean();
        const customUserIds = new Set(users.map((u) => u._id.toString()));
        return this.intersectWithMerchantCustomers(merchantId, customUserIds);
    }
    async getCustomUserIds(filter) {
        const safeFilter = this.sanitizeMongoFilter(filter.customFilter);
        const users = await User.find(safeFilter)
            .select('_id')
            .lean();
        return new Set(users.map((u) => u._id.toString()));
    }
    /** Recursively removes any key that begins with '$' at any nesting depth to prevent operator injection. */
    sanitizeMongoFilter(obj) {
        const safe = {};
        for (const [key, val] of Object.entries(obj)) {
            if (key.startsWith('$'))
                continue;
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                safe[key] = this.sanitizeMongoFilter(val);
            }
            else {
                safe[key] = val;
            }
        }
        return safe;
    }
    // ── Intersection helper ───────────────────────────────────────────────────
    // Ensures we only target users who are known customers of this merchant
    async intersectWithMerchantCustomers(merchantId, userIds) {
        if (userIds.size === 0)
            return new Set();
        // MRS-H5: Throw for invalid merchantId so callers get a clear error instead of
        // silently returning empty results when a non-existent merchantId is targeted.
        if (!mongoose_1.default.Types.ObjectId.isValid(merchantId)) {
            throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
        }
        const objectIds = Array.from(userIds).map((id) => new mongoose_1.default.Types.ObjectId(id));
        const docs = await Snapshot.find({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            userId: { $in: objectIds },
        })
            .select('userId')
            .lean();
        return new Set(docs.map((d) => d.userId.toString()));
    }
    /**
     * Batched intersection — streams matching userIds from the merchant snapshot
     * using a MongoDB cursor with O(BATCH_SIZE) memory overhead per batch (MRS-H6).
     */
    async *intersectMerchantCustomersBatched(merchantId, candidateIds) {
        if (candidateIds.size === 0)
            return;
        if (!mongoose_1.default.Types.ObjectId.isValid(merchantId)) {
            throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
        }
        const candidateList = Array.from(candidateIds).map((id) => new mongoose_1.default.Types.ObjectId(id));
        const cursor = Snapshot.collection.find({ merchantId: new mongoose_1.default.Types.ObjectId(merchantId), userId: { $in: candidateList } }, { projection: { _id: 1 } }).batchSize(BATCH_SIZE);
        for await (const doc of cursor) {
            yield [doc._id];
        }
    }
    async countIntersectWithMerchantCustomers(merchantId, candidateIds) {
        if (candidateIds.size === 0)
            return 0;
        if (!mongoose_1.default.Types.ObjectId.isValid(merchantId)) {
            throw new Error(`Invalid merchantId for audience build: ${merchantId}`);
        }
        const objectIds = Array.from(candidateIds).map((id) => new mongoose_1.default.Types.ObjectId(id));
        return Snapshot.countDocuments({
            merchantId: new mongoose_1.default.Types.ObjectId(merchantId),
            userId: { $in: objectIds },
        });
    }
}
exports.AudienceBuilder = AudienceBuilder;
function channelOptInField(channel) {
    switch (channel) {
        case 'sms': return 'smsOptIn';
        case 'push': return 'pushOptIn';
        case 'email': return 'emailOptIn';
        case 'whatsapp': return 'whatsappOptIn';
        default: return 'hasAppInstalled';
    }
}
exports.audienceBuilder = new AudienceBuilder();
exports.default = exports.audienceBuilder;
//# sourceMappingURL=AudienceBuilder.js.map