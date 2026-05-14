"use strict";
/**
 * Event Platform Integration Config
 *
 * Configures how rez-ads-service connects to rez-event-platform
 * for emitting ad events (impression, click, conversion).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventPlatformConfig = void 0;
exports.forwardToEventPlatform = forwardToEventPlatform;
exports.emitAdImpression = emitAdImpression;
exports.emitAdClick = emitAdClick;
exports.emitConversion = emitConversion;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const logger_1 = require("./logger");
exports.eventPlatformConfig = {
    url: process.env.EVENT_PLATFORM_URL || 'http://localhost:4008',
    enabled: process.env.EVENT_PLATFORM_ENABLED !== 'false',
    timeout: parseInt(process.env.EVENT_PLATFORM_TIMEOUT || '5000', 10),
};
/**
 * Forward event to event-platform
 * Non-blocking - won't fail the main operation if event-platform is unavailable
 */
async function forwardToEventPlatform(eventType, payload) {
    if (!exports.eventPlatformConfig.enabled) {
        logger_1.logger.debug('[EventPlatform] Disabled via config');
        return { success: false };
    }
    try {
        const response = await axios_1.default.post(`${exports.eventPlatformConfig.url}/events/publish`, {
            id: (0, uuid_1.v4)(),
            type: eventType,
            timestamp: new Date().toISOString(),
            source: 'rez-ads-service',
            payload,
        }, {
            timeout: exports.eventPlatformConfig.timeout,
            headers: { 'Content-Type': 'application/json' },
        });
        return {
            success: response.data.success !== false,
            eventId: response.data.eventId,
        };
    }
    catch (error) {
        logger_1.logger.warn('[EventPlatform] Failed to forward event', {
            eventType,
            error: error.message,
            url: exports.eventPlatformConfig.url,
        });
        return { success: false };
    }
}
/**
 * Emit ad.impression event
 */
async function emitAdImpression(payload) {
    return forwardToEventPlatform('ad.impression', payload);
}
/**
 * Emit ad.click event
 */
async function emitAdClick(payload) {
    return forwardToEventPlatform('ad.click', payload);
}
/**
 * Emit conversion event
 */
async function emitConversion(payload) {
    return forwardToEventPlatform('conversion', payload);
}
//# sourceMappingURL=eventPlatform.js.map