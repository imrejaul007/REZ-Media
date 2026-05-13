import { v4 as uuidv4 } from 'uuid';
import {
  Platform,
  SyncType,
  SyncEntity,
  SyncStatus,
  SyncStatusResponse,
} from '../types';
import { SyncLog, ISyncLogDocument } from '../models/SyncLog';
import { getAuthService } from './authService';
import { getTicketService } from './ticketService';
import { getContactService } from './contactService';
import config from '../config';

export interface SyncResult {
  success: boolean;
  platform: Platform;
  entity: SyncEntity;
  processedItems: number;
  failedItems: number;
  errors: { itemId: string; error: string }[];
  duration: number;
}

export interface SyncAllResult {
  overallSuccess: boolean;
  results: SyncResult[];
  totalProcessed: number;
  totalFailed: number;
  duration: number;
}

export class SyncService {
  private authService = getAuthService();
  private ticketService = getTicketService();
  private contactService = getContactService();
  private isSyncing = new Map<Platform, boolean>();

  // Create a sync log entry
  private async createSyncLog(
    platform: Platform,
    entity: SyncEntity,
    syncType: SyncType
  ): Promise<ISyncLogDocument> {
    const log = new SyncLog({
      id: uuidv4(),
      platform,
      entity,
      syncType,
      status: 'pending',
      startedAt: new Date(),
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      errors: [],
    });
    await log.save();
    return log;
  }

  // Update sync log
  private async updateSyncLog(
    logId: string,
    updates: Partial<{
      status: SyncStatus;
      completedAt: Date;
      duration: number;
      totalItems: number;
      processedItems: number;
      failedItems: number;
      errors: { itemId: string; error: string; timestamp: Date }[];
    }>
  ): Promise<void> {
    await SyncLog.findOneAndUpdate({ id: logId }, updates);
  }

  // Sync Zendesk tickets
  async syncZendeskTickets(syncType: SyncType = 'incremental'): Promise<SyncResult> {
    const startTime = Date.now();
    const log = await this.createSyncLog('zendesk', 'tickets', syncType);

    try {
      await this.updateSyncLog(log.id, { status: 'in_progress' });

      const client = this.authService.getClient('zendesk');
      if (!client) {
        throw new Error('Zendesk client not configured');
      }

      const zendeskClient = client as any;
      const errors: { itemId: string; error: string }[] = [];
      let processedItems = 0;
      let failedItems = 0;

      // Get tickets based on sync type
      let tickets: any[] = [];
      if (syncType === 'full') {
        // For full sync, get recent tickets in batches
        tickets = await zendeskClient.getRecentTickets();
      } else {
        // For incremental sync, get tickets updated since last sync
        const lastSync = this.authService.getLastSyncTime('zendesk');
        const since = lastSync
          ? Math.floor(lastSync.getTime() / 1000)
          : Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
        tickets = await zendeskClient.getTicketsSince(since);
      }

      for (const ticket of tickets) {
        try {
          const transformed = zendeskClient.transformTicket(ticket);

          // Get requester info
          let requester = {
            id: String(ticket.requester_id),
            name: 'Unknown',
            email: 'unknown@example.com',
            platform: 'zendesk' as Platform,
            platformContactId: String(ticket.requester_id),
          };

          if (ticket.requester_id) {
            const user = await zendeskClient.getUser(ticket.requester_id);
            if (user) {
              const transformedUser = zendeskClient.transformUser(user);
              requester = {
                id: transformedUser.platformContactId,
                name: transformedUser.name,
                email: transformedUser.email,
                platform: 'zendesk',
                platformContactId: transformedUser.platformContactId,
              };
            }
          }

          // Get assignee info if available
          let assignee;
          if (ticket.assignee_id) {
            const agent = await zendeskClient.getUser(ticket.assignee_id);
            if (agent) {
              const transformedAgent = zendeskClient.transformUser(agent);
              assignee = {
                id: transformedAgent.platformContactId,
                name: transformedAgent.name,
                email: transformedAgent.email,
                platform: 'zendesk',
                platformAgentId: transformedAgent.platformContactId,
              };
            }
          }

          await this.ticketService.findOrCreateTicket({
            platform: 'zendesk',
            platformTicketId: transformed.platformTicketId,
            subject: transformed.subject,
            description: transformed.description,
            status: transformed.status as any,
            priority: transformed.priority as any,
            requester,
            assignee,
            tags: transformed.tags,
            slaDeadline: transformed.customFields?.slaDeadline
              ? new Date(transformed.customFields.slaDeadline as string)
              : undefined,
            externalUrls: [
              {
                platform: 'zendesk',
                url: zendeskClient.getTicketUrl(ticket.id),
              },
            ],
            customFields: transformed.customFields,
          });

          processedItems++;
        } catch (error) {
          failedItems++;
          errors.push({
            itemId: String(ticket.id),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Get comments for each ticket
      for (const ticket of tickets.slice(0, config.sync.batchSize)) {
        try {
          const commentsResponse = await zendeskClient.getTicketComments(ticket.id);
          const unifiedTicket = await this.ticketService.getTicketByPlatformId(
            'zendesk',
            String(ticket.id)
          );

          if (unifiedTicket) {
            for (const comment of commentsResponse.comments || []) {
              const transformedComment = zendeskClient.transformComment(
                comment,
                unifiedTicket.id
              );

              // Get author info
              const author = await zendeskClient.getUser(comment.author_id);
              if (author) {
                transformedComment.author.name = author.name || '';
                transformedComment.author.email = author.email || '';
              }

              const existingComment = unifiedTicket.comments.find(
                (c) => c.platformCommentId === transformedComment.platformCommentId
              );

              if (!existingComment) {
                await this.ticketService.addComment(unifiedTicket.id, {
                  author: transformedComment.author,
                  body: transformedComment.body,
                  htmlBody: transformedComment.htmlBody,
                  attachments: transformedComment.attachments,
                  isPublic: transformedComment.isPublic,
                });
              }
            }
          }
        } catch (error) {
          console.error(`Failed to sync comments for ticket ${ticket.id}:`, error);
        }
      }

      this.authService.updateLastSyncTime('zendesk');

      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: failedItems > 0 && processedItems === 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        duration,
        totalItems: tickets.length,
        processedItems,
        failedItems,
        errors: errors.map((e) => ({ ...e, timestamp: new Date() })),
      });

      return {
        success: failedItems === 0,
        platform: 'zendesk',
        entity: 'tickets',
        processedItems,
        failedItems,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: 'failed',
        completedAt: new Date(),
        duration,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        ],
      });

      return {
        success: false,
        platform: 'zendesk',
        entity: 'tickets',
        processedItems: 0,
        failedItems: 0,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        duration,
      };
    }
  }

  // Sync Freshdesk tickets
  async syncFreshdeskTickets(syncType: SyncType = 'incremental'): Promise<SyncResult> {
    const startTime = Date.now();
    const log = await this.createSyncLog('freshdesk', 'tickets', syncType);

    try {
      await this.updateSyncLog(log.id, { status: 'in_progress' });

      const client = this.authService.getClient('freshdesk');
      if (!client) {
        throw new Error('Freshdesk client not configured');
      }

      const freshdeskClient = client as any;
      const errors: { itemId: string; error: string }[] = [];
      let processedItems = 0;
      let failedItems = 0;

      // Get tickets
      let tickets: any[] = [];
      if (syncType === 'incremental') {
        const lastSync = this.authService.getLastSyncTime('freshdesk');
        const since = lastSync
          ? lastSync.toISOString()
          : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        tickets = await freshdeskClient.getTicketsUpdatedSince(since);
      } else {
        tickets = await freshdeskClient.getTickets({ per_page: config.sync.batchSize });
      }

      for (const ticket of tickets) {
        try {
          const transformed = freshdeskClient.transformTicket(ticket);

          // Get requester info
          let requester = {
            id: String(ticket.requester_id),
            name: 'Unknown',
            email: 'unknown@example.com',
            platform: 'freshdesk' as Platform,
            platformContactId: String(ticket.requester_id),
          };

          if (ticket.requester_id) {
            const contact = await freshdeskClient.getContact(ticket.requester_id);
            if (contact) {
              const transformedContact = freshdeskClient.transformContact(contact);
              requester = {
                id: transformedContact.platformContactId,
                name: transformedContact.name,
                email: transformedContact.email,
                platform: 'freshdesk',
                platformContactId: transformedContact.platformContactId,
              };
            }
          }

          // Get assignee info
          let assignee;
          if (ticket.responder_id) {
            const agent = await freshdeskClient.getAgent(ticket.responder_id);
            if (agent) {
              assignee = {
                id: String(agent.id),
                name: agent.contact?.name || 'Unknown',
                email: agent.contact?.email || 'unknown@example.com',
                platform: 'freshdesk',
                platformAgentId: String(agent.id),
              };
            }
          }

          await this.ticketService.findOrCreateTicket({
            platform: 'freshdesk',
            platformTicketId: transformed.platformTicketId,
            subject: transformed.subject,
            description: transformed.description,
            status: transformed.status as any,
            priority: transformed.priority as any,
            requester,
            assignee,
            tags: transformed.tags,
            slaDeadline: transformed.customFields?.due_by
              ? new Date(transformed.customFields.due_by as string)
              : undefined,
            externalUrls: [
              {
                platform: 'freshdesk',
                url: freshdeskClient.getTicketUrl(ticket.id),
              },
            ],
            customFields: transformed.customFields,
          });

          processedItems++;
        } catch (error) {
          failedItems++;
          errors.push({
            itemId: String(ticket.id),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.authService.updateLastSyncTime('freshdesk');

      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: failedItems > 0 && processedItems === 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        duration,
        totalItems: tickets.length,
        processedItems,
        failedItems,
        errors: errors.map((e) => ({ ...e, timestamp: new Date() })),
      });

      return {
        success: failedItems === 0,
        platform: 'freshdesk',
        entity: 'tickets',
        processedItems,
        failedItems,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: 'failed',
        completedAt: new Date(),
        duration,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        ],
      });

      return {
        success: false,
        platform: 'freshdesk',
        entity: 'tickets',
        processedItems: 0,
        failedItems: 0,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        duration,
      };
    }
  }

  // Sync Intercom conversations
  async syncIntercomConversations(syncType: SyncType = 'incremental'): Promise<SyncResult> {
    const startTime = Date.now();
    const log = await this.createSyncLog('intercom', 'conversations', syncType);

    try {
      await this.updateSyncLog(log.id, { status: 'in_progress' });

      const client = this.authService.getClient('intercom');
      if (!client) {
        throw new Error('Intercom client not configured');
      }

      const intercomClient = client as any;
      const errors: { itemId: string; error: string }[] = [];
      let processedItems = 0;
      let failedItems = 0;

      // Get conversations
      const response = await intercomClient.getConversations({
        per_page: config.sync.batchSize,
      });

      for (const conversation of response.data || []) {
        try {
          const transformed = intercomClient.transformConversation(conversation);

          // Get contact info
          let requester = {
            id: 'unknown',
            name: 'Unknown',
            email: 'unknown@example.com',
            platform: 'intercom' as Platform,
            platformContactId: 'unknown',
          };

          const contacts = conversation.contacts?.contacts || [];
          if (contacts.length > 0) {
            const contact = await intercomClient.getContact(contacts[0].id);
            if (contact) {
              const transformedContact = intercomClient.transformContact(contact);
              requester = {
                id: transformedContact.platformContactId,
                name: transformedContact.name,
                email: transformedContact.email || 'unknown@example.com',
                platform: 'intercom',
                platformContactId: transformedContact.platformContactId,
              };
            }
          }

          // Get assignee info
          let assignee;
          if (conversation.assignee) {
            assignee = {
              id: conversation.assignee.id || 'unknown',
              name: conversation.assignee.name || 'Unknown',
              email: conversation.assignee.email || 'unknown@example.com',
              platform: 'intercom',
              platformAgentId: conversation.assignee.id || 'unknown',
            };
          }

          await this.ticketService.findOrCreateTicket({
            platform: 'intercom',
            platformTicketId: transformed.platformTicketId,
            subject: transformed.subject,
            description: transformed.description,
            status: transformed.status as any,
            priority: transformed.priority as any,
            requester,
            assignee,
            tags: transformed.tags,
            externalUrls: [
              {
                platform: 'intercom',
                url: intercomClient.getConversationUrl(conversation.id),
              },
            ],
            customFields: transformed.customFields,
          });

          processedItems++;
        } catch (error) {
          failedItems++;
          errors.push({
            itemId: conversation.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.authService.updateLastSyncTime('intercom');

      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: failedItems > 0 && processedItems === 0 ? 'failed' : 'completed',
        completedAt: new Date(),
        duration,
        totalItems: response.data?.length || 0,
        processedItems,
        failedItems,
        errors: errors.map((e) => ({ ...e, timestamp: new Date() })),
      });

      return {
        success: failedItems === 0,
        platform: 'intercom',
        entity: 'conversations',
        processedItems,
        failedItems,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.updateSyncLog(log.id, {
        status: 'failed',
        completedAt: new Date(),
        duration,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        ],
      });

      return {
        success: false,
        platform: 'intercom',
        entity: 'conversations',
        processedItems: 0,
        failedItems: 0,
        errors: [
          {
            itemId: 'sync',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
        duration,
      };
    }
  }

  // Sync all platforms
  async syncAll(platforms?: Platform[]): Promise<SyncAllResult> {
    const startTime = Date.now();
    const results: SyncResult[] = [];
    const platformsToSync = platforms || ['zendesk', 'freshdesk', 'intercom'];

    // Check if already syncing
    for (const platform of platformsToSync) {
      if (this.isSyncing.get(platform)) {
        throw new Error(`Sync already in progress for ${platform}`);
      }
      this.isSyncing.set(platform, true);
    }

    try {
      for (const platform of platformsToSync) {
        try {
          let result: SyncResult;

          switch (platform) {
            case 'zendesk':
              result = await this.syncZendeskTickets();
              break;
            case 'freshdesk':
              result = await this.syncFreshdeskTickets();
              break;
            case 'intercom':
              result = await this.syncIntercomConversations();
              break;
            default:
              continue;
          }

          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            platform,
            entity: 'tickets',
            processedItems: 0,
            failedItems: 0,
            errors: [
              {
                itemId: 'sync',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            ],
            duration: 0,
          });
        }
      }

      const totalProcessed = results.reduce((sum, r) => sum + r.processedItems, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failedItems, 0);
      const overallSuccess = results.every((r) => r.success);

      return {
        overallSuccess,
        results,
        totalProcessed,
        totalFailed,
        duration: Date.now() - startTime,
      };
    } finally {
      for (const platform of platformsToSync) {
        this.isSyncing.set(platform, false);
      }
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<SyncStatusResponse[]> {
    const statuses: SyncStatusResponse[] = [];
    const platforms: Platform[] = ['zendesk', 'freshdesk', 'intercom'];

    for (const platform of platforms) {
      const latestLog = await SyncLog.findOne({ platform })
        .sort({ startedAt: -1 });

      const lastSync = this.authService.getLastSyncTime(platform);

      statuses.push({
        platform,
        lastSyncAt: latestLog?.completedAt || lastSync,
        status: this.isSyncing.get(platform) ? 'in_progress' : (latestLog?.status || 'pending'),
        itemsProcessed: latestLog?.processedItems || 0,
        errors: latestLog?.failedItems || 0,
      });
    }

    return statuses;
  }

  // Get sync history
  async getSyncHistory(limit: number = 50): Promise<ISyncLogDocument[]> {
    return SyncLog.find()
      .sort({ startedAt: -1 })
      .limit(limit);
  }

  // Get sync statistics
  async getSyncStatistics(days: number = 7): Promise<any> {
    return SyncLog.getStats(days);
  }
}

// Singleton instance
let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

export default SyncService;
