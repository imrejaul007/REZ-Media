/**
 * DOOH Service - Screen Routes
 *
 * Express routes for screen management:
 * - Registration
 * - Status updates
 * - Health monitoring
 * - Playlist retrieval
 */

import { Router, Request, Response } from 'express';
import { ScreenManagementService, NetworkStats } from '../services/screenManagement';
import { AnalyticsService } from '../services/analytics';
import { ScreenRegistration, ScreenFilter, ScreenStatus } from '../types';

export interface ScreenRoutesConfig {
  screenService: ScreenManagementService;
  analyticsService: AnalyticsService;
}

export function createScreenRoutes(config: ScreenRoutesConfig): Router {
  const router = Router();
  const { screenService, analyticsService } = config;

  // ==========================================================================
  // Screen Registration
  // ==========================================================================

  /**
   * POST /screens/register
   * Register a new screen in the network
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const registration: ScreenRegistration = req.body;

      // Validate required fields
      if (!registration.name || !registration.type || !registration.location || !registration.owner_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, type, location, owner_id',
        });
      }

      const screen = screenService.registerScreen(registration);

      return res.status(201).json({
        success: true,
        screen_id: screen.id,
        screen: {
          id: screen.id,
          name: screen.name,
          type: screen.type,
          network_type: screen.network_type,
          status: screen.status,
          location: screen.location,
          cpm: screen.cpm,
        },
        message: 'Screen registered successfully',
      });
    } catch (error) {
      console.error('Screen registration error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register screen',
      });
    }
  });

  // ==========================================================================
  // Screen CRUD
  // ==========================================================================

  /**
   * GET /screens
   * List all screens with optional filters
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filter: ScreenFilter = {
        type: req.query.type as any,
        network_type: req.query.network_type as any,
        city: req.query.city as string,
        area: req.query.area as string,
        status: req.query.status as any,
        owner_id: req.query.owner_id as string,
      };

      // Remove undefined values
      Object.keys(filter).forEach(key => {
        if (filter[key as keyof ScreenFilter] === undefined) {
          delete filter[key as keyof ScreenFilter];
        }
      });

      const screens = filter && Object.keys(filter).length > 0
        ? screenService.queryScreens(filter)
        : screenService.getAllScreens();

      return res.json({
        success: true,
        count: screens.length,
        screens: screens.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          network_type: s.network_type,
          status: s.status,
          location: s.location,
          cpm: s.cpm,
          total_impressions: s.total_impressions,
          total_scans: s.total_scans,
          last_seen: s.last_seen,
        })),
      });
    } catch (error) {
      console.error('Get screens error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get screens',
      });
    }
  });

  /**
   * GET /screens/:id
   * Get screen by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const screen = screenService.getScreen(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      const health = screenService.getScreenHealth(id);
      const analytics = analyticsService.getScreenPerformance(id);

      return res.json({
        success: true,
        screen: {
          ...screen,
          health,
          performance: analytics?.metrics,
        },
      });
    } catch (error) {
      console.error('Get screen error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get screen',
      });
    }
  });

  /**
   * PATCH /screens/:id
   * Update screen
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const screen = screenService.updateScreen(id, updates);

      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      return res.json({
        success: true,
        screen: {
          id: screen.id,
          name: screen.name,
          type: screen.type,
          status: screen.status,
          updated_at: screen.updated_at,
        },
      });
    } catch (error) {
      console.error('Update screen error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update screen',
      });
    }
  });

  /**
   * DELETE /screens/:id
   * Remove screen from network
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = screenService.removeScreen(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      return res.json({
        success: true,
        message: 'Screen removed successfully',
      });
    } catch (error) {
      console.error('Delete screen error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete screen',
      });
    }
  });

  // ==========================================================================
  // Screen Status
  // ==========================================================================

  /**
   * POST /screens/:id/status
   * Update screen status
   */
  router.post('/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status: ScreenStatus };

      if (!status || !['active', 'inactive', 'offline', 'maintenance'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: active, inactive, offline, or maintenance',
        });
      }

      const updated = screenService.updateScreenStatus(id, status);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      return res.json({
        success: true,
        status,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Update status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update screen status',
      });
    }
  });

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  /**
   * POST /screens/:id/heartbeat
   * Process screen heartbeat
   */
  router.post('/:id/heartbeat', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const heartbeat = {
        screen_id: id,
        timestamp: new Date(),
        status: req.body.status as any || 'active',
        playlist_version: req.body.playlist_version || 0,
        impressions_last_hour: req.body.impressions_last_hour || 0,
        errors: req.body.errors,
      };

      const contentUpdate = screenService.processHeartbeat(heartbeat);

      return res.json({
        success: true,
        content_update: contentUpdate ? {
          playlist_version: contentUpdate.version,
          timestamp: contentUpdate.timestamp,
        } : null,
        needs_update: !!contentUpdate,
      });
    } catch (error) {
      console.error('Heartbeat error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process heartbeat',
      });
    }
  });

  // ==========================================================================
  // Health
  // ==========================================================================

  /**
   * GET /screens/:id/health
   * Get screen health status
   */
  router.get('/:id/health', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const health = screenService.getScreenHealth(id);

      if (!health) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      return res.json({
        success: true,
        health,
      });
    } catch (error) {
      console.error('Get health error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get screen health',
      });
    }
  });

  // ==========================================================================
  // Network Stats
  // ==========================================================================

  /**
   * GET /screens/stats
   * Get network statistics
   */
  router.get('/stats/network', async (req: Request, res: Response) => {
    try {
      const stats = screenService.getNetworkStats();
      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Get network stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get network stats',
      });
    }
  });

  /**
   * GET /screens/stats/types
   * Get screen types summary
   */
  router.get('/stats/types', async (req: Request, res: Response) => {
    try {
      const types = screenService.getScreenTypesSummary();
      return res.json({
        success: true,
        types,
      });
    } catch (error) {
      console.error('Get types error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get screen types',
      });
    }
  });

  /**
   * GET /screens/stats/cities
   * Get cities summary
   */
  router.get('/stats/cities', async (req: Request, res: Response) => {
    try {
      const cities = screenService.getCitiesSummary();
      return res.json({
        success: true,
        cities,
      });
    } catch (error) {
      console.error('Get cities error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get cities',
      });
    }
  });

  return router;
}
