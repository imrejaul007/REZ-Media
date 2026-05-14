/**
 * EmailChannel — transactional campaign email via SMTP or AWS SES.
 *
 * Config (env vars):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS  → standard SMTP (e.g. Zoho, Mailgun)
 *   OR
 *   SES_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY  → AWS SES
 *   EMAIL_FROM  → sender address (e.g. "REZ <noreply@rez.money>")
 */
export interface EmailSendOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    campaignId: string;
}
export interface ChannelResult {
    success: boolean;
    messageId?: string;
    deduped?: boolean;
    error?: string;
}
declare class EmailChannel {
    get isConfigured(): boolean;
    /**
     * Build branded HTML email template wrapping merchant campaign message.
     */
    buildHtml(message: string, campaignId: string, ctaUrl?: string, ctaText?: string): string;
    send(options: EmailSendOptions & {
        ctaUrl?: string;
        ctaText?: string;
    }): Promise<ChannelResult>;
}
export declare const emailChannel: EmailChannel;
export default emailChannel;
//# sourceMappingURL=EmailChannel.d.ts.map