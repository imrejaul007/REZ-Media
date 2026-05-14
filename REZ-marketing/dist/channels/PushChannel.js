"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushChannel = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../config/logger");
/**
 * PushChannel — Expo Push Notifications API for broadcast campaigns.
 *
 * The REZ consumer app (rez-master) uses expo-notifications and registers
 * ExponentPushToken[xxx] format tokens. We use the Expo Push API
 * (https://exp.host/--/api/v2/push/send) which accepts these tokens directly.
 *
 * Expo batches up to 100 messages per request. The Expo API handles the
 * FCM/APNs routing transparently — no need for FCM_SERVER_KEY here.
 *
 * FCM_SERVER_KEY is kept as a fallback for raw device tokens if needed.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
class PushChannel {
    // Expo Push API needs no server key — it's open with rate limits
    // FCM_SERVER_KEY kept for potential raw FCM fallback
    get isConfigured() { return true; } // Expo API is always available
    async send(options) {
        if (!options.tokens?.length)
            return { success: false, error: 'No push tokens' };
        // Separate Expo tokens from any raw FCM tokens
        const expoTokens = options.tokens.filter((t) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
        const fcmTokens = options.tokens.filter((t) => !t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken['));
        let successCount = 0;
        let failureCount = 0;
        // ── Expo Push API (for all consumer app tokens) ────────────────────────
        if (expoTokens.length > 0) {
            try {
                // Expo accepts up to 100 messages per request
                const BATCH = 100;
                for (let i = 0; i < expoTokens.length; i += BATCH) {
                    const batch = expoTokens.slice(i, i + BATCH);
                    const messages = batch.map((token) => ({
                        to: token,
                        title: options.title,
                        body: options.body,
                        data: {
                            campaignId: options.campaignId,
                            merchantId: options.merchantId,
                            type: 'broadcast',
                            ...(options.ctaUrl ? { ctaUrl: options.ctaUrl } : {}),
                        },
                        ...(options.imageUrl ? { image: options.imageUrl } : {}),
                        sound: 'default',
                        priority: 'high',
                        channelId: 'promotions', // Android notification channel on consumer app
                    }));
                    const MAX_RETRIES = 3;
                    const BASE_DELAY_MS = 1000;
                    let response;
                    let attempt = 0;
                    for (attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                        try {
                            response = await axios_1.default.post(EXPO_PUSH_URL, messages, {
                                headers: {
                                    Accept: 'application/json',
                                    'Accept-Encoding': 'gzip, deflate',
                                    'Content-Type': 'application/json',
                                },
                                timeout: 15000,
                            });
                            break; // success
                        }
                        catch (err) {
                            if (attempt === MAX_RETRIES) {
                                logger_1.logger.error('[Push] Expo batch failed after all retries', {
                                    campaignId: options.campaignId,
                                    attempt,
                                    maxRetries: MAX_RETRIES,
                                    error: err.message,
                                    status: err.response?.status,
                                    batchIndex: Math.floor(i / BATCH),
                                    batchSize: batch.length,
                                });
                                failureCount += batch.length;
                            }
                            else {
                                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                                logger_1.logger.warn('[Push] Expo batch attempt failed, retrying', {
                                    campaignId: options.campaignId,
                                    attempt,
                                    maxRetries: MAX_RETRIES,
                                    error: err.message,
                                    retryDelayMs: delay,
                                });
                                await new Promise((resolve) => setTimeout(resolve, delay));
                            }
                        }
                    }
                    if (response) {
                        const data = response.data?.data ?? [];
                        for (const result of data) {
                            if (result.status === 'ok')
                                successCount++;
                            else
                                failureCount++;
                        }
                    }
                }
            }
            catch (err) {
                logger_1.logger.error('[Push] Expo send loop threw unexpectedly', {
                    campaignId: options.campaignId,
                    error: err.message,
                });
                failureCount += expoTokens.length;
            }
        }
        // ── FCM legacy fallback (for any non-Expo raw device tokens) ──────────
        if (fcmTokens.length > 0 && process.env.FCM_SERVER_KEY) {
            try {
                const FCM_URL = 'https://fcm.googleapis.com/fcm/send';
                const BATCH = 1000;
                for (let i = 0; i < fcmTokens.length; i += BATCH) {
                    const batch = fcmTokens.slice(i, i + BATCH);
                    const response = await axios_1.default.post(FCM_URL, {
                        registration_ids: batch,
                        notification: { title: options.title, body: options.body },
                        data: { campaignId: options.campaignId, merchantId: options.merchantId, type: 'broadcast' },
                    }, {
                        headers: { Authorization: `key=${process.env.FCM_SERVER_KEY}`, 'Content-Type': 'application/json' },
                        timeout: 15000,
                    });
                    successCount += response.data?.success || 0;
                    failureCount += response.data?.failure || 0;
                }
            }
            catch (err) {
                logger_1.logger.error('[Push] FCM fallback failed', { err: err.message });
                failureCount += fcmTokens.length;
            }
        }
        logger_1.logger.info('[Push] Batch complete', {
            campaignId: options.campaignId,
            total: options.tokens.length,
            expoTokens: expoTokens.length,
            fcmTokens: fcmTokens.length,
            successCount,
            failureCount,
        });
        return { success: successCount > 0 || failureCount === 0, successCount, failureCount };
    }
}
exports.pushChannel = new PushChannel();
exports.default = exports.pushChannel;
//# sourceMappingURL=PushChannel.js.map