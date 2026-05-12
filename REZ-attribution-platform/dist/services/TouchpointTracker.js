"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.touchpointTracker = exports.TouchpointTracker = void 0;
const uuid_1 = require("uuid");
const Touchpoint_1 = require("../models/Touchpoint");
const logger_1 = __importDefault(require("../utils/logger"));
class TouchpointTracker {
    /**
     * Create a new touchpoint
     */
    async createTouchpoint(data) {
        const touchpointId = (0, uuid_1.v4)();
        const timestamp = data.timestamp || new Date();
        const touchpoint = new Touchpoint_1.Touchpoint({
            id: touchpointId,
            userId: data.userId,
            sessionId: data.sessionId,
            type: data.type,
            channel: data.channel,
            campaignId: data.campaignId,
            adId: data.adId,
            creativeId: data.creativeId,
            merchantId: data.merchantId,
            storeId: data.storeId,
            location: data.location,
            deviceFingerprint: data.deviceFingerprint,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            metadata: data.metadata || {},
            timestamp
        });
        await touchpoint.save();
        logger_1.default.info('Touchpoint created', {
            touchpointId,
            userId: data.userId,
            type: data.type,
            channel: data.channel
        });
        return touchpoint;
    }
    /**
     * Get touchpoints with filtering options
     */
    async getTouchpoints(options) {
        const filter = {};
        if (options.userId)
            filter.userId = options.userId;
        if (options.merchantId)
            filter.merchantId = options.merchantId;
        if (options.campaignId)
            filter.campaignId = options.campaignId;
        if (options.storeId)
            filter.storeId = options.storeId;
        if (options.channel)
            filter.channel = options.channel;
        if (options.type)
            filter.type = options.type;
        if (options.startDate || options.endDate) {
            filter.timestamp = {};
            if (options.startDate) {
                filter.timestamp.$gte = options.startDate;
            }
            if (options.endDate) {
                filter.timestamp.$lte = options.endDate;
            }
        }
        const limit = options.limit || 100;
        const skip = options.skip || 0;
        const [touchpoints, total] = await Promise.all([
            Touchpoint_1.Touchpoint.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Touchpoint_1.Touchpoint.countDocuments(filter)
        ]);
        return { touchpoints: touchpoints, total };
    }
    /**
     * Get touchpoints for a user within a time window (for attribution)
     */
    async getUserTouchpointsForAttribution(userId, conversionTimestamp, lookbackDays) {
        const startDate = new Date(conversionTimestamp);
        startDate.setDate(startDate.getDate() - lookbackDays);
        const touchpoints = await Touchpoint_1.Touchpoint.find({
            userId,
            timestamp: {
                $gte: startDate,
                $lte: conversionTimestamp
            }
        })
            .sort({ timestamp: 1 })
            .lean();
        return touchpoints;
    }
    /**
     * Get touchpoints by campaign
     */
    async getCampaignTouchpoints(campaignId, startDate, endDate) {
        const filter = { campaignId };
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = startDate;
            }
            if (endDate) {
                filter.timestamp.$lte = endDate;
            }
        }
        const touchpoints = await Touchpoint_1.Touchpoint.find(filter)
            .sort({ timestamp: -1 })
            .lean();
        return touchpoints;
    }
    /**
     * Get touchpoints by merchant
     */
    async getMerchantTouchpoints(merchantId, startDate, endDate) {
        const filter = { merchantId };
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = startDate;
            }
            if (endDate) {
                filter.timestamp.$lte = endDate;
            }
        }
        const touchpoints = await Touchpoint_1.Touchpoint.find(filter)
            .sort({ timestamp: -1 })
            .lean();
        return touchpoints;
    }
    /**
     * Get unique user count for a campaign
     */
    async getCampaignUniqueUsers(campaignId, startDate, endDate) {
        const filter = { campaignId };
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = startDate;
            }
            if (endDate) {
                filter.timestamp.$lte = endDate;
            }
        }
        return Touchpoint_1.Touchpoint.distinct('userId', filter).then(users => users.length);
    }
    /**
     * Get touchpoint statistics
     */
    async getTouchpointStats(merchantId, campaignId, startDate, endDate) {
        const filter = {};
        if (merchantId)
            filter.merchantId = merchantId;
        if (campaignId)
            filter.campaignId = campaignId;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = startDate;
            }
            if (endDate) {
                filter.timestamp.$lte = endDate;
            }
        }
        const [touchpoints, uniqueUsers] = await Promise.all([
            Touchpoint_1.Touchpoint.find(filter).lean(),
            Touchpoint_1.Touchpoint.distinct('userId', filter)
        ]);
        const byChannel = {};
        const byType = {};
        for (const tp of touchpoints) {
            byChannel[tp.channel] = (byChannel[tp.channel] || 0) + 1;
            byType[tp.type] = (byType[tp.type] || 0) + 1;
        }
        return {
            total: touchpoints.length,
            byChannel,
            byType,
            uniqueUsers: uniqueUsers.length
        };
    }
    /**
     * Delete touchpoint by ID
     */
    async deleteTouchpoint(touchpointId) {
        const result = await Touchpoint_1.Touchpoint.deleteOne({ id: touchpointId });
        return result.deletedCount > 0;
    }
    /**
     * Batch create touchpoints for efficiency
     */
    async createTouchpointsBatch(data) {
        const touchpoints = data.map(item => {
            const touchpointId = (0, uuid_1.v4)();
            const timestamp = item.timestamp || new Date();
            return {
                id: touchpointId,
                userId: item.userId,
                sessionId: item.sessionId,
                type: item.type,
                channel: item.channel,
                campaignId: item.campaignId,
                adId: item.adId,
                creativeId: item.creativeId,
                merchantId: item.merchantId,
                storeId: item.storeId,
                location: item.location,
                deviceFingerprint: item.deviceFingerprint,
                ipAddress: item.ipAddress,
                userAgent: item.userAgent,
                metadata: item.metadata || {},
                timestamp
            };
        });
        await Touchpoint_1.Touchpoint.insertMany(touchpoints);
        logger_1.default.info('Batch touchpoints created', { count: touchpoints.length });
        return touchpoints;
    }
}
exports.TouchpointTracker = TouchpointTracker;
exports.touchpointTracker = new TouchpointTracker();
//# sourceMappingURL=TouchpointTracker.js.map