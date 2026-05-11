/**
 * DOOH Service - Ad Routes
 *
 * Express routes for ad management:
 * - Campaign CRUD
 * - Ad delivery
 * - Playlist generation
 * - Targeting
 */

import { Router, Request, Response } from 'express';
import { AdDecisionService } from '../services/adDecision';
import { PersonalizationService } from '../services/personalization';
import { ScreenManagementService } from '../services/screenManagement';
import { AreaIntelligenceService } from '../services/areaIntelligence';
import { DOOHCampaign, DeliveryRequest, CampaignCreateRequest } from '../types';

export interface AdRoutesConfig {
  adDecisionService: AdDecisionService;
  personalizationService: PersonalizationService;
  screenService: ScreenManagementService;
  areaService: AreaIntelligenceService;
}

export function createAdRoutes(config: AdRoutesConfig): Router {
  const router = Router();
  const { adDecisionService, personalizationService, screenService, areaService } = config;

  // ==========================================================================
  // Campaign Management
  // ==========================================================================

  /**
   * POST /ads/campaigns
   * Create a new campaign
   */
  router.post('/campaigns', async (req: Request, res: Response) => {
    try {
      const campaignData: CampaignCreateRequest = req.body;

      // Validate required fields
      if (!campaignData.name || !campaignData.merchant_id || !campaignData.budget) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, merchant_id, budget',
        });
      }

      const campaign = adDecisionService.createCampaign({
        name: campaignData.name,
        merchant_id: campaignData.merchant_id,
        brand_id: campaignData.merchant_id, // Using merchant as brand for now
        creatives: campaignData.creatives.map((c, i) => ({
          id: `creative_${i}`,
          ...c,
        })),
        targeting: campaignData.targeting || {},
        budget: campaignData.budget,
        spent: 0,
        start_date: campaignData.start_date || new Date(),
        end_date: campaignData.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        schedule_type: 'continuous',
        screen_filter: campaignData.screen_filter || {},
        status: 'draft',
      });

      return res.status(201).json({
        success: true,
        campaign_id: campaign.id,
        campaign,
        message: 'Campaign created successfully',
      });
    } catch (error) {
      console.error('Create campaign error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create campaign',
      });
    }
  });

  /**
   * GET /ads/campaigns
   * List all campaigns
   */
  router.get('/campaigns', async (req: Request, res: Response) => {
    try {
      const merchantId = req.query.merchant_id as string;
      const status = req.query.status as string;

      let campaigns = merchantId
        ? adDecisionService.getCampaignsByMerchant(merchantId)
        : adDecisionService.getAllCampaigns();

      if (status) {
        campaigns = campaigns.filter(c => c.status === status);
      }

      return res.json({
        success: true,
        count: campaigns.length,
        campaigns,
      });
    } catch (error) {
      console.error('List campaigns error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to list campaigns',
      });
    }
  });

  /**
   * GET /ads/campaigns/:id
   * Get campaign by ID
   */
  router.get('/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const campaign = adDecisionService.getCampaign(id);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }

      // Get ROI
      const roi = adDecisionService.calculateROI(id);

      return res.json({
        success: true,
        campaign,
        roi,
      });
    } catch (error) {
      console.error('Get campaign error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get campaign',
      });
    }
  });

  /**
   * PATCH /ads/campaigns/:id
   * Update campaign
   */
  router.patch('/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const campaign = adDecisionService.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }

      // Apply updates
      if (updates.status) {
        adDecisionService.updateCampaignStatus(id, updates.status);
      }

      return res.json({
        success: true,
        campaign_id: id,
        message: 'Campaign updated successfully',
      });
    } catch (error) {
      console.error('Update campaign error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update campaign',
      });
    }
  });

  /**
   * DELETE /ads/campaigns/:id
   * Delete campaign
   */
  router.delete('/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = adDecisionService.deleteCampaign(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }

      return res.json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error) {
      console.error('Delete campaign error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete campaign',
      });
    }
  });

  // ==========================================================================
  // Ad Delivery
  // ==========================================================================

  /**
   * POST /ads/deliver
   * Get ads for a screen
   */
  router.post('/deliver', async (req: Request, res: Response) => {
    try {
      const request: DeliveryRequest = req.body;

      if (!request.screen_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: screen_id',
        });
      }

      const screen = screenService.getScreen(request.screen_id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      // Build context if not provided
      if (!request.context) {
        const areaContext = areaService.getAreaContext(screen.location.area);
        request.context = {
          time: new Date().toISOString(),
          day_type: [0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday',
          audience: screen.audience_profile || {
            primary: [],
            peak_hours: [],
            avg_dwell_time: 300,
          },
        };
      }

      // Set available slots if not provided
      if (!request.available_slots) {
        request.available_slots = 10;
      }

      const response = adDecisionService.getAdsForScreen(request);

      return res.json({
        success: true,
        ...response,
      });
    } catch (error) {
      console.error('Ad delivery error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to deliver ads',
      });
    }
  });

  /**
   * POST /ads/decide
   * Make ad decision for a screen
   */
  router.post('/decide', async (req: Request, res: Response) => {
    try {
      const { screen_id, user_id } = req.body;

      if (!screen_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: screen_id',
        });
      }

      // Check if this is a 1:1 screen with user
      const screen = screenService.getScreen(screen_id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      let decision;

      if (screen.network_type === '1:1' && user_id) {
        // Use personalization for 1:1 screens
        decision = personalizationService.getPersonalizedAd(screen_id, user_id);
      } else {
        // Use area-based targeting
        decision = adDecisionService.decideAd(screen_id);
      }

      if (!decision) {
        return res.status(404).json({
          success: false,
          error: 'No ad decision available',
        });
      }

      return res.json({
        success: true,
        decision,
      });
    } catch (error) {
      console.error('Ad decision error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to make ad decision',
      });
    }
  });

  // ==========================================================================
  // Playlist
  // ==========================================================================

  /**
   * POST /ads/playlist
   * Generate playlist for a screen
   */
  router.post('/playlist', async (req: Request, res: Response) => {
    try {
      const { screen_id, date, duration, time_slots } = req.body;

      if (!screen_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: screen_id',
        });
      }

      const screen = screenService.getScreen(screen_id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          error: 'Screen not found',
        });
      }

      // Build delivery request
      const deliveryRequest: DeliveryRequest = {
        screen_id,
        available_slots: Math.floor((duration || 3600) / 30), // 30 second slots by default
        context: {
          time: new Date().toISOString(),
          day_type: [0, 6].includes(new Date().getDay()) ? 'weekend' : 'weekday',
          audience: screen.audience_profile || {
            primary: [],
            peak_hours: [],
            avg_dwell_time: 300,
          },
        },
      };

      const response = adDecisionService.getAdsForScreen(deliveryRequest);

      // Convert to playlist format
      const playlist = {
        id: `pl_${screen_id}_${Date.now()}`,
        screen_id,
        date: date || new Date(),
        slots: response.slots.map((slot, index) => ({
          position: index,
          campaign_id: slot.campaign_id,
          creative_id: slot.creative.id,
          start_time: `${9 + Math.floor(index / 10)}:${(index % 10) * 6}:00`,
          duration: slot.duration,
          scheduled_impressions: Math.round(slot.priority * 10),
        })),
        total_duration: response.slots.reduce((sum, slot) => sum + slot.duration, 0),
        generated_at: new Date(),
        version: 1,
      };

      return res.json({
        success: true,
        playlist,
      });
    } catch (error) {
      console.error('Playlist generation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate playlist',
      });
    }
  });

  // ==========================================================================
  // Targeting
  // ==========================================================================

  /**
   * GET /ads/targeting/areas
   * Get available areas
   */
  router.get('/targeting/areas', async (req: Request, res: Response) => {
    try {
      const areas = areaService.getAllAreas();
      const areaContexts = [];

      for (const areaId of areas) {
        const context = await areaService.getAreaContext(areaId);
        if (context) {
          areaContexts.push(context);
        }
      }

      return res.json({
        success: true,
        count: areaContexts.length,
        areas: areaContexts,
      });
    } catch (error) {
      console.error('Get areas error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get areas',
      });
    }
  });

  /**
   * POST /ads/targeting/areas
   * Register a new area
   */
  router.post('/targeting/areas', async (req: Request, res: Response) => {
    try {
      const { area_id, name, demographics } = req.body;

      if (!area_id || !name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: area_id, name',
        });
      }

      const profile = await areaService.registerArea(area_id, name, demographics);

      return res.status(201).json({
        success: true,
        area: profile,
        message: 'Area registered successfully',
      });
    } catch (error) {
      console.error('Register area error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register area',
      });
    }
  });

  /**
   * GET /ads/targeting/areas/:id/context
   * Get area context
   */
  router.get('/targeting/areas/:id/context', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const context = await areaService.getAreaContext(id);

      if (!context) {
        return res.status(404).json({
          success: false,
          error: 'Area not found',
        });
      }

      return res.json({
        success: true,
        context,
      });
    } catch (error) {
      console.error('Get area context error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get area context',
      });
    }
  });

  // ==========================================================================
  // ROI & Budget
  // ==========================================================================

  /**
   * POST /ads/roi/:campaignId
   * Calculate ROI for a campaign
   */
  router.post('/roi/:campaignId', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const roi = adDecisionService.calculateROI(campaignId);

      if (!roi) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found',
        });
      }

      return res.json({
        success: true,
        roi,
      });
    } catch (error) {
      console.error('Calculate ROI error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to calculate ROI',
      });
    }
  });

  /**
   * POST /ads/budget/allocate
   * Allocate budget across campaigns
   */
  router.post('/budget/allocate', async (req: Request, res: Response) => {
    try {
      const { campaign_ids, total_budget } = req.body;

      if (!campaign_ids || !Array.isArray(campaign_ids) || campaign_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: campaign_ids (array)',
        });
      }

      if (!total_budget || total_budget <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid required field: total_budget',
        });
      }

      const allocations = adDecisionService.allocateBudget(campaign_ids, total_budget);

      return res.json({
        success: true,
        total_budget,
        allocations,
      });
    } catch (error) {
      console.error('Budget allocation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to allocate budget',
      });
    }
  });

  return router;
}
