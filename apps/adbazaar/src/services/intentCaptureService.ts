const INTENT_CAPTURE_URL = process.env.NEXT_PUBLIC_INTENT_CAPTURE_URL || '';

const EVENT_TO_INTENT_MAP: Record<string, { eventType: string; category: string; confidence: number }> = {
  listing_viewed: { eventType: 'view', category: 'RETAIL', confidence: 0.25 },
  offer_made: { eventType: 'hold', category: 'RETAIL', confidence: 0.35 },
  campaign_created: { eventType: 'fulfilled', category: 'RETAIL', confidence: 1.0 },
  listing_searched: { eventType: 'search', category: 'RETAIL', confidence: 0.15 },
};

export async function captureIntent(params: {
  userId: string;
  eventType: string;
  category: string;
  intentKey: string;
  metadata?: Record<string, unknown>;
  appType: string;
}): Promise<void> {
  if (!INTENT_CAPTURE_URL) return;
  try {
    await fetch(`${INTENT_CAPTURE_URL}/api/intent/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: params.userId,
        appType: params.appType,
        eventType: params.eventType,
        category: params.category,
        intentKey: params.intentKey,
        metadata: params.metadata,
      }),
    });
  } catch {
    // Never throw — intent capture must never break UX
  }
}

export function track(params: {
  userId: string;
  event: string;
  appType: string;
  intentKey: string;
  properties?: Record<string, unknown>;
}): void {
  const config = EVENT_TO_INTENT_MAP[params.event];
  if (!config || !params.userId) return;
  captureIntent({
    userId: params.userId,
    appType: params.appType,
    eventType: config.eventType,
    category: config.category,
    intentKey: params.intentKey,
    metadata: params.properties,
  }).catch(() => {});
}
