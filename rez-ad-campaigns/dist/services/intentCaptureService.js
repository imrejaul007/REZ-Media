"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.track = track;
// @ts-nocheck
const INTENT_CAPTURE_URL = process.env.INTENT_CAPTURE_URL || 'https://rez-intent-graph.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
async function track(params) {
    try {
        await fetch(`${INTENT_CAPTURE_URL}/api/intent/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-token': INTERNAL_SERVICE_TOKEN,
            },
            body: JSON.stringify({
                userId: params.userId,
                eventType: params.event,
                intentKey: params.intentKey,
                properties: params.properties ?? {},
                appType: 'rez-ads-service',
                category: 'GENERAL',
            }),
        });
    }
    catch { }
}
//# sourceMappingURL=intentCaptureService.js.map