/**
 * Identity Routes
 */

import { Router } from 'express';
import { linkerService } from '../services/linkerService';
import { resolverService } from '../services/resolverService';

export const identityRoutes = Router();

/**
 * GET /api/identity - Get identity by any identifier
 */
identityRoutes.get('/', async (req, res) => {
  try {
    const { phone, email, deviceId, app, userId } = req.query;

    const identity = await resolverService.resolve({
      phone: phone as string,
      email: email as string,
      deviceId: deviceId as string,
      app: app as string,
      userId: userId as string,
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
        apps: identity.linkedAccounts.map(a => a.app),
        wallets: identity.wallets,
        status: identity.status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/link - Link new account
 */
identityRoutes.post('/link', async (req, res) => {
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
    } else if (deviceId) {
      result = await linkerService.linkByDevice(deviceId, app, userId);
    } else {
      return res.status(400).json({ success: false, error: 'identityId, phone, or deviceId required' });
    }

    res.json({
      success: true,
      data: {
        id: result.identity._id,
        isNew: result.isNew || false,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * POST /api/identity/unlink - Unlink account
 */
identityRoutes.post('/unlink', async (req, res) => {
  try {
    const { identityId, app, userId } = req.body;

    if (!identityId || !app || !userId) {
      return res.status(400).json({ success: false, error: 'identityId, app, userId required' });
    }

    await linkerService.unlinkAccount(identityId, app, userId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * GET /api/identity/potential-matches - Find potential duplicate identities
 */
identityRoutes.get('/potential-matches', async (req, res) => {
  try {
    const { phone, email, deviceId } = req.query;

    const matches = await resolverService.findPotentialMatches({
      phone: phone as string,
      email: email as string,
      deviceId: deviceId as string,
    });

    res.json({
      success: true,
      data: { matches },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
