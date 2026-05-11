import axios from 'axios';
import { logger } from '../config/logger';

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

class SMSChannel {
  get isConfigured() {
    return !!(process.env.MSG91_AUTH_KEY || (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN));
  }

  normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.startsWith('0')) return `91${cleaned.slice(1)}`;
    return cleaned;
  }

  async send(options: SMSSendOptions): Promise<ChannelResult> {
    if (!this.isConfigured) return { success: false, error: 'SMS not configured' };

    const phone = this.normalizePhone(options.to);

    if (process.env.MSG91_AUTH_KEY) {
      return this.sendViaMSG91(phone, options.message);
    }

    return this.sendViaTwilio(phone, options.message);
  }

  private async sendViaMSG91(phone: string, message: string): Promise<ChannelResult> {
    try {
      const response = await axios.post('https://api.msg91.com/api/sendhttp.php', null, {
        params: {
          authkey: process.env.MSG91_AUTH_KEY,
          mobiles: phone,
          message,
          sender: process.env.MSG91_SENDER_ID || 'REZAPP',
          route: 4, // transactional
          country: 91,
        },
        headers: { 'authkey': process.env.MSG91_AUTH_KEY! },
        timeout: 10_000,
      });

      return { success: true, messageId: response.data?.toString() };
    } catch (err: any) {
      logger.warn('[SMS:MSG91] Send failed', { phone: `***${phone.slice(-4)}`, err: err.message });
      return { success: false, error: err.message };
    }
  }

  private async sendViaTwilio(phone: string, message: string): Promise<ChannelResult> {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

      const result = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+${phone}`,
      });

      return { success: true, messageId: result.sid };
    } catch (err: any) {
      logger.warn('[SMS:Twilio] Send failed', { phone: `***${phone.slice(-4)}`, err: err.message });
      return { success: false, error: err.message };
    }
  }
}

export const smsChannel = new SMSChannel();
export default smsChannel;
