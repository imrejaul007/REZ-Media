/**
 * Event Platform Integration Config
 *
 * Configures how rez-ads-service connects to rez-event-platform
 * for emitting ad events (impression, click, conversion).
 */
export interface EventPlatformConfig {
    url: string;
    enabled: boolean;
    timeout: number;
}
export declare const eventPlatformConfig: EventPlatformConfig;
/**
 * Forward event to event-platform
 * Non-blocking - won't fail the main operation if event-platform is unavailable
 */
export declare function forwardToEventPlatform(eventType: string, payload: Record<string, any>): Promise<{
    success: boolean;
    eventId?: string;
}>;
/**
 * Emit ad.impression event
 */
export declare function emitAdImpression(payload: {
    adId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    placement?: string;
    deviceType?: string;
    platform?: string;
    location?: string;
    referrer?: string;
}): Promise<{
    success: boolean;
    eventId?: string;
}>;
/**
 * Emit ad.click event
 */
export declare function emitAdClick(payload: {
    adId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    placement?: string;
    deviceType?: string;
    platform?: string;
    location?: string;
    ctaClicked?: string;
}): Promise<{
    success: boolean;
    eventId?: string;
}>;
/**
 * Emit conversion event
 */
export declare function emitConversion(payload: {
    conversionId: string;
    campaignId: string;
    merchantId: string;
    userId?: string;
    orderId?: string;
    value: number;
    currency?: string;
    source?: string;
    channel?: string;
}): Promise<{
    success: boolean;
    eventId?: string;
}>;
//# sourceMappingURL=eventPlatform.d.ts.map