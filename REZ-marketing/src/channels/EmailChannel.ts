import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

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

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SES_REGION } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: parseInt(SMTP_PORT || '587') === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return transporter;
  }

  if (SES_REGION) {
    // AWS SES via SMTP endpoint
    transporter = nodemailer.createTransport({
      host: `email-smtp.${SES_REGION}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: process.env.AWS_SES_SMTP_USER || process.env.AWS_ACCESS_KEY_ID || '',
        pass: process.env.AWS_SES_SMTP_PASS || process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    return transporter;
  }

  return null;
}

class EmailChannel {
  get isConfigured() {
    return !!(process.env.SMTP_HOST || process.env.SES_REGION);
  }

  /**
   * Build branded HTML email template wrapping merchant campaign message.
   */
  buildHtml(message: string, campaignId: string, ctaUrl?: string, ctaText?: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.rez.money';
    const unsubLink = `${frontendUrl}/unsubscribe?cid=${campaignId}`;
    const trackPixel = `${process.env.MARKETING_SERVICE_URL || ''}/analytics/track/open?cid=${campaignId}`;

    // Escape HTML special characters to prevent XSS in user-supplied messages
    const escapeHtml = (str: string): string =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const safeMessage = escapeHtml(message);

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7C3AED,#6366F1);padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">REZ</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">${safeMessage.replace(/\n/g, '<br>')}</p>
          ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${ctaText || 'View Offer'}</a>` : ''}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">
            You're receiving this because you opted in to marketing emails from REZ merchants.
            <a href="${unsubLink}" style="color:#6366f1;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${trackPixel}" width="1" height="1" style="display:none;" alt="">
</body>
</html>`;
  }

  async send(options: EmailSendOptions & { ctaUrl?: string; ctaText?: string }): Promise<ChannelResult> {
    if (!this.isConfigured) return { success: false, error: 'Email not configured' };

    const t = getTransporter();
    if (!t) return { success: false, error: 'Email transporter unavailable' };

    try {
      const info = await t.sendMail({
        from: process.env.EMAIL_FROM || 'REZ <noreply@rez.money>',
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
        html: options.html || this.buildHtml(options.html, options.campaignId, options.ctaUrl, options.ctaText),
      });

      logger.info('[Email] Sent', { campaignId: options.campaignId, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      logger.warn('[Email] Send failed', { campaignId: options.campaignId, err: err.message });
      return { success: false, error: err.message };
    }
  }
}

export const emailChannel = new EmailChannel();
export default emailChannel;
