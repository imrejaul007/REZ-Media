"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interestEngine = exports.InterestEngine = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const UserInterestProfile_1 = require("../models/UserInterestProfile");
const logger_1 = require("../config/logger");
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000; // 30 second delay between retries
/**
 * InterestEngine — derives interest tags from a user's order history.
 *
 * How it works:
 *   1. Query all orders for a user from the last 180 days
 *   2. For each order item, map the product category to an interest tag
 *   3. Score each tag by order frequency (more orders = higher score)
 *   4. Apply weekly decay (score * 0.9 per week since last order)
 *   5. Upsert the UserInterestProfile
 *
 * Category → Interest tag mapping covers major REZ merchant verticals:
 *   Food & Beverage, Retail, Services, Entertainment, Health, Education
 *
 * Called by:
 *   - interestSyncWorker (nightly bulk rebuild)
 *   - On-demand when a user places a new order (event-driven update)
 */
// Read orders from rez-backend's shared DB
const Order = mongoose_1.default.model('MktOrder', new mongoose_1.default.Schema({}, { strict: false, collection: 'orders' }));
// Category name → interest tag mapping
const CATEGORY_TAG_MAP = {
    // Food & Beverage
    coffee: 'coffee',
    cafe: 'coffee',
    tea: 'tea',
    beverages: 'beverages',
    'fast food': 'fast_food',
    burger: 'fast_food',
    pizza: 'pizza',
    biryani: 'biryani',
    chinese: 'chinese_food',
    'south indian': 'south_indian_food',
    'north indian': 'north_indian_food',
    desserts: 'desserts',
    ice_cream: 'desserts',
    bakery: 'bakery',
    chicken: 'non_veg',
    mutton: 'non_veg',
    seafood: 'non_veg',
    vegan: 'vegan',
    healthy: 'health_food',
    salad: 'health_food',
    juice: 'beverages',
    // Retail
    fashion: 'fashion',
    clothing: 'fashion',
    footwear: 'footwear',
    accessories: 'accessories',
    electronics: 'electronics',
    mobile: 'electronics',
    laptop: 'electronics',
    books: 'books',
    stationery: 'stationery',
    groceries: 'groceries',
    pharmacy: 'pharmacy',
    cosmetics: 'beauty',
    beauty: 'beauty',
    jewellery: 'jewellery',
    sports: 'sports',
    fitness: 'fitness',
    gym: 'fitness',
    // Services
    salon: 'salon',
    spa: 'wellness',
    yoga: 'wellness',
    laundry: 'laundry',
    repair: 'repair',
    photography: 'photography',
    printing: 'printing',
    // Entertainment
    gaming: 'gaming',
    movies: 'entertainment',
    events: 'events',
    // Recharge
    recharge: 'recharge',
    utility: 'utilities',
};
function mapCategoryToTag(category) {
    const lower = category.toLowerCase().trim();
    for (const [key, tag] of Object.entries(CATEGORY_TAG_MAP)) {
        if (lower.includes(key))
            return tag;
    }
    return null;
}
function applyDecay(score, lastOrderAt) {
    const weeksSince = (Date.now() - lastOrderAt.getTime()) / (7 * 24 * 3600 * 1000);
    return Math.max(1, score * Math.pow(0.9, weeksSince));
}
class InterestEngine {
    constructor() {
        this.retryQueue = new bullmq_1.Queue('mkt-interest-retry', {
            connection: (0, redis_1.getRedisBullMQConnection)(),
            defaultJobOptions: {
                attempts: MAX_RETRIES,
                backoff: { type: 'fixed', delay: RETRY_DELAY_MS },
                removeOnComplete: { age: 86400 },
                removeOnFail: { age: 7 * 86400 }, // Failed after all retries → DLQ
            },
        });
    }
    /**
     * Rebuild interest profile for a single user.
     * Queries their last 180 days of orders.
     */
    async rebuildForUser(userId) {
        const since = new Date();
        since.setDate(since.getDate() - 180);
        const orders = await Order.find({
            userId: new mongoose_1.default.Types.ObjectId(userId),
            createdAt: { $gte: since },
            status: { $nin: ['cancelled', 'refunded'] },
        })
            .select('items createdAt')
            .lean();
        if (!orders.length)
            return;
        // Aggregate tag scores
        const tagMap = new Map();
        for (const order of orders) {
            for (const item of order.items || []) {
                const categoryRaw = item.categoryName || item.category || item.name || '';
                const tag = mapCategoryToTag(categoryRaw);
                if (!tag)
                    continue;
                const existing = tagMap.get(tag) || { score: 0, orderCount: 0, lastOrderAt: order.createdAt };
                existing.orderCount += 1;
                existing.score += 10; // +10 per order in this category
                if (order.createdAt > existing.lastOrderAt)
                    existing.lastOrderAt = order.createdAt;
                tagMap.set(tag, existing);
            }
        }
        // Apply decay and cap at 100
        const interests = Array.from(tagMap.entries()).map(([tag, data]) => ({
            tag,
            score: Math.min(100, Math.round(applyDecay(data.score, data.lastOrderAt))),
            orderCount: data.orderCount,
            lastOrderAt: data.lastOrderAt,
        }));
        // Sort by score descending, keep top 20 interests
        interests.sort((a, b) => b.score - a.score);
        const topInterests = interests.slice(0, 20);
        await UserInterestProfile_1.UserInterestProfile.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(userId) }, {
            $set: {
                interests: topInterests,
                lastSyncedAt: new Date(),
            },
        }, { upsert: true, new: true });
    }
    /**
     * Rebuild for all users who have placed orders in the last N days.
     * Used by interestSyncWorker for nightly bulk rebuild.
     * Returns { processed, errors } counts.
     *
     * BAK-MKT-008 FIX: Failed user rebuilds are now enqueued to a retry queue
     * (mkt-interest-retry) with up to 3 attempts and 30s backoff. After all
     * retries are exhausted, the job moves to the dead-letter queue (DLQ) for
     * manual inspection. Previously, failed rebuilds were silently skipped with
     * no retry and no DLQ, leaving user profiles stale indefinitely.
     */
    async rebuildBatch(sinceDays = 7) {
        const since = new Date();
        since.setDate(since.getDate() - sinceDays);
        const results = await Order.aggregate([
            { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled', 'refunded'] } } },
            { $group: { _id: '$userId' } },
        ]);
        let processed = 0;
        let errors = 0;
        let retried = 0;
        for (const { _id } of results) {
            const userId = _id.toString();
            try {
                await this.rebuildForUser(userId);
                processed++;
            }
            catch (err) {
                logger_1.logger.warn('[InterestEngine] Failed to rebuild user, enqueuing for retry', { userId, err: err.message });
                errors++;
                // BAK-MKT-008 FIX: Enqueue to retry queue instead of silently skipping.
                // The retry queue has MAX_RETRIES (3) attempts with 30s backoff.
                // After all retries fail, the job goes to DLQ for manual review.
                try {
                    await this.retryQueue.add('rebuild', { userId }, { jobId: `interest-rebuild-${userId}` });
                    retried++;
                }
                catch (queueErr) {
                    logger_1.logger.error('[InterestEngine] Failed to enqueue retry for user', { userId, error: queueErr });
                }
            }
        }
        logger_1.logger.info('[InterestEngine] Batch rebuild complete', { processed, errors, retried, sinceDays });
        return { processed, errors, retried };
    }
    /**
     * Update location signals for a user from their order delivery address.
     * Called when a new order is placed.
     */
    async updateLocationFromOrder(userId, address) {
        if (!address.city && !address.area && !address.pincode)
            return;
        const signal = {
            city: address.city,
            area: address.area,
            pincode: address.pincode,
            coordinates: address.coordinates,
            source: 'order_address',
            updatedAt: new Date(),
        };
        await UserInterestProfile_1.UserInterestProfile.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(userId) }, {
            $set: { primaryLocation: signal },
            $push: {
                locationHistory: {
                    $each: [signal],
                    $slice: -10, // keep last 10 location signals
                },
            },
        }, { upsert: true });
    }
    /**
     * Record a keyword search from the REZ consumer app.
     * Called via API when user performs a search.
     */
    async recordSearch(userId, term) {
        const cleanTerm = term.toLowerCase().trim();
        if (!cleanTerm)
            return;
        await UserInterestProfile_1.UserInterestProfile.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(userId) }, {
            $push: {
                recentSearches: {
                    $each: [{ term: cleanTerm, searchedAt: new Date() }],
                    $slice: -50, // keep last 50 searches
                },
            },
        }, { upsert: true });
    }
}
exports.InterestEngine = InterestEngine;
exports.interestEngine = new InterestEngine();
exports.default = exports.interestEngine;
//# sourceMappingURL=InterestEngine.js.map