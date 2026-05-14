/**
 * SMSChannel — MSG91 (primary) with Twilio fallback.
 *
 * MSG91 is the recommended provider for Indian numbers:
 *   - Supports DLT registered templates (required by TRAI)
 *   - Cheaper than Twilio for Indian routes
 *   - Supports bulk SMS API
 *
 * Set MSG91_AUTH_KEY + MSG91_SENDER_ID to use MSG91.
 * Falls back to Twilio if MSG91 not configured.
 */
export interface SMSSendOptions {
    to: string;
    message: string;
    campaignId: string;
}
export interface ChannelResult {
    success: boolean;
    messageId?: string;
    error?: string;
}
declare class SMSChannel {
    get isConfigured(): boolean;
    normalizePhone(phone: string): string;
    send(options: SMSSendOptions): Promise<ChannelResult>;
    private sendViaMSG91;
    private sendViaTwilio;
}
export declare const smsChannel: SMSChannel;
export default smsChannel;
//# sourceMappingURL=SMSChannel.d.ts.map