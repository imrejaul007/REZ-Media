import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import { LoyaltyEngine } from './loyalty/loyalty-engine';
import { OfferEngine } from './offers/offer-engine';
import { GamificationEngine } from './gamification/gamification';
import { ReferralEngine } from './referrals/referral-engine';
import { CampaignManager } from './campaigns/campaign-manager';
import { auth, rateLimit, requestId, errorHandler } from './middleware/auth';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'engagement-platform.log' })
  ]
});

export interface EngagementPlatformConfig {
  port: number;
  loyaltyConfig: Parameters<LoyaltyEngine['initialize']>[0];
  offerConfig: Parameters<OfferEngine['initialize']>[0];
  gamificationConfig: Parameters<GamificationEngine['initialize']>[0];
  referralConfig: Parameters<ReferralEngine['initialize']>[0];
}

export class EngagementPlatform {
  private app: Application;
  private loyaltyEngine: LoyaltyEngine;
  private offerEngine: OfferEngine;
  private gamificationEngine: GamificationEngine;
  private referralEngine: ReferralEngine;
  private campaignManager: CampaignManager;
  private initialized: boolean = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();

    this.loyaltyEngine = new LoyaltyEngine(logger);
    this.offerEngine = new OfferEngine(logger);
    this.gamificationEngine = new GamificationEngine(logger);
    this.referralEngine = new ReferralEngine(logger);
    this.campaignManager = new CampaignManager(
      this.loyaltyEngine,
      this.offerEngine,
      this.gamificationEngine,
      this.referralEngine,
      logger
    );
  }

  private setupMiddleware(): void {
    this.app.use(requestId);
    this.app.use(helmet());
    this.app.use(express.json());
    this.app.use(rateLimit);

    this.app.use((req: Request, _res: Response, next) => {
      logger.info(`${req.method} ${req.path}`, {
        body: req.body,
        query: req.query
      });
      next();
    });
  }

  async initialize(config: EngagementPlatformConfig): Promise<void> {
    if (this.initialized) {
      throw new Error('Platform already initialized');
    }

    await Promise.all([
      this.loyaltyEngine.initialize(config.loyaltyConfig),
      this.offerEngine.initialize(config.offerConfig),
      this.gamificationEngine.initialize(config.gamificationConfig),
      this.referralEngine.initialize(config.referralConfig)
    ]);

    this.setupRoutes();
    this.initialized = true;
    logger.info('Engagement platform initialized successfully');
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Apply auth to API routes
    this.app.use('/api', auth);

    this.app.get('/api/loyalty/:userId', async (req: Request, res: Response) => {
      try {
        const profile = await this.loyaltyEngine.getUserProfile(req.params.userId);
        res.json(profile);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/loyalty/:userId/points', async (req: Request, res: Response) => {
      try {
        const { points, reason } = req.body;
        const result = await this.loyaltyEngine.creditPoints(req.params.userId, points, reason);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/offers', async (_req: Request, res: Response) => {
      try {
        const offers = await this.offerEngine.getActiveOffers();
        res.json(offers);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/offers/:offerId/redeem', async (req: Request, res: Response) => {
      try {
        const { userId } = req.body;
        const result = await this.offerEngine.redeemOffer(req.params.offerId, userId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/gamification/:userId/badges', async (req: Request, res: Response) => {
      try {
        const badges = await this.gamificationEngine.getUserBadges(req.params.userId);
        res.json(badges);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.get('/api/gamification/:userId/streak', async (req: Request, res: Response) => {
      try {
        const streak = await this.gamificationEngine.getUserStreak(req.params.userId);
        res.json(streak);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/referrals/generate', async (req: Request, res: Response) => {
      try {
        const { userId } = req.body;
        const referral = await this.referralEngine.generateReferralCode(userId);
        res.json(referral);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/referrals/track', async (req: Request, res: Response) => {
      try {
        const { referralCode, newUserId } = req.body;
        const result = await this.referralEngine.trackReferral(referralCode, newUserId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/campaigns', async (req: Request, res: Response) => {
      try {
        const result = await this.campaignManager.createCampaign(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/api/campaigns/:campaignId/execute', async (req: Request, res: Response) => {
      try {
        const result = await this.campaignManager.executeCampaign(req.params.campaignId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });
  }

  start(port: number): void {
    if (!this.initialized) {
      throw new Error('Platform must be initialized before starting');
    }

    this.app.listen(port, () => {
      logger.info(`Engagement platform listening on port ${port}`);
    });
  }

  getEngines() {
    return {
      loyalty: this.loyaltyEngine,
      offers: this.offerEngine,
      gamification: this.gamificationEngine,
      referrals: this.referralEngine,
      campaigns: this.campaignManager
    };
  }
}

const platform = new EngagementPlatform();

const config: EngagementPlatformConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  loyaltyConfig: {
    tiers: [
      { name: 'Bronze', minPoints: 0, multiplier: 1.0 },
      { name: 'Silver', minPoints: 1000, multiplier: 1.25 },
      { name: 'Gold', minPoints: 5000, multiplier: 1.5 },
      { name: 'Platinum', minPoints: 15000, multiplier: 2.0 }
    ],
    pointExpirationDays: 365,
    autoUpgrade: true
  },
  offerConfig: {
    maxOffersPerUser: 10,
    offerTypes: ['discount', 'cashback', 'bogo', 'free_shipping'],
    validationRules: {
      minOrderValue: 0,
      maxDiscount: 100
    }
  },
  gamificationConfig: {
    badges: [
      { id: 'first_purchase', name: 'First Purchase', points: 50 },
      { id: 'referrer', name: 'Brand Ambassador', points: 200 },
      { id: 'streak_7', name: 'Week Warrior', points: 100 },
      { id: 'streak_30', name: 'Monthly Master', points: 500 },
      { id: 'spender_1000', name: 'Big Spender', points: 300 }
    ],
    streakConfig: {
      gracePeriodHours: 24,
      streakMilestones: [7, 14, 30, 60, 90]
    }
  },
  referralConfig: {
    referrerReward: 500,
    refereeReward: 250,
    maxReferralsPerUser: 10,
    referralCodeLength: 8
  }
};

async function main() {
  try {
    await platform.initialize(config);
    platform.start(config.port);
  } catch (error) {
    logger.error('Failed to start platform', { error });
    process.exit(1);
  }
}

main();

export { EngagementPlatform, logger };
