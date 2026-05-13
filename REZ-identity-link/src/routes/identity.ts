/**
 * Identity Routes - Full implementation
 */

import { Router, Request, Response } from 'express';
import { linkerService } from '../services/linkerService';
import { resolverService } from '../services/resolverService';
import { identityService } from '../services/identityService';
import {
  linkRequestService,
  LinkRequest
} from '../models/LinkRequest';
import {
  verifyOTPMiddleware,
  verifyOTPQueryMiddleware,
  otpRequestRateLimitMiddleware,
  resendOTPMiddleware,
  generateAndSendOTP,
  maskPhone,
  maskEmail,
  recordOTPRequest,
} from '../middleware/verifyOTP';

export const identityRoutes = Router();

// ============================================
// IDENTITY RESOLUTION ROUTES
// ============================================

/**
 * GET /api/identity - Get identity by any identifier
 */
identityRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const { phone, email, deviceId, app, userId, identityId } = req.query;

    const identity = await resolverService.resolve({
      phone: phone as string,
      email: email as string,
      deviceId: deviceId as string,
      app: app as string,
      userId: userId as string,
      identityId: identityId as string,
    });

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({
      success: true,
      data: {
        id: identity._id,
        phone: identity.phone,
        email: identity.email,
        whatsapp: identity.whatsapp,
        apps: identity.linkedAccounts.map(a => a.app),
        linkedAccounts: identity.linkedAccounts,
        wallets: identity.wallets,
        status: identity.status,
        riskFlags: identity.riskFlags,
        createdAt: identity.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/resolve/phone - Resolve by phone
 */
identityRoutes.get('/resolve/phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required' });
    }

    const result = await resolverService.resolveByPhone(phone as string);

    res.json({
      success: true,
      data: {
        identity: result.identity,
        resolvedBy: result.resolvedBy,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/resolve/email - Resolve by email
 */
identityRoutes.get('/resolve/email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    const result = await resolverService.resolveByEmail(email as string);

    res.json({
      success: true,
      data: {
        identity: result.identity,
        resolvedBy: result.resolvedBy,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/resolve/device - Resolve by device
 */
identityRoutes.get('/resolve/device', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }

    const result = await resolverService.resolveByDevice(deviceId as string);

    res.json({
      success: true,
      data: {
        identity: result.identity,
        resolvedBy: result.resolvedBy,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// IDENTITY CREATION ROUTES
// ============================================

/**
 * POST /api/identity/create - Create new identity
 */
identityRoutes.post('/create', async (req: Request, res: Response) => {
  try {
    const { phone, email, whatsapp, deviceId, app, userId, profile } = req.body;

    if (!phone && !email && !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'At least one of phone, email, or deviceId is required',
      });
    }

    const identity = await identityService.createIdentity({
      phone,
      email,
      whatsapp,
      deviceId,
      app,
      userId,
      profile,
    });

    res.status(201).json({
      success: true,
      data: {
        id: identity._id,
        phone: identity.phone,
        email: identity.email,
        status: identity.status,
      },
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ACCOUNT LINKING ROUTES
// ============================================

/**
 * POST /api/identity/link - Link new account
 */
identityRoutes.post('/link', async (req: Request, res: Response) => {
  try {
    const { identityId, app, userId, phone, email, deviceId } = req.body;

    if (!app || !userId) {
      return res.status(400).json({ success: false, error: 'app and userId required' });
    }

    let result;

    if (identityId) {
      result = await linkerService.linkAccount(identityId, app, userId, { phone, email, deviceId });
    } else if (phone) {
      result = await linkerService.linkByPhone(phone, app, userId);
    } else if (email) {
      result = await linkerService.linkByEmail(email, app, userId);
    } else if (deviceId) {
      result = await linkerService.linkByDevice(deviceId, app, userId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'identityId, phone, email, or deviceId required',
      });
    }

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        id: result.identity?._id,
        isNew: result.isNew,
        linked: result.linked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/link/auto - Auto-link based on available identifiers
 */
identityRoutes.post('/link/auto', async (req: Request, res: Response) => {
  try {
    const { phone, email, deviceId, app, userId } = req.body;

    if (!app || !userId) {
      return res.status(400).json({ success: false, error: 'app and userId required' });
    }

    if (!phone && !email && !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'At least one identifier required',
      });
    }

    const result = await linkerService.autoLink(
      { phone, email, deviceId },
      app,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        id: result.identity?._id,
        isNew: result.isNew,
        linked: result.linked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/link/verified - Link with OTP verification
 */
identityRoutes.post(
  '/link/verified',
  verifyOTPMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { app, userId } = req.body;
      const verifiedIdentifier = req.verifiedIdentifier;

      if (!app || !userId) {
        return res.status(400).json({ success: false, error: 'app and userId required' });
      }

      if (!verifiedIdentifier) {
        return res.status(400).json({
          success: false,
          error: 'No verified identifier',
        });
      }

      const result = await linkerService.linkWithVerification(
        verifiedIdentifier,
        app,
        userId,
        true
      );

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        data: {
          id: result.identity?._id,
          isNew: result.isNew,
          linked: result.linked,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/**
 * POST /api/identity/unlink - Unlink account
 */
identityRoutes.post('/unlink', async (req: Request, res: Response) => {
  try {
    const { identityId, app, userId } = req.body;

    if (!identityId || !app || !userId) {
      return res.status(400).json({
        success: false,
        error: 'identityId, app, userId required',
      });
    }

    const result = await linkerService.unlinkAccount(identityId, app, userId);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// MERGE ROUTES
// ============================================

/**
 * POST /api/identity/merge - Merge two identities
 */
identityRoutes.post('/merge', async (req: Request, res: Response) => {
  try {
    const { sourceIdentityId, targetIdentityId, reason, performedBy } = req.body;

    if (!sourceIdentityId || !targetIdentityId) {
      return res.status(400).json({
        success: false,
        error: 'sourceIdentityId and targetIdentityId required',
      });
    }

    const result = await linkerService.mergeIdentities(
      sourceIdentityId,
      targetIdentityId,
      reason,
      performedBy
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        mergedIdentityId: result.mergedIdentity?._id,
        mergedAccountIds: result.mergedAccountIds,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/match-analysis - Analyze match between two identities
 */
identityRoutes.get('/match-analysis', async (req: Request, res: Response) => {
  try {
    const { identityId1, identityId2 } = req.query;

    if (!identityId1 || !identityId2) {
      return res.status(400).json({
        success: false,
        error: 'identityId1 and identityId2 required',
      });
    }

    const analysis = await resolverService.getMatchAnalysis(
      identityId1 as string,
      identityId2 as string
    );

    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// DUPLICATE DETECTION ROUTES
// ============================================

/**
 * GET /api/identity/potential-matches - Find potential duplicate identities
 */
identityRoutes.get('/potential-matches', async (req: Request, res: Response) => {
  try {
    const { phone, email, deviceId } = req.query;

    const matches = await resolverService.findMatches({
      phone: phone as string,
      email: email as string,
      deviceId: deviceId as string,
    });

    res.json({
      success: true,
      data: {
        matches: matches.map(m => ({
          id: m.identity._id,
          confidence: m.confidence,
          matchFactors: m.matchFactors,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/duplicates/phone - Find phone duplicates
 */
identityRoutes.get('/duplicates/phone', async (req: Request, res: Response) => {
  try {
    const duplicates = await resolverService.findPhoneDuplicates();

    res.json({
      success: true,
      data: {
        duplicates: duplicates.map(d => ({
          phone: d.phone,
          count: d.identities.length,
          identities: d.identities.map(i => i._id),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/duplicates/email - Find email duplicates
 */
identityRoutes.get('/duplicates/email', async (req: Request, res: Response) => {
  try {
    const duplicates = await resolverService.findEmailDuplicates();

    res.json({
      success: true,
      data: {
        duplicates: duplicates.map(d => ({
          email: d.email,
          count: d.identities.length,
          identities: d.identities.map(i => i._id),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// IDENTITY MANAGEMENT ROUTES
// ============================================

/**
 * GET /api/identity/:id - Get identity by ID
 */
identityRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const identity = await identityService.findById(req.params.id);

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({
      success: true,
      data: identity,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/:id/summary - Get identity summary
 */
identityRoutes.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const summary = await identityService.getSummary(req.params.id);

    if (!summary) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * PATCH /api/identity/:id/status - Update identity status
 */
identityRoutes.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!['active', 'merged', 'flagged', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, merged, flagged, or suspended',
      });
    }

    const identity = await identityService.updateStatus(req.params.id, status);

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/:id/device - Add device to identity
 */
identityRoutes.post('/:id/device', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId required' });
    }

    const identity = await identityService.addDevice(req.params.id, deviceId);

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/identity/:id/device/:deviceId - Remove device from identity
 */
identityRoutes.delete('/:id/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const identity = await identityService.removeDevice(
      req.params.id,
      req.params.deviceId
    );

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/:id/risk-flag - Add risk flag
 */
identityRoutes.post('/:id/risk-flag', async (req: Request, res: Response) => {
  try {
    const { flag } = req.body;

    if (!flag) {
      return res.status(400).json({ success: false, error: 'flag required' });
    }

    const identity = await identityService.addRiskFlag(req.params.id, flag);

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/identity/:id/risk-flag/:flag - Remove risk flag
 */
identityRoutes.delete('/:id/risk-flag/:flag', async (req: Request, res: Response) => {
  try {
    const identity = await identityService.removeRiskFlag(
      req.params.id,
      req.params.flag
    );

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// WALLET LINKING ROUTES
// ============================================

/**
 * POST /api/identity/:id/wallet - Link wallet
 */
identityRoutes.post('/:id/wallet', async (req: Request, res: Response) => {
  try {
    const { walletType, app } = req.body;

    if (!['cash', 'coins', 'points'].includes(walletType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid walletType. Must be: cash, coins, or points',
      });
    }

    if (!app) {
      return res.status(400).json({ success: false, error: 'app required' });
    }

    const identity = await identityService.linkWallet(
      req.params.id,
      walletType,
      app
    );

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * DELETE /api/identity/:id/wallet - Unlink wallet
 */
identityRoutes.delete('/:id/wallet', async (req: Request, res: Response) => {
  try {
    const { walletType, app } = req.body;

    if (!walletType || !app) {
      return res.status(400).json({
        success: false,
        error: 'walletType and app required',
      });
    }

    const identity = await identityService.unlinkWallet(
      req.params.id,
      walletType,
      app
    );

    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// OTP VERIFICATION ROUTES
// ============================================

/**
 * POST /api/identity/otp/request - Request OTP for linking
 */
identityRoutes.post('/otp/request', otpRequestRateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone, email, app, userId } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: 'phone or email required',
      });
    }

    const identifier = phone || email;

    // Record the request for rate limiting
    recordOTPRequest(identifier);

    // Determine request type
    const type = phone ? 'phone_link' : 'email_link';

    // Create link request
    const request = await linkRequestService.createRequest({
      type,
      identifier: { phone, email },
      app: app || 'unknown',
      requestedUserId: userId,
    });

    // Generate and send OTP
    const result = await generateAndSendOTP(
      request.requestId,
      phone,
      email
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        requestId: request.requestId,
        maskedPhone: phone ? maskPhone(phone) : undefined,
        maskedEmail: email ? maskEmail(email) : undefined,
        expiresIn: 300, // 5 minutes
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/otp/verify - Verify OTP
 */
identityRoutes.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { requestId, code } = req.body;

    if (!requestId || !code) {
      return res.status(400).json({
        success: false,
        error: 'requestId and code required',
      });
    }

    const result = await linkRequestService.verifyOTP(requestId, code);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: {
        verified: true,
        identifier: result.request?.identifier,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/otp/resend - Resend OTP
 */
identityRoutes.post('/otp/resend', resendOTPMiddleware);

// ============================================
// LINK REQUEST ROUTES
// ============================================

/**
 * GET /api/identity/requests/:requestId - Get link request
 */
identityRoutes.get('/requests/:requestId', async (req: Request, res: Response) => {
  try {
    const request = await linkRequestService.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({
      success: true,
      data: {
        requestId: request.requestId,
        type: request.type,
        status: request.status,
        identifier: request.identifier,
        app: request.app,
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/requests/stats - Get request statistics
 */
identityRoutes.get('/requests/stats', async (req: Request, res: Response) => {
  try {
    const { app } = req.query;
    const stats = await linkRequestService.getStats(app as string);

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// SEARCH ROUTES
// ============================================

/**
 * GET /api/identity/search - Search identities
 */
identityRoutes.get('/search', async (req: Request, res: Response) => {
  try {
    const { phone, email, limit, skip } = req.query;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        error: 'phone or email query parameter required',
      });
    }

    const result = await resolverService.search({
      phone: phone as string,
      email: email as string,
      limit: limit ? parseInt(limit as string) : undefined,
      skip: skip ? parseInt(skip as string) : undefined,
    });

    res.json({
      success: true,
      data: {
        identities: result.identities,
        total: result.total,
        limit: limit ? parseInt(limit as string) : 20,
        skip: skip ? parseInt(skip as string) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// ============================================
// BATCH ROUTES
// ============================================

/**
 * POST /api/identity/batch/resolve - Batch resolve identities
 */
identityRoutes.post('/batch/resolve', async (req: Request, res: Response) => {
  try {
    const { identifiers } = req.body;

    if (!Array.isArray(identifiers)) {
      return res.status(400).json({
        success: false,
        error: 'identifiers must be an array',
      });
    }

    if (identifiers.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 identifiers per batch',
      });
    }

    const results = await resolverService.batchResolve(identifiers);

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        resolved: results.filter(r => r.identity !== null).length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/batch/link - Batch link accounts
 */
identityRoutes.post('/batch/link', async (req: Request, res: Response) => {
  try {
    const { identityId, accounts } = req.body;

    if (!identityId) {
      return res.status(400).json({ success: false, error: 'identityId required' });
    }

    if (!Array.isArray(accounts)) {
      return res.status(400).json({ success: false, error: 'accounts must be an array' });
    }

    const result = await linkerService.batchLink(identityId, accounts);

    res.json({
      success: result.success,
      data: {
        linked: result.linked,
        failed: result.failed,
        errors: result.errors,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
