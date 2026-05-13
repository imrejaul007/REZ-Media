import { v4 as uuidv4 } from 'uuid';
import {
  IUnifiedContact,
  Platform,
  PaginatedResponse,
} from '../types';
import { UnifiedContact, IUnifiedContactDocument } from '../models/UnifiedContact';
import { getAuthService } from './authService';

export interface CreateContactInput {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  company?: {
    id: string;
    name: string;
    domain?: string;
  };
  tags?: string[];
  linkedRezUserId?: string;
  platforms?: {
    platform: Platform;
    platformContactId: string;
    externalUrl?: string;
  }[];
  metadata?: Record<string, unknown>;
}

export interface UpdateContactInput {
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  company?: {
    id: string;
    name: string;
    domain?: string;
  };
  tags?: string[];
  linkedRezUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface ContactQueryOptions {
  platform?: Platform;
  email?: string;
  name?: string;
  tags?: string[];
  linkedRezUserId?: string;
  hasOpenTickets?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'totalTickets';
  sortOrder?: 'asc' | 'desc';
}

export class ContactService {
  private authService = getAuthService();

  // Create a new unified contact
  async createContact(input: CreateContactInput): Promise<IUnifiedContactDocument> {
    const contact = new UnifiedContact({
      id: uuidv4(),
      platforms: input.platforms || [],
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      avatar: input.avatar,
      company: input.company,
      tags: input.tags || [],
      linkedRezUserId: input.linkedRezUserId,
      metadata: input.metadata || {},
      totalTickets: 0,
      openTickets: 0,
      solvedTickets: 0,
      lastSyncedAt: new Date(),
    });

    await contact.save();
    return contact;
  }

  // Find contact by ID
  async getContactById(id: string): Promise<IUnifiedContactDocument | null> {
    return UnifiedContact.findOne({ id });
  }

  // Find contact by email
  async getContactByEmail(email: string): Promise<IUnifiedContactDocument | null> {
    return UnifiedContact.findOne({ email: email.toLowerCase() });
  }

  // Find contact by platform contact ID
  async getContactByPlatformId(
    platform: Platform,
    platformContactId: string
  ): Promise<IUnifiedContactDocument | null> {
    return UnifiedContact.findOne({
      'platforms.platform': platform,
      'platforms.platformContactId': platformContactId,
    });
  }

  // Find contact by linked ReZ user ID
  async getContactByRezUserId(rezUserId: string): Promise<IUnifiedContactDocument | null> {
    return UnifiedContact.findOne({ linkedRezUserId: rezUserId });
  }

  // Find or create contact by email
  async findOrCreateByEmail(
    email: string,
    defaults?: Partial<CreateContactInput>
  ): Promise<IUnifiedContactDocument> {
    const existing = await this.getContactByEmail(email);
    if (existing) {
      return existing;
    }
    return this.createContact({
      name: defaults?.name || email.split('@')[0],
      email,
      ...defaults,
    });
  }

  // Update contact
  async updateContact(
    id: string,
    updates: UpdateContactInput
  ): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    // Apply updates
    if (updates.name !== undefined) contact.name = updates.name;
    if (updates.email !== undefined) contact.email = updates.email.toLowerCase();
    if (updates.phone !== undefined) contact.phone = updates.phone;
    if (updates.avatar !== undefined) contact.avatar = updates.avatar;
    if (updates.company !== undefined) contact.company = updates.company;
    if (updates.tags !== undefined) contact.tags = updates.tags;
    if (updates.linkedRezUserId !== undefined) contact.linkedRezUserId = updates.linkedRezUserId;
    if (updates.metadata !== undefined) {
      contact.metadata = { ...contact.metadata, ...updates.metadata };
    }

    contact.lastSyncedAt = new Date();
    await contact.save();

    return contact;
  }

  // Add platform to contact
  async addPlatform(
    id: string,
    platform: Platform,
    platformContactId: string,
    externalUrl?: string
  ): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    const exists = contact.platforms.some((p) => p.platform === platform);
    if (!exists) {
      contact.platforms.push({ platform, platformContactId, externalUrl });
      contact.lastSyncedAt = new Date();
      await contact.save();
    }

    return contact;
  }

  // Remove platform from contact
  async removePlatform(
    id: string,
    platform: Platform
  ): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    contact.platforms = contact.platforms.filter((p) => p.platform !== platform);
    contact.lastSyncedAt = new Date();
    await contact.save();

    return contact;
  }

  // Update ticket counts
  async updateTicketCounts(
    id: string,
    total: number,
    open: number,
    solved: number
  ): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    contact.totalTickets = total;
    contact.openTickets = open;
    contact.solvedTickets = solved;

    await contact.save();
    return contact;
  }

  // Link to ReZ user
  async linkToRezUser(
    contactId: string,
    rezUserId: string
  ): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ contactId });
    if (!contact) {
      return null;
    }

    contact.linkedRezUserId = rezUserId;
    contact.metadata = {
      ...contact.metadata,
      linkedRezUserId: rezUserId,
      linkedAt: new Date(),
    };

    await contact.save();
    return contact;
  }

  // Add tags
  async addTags(id: string, tags: string[]): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    const newTags = tags.filter((tag) => !contact.tags.includes(tag));
    contact.tags.push(...newTags);
    contact.lastSyncedAt = new Date();
    await contact.save();

    return contact;
  }

  // Remove tags
  async removeTags(id: string, tags: string[]): Promise<IUnifiedContactDocument | null> {
    const contact = await UnifiedContact.findOne({ id });
    if (!contact) {
      return null;
    }

    contact.tags = contact.tags.filter((tag) => !tags.includes(tag));
    contact.lastSyncedAt = new Date();
    await contact.save();

    return contact;
  }

  // Query contacts
  async queryContacts(options: ContactQueryOptions): Promise<PaginatedResponse<IUnifiedContactDocument>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (options.platform) {
      query['platforms.platform'] = options.platform;
    }
    if (options.email) query.email = { $regex: options.email, $options: 'i' };
    if (options.name) query.name = { $regex: options.name, $options: 'i' };
    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }
    if (options.linkedRezUserId) query.linkedRezUserId = options.linkedRezUserId;
    if (options.hasOpenTickets !== undefined) {
      query.openTickets = options.hasOpenTickets ? { $gt: 0 } : 0;
    }

    const sortBy = options.sortBy || 'updatedAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const [contacts, total] = await Promise.all([
      UnifiedContact.find(query).sort(sort).skip(skip).limit(limit),
      UnifiedContact.countDocuments(query),
    ]);

    return {
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  // Get all contacts
  async getAllContacts(options?: {
    page?: number;
    limit?: number;
    platform?: Platform;
  }): Promise<PaginatedResponse<IUnifiedContactDocument>> {
    return this.queryContacts({
      page: options?.page,
      limit: options?.limit,
      platform: options?.platform,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  }

  // Search contacts
  async searchContacts(
    query: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<PaginatedResponse<IUnifiedContactDocument>> {
    const searchRegex = new RegExp(query, 'i');
    const [contacts, total] = await Promise.all([
      UnifiedContact.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      })
        .limit(limit)
        .skip(offset),
      UnifiedContact.countDocuments({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ],
      }),
    ]);

    return {
      data: contacts,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    };
  }

  // Merge contacts
  async mergeContacts(
    primaryId: string,
    secondaryId: string
  ): Promise<IUnifiedContactDocument | null> {
    const [primary, secondary] = await Promise.all([
      UnifiedContact.findOne({ id: primaryId }),
      UnifiedContact.findOne({ id: secondaryId }),
    ]);

    if (!primary || !secondary) {
      return null;
    }

    // Merge platforms
    const existingPlatforms = new Set(
      primary.platforms.map((p) => `${p.platform}:${p.platformContactId}`)
    );
    for (const platform of secondary.platforms) {
      const key = `${platform.platform}:${platform.platformContactId}`;
      if (!existingPlatforms.has(key)) {
        primary.platforms.push(platform);
      }
    }

    // Merge tags
    const existingTags = new Set(primary.tags);
    for (const tag of secondary.tags) {
      if (!existingTags.has(tag)) {
        primary.tags.push(tag);
      }
    }

    // Update ticket counts (take the maximum)
    primary.totalTickets = Math.max(primary.totalTickets, secondary.totalTickets);
    primary.openTickets = Math.max(primary.openTickets, secondary.openTickets);
    primary.solvedTickets = Math.max(primary.solvedTickets, secondary.solvedTickets);

    // Update metadata
    primary.metadata = {
      ...secondary.metadata,
      ...primary.metadata,
      mergedFrom: secondaryId,
      mergedAt: new Date(),
    };

    // Update last contact time
    if (secondary.lastContactAt) {
      if (!primary.lastContactAt || secondary.lastContactAt > primary.lastContactAt) {
        primary.lastContactAt = secondary.lastContactAt;
      }
    }

    await primary.save();

    // Delete the secondary contact
    await UnifiedContact.deleteOne({ id: secondaryId });

    return primary;
  }

  // Get contact statistics
  async getStatistics(): Promise<{
    total: number;
    byPlatform: Record<Platform, number>;
    withOpenTickets: number;
    linkedToRez: number;
    averageTicketsPerContact: number;
  }> {
    const stats = await UnifiedContact.aggregate([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byPlatform: [
            { $unwind: '$platforms' },
            { $group: { _id: '$platforms.platform', count: { $sum: 1 } } },
          ],
          withOpenTickets: [
            { $match: { openTickets: { $gt: 0 } } },
            { $count: 'count' },
          ],
          linkedToRez: [
            { $match: { linkedRezUserId: { $exists: true, $ne: null } } },
            { $count: 'count' },
          ],
          avgTickets: [
            {
              $group: {
                _id: null,
                avgTotal: { $avg: '$totalTickets' },
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0] || {};

    return {
      total: result.total?.[0]?.count || 0,
      byPlatform: (result.byPlatform || []).reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {} as Record<Platform, number>
      ),
      withOpenTickets: result.withOpenTickets?.[0]?.count || 0,
      linkedToRez: result.linkedToRez?.[0]?.count || 0,
      averageTicketsPerContact: result.avgTickets?.[0]?.avgTotal || 0,
    };
  }

  // Delete contact
  async deleteContact(id: string): Promise<boolean> {
    const result = await UnifiedContact.deleteOne({ id });
    return result.deletedCount > 0;
  }
}

// Singleton instance
let contactServiceInstance: ContactService | null = null;

export function getContactService(): ContactService {
  if (!contactServiceInstance) {
    contactServiceInstance = new ContactService();
  }
  return contactServiceInstance;
}

export default ContactService;
