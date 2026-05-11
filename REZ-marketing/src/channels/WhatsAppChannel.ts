import axios from 'axios';
import { getRedis } from '../config/redis';
import { logger } from '../config/logger';

const META_API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';
const TIMEOUT_MS = 15_000;
const RATE_LIMIT_DELAY_MS = 15; // 80 msg/s Meta tier-1
const BATCH_SIZE = 50; // Meta max messages per batch request
const CONCURRENT_BATCHES = 5; // send up to 5 batches concurrently

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

class WhatsAppChannel {
  private get token() { return process.env.WHATSAPP_TOKEN; }
  private get phoneId() { return process.env.WHATSAPP_PHONE_ID; }

  get isConfigured() { return !!(this.token && this.phoneId); }

  normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.startsWith('0')) return `91${cleaned.slice(1)}`;
    return cleaned;
  }

  private async isDuplicate(campaignId: string, phone: string): Promise<boolean> {
    try {
      const redis = getRedis();
      // BE-MKT-008 FIX: Include timestamp in dedup key to allow campaign relaunches.
      // Each send attempt gets a unique key based on when it occurred, so relaunches
      // (even with the same campaignId) can resend if sufficient time has passed.
      const now = Date.now();
      const dedupWindow = Math.floor(now / 86400000); // Daily window
      const result = await redis.set(`wa:mkt:dedup:${campaignId}:${phone}:${dedupWindow}`, '1', 'EX', 86400, 'NX');
      return result === null;
    } catch {
      return false;
    }
  }

  async send(options: WhatsAppSendOptions): Promise<ChannelResult> {
    if (!this.isConfigured) return { success: false, error: 'WhatsApp not configured' };

    const phone = this.normalizePhone(options.to);

    if (await this.isDuplicate(options.campaignId, phone)) {
      return { success: true, deduped: true };
    }

    try {
      const payload = options.templateName
        ? {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: options.templateName,
              language: { code: 'en' },
              components: options.templateComponents || [],
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: options.message, preview_url: false },
          };

      const response = await axios.post(
        `${BASE_URL}/${META_API_VERSION}/${this.phoneId}/messages`,
        payload,
        {
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          timeout: TIMEOUT_MS,
        },
      );

      const messageId = response.data?.messages?.[0]?.id;
      logger.info('[WA] Sent', {
        campaignId: options.campaignId,
        phone: `***${phone.slice(-4)}`,
        messageId,
      });

      // Store messageId → campaignId for webhook receipt lookups (7-day TTL)
      if (messageId) {
        try {
          const redis = getRedis();
          await redis.set(`wa:mkt:msgid:${messageId}`, options.campaignId, 'EX', 7 * 86400);
        } catch { /* non-critical */ }
      }

      return { success: true, messageId };
    } catch (err: any) {
      const error = err?.response?.data?.error?.message || err?.message || 'unknown';
      logger.warn('[WA] Send failed', { campaignId: options.campaignId, error });
      return { success: false, error };
    }
  }

  /**
   * Send a batch of WhatsApp messages using Meta's batch endpoint.
   * Groups messages into chunks of up to 50 (Meta's batch limit) and sends
   * CONCURRENT_BATCHES chunks in parallel, replacing the per-message 15ms
   * delay with a single 15ms delay per batch group (MRS-L2).
   */
  async sendBatch(options: WhatsAppSendOptions[]): Promise<WhatsAppBatchResult> {
    if (!this.isConfigured) return { allDeduped: false, results: options.map(() => ({ success: false, error: 'WhatsApp not configured' })) };

    // Chunk into batches of BATCH_SIZE
    const chunks: WhatsAppSendOptions[][] = [];
    for (let i = 0; i < options.length; i += BATCH_SIZE) {
      chunks.push(options.slice(i, i + BATCH_SIZE));
    }

    const results: ChannelResult[] = [];
    let allDeduped = true;

    // Send CONCURRENT_BATCHES chunks at a time
    for (let i = 0; i < chunks.length; i += CONCURRENT_BATCHES) {
      const group = chunks.slice(i, i + CONCURRENT_BATCHES);
      const batchResults = await Promise.all(group.map((chunk) => this.sendBatchChunk(chunk)));
      for (const r of batchResults) {
        results.push(...r);
        if (r.some((msg) => !msg.deduped)) allDeduped = false;
      }

      // Rate limit: one 15ms pause between batch groups (not per message or per batch)
      if (i + CONCURRENT_BATCHES < chunks.length) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
      }
    }

    return { allDeduped, results };
  }

  private async sendBatchChunk(chunk: WhatsAppSendOptions[]): Promise<ChannelResult[]> {
    // MKT-09 FIX: Use Map keyed by normalized phone instead of positional findIndex.
    // Positional indexing breaks when the same phone appears multiple times in a chunk
    // or when normalizePhone changes the address (e.g. +91 prefix added), causing
    // index lookups to return wrong results and corrupt stats reporting.
    const dedupMap = new Map<string, ChannelResult>();
    const toSend: WhatsAppSendOptions[] = [];

    for (const opts of chunk) {
      const phone = this.normalizePhone(opts.to);
      if (await this.isDuplicate(opts.campaignId, phone)) {
        dedupMap.set(phone, { success: true, deduped: true });
      } else {
        toSend.push({ ...opts, to: phone });
      }
    }

    if (toSend.length === 0) {
      return chunk.map((opts) => dedupMap.get(this.normalizePhone(opts.to)) ?? { success: false, error: 'dedup lookup failed' });
    }

    try {
      // Build batch payload with individual message objects (supports text messages)
      const messages = toSend.map((opts) => {
        if (opts.templateName) {
          return {
            to: opts.to,
            type: 'template' as const,
            template: {
              name: opts.templateName,
              language: { code: 'en' },
              components: opts.templateComponents || [],
            },
          };
        }
        return {
          to: opts.to,
          type: 'text' as const,
          text: { body: opts.message, preview_url: false },
        };
      });

      const response = await axios.post(
        `${BASE_URL}/${META_API_VERSION}/${this.phoneId}/messages`,
        { messaging_product: 'whatsapp', messages },
        {
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          timeout: TIMEOUT_MS,
        },
      );

      // Meta returns individual message results in the response
      const sentStatuses = response.data?.messages || [];
      const messageIdMap = new Map<string, string>();
      for (const msg of sentStatuses) {
        if (msg.id) messageIdMap.set(msg.to, msg.id);
      }

      // Store messageId → campaignId for webhook lookups (7-day TTL)
      const redis = getRedis();
      await Promise.all(
        sentStatuses.map(async (msg: any) => {
          if (msg.id) {
            const opts = toSend.find((o) => o.to === msg.to);
            if (opts) {
              try {
                await redis.set(`wa:mkt:msgid:${msg.id}`, opts.campaignId, 'EX', 7 * 86400);
              } catch { /* non-critical */ }
            }
          }
        }),
      );

      // Build results: maintain same order as input chunk using Map lookup
      const chunkResults: ChannelResult[] = [];
      for (const opts of chunk) {
        const normalizedPhone = this.normalizePhone(opts.to);
        const dedupResult = dedupMap.get(normalizedPhone);
        if (dedupResult?.deduped) {
          chunkResults.push(dedupResult);
        } else {
          const messageId = messageIdMap.get(normalizedPhone);
          chunkResults.push({ success: true, messageId });
        }
      }
      return chunkResults;
    } catch (err: any) {
      // On batch failure, mark all as failed — deduped messages keep their dedup status
      const error = err?.response?.data?.error?.message || err?.message || 'unknown';
      logger.warn('[WA] Batch send failed', { count: toSend.length, error });
      const chunkResults: ChannelResult[] = [];
      for (const opts of chunk) {
        const normalizedPhone = this.normalizePhone(opts.to);
        const dedupResult = dedupMap.get(normalizedPhone);
        if (dedupResult?.deduped) {
          chunkResults.push(dedupResult);
        } else {
          chunkResults.push({ success: false, error });
        }
      }
      return chunkResults;
    }
  }
}

export const whatsAppChannel = new WhatsAppChannel();
export default whatsAppChannel;
