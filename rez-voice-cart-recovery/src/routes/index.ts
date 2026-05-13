import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { voiceService } from '../services/voiceService';
import { campaignService } from '../services/campaignService';
import { dncService } from '../services/dncService';
import { transcriptService } from '../services/transcriptService';
import {
  InitiateCallSchema,
  CreateCampaignSchema,
  AddToDncSchema,
  ApiResponse,
  TwilioVoiceWebhook
} from '../types';
import { campaignWorker } from '../workers/campaignWorker';

const router = Router();

// Validation error handler
const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        };
        return res.status(400).json(response);
      }
      next(error);
    }
  };
};

// Error handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ============================================
// VOICE ENDPOINTS
// ============================================

/**
 * POST /api/voice/calls
 * Initiate a voice call
 */
router.post(
  '/api/voice/calls',
  validate(InitiateCallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { to, campaignId, trigger, customerId, cartId, orderId, metadata } = req.body;

    const context = {
      ...metadata,
      customerName: metadata?.customerName,
      storeName: metadata?.storeName || 'our store',
      itemCount: metadata?.itemCount,
      totalAmount: metadata?.totalAmount,
      orderId,
      cartId,
      appointmentTime: metadata?.appointmentTime,
      trackingNumber: metadata?.trackingNumber,
      estimatedDelivery: metadata?.estimatedDelivery
    };

    const { callSid, localCallId } = await voiceService.initiateCall(
      to,
      context,
      {
        campaignId,
        trigger,
        customerId,
        cartId,
        orderId
      }
    );

    const response: ApiResponse = {
      success: true,
      data: {
        callSid,
        localCallId,
        status: 'initiated'
      }
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/voice/calls/:id
 * Get call status
 */
router.get(
  '/api/voice/calls/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const call = await voiceService.getCall(id);

    if (!call) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Call not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: call
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/calls/sid/:twilioSid
 * Get call by Twilio SID
 */
router.get(
  '/api/voice/calls/sid/:twilioSid',
  asyncHandler(async (req: Request, res: Response) => {
    const { twilioSid } = req.params;

    const call = await voiceService.getCallBySid(twilioSid);

    if (!call) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Call not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: call
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/calls/:id/cancel
 * Cancel a call
 */
router.post(
  '/api/voice/calls/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await voiceService.cancelCall(id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Call cancelled successfully' }
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/stats
 * Get call statistics
 */
router.get(
  '/api/voice/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { start, end } = req.query;

    const dateRange = start && end
      ? { start: new Date(start as string), end: new Date(end as string) }
      : undefined;

    const stats = await voiceService.getCallStats(dateRange);

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.json(response);
  })
);

// ============================================
// CAMPAIGN ENDPOINTS
// ============================================

/**
 * POST /api/voice/campaigns
 * Create a new campaign
 */
router.post(
  '/api/voice/campaigns',
  validate(CreateCampaignSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await campaignService.createCampaign(req.body);

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/voice/campaigns
 * List all campaigns
 */
router.get(
  '/api/voice/campaigns',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, trigger, page, limit } = req.query;

    const result = await campaignService.listCampaigns({
      status: status as any,
      trigger: trigger as any,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    const response: ApiResponse = {
      success: true,
      data: result.campaigns,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/campaigns/:id
 * Get campaign by ID
 */
router.get(
  '/api/voice/campaigns/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.getCampaign(id);

    if (!campaign) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * PUT /api/voice/campaigns/:id
 * Update campaign
 */
router.put(
  '/api/voice/campaigns/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.updateCampaign(id, req.body);

    if (!campaign) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/campaigns/:id/execute
 * Execute a campaign with targets
 */
router.post(
  '/api/voice/campaigns/:id/execute',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { targets } = req.body;

    if (!targets || !Array.isArray(targets)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'targets must be an array'
        }
      };
      return res.status(400).json(response);
    }

    const result = await campaignService.executeCampaign(id, targets);

    const response: ApiResponse = {
      success: true,
      data: result
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/campaigns/:id/start
 * Start a campaign
 */
router.post(
  '/api/voice/campaigns/:id/start',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.updateCampaignStatus(id, 'running' as any);

    if (!campaign) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/campaigns/:id/pause
 * Pause a campaign
 */
router.post(
  '/api/voice/campaigns/:id/pause',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.pauseCampaign(id);

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/campaigns/:id/resume
 * Resume a campaign
 */
router.post(
  '/api/voice/campaigns/:id/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.resumeCampaign(id);

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * POST /api/voice/campaigns/:id/cancel
 * Cancel a campaign
 */
router.post(
  '/api/voice/campaigns/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await campaignService.cancelCampaign(id);

    const response: ApiResponse = {
      success: true,
      data: campaign
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/campaigns/:id/calls
 * Get campaign call history
 */
router.get(
  '/api/voice/campaigns/:id/calls',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page, limit, status } = req.query;

    const result = await campaignService.getCampaignCalls(id, {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string
    });

    const response: ApiResponse = {
      success: true,
      data: result.calls,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/campaigns/:id/analytics
 * Get campaign analytics
 */
router.get(
  '/api/voice/campaigns/:id/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const analytics = await campaignService.getCampaignAnalytics(id);

    const response: ApiResponse = {
      success: true,
      data: analytics
    };

    res.json(response);
  })
);

// ============================================
// TRANSCRIPT ENDPOINTS
// ============================================

/**
 * GET /api/voice/transcripts
 * List transcripts
 */
router.get(
  '/api/voice/transcripts',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, sentiment, dateFrom, dateTo } = req.query;

    const result = await transcriptService.listTranscripts({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      sentiment: sentiment as any,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined
    });

    const response: ApiResponse = {
      success: true,
      data: result.transcripts,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/transcripts/:id
 * Get transcript by ID
 */
router.get(
  '/api/voice/transcripts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const transcript = await transcriptService.getTranscriptByCallId(id);

    if (!transcript) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Transcript not found'
        }
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: transcript
    };

    res.json(response);
  })
);

/**
 * GET /api/voice/transcripts/search
 * Search transcripts
 */
router.get(
  '/api/voice/transcripts/search',
  asyncHandler(async (req: Request, res: Response) => {
    const { q, limit } = req.query;

    if (!q) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter q is required'
        }
      };
      return res.status(400).json(response);
    }

    const transcripts = await transcriptService.searchTranscripts(
      q as string,
      limit ? parseInt(limit as string) : 50
    );

    const response: ApiResponse = {
      success: true,
      data: transcripts
    };

    res.json(response);
  })
);

// ============================================
// RECORDINGS ENDPOINT
// ============================================

/**
 * GET /api/voice/recordings
 * List recordings
 */
router.get(
  '/api/voice/recordings',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;

    const result = await transcriptService.listTranscripts({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    // Filter to only include recordings with recordingUrl
    const recordings = result.transcripts.filter(t => t.recordingSid);

    const response: ApiResponse = {
      success: true,
      data: recordings,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };

    res.json(response);
  })
);

// ============================================
// DNC ENDPOINTS
// ============================================

/**
 * POST /api/dnc/add
 * Add to DNC list
 */
router.post(
  '/api/dnc/add',
  validate(AddToDncSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { phone, reason, source, expiresAt } = req.body;

    const entry = await dncService.addToDnc(phone, {
      reason,
      source,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    const response: ApiResponse = {
      success: true,
      data: entry
    };

    res.status(201).json(response);
  })
);

/**
 * POST /api/dnc/bulk
 * Bulk add to DNC list
 */
router.post(
  '/api/dnc/bulk',
  asyncHandler(async (req: Request, res: Response) => {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries)) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'entries must be an array'
        }
      };
      return res.status(400).json(response);
    }

    const result = await dncService.bulkAddToDnc(entries);

    const response: ApiResponse = {
      success: true,
      data: result
    };

    res.json(response);
  })
);

/**
 * DELETE /api/dnc/:phone
 * Remove from DNC list
 */
router.delete(
  '/api/dnc/:phone',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.params;

    const removed = await dncService.removeFromDnc(phone);

    const response: ApiResponse = {
      success: true,
      data: { removed }
    };

    res.json(response);
  })
);

/**
 * GET /api/dnc/check/:phone
 * Check if phone is on DNC list
 */
router.get(
  '/api/dnc/check/:phone',
  asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.params;

    const isDnc = await dncService.isPhoneDnc(phone);

    const response: ApiResponse = {
      success: true,
      data: { isDnc }
    };

    res.json(response);
  })
);

/**
 * GET /api/dnc/list
 * List DNC entries
 */
router.get(
  '/api/dnc/list',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, includeExpired, source } = req.query;

    const result = await dncService.listDncEntries({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      includeExpired: includeExpired === 'true',
      source: source as string
    });

    const response: ApiResponse = {
      success: true,
      data: result.entries,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total
      }
    };

    res.json(response);
  })
);

/**
 * GET /api/dnc/stats
 * Get DNC statistics
 */
router.get(
  '/api/dnc/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await dncService.getStats();

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.json(response);
  })
);

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

/**
 * POST /api/voice/webhook
 * Twilio status callback webhook
 */
router.post(
  '/api/voice/webhook',
  asyncHandler(async (req: Request, res: Response) => {
    const webhook: TwilioVoiceWebhook = req.body;

    await voiceService.handleVoiceWebhook(webhook);

    res.status(200).send('OK');
  })
);

/**
 * POST /api/voice/webhook/status
 * Twilio call status webhook
 */
router.post(
  '/api/voice/webhook/status',
  asyncHandler(async (req: Request, res: Response) => {
    const webhook = req.body;

    await voiceService.handleStatusUpdate(webhook);

    res.status(200).send('OK');
  })
);

/**
 * POST /api/voice/webhook/recording
 * Twilio recording webhook
 */
router.post(
  '/api/voice/webhook/recording',
  asyncHandler(async (req: Request, res: Response) => {
    const { RecordingSid, RecordingUrl, CallSid } = req.body;

    if (RecordingSid && RecordingUrl && CallSid) {
      await transcriptService.processRecording(CallSid, RecordingSid, RecordingUrl);
    }

    res.status(200).send('OK');
  })
);

// ============================================
// HEALTH & STATUS ENDPOINTS
// ============================================

/**
 * GET /health
 * Health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-voice-cart-recovery' });
});

/**
 * GET /api/worker/status
 * Get worker status
 */
router.get(
  '/api/worker/status',
  asyncHandler(async (req: Request, res: Response) => {
    const workerStatus = campaignWorker.getStatus();
    const queueStats = await campaignWorker.getQueueStats();

    const response: ApiResponse = {
      success: true,
      data: {
        worker: workerStatus,
        queue: queueStats
      }
    };

    res.json(response);
  })
);

export default router;
