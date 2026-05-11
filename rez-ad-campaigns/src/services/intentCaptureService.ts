// @ts-nocheck
const INTENT_CAPTURE_URL = process.env.INTENT_CAPTURE_URL || 'https://rez-intent-graph.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

export interface TrackParams {
  userId?: string;
  event: string;
  intentKey: string;
  properties?: Record<string, unknown>;
}

export async function track(params: TrackParams): Promise<void> {
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
  } catch {}
}
