export interface PushSendOptions {
    tokens: string[];
    title: string;
    body: string;
    campaignId: string;
    merchantId: string;
    imageUrl?: string;
    ctaUrl?: string;
}
export interface ChannelResult {
    success: boolean;
    successCount?: number;
    failureCount?: number;
    error?: string;
}
declare class PushChannel {
    get isConfigured(): boolean;
    send(options: PushSendOptions): Promise<ChannelResult>;
}
export declare const pushChannel: PushChannel;
export default pushChannel;
//# sourceMappingURL=PushChannel.d.ts.map