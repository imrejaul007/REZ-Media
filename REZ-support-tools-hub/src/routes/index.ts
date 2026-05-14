import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  Platform,
  TicketStatus,
  ConnectRequest,
  ConnectResponse,
  CommentRequest,
  StatusUpdateRequest,
  AssignRequest,
  LinkTicketRequest,
  FieldMappingRequest,
  SlaMappingRequest,
} from '../types';
import { getAuthService } from '../services/authService';
import { getTicketService } from '../services/ticketService';
import { getContactService } from '../services/contactService';
import { getSyncService } from '../services/syncService';
import { getMappingService } from '../services/mappingService';
import { getSyncWorker } from '../workers/syncWorker';
import config from '../config';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

// Validation schemas
const connectSchema = z.object({
  platform: z.enum(['zendesk', 'freshdesk', 'intercom']),
  credentials: z.object({
    subdomain: z.string().optional(),
    email: z.string().email().optional(),
    apiToken: z.string().optional(),
    domain: z.string().optional(),
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }),
});

const commentSchema = z.object({
  body: z.string().min(1),
  isPublic: z.boolean().optional().default(true),
});

const statusUpdateSchema = z.object({
  status: z.enum(['open', 'pending', 'on_hold', 'solved', 'closed']),
  comment: z.string().optional(),
});

const assignSchema = z.object({
  assigneeId: z.string(),
  assigneeName: z.string(),
  assigneeEmail: z.string().email(),
});

const linkTicketSchema = z.object({
  rezTicketId: z.string(),
  linkType: z.enum(['related', 'parent', 'child']).optional().default('related'),
});

const fieldMappingSchema = z.object({
  platform: z.enum(['zendesk', 'freshdesk', 'intercom']),
  fieldMappings: z.array(
    z.object({
      fieldName: z.string(),
      targetField: z.string(),
      transformType: z.enum(['direct', 'mapping', 'function']).optional(),
      transformConfig: z.record(z.unknown()).optional(),
    })
  ),
});

const slaMappingSchema = z.object({
  platform: z.enum(['zendesk', 'freshdesk', 'intercom']),
  slaMappings: z.array(
    z.object({
      platformSlaName: z.string(),
      targetPriority: z.enum(['low', 'normal', 'high', 'urgent']),
      responseTimeMinutes: z.number().positive(),
      resolutionTimeMinutes: z.number().positive(),
    })
  ),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['open', 'pending', 'on_hold', 'solved', 'closed']).optional(),
  platform: z.enum(['zendesk', 'freshdesk', 'intercom']).optional(),
});

export function createRouter(): Router {
  const router = Router();
  const authService = getAuthService();
  const ticketService = getTicketService();
  const contactService = getContactService();
  const syncService = getSyncService();
  const mappingService = getMappingService();

  // Authentication middleware for internal service calls
  const internalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-internal-token'] as string;

    if (config.server.isProduction && token !== config.security.internalServiceToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };

  // Apply internal auth to all routes
  router.use(internalAuthMiddleware);

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'rez-support-tools-hub',
      timestamp: new Date().toISOString(),
    });
  });

  // ==================== Platform Connection Routes ====================

  // Connect Zendesk
  router.post('/tools/zendesk/connect', async (req: Request, res: Response) => {
    try {
      const result = await authService.connectZendesk(req.body.credentials);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'zendesk',
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Connect Freshdesk
  router.post('/tools/freshdesk/connect', async (req: Request, res: Response) => {
    try {
      const result = await authService.connectFreshdesk(req.body.credentials);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'freshdesk',
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Connect Intercom
  router.post('/tools/intercom/connect', async (req: Request, res: Response) => {
    try {
      const result = await authService.connectIntercom(req.body.credentials);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        platform: 'intercom',
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Disconnect platform
  router.delete('/tools/:platform/disconnect', (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    const result = authService.disconnect(platform);
    res.json(result);
  });

  // Get connection status
  router.get('/config/platforms', (_req: Request, res: Response) => {
    const statuses = authService.getAllConnectionStatuses();
    res.json({ platforms: statuses });
  });

  // ==================== Ticket Routes ====================

  // Get all tickets (aggregated)
  router.get('/tickets', async (req: Request, res: Response) => {
    try {
      const query = paginationSchema.parse(req.query);
      const result = await ticketService.getAllTickets({
        page: query.page,
        limit: query.limit,
        status: query.status,
        platform: query.platform,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to fetch tickets' });
      }
    }
  });

  // Get single ticket
  router.get('/tickets/:id', async (req: Request, res: Response) => {
    try {
      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  });

  // Add comment to ticket
  router.post('/tickets/:id/comments', async (req: Request, res: Response) => {
    try {
      const { error, data } = commentSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      const ticket = await ticketService.addComment(req.params.id, {
        author: {
          id: req.headers['x-user-id'] as string || 'api',
          name: req.headers['x-user-name'] as string || 'API User',
          email: req.headers['x-user-email'] as string || 'api@rez.app',
          type: 'agent',
        },
        body: data.body,
        isPublic: data.isPublic,
      });

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add comment' });
    }
  });

  // Update ticket status
  router.patch('/tickets/:id/status', async (req: Request, res: Response) => {
    try {
      const { error, data } = statusUpdateSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      const ticket = await ticketService.updateTicketStatus(
        req.params.id,
        data.status,
        data.comment
      );

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update ticket status' });
    }
  });

  // Assign ticket
  router.patch('/tickets/:id/assign', async (req: Request, res: Response) => {
    try {
      const { error, data } = assignSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      const ticket = await ticketService.getTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const result = await ticketService.assignTicket(req.params.id, {
        id: data.assigneeId,
        name: data.assigneeName,
        email: data.assigneeEmail,
        platform: ticket.platform,
        platformAgentId: data.assigneeId,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to assign ticket' });
    }
  });

  // Link ticket to ReZ ticket
  router.post('/tickets/:id/link', async (req: Request, res: Response) => {
    try {
      const { error, data } = linkTicketSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      const ticket = await ticketService.linkToRezTicket(req.params.id, data.rezTicketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: 'Failed to link ticket' });
    }
  });

  // Get ticket statistics
  router.get('/tickets/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await ticketService.getStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // ==================== Contact Routes ====================

  // Get all contacts
  router.get('/contacts', async (req: Request, res: Response) => {
    try {
      const query = paginationSchema.parse(req.query);
      const result = await contactService.getAllContacts({
        page: query.page,
        limit: query.limit,
        platform: query.platform,
      });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to fetch contacts' });
      }
    }
  });

  // Get single contact
  router.get('/contacts/:id', async (req: Request, res: Response) => {
    try {
      const contact = await contactService.getContactById(req.params.id);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contact' });
    }
  });

  // Link contact to ReZ user
  router.post('/contacts/:id/link', async (req: Request, res: Response) => {
    try {
      const { rezUserId } = req.body;
      if (!rezUserId) {
        return res.status(400).json({ error: 'rezUserId is required' });
      }

      const contact = await contactService.linkToRezUser(req.params.id, rezUserId);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Failed to link contact' });
    }
  });

  // Get contact statistics
  router.get('/contacts/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await contactService.getStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // ==================== Sync Routes ====================

  // Sync all platforms
  router.post('/sync/all', async (req: Request, res: Response) => {
    try {
      const { platforms } = req.body;
      const result = await syncService.syncAll(platforms);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to sync',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get sync status
  router.get('/sync/status', async (_req: Request, res: Response) => {
    try {
      const status = await syncService.getSyncStatus();
      res.json({ status });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get sync status' });
    }
  });

  // Get sync history
  router.get('/sync/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await syncService.getSyncHistory(limit);
      res.json({ history });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get sync history' });
    }
  });

  // Trigger sync for specific platform
  router.post('/sync/:platform', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform;
      const worker = getSyncWorker();
      const result = await worker.runSyncForPlatform(platform);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to trigger sync',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ==================== Configuration Routes ====================

  // Get field mappings
  router.get('/config/field-mappings', (_req: Request, res: Response) => {
    const mappings = mappingService.getAllFieldMappings();
    res.json({ fieldMappings: mappings });
  });

  // Update field mappings
  router.put('/config/field-mappings', (req: Request, res: Response) => {
    try {
      const { error, data } = fieldMappingSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      // Clear existing and set new
      mappingService.setFieldMappings(data.platform, []);
      for (const mapping of data.fieldMappings) {
        mappingService.addFieldMapping(data.platform, {
          platform: data.platform,
          ...mapping,
        });
      }

      res.json({
        success: true,
        fieldMappings: mappingService.getFieldMappings(data.platform),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update field mappings' });
    }
  });

  // Get SLA mappings
  router.get('/config/sla-mapping', (_req: Request, res: Response) => {
    const mappings = mappingService.getAllSlaMappings();
    res.json({ slaMappings: mappings });
  });

  // Update SLA mappings
  router.put('/config/sla-mapping', (req: Request, res: Response) => {
    try {
      const { error, data } = slaMappingSchema.safeParse(req.body);
      if (error) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }

      // Clear existing and set new
      mappingService.setSlaMappings(data.platform, []);
      for (const mapping of data.slaMappings) {
        mappingService.addSlaMapping(data.platform, {
          platform: data.platform,
          ...mapping,
        });
      }

      res.json({
        success: true,
        slaMappings: mappingService.getSlaMappings(data.platform),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update SLA mappings' });
    }
  });

  // Get all mappings (export)
  router.get('/config/all', (_req: Request, res: Response) => {
    const mappings = mappingService.exportAllMappings();
    res.json(mappings);
  });

  // Import mappings
  router.post('/config/import', (req: Request, res: Response) => {
    try {
      mappingService.importMappings(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to import mappings' });
    }
  });

  // ==================== Webhook Routes ====================

  // Zendesk webhook
  router.post('/webhooks/zendesk', async (req: Request, res: Response) => {
    try {
      // Process Zendesk webhook
      console.log('Received Zendesk webhook:', req.body);

      const { detail } = req.body;
      if (detail?.ticket_id) {
        // Trigger incremental sync for this ticket
        // In production, this would update just the specific ticket
        console.log(`Zendesk ticket ${detail.ticket_id} updated`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Freshdesk webhook
  router.post('/webhooks/freshdesk', async (req: Request, res: Response) => {
    try {
      console.log('Received Freshdesk webhook:', req.body);

      const { ticket_id } = req.body;
      if (ticket_id) {
        console.log(`Freshdesk ticket ${ticket_id} updated`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  // Intercom webhook
  router.post('/webhooks/intercom', async (req: Request, res: Response) => {
    try {
      console.log('Received Intercom webhook:', req.body);

      const { topic, data } = req.body;
      if (topic && data?.id) {
        console.log(`Intercom ${topic} for ${data.id}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  return router;
}

export default createRouter;
