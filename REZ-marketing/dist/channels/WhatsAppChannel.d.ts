export interface WhatsAppSendOptions {
    to: string;
    message: string;
    campaignId: string;
    merchantId: string;
    templateName?: string;
    templateComponents?: object[];
}
export interface ChannelResult {
    success: boolean;
    messageId?: string;
    deduped?: boolean;
    error?: string;
}
export interface WhatsAppBatchResult {
    allDeduped: boolean;
    results: ChannelResult[];
}
declare class WhatsAppChannel {
    private get token();
    private get phoneId();
    get isConfigured(): boolean;
    normalizePhone(phone: string): string;
    private isDuplicate;
    send(options: WhatsAppSendOptions): Promise<ChannelResult>;
    /**
     * Send a batch of WhatsApp messages using Meta's batch endpoint.
     * Groups messages into chunks of up to 50 (Meta's batch limit) and sends
     * CONCURRENT_BATCHES chunks in parallel, replacing the per-message 15ms
     * delay with a single 15ms delay per batch group (MRS-L2).
     */
    sendBatch(options: WhatsAppSendOptions[]): Promise<WhatsAppBatchResult>;
    private sendBatchChunk;
}
export declare const whatsAppChannel: WhatsAppChannel;
export default whatsAppChannel;
//# sourceMappingURL=WhatsAppChannel.d.ts.map