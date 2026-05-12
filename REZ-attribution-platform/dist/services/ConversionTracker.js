"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversionTracker = exports.ConversionTracker = void 0;
const uuid_1 = require("uuid");
const Conversion_1 = require("../models/Conversion");
const logger_1 = __importDefault(require("../utils/logger"));
class ConversionTracker {
    /**
     * Create a new conversion
     */
    async createConversion(data) {
        const conversionId = (0, uuid_1.v4)();
        const conversionTimestamp = data.conversionTimestamp || new Date();
        const conversion = new Conversion_1.Conversion({
            id: conversionId,
            userId: data.userId,
            sessionId: data.sessionId,
            type: data.type,
            status: Conversion_1.ConversionStatus.COMPLETED,
            merchantId: data.merchantId,
            storeId: data.storeId,
            orderId: data.orderId,
            value: data.value || 0,
            currency: data.currency || 'USD',
            items: data.items,
            location: data.location,
            metadata: data.metadata || {},
            conversionTimestamp
        });
        await conversion.save();
        logger_1.default.info('Conversion created', {
            conversionId,
            userId: data.userId,
            type: data.type,
            value: data.value
        });
        return conversion;
    }
    /**
     * Get conversion by ID
     */
    async getConversion(conversionId) {
        const result = await Conversion_1.Conversion.findOne({ id: conversionId }).lean();
        return result;
    }
    /**
     * Get conversions with filtering options
     */
    async getConversions(options) {
        const filter = {};
        if (options.userId)
            filter.userId = options.userId;
        if (options.merchantId)
            filter.merchantId = options.merchantId;
        if (options.storeId)
            filter.storeId = options.storeId;
        if (options.type)
            filter.type = options.type;
        if (options.status)
            filter.status = options.status;
        if (options.startDate || options.endDate) {
            filter.conversionTimestamp = {};
            if (options.startDate) {
                filter.conversionTimestamp.$gte = options.startDate;
            }
            if (options.endDate) {
                filter.conversionTimestamp.$lte = options.endDate;
            }
        }
        if (options.minValue !== undefined || options.maxValue !== undefined) {
            filter.value = {};
            if (options.minValue !== undefined) {
                filter.value.$gte = options.minValue;
            }
            if (options.maxValue !== undefined) {
                filter.value.$lte = options.maxValue;
            }
        }
        const limit = options.limit || 100;
        const skip = options.skip || 0;
        const [conversions, total] = await Promise.all([
            Conversion_1.Conversion.find(filter)
                .sort({ conversionTimestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Conversion_1.Conversion.countDocuments(filter)
        ]);
        return { conversions: conversions, total };
    }
    /**
     * Get conversions for a user
     */
    async getUserConversions(userId) {
        const result = await Conversion_1.Conversion.find({ userId })
            .sort({ conversionTimestamp: -1 })
            .lean();
        return result;
    }
    /**
     * Get conversions by merchant
     */
    async getMerchantConversions(merchantId, startDate, endDate) {
        const filter = { merchantId };
        if (startDate || endDate) {
            filter.conversionTimestamp = {};
            if (startDate) {
                filter.conversionTimestamp.$gte = startDate;
            }
            if (endDate) {
                filter.conversionTimestamp.$lte = endDate;
            }
        }
        const result = await Conversion_1.Conversion.find(filter)
            .sort({ conversionTimestamp: -1 })
            .lean();
        return result;
    }
    /**
     * Update conversion status
     */
    async updateConversionStatus(conversionId, status) {
        const conversion = await Conversion_1.Conversion.findOneAndUpdate({ id: conversionId }, { status }, { new: true }).lean();
        if (conversion) {
            logger_1.default.info('Conversion status updated', {
                conversionId,
                newStatus: status
            });
        }
        return conversion;
    }
    /**
     * Add attribution data to a conversion
     */
    async addAttributionData(conversionId, attributionData) {
        const conversion = await Conversion_1.Conversion.findOneAndUpdate({ id: conversionId }, { attributionData }, { new: true }).lean();
        if (conversion) {
            logger_1.default.info('Attribution data added to conversion', {
                conversionId,
                attributionModel: attributionData.attributionModel
            });
        }
        return conversion;
    }
    /**
     * Get conversion statistics
     */
    async getConversionStats(merchantId, startDate, endDate) {
        const filter = {};
        if (merchantId)
            filter.merchantId = merchantId;
        if (startDate || endDate) {
            filter.conversionTimestamp = {};
            if (startDate) {
                filter.conversionTimestamp.$gte = startDate;
            }
            if (endDate) {
                filter.conversionTimestamp.$lte = endDate;
            }
        }
        const conversions = await Conversion_1.Conversion.find(filter).lean();
        const byStatus = {};
        const byType = {};
        let totalValue = 0;
        const uniqueUsers = new Set();
        for (const conv of conversions) {
            byStatus[conv.status] = (byStatus[conv.status] || 0) + 1;
            byType[conv.type] = (byType[conv.type] || 0) + 1;
            totalValue += conv.value || 0;
            uniqueUsers.add(conv.userId);
        }
        return {
            totalConversions: conversions.length,
            totalValue,
            averageValue: conversions.length > 0 ? totalValue / conversions.length : 0,
            byStatus,
            byType,
            uniqueUsers: uniqueUsers.size
        };
    }
    /**
     * Get recent conversions for a merchant
     */
    async getRecentConversions(merchantId, limit = 10) {
        const result = await Conversion_1.Conversion.find({ merchantId })
            .sort({ conversionTimestamp: -1 })
            .limit(limit)
            .lean();
        return result;
    }
    /**
     * Delete conversion by ID
     */
    async deleteConversion(conversionId) {
        const result = await Conversion_1.Conversion.deleteOne({ id: conversionId });
        return result.deletedCount > 0;
    }
    /**
     * Batch create conversions
     */
    async createConversionsBatch(data) {
        const conversions = data.map(item => {
            const conversionId = (0, uuid_1.v4)();
            const conversionTimestamp = item.conversionTimestamp || new Date();
            return {
                id: conversionId,
                userId: item.userId,
                sessionId: item.sessionId,
                type: item.type,
                status: Conversion_1.ConversionStatus.COMPLETED,
                merchantId: item.merchantId,
                storeId: item.storeId,
                orderId: item.orderId,
                value: item.value || 0,
                currency: item.currency || 'USD',
                items: item.items,
                location: item.location,
                metadata: item.metadata || {},
                conversionTimestamp
            };
        });
        await Conversion_1.Conversion.insertMany(conversions);
        logger_1.default.info('Batch conversions created', { count: conversions.length });
        return conversions;
    }
    /**
     * Get conversions by order ID
     */
    async getConversionsByOrderId(orderId) {
        const result = await Conversion_1.Conversion.find({ orderId }).lean();
        return result;
    }
    /**
     * Track refund
     */
    async processRefund(conversionId) {
        const conversion = await Conversion_1.Conversion.findOneAndUpdate({ id: conversionId }, { status: Conversion_1.ConversionStatus.REFUNDED }, { new: true }).lean();
        if (conversion) {
            logger_1.default.info('Conversion refunded', {
                conversionId,
                originalValue: conversion.value
            });
        }
        return conversion;
    }
}
exports.ConversionTracker = ConversionTracker;
exports.conversionTracker = new ConversionTracker();
//# sourceMappingURL=ConversionTracker.js.map