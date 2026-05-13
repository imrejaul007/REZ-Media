import { v4 as uuidv4 } from 'uuid';
import {
  IUnifiedTicket,
  Platform,
  TicketStatus,
  TicketPriority,
  IComment,
  PaginatedResponse,
  PlatformError,
} from '../types';
import { UnifiedTicket, IUnifiedTicketDocument } from '../models/UnifiedTicket';
import { getAuthService } from './authService';
import {
  ZENDESK_REVERSE_STATUS_MAP,
  ZENDESK_REVERSE_PRIORITY_MAP,
} from '../constants/zendeskFields';
import {
  FRESHDESK_REVERSE_STATUS_MAP,
  FRESHDESK_REVERSE_PRIORITY_MAP,
} from '../constants/freshdeskFields';
import {
  INTERCOM_REVERSE_STATE_MAP,
} from '../constants/intercomFields';

export interface CreateTicketInput {
  platform: Platform;
  platformTicketId: string;
  subject: string;
  description: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  requester: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    platform: Platform;
    platformContactId: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
    platform: Platform;
    platformAgentId: string;
  };
  tags?: string[];
  slaDeadline?: Date;
  externalUrls?: { platform: Platform; url: string }[];
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface UpdateTicketInput {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: {
    id: string;
    name: string;
    email: string;
    platform: Platform;
    platformAgentId: string;
  };
  tags?: string[];
  slaDeadline?: Date;
  satisfaction?: 'good' | 'bad';
  linkedRezTicketId?: string;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
}

export interface AddCommentInput {
  author: {
    id: string;
    name: string;
    email: string;
    type: 'agent' | 'customer' | 'system';
  };
  body: string;
  htmlBody?: string;
  attachments?: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
  }[];
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TicketQueryOptions {
  platform?: Platform;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  requesterEmail?: string;
  tags?: string[];
  linkedRezTicketId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export class TicketService {
  private authService = getAuthService();

  // Create a new unified ticket
  async createTicket(input: CreateTicketInput): Promise<IUnifiedTicketDocument> {
    const ticket = new UnifiedTicket({
      id: uuidv4(),
      platform: input.platform,
      platformTicketId: input.platformTicketId,
      subject: input.subject,
      description: input.description,
      status: input.status || 'open',
      priority: input.priority || 'normal',
      requester: input.requester,
      assignee: input.assignee,
      tags: input.tags || [],
      slaDeadline: input.slaDeadline,
      externalUrls: input.externalUrls || [],
      metadata: input.metadata || {},
      customFields: input.customFields || {},
      lastSyncedAt: new Date(),
      version: 1,
    });

    await ticket.save();
    return ticket;
  }

  // Find ticket by ID
  async getTicketById(id: string): Promise<IUnifiedTicketDocument | null> {
    return UnifiedTicket.findOne({ id, isDeleted: false });
  }

  // Find ticket by platform and platform ticket ID
  async getTicketByPlatformId(
    platform: Platform,
    platformTicketId: string
  ): Promise<IUnifiedTicketDocument | null> {
    return UnifiedTicket.findOne({ platform, platformTicketId, isDeleted: false });
  }

  // Find or create ticket
  async findOrCreateTicket(input: CreateTicketInput): Promise<IUnifiedTicketDocument> {
    const existing = await this.getTicketByPlatformId(input.platform, input.platformTicketId);
    if (existing) {
      return existing;
    }
    return this.createTicket(input);
  }

  // Update ticket
  async updateTicket(
    id: string,
    updates: UpdateTicketInput
  ): Promise<IUnifiedTicketDocument | null> {
    const ticket = await UnifiedTicket.findOne({ id, isDeleted: false });
    if (!ticket) {
      return null;
    }

    // Apply updates
    if (updates.subject !== undefined) ticket.subject = updates.subject;
    if (updates.description !== undefined) ticket.description = updates.description;
    if (updates.status !== undefined) ticket.status = updates.status;
    if (updates.priority !== undefined) ticket.priority = updates.priority;
    if (updates.assignee !== undefined) ticket.assignee = updates.assignee;
    if (updates.tags !== undefined) ticket.tags = updates.tags;
    if (updates.slaDeadline !== undefined) ticket.slaDeadline = updates.slaDeadline;
    if (updates.satisfaction !== undefined) ticket.satisfaction = updates.satisfaction;
    if (updates.linkedRezTicketId !== undefined) ticket.linkedRezTicketId = updates.linkedRezTicketId;
    if (updates.metadata !== undefined) {
      ticket.metadata = { ...ticket.metadata, ...updates.metadata };
    }
    if (updates.customFields !== undefined) {
      ticket.customFields = { ...ticket.customFields, ...updates.customFields };
    }

    ticket.version += 1;
    ticket.lastSyncedAt = new Date();

    await ticket.save();
    return ticket;
  }

  // Update ticket status and sync to platform
  async updateTicketStatus(
    id: string,
    status: TicketStatus,
    comment?: string
  ): Promise<IUnifiedTicketDocument | null> {
    const ticket = await UnifiedTicket.findOne({ id, isDeleted: false });
    if (!ticket) {
      return null;
    }

    ticket.status = status;
    ticket.version += 1;
    ticket.lastSyncedAt = new Date();

    // Sync to platform
    if (comment) {
      await this.addComment(id, {
        author: {
          id: 'system',
          name: 'System',
          email: 'system@rez.app',
          type: 'system',
        },
        body: comment,
        isPublic: false,
      });
    }

    await this.syncStatusToPlatform(ticket, status);
    await ticket.save();

    return ticket;
  }

  // Assign ticket
  async assignTicket(
    id: string,
    assignee: {
      id: string;
      name: string;
      email: string;
      platform: Platform;
      platformAgentId: string;
    }
  ): Promise<IUnifiedTicketDocument | null> {
    const ticket = await UnifiedTicket.findOne({ id, isDeleted: false });
    if (!ticket) {
      return null;
    }

    ticket.assignee = assignee;
    ticket.version += 1;
    ticket.lastSyncedAt = new Date();

    // Sync to platform
    await this.syncAssigneeToPlatform(ticket, assignee);

    await ticket.save();
    return ticket;
  }

  // Link to ReZ ticket
  async linkToRezTicket(
    ticketId: string,
    rezTicketId: string
  ): Promise<IUnifiedTicketDocument | null> {
    const ticket = await UnifiedTicket.findOne({ ticketId, isDeleted: false });
    if (!ticket) {
      return null;
    }

    ticket.linkedRezTicketId = rezTicketId;
    ticket.version += 1;

    // Add custom field for ReZ ticket ID
    ticket.customFields = {
      ...ticket.customFields,
      linkedRezTicketId: rezTicketId,
    };

    await ticket.save();
    return ticket;
  }

  // Add comment
  async addComment(
    ticketId: string,
    input: AddCommentInput
  ): Promise<IUnifiedTicketDocument | null> {
    const ticket = await UnifiedTicket.findOne({ id: ticketId, isDeleted: false });
    if (!ticket) {
      return null;
    }

    const comment: IComment = {
      id: uuidv4(),
      ticketId: ticket.id,
      platform: ticket.platform,
      platformCommentId: uuidv4(),
      author: input.author,
      body: input.body,
      htmlBody: input.htmlBody,
      attachments: input.attachments || [],
      isPublic: input.isPublic !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: input.metadata,
    };

    ticket.comments.push(comment);
    ticket.version += 1;
    ticket.lastSyncedAt = new Date();

    // Sync to platform
    await this.syncCommentToPlatform(ticket, comment);

    await ticket.save();
    return ticket;
  }

  // Query tickets
  async queryTickets(options: TicketQueryOptions): Promise<PaginatedResponse<IUnifiedTicketDocument>> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { isDeleted: false };

    if (options.platform) query.platform = options.platform;
    if (options.status) query.status = options.status;
    if (options.priority) query.priority = options.priority;
    if (options.assigneeId) query['assignee.id'] = options.assigneeId;
    if (options.requesterEmail) query['requester.email'] = options.requesterEmail;
    if (options.linkedRezTicketId) query.linkedRezTicketId = options.linkedRezTicketId;
    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }

    const sortBy = options.sortBy || 'updatedAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const [tickets, total] = await Promise.all([
      UnifiedTicket.find(query).sort(sort).skip(skip).limit(limit),
      UnifiedTicket.countDocuments(query),
    ]);

    return {
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  // Get all tickets (aggregated from all platforms)
  async getAllTickets(options?: {
    page?: number;
    limit?: number;
    status?: TicketStatus;
    platform?: Platform;
  }): Promise<PaginatedResponse<IUnifiedTicketDocument>> {
    return this.queryTickets({
      page: options?.page,
      limit: options?.limit,
      status: options?.status,
      platform: options?.platform,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  }

  // Get tickets by platform
  async getTicketsByPlatform(
    platform: Platform,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<IUnifiedTicketDocument>> {
    return this.getAllTickets({ ...options, platform });
  }

  // Get ticket statistics
  async getStatistics(): Promise<{
    total: number;
    byPlatform: Record<Platform, number>;
    byStatus: Record<TicketStatus, number>;
    byPriority: Record<TicketPriority, number>;
    openTickets: number;
    linkedTickets: number;
  }> {
    const [tickets, stats] = await Promise.all([
      UnifiedTicket.find({ isDeleted: false }),
      UnifiedTicket.aggregate([
        { $match: { isDeleted: false } },
        {
          $facet: {
            byPlatform: [{ $group: { _id: '$platform', count: { $sum: 1 } } }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
            openTickets: [{ $match: { status: 'open' } }, { $count: 'count' }],
            linkedTickets: [
              { $match: { linkedRezTicketId: { $exists: true, $ne: null } } },
              { $count: 'count' },
            ],
          },
        },
      ]),
    ]);

    const result = stats[0] || {};

    return {
      total: tickets.length,
      byPlatform: (result.byPlatform || []).reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {} as Record<Platform, number>
      ),
      byStatus: (result.byStatus || []).reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {} as Record<TicketStatus, number>
      ),
      byPriority: (result.byPriority || []).reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {} as Record<TicketPriority, number>
      ),
      openTickets: result.openTickets?.[0]?.count || 0,
      linkedTickets: result.linkedTickets?.[0]?.count || 0,
    };
  }

  // Soft delete ticket
  async deleteTicket(id: string): Promise<boolean> {
    const ticket = await UnifiedTicket.findOne({ id, isDeleted: false });
    if (!ticket) {
      return false;
    }

    ticket.isDeleted = true;
    ticket.version += 1;
    await ticket.save();

    return true;
  }

  // Sync status to platform
  private async syncStatusToPlatform(
    ticket: IUnifiedTicketDocument,
    status: TicketStatus
  ): Promise<void> {
    const client = this.authService.getClient(ticket.platform);
    if (!client) return;

    try {
      if (ticket.platform === 'zendesk') {
        const zendeskClient = client as any;
        const zendeskStatus = ZENDESK_REVERSE_STATUS_MAP[status];
        await zendeskClient.updateTicketStatus(
          parseInt(ticket.platformTicketId),
          zendeskStatus
        );
      } else if (ticket.platform === 'freshdesk') {
        const freshdeskClient = client as any;
        const freshdeskStatus = FRESHDESK_REVERSE_STATUS_MAP[status];
        await freshdeskClient.updateTicketStatus(
          parseInt(ticket.platformTicketId),
          freshdeskStatus
        );
      } else if (ticket.platform === 'intercom') {
        const intercomClient = client as any;
        const intercomState = INTERCOM_REVERSE_STATE_MAP[status];
        if (status === 'closed' || status === 'solved') {
          await intercomClient.closeConversation(ticket.platformTicketId);
        }
      }
    } catch (error) {
      console.error(`Failed to sync status to ${ticket.platform}:`, error);
    }
  }

  // Sync assignee to platform
  private async syncAssigneeToPlatform(
    ticket: IUnifiedTicketDocument,
    assignee: { platform: Platform; platformAgentId: string }
  ): Promise<void> {
    if (ticket.platform !== assignee.platform) return;

    const client = this.authService.getClient(ticket.platform);
    if (!client) return;

    try {
      if (ticket.platform === 'zendesk') {
        const zendeskClient = client as any;
        await zendeskClient.assignTicket(
          parseInt(ticket.platformTicketId),
          parseInt(assignee.platformAgentId)
        );
      } else if (ticket.platform === 'freshdesk') {
        const freshdeskClient = client as any;
        await freshdeskClient.assignTicket(
          parseInt(ticket.platformTicketId),
          parseInt(assignee.platformAgentId)
        );
      } else if (ticket.platform === 'intercom') {
        const intercomClient = client as any;
        await intercomClient.assignConversation(
          ticket.platformTicketId,
          assignee.platformAgentId
        );
      }
    } catch (error) {
      console.error(`Failed to sync assignee to ${ticket.platform}:`, error);
    }
  }

  // Sync comment to platform
  private async syncCommentToPlatform(
    ticket: IUnifiedTicketDocument,
    comment: IComment
  ): Promise<void> {
    const client = this.authService.getClient(ticket.platform);
    if (!client) return;

    try {
      if (ticket.platform === 'zendesk') {
        const zendeskClient = client as any;
        await zendeskClient.addComment(
          parseInt(ticket.platformTicketId),
          comment.body,
          comment.isPublic
        );
      } else if (ticket.platform === 'freshdesk') {
        const freshdeskClient = client as any;
        if (comment.isPublic) {
          await freshdeskClient.addReply(
            parseInt(ticket.platformTicketId),
            comment.body
          );
        } else {
          await freshdeskClient.addNote(
            parseInt(ticket.platformTicketId),
            comment.body
          );
        }
      } else if (ticket.platform === 'intercom') {
        const intercomClient = client as any;
        await intercomClient.replyToConversation(
          ticket.platformTicketId,
          comment.body
        );
      }
    } catch (error) {
      console.error(`Failed to sync comment to ${ticket.platform}:`, error);
    }
  }
}

// Singleton instance
let ticketServiceInstance: TicketService | null = null;

export function getTicketService(): TicketService {
  if (!ticketServiceInstance) {
    ticketServiceInstance = new TicketService();
  }
  return ticketServiceInstance;
}

export default TicketService;
