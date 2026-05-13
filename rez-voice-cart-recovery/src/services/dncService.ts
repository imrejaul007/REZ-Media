import mongoose, { Schema } from 'mongoose';
import { DncEntry, AddToDncSchema } from '../types';

const dncSchema = new Schema<DncEntry>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    reason: {
      type: String
    },
    source: {
      type: String
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: false,
    collection: 'dnc_list'
  }
);

// TTL index for automatic expiration
dncSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups
dncSchema.index({ phone: 1, expiresAt: 1 });

export interface IDncEntry extends mongoose.Document, DncEntry {}

const DncModel = mongoose.model<IDncEntry>('DNC', dncSchema);

export class DncService {
  /**
   * Check if a phone number is on the DNC list
   */
  async isPhoneDnc(phone: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);

    const entry = await DncModel.findOne({
      phone: normalizedPhone,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    return entry !== null;
  }

  /**
   * Add a phone number to the DNC list
   */
  async addToDnc(
    phone: string,
    options: {
      reason?: string;
      source?: string;
      expiresAt?: Date;
    } = {}
  ): Promise<DncEntry> {
    const normalizedPhone = this.normalizePhone(phone);

    // Use upsert to handle existing entries
    const entry = await DncModel.findOneAndUpdate(
      { phone: normalizedPhone },
      {
        $set: {
          phone: normalizedPhone,
          reason: options.reason,
          source: options.source,
          expiresAt: options.expiresAt,
          addedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return entry;
  }

  /**
   * Add multiple phone numbers to the DNC list
   */
  async bulkAddToDnc(
    entries: Array<{
      phone: string;
      reason?: string;
      source?: string;
      expiresAt?: Date;
    }>
  ): Promise<{ added: number; failed: number; errors: string[] }> {
    const results = {
      added: 0,
      failed: 0,
      errors: [] as string[]
    };

    const operations = entries.map(entry => {
      const normalizedPhone = this.normalizePhone(entry.phone);
      return {
        updateOne: {
          filter: { phone: normalizedPhone },
          update: {
            $set: {
              phone: normalizedPhone,
              reason: entry.reason,
              source: entry.source,
              expiresAt: entry.expiresAt,
              addedAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

    try {
      const response = await DncModel.bulkWrite(operations);
      results.added = response.upsertedCount + response.modifiedCount;
    } catch (error) {
      results.failed = entries.length;
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return results;
  }

  /**
   * Remove a phone number from the DNC list
   */
  async removeFromDnc(phone: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);

    const result = await DncModel.deleteOne({ phone: normalizedPhone });
    return result.deletedCount > 0;
  }

  /**
   * Get DNC entry for a phone number
   */
  async getDncEntry(phone: string): Promise<DncEntry | null> {
    const normalizedPhone = this.normalizePhone(phone);

    return DncModel.findOne({
      phone: normalizedPhone,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });
  }

  /**
   * List DNC entries with pagination
   */
  async listDncEntries(
    options: {
      page?: number;
      limit?: number;
      includeExpired?: boolean;
      source?: string;
    } = {}
  ): Promise<{
    entries: DncEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);

    const query: any = {};

    if (!options.includeExpired) {
      query.$or = [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ];
    }

    if (options.source) {
      query.source = options.source;
    }

    const [entries, total] = await Promise.all([
      DncModel.find(query)
        .sort({ addedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      DncModel.countDocuments(query)
    ]);

    return {
      entries,
      total,
      page,
      limit
    };
  }

  /**
   * Clean up expired DNC entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    const result = await DncModel.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    return result.deletedCount;
  }

  /**
   * Get DNC statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    bySource: Record<string, number>;
  }> {
    const [total, active, expired, bySourceResult] = await Promise.all([
      DncModel.countDocuments(),
      DncModel.countDocuments({
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }),
      DncModel.countDocuments({
        expiresAt: { $lt: new Date() }
      }),
      DncModel.aggregate([
        { $match: { source: { $exists: true, $ne: null } } },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ])
    ]);

    const bySource: Record<string, number> = {};
    bySourceResult.forEach(item => {
      bySource[item._id] = item.count;
    });

    return {
      total,
      active,
      expired,
      bySource
    };
  }

  /**
   * Check multiple phone numbers at once
   */
  async checkMultiple(phones: string[]): Promise<Map<string, boolean>> {
    const normalizedPhones = phones.map(p => this.normalizePhone(p));

    const entries = await DncModel.find({
      phone: { $in: normalizedPhones },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    const result = new Map<string, boolean>();
    normalizedPhones.forEach(phone => {
      const found = entries.some(e => e.phone === phone);
      result.set(phone, found);
    });

    return result;
  }

  /**
   * Normalize phone number to E.164 format
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      // Assume Indian number if 10 digits
      if (normalized.length === 10) {
        normalized = '+91' + normalized;
      } else if (normalized.length === 11 && normalized.startsWith('0')) {
        normalized = '+91' + normalized.substring(1);
      } else {
        normalized = '+' + normalized;
      }
    }

    return normalized;
  }

  /**
   * Import DNC list from external source
   */
  async importFromExternal(
    source: string,
    entries: Array<{ phone: string; reason?: string }>
  ): Promise<{ imported: number; duplicates: number; invalid: number }> {
    const results = {
      imported: 0,
      duplicates: 0,
      invalid: 0
    };

    for (const entry of entries) {
      try {
        // Validate phone format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const normalizedPhone = this.normalizePhone(entry.phone);

        if (!phoneRegex.test(normalizedPhone.replace(/\s/g, ''))) {
          results.invalid++;
          continue;
        }

        // Check if already exists
        const existing = await this.getDncEntry(normalizedPhone);
        if (existing) {
          results.duplicates++;
          continue;
        }

        await this.addToDnc(normalizedPhone, {
          reason: entry.reason,
          source
        });

        results.imported++;
      } catch (error) {
        results.invalid++;
      }
    }

    return results;
  }
}

export const dncService = new DncService();
