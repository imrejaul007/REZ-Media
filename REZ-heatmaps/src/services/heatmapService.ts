import Redis from 'ioredis';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import {
  ClickEvent,
  ScrollEvent,
  MovementEvent,
  PageView,
  Session,
  ClickHeatmapData,
  ScrollHeatmapData,
  MovementHeatmapData,
  PageAnalytics,
  DashboardData,
  HeatmapCell,
} from '../types/heatmap';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Redis client for real-time data
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// MongoDB schemas
const clickEventSchema = new mongoose.Schema({
  sessionId: String,
  pageId: String,
  websiteId: String,
  x: Number,
  y: Number,
  elementX: Number,
  elementY: Number,
  elementTag: String,
  elementId: String,
  elementClass: String,
  timestamp: Number,
  viewportWidth: Number,
  viewportHeight: Number,
});

const scrollEventSchema = new mongoose.Schema({
  sessionId: String,
  pageId: String,
  websiteId: String,
  scrollDepth: Number,
  maxScrollDepth: Number,
  timestamp: Number,
  viewportHeight: Number,
  documentHeight: Number,
});

const movementEventSchema = new mongoose.Schema({
  sessionId: String,
  pageId: String,
  websiteId: String,
  x: Number,
  y: Number,
  timestamp: Number,
  throttleIndex: Number,
});

const pageViewSchema = new mongoose.Schema({
  sessionId: String,
  pageId: String,
  websiteId: String,
  url: String,
  referrer: String,
  title: String,
  timestamp: Number,
  viewportWidth: Number,
  viewportHeight: Number,
});

const sessionSchema = new mongoose.Schema({
  sessionId: String,
  websiteId: String,
  startTime: Number,
  endTime: Number,
  duration: Number,
  pageViews: Number,
  clicks: Number,
  avgScrollDepth: Number,
  bounce: Boolean,
  country: String,
  device: String,
  browser: String,
  os: String,
});

const ClickEventModel = mongoose.model('ClickEvent', clickEventSchema);
const ScrollEventModel = mongoose.model('ScrollEvent', scrollEventSchema);
const MovementEventModel = mongoose.model('MovementEvent', movementEventSchema);
const PageViewModel = mongoose.model('PageView', pageViewSchema);
const SessionModel = mongoose.model('Session', sessionSchema);

class HeatmapService {
  private readonly CLICK_KEY_PREFIX = 'heatmap:clicks:';
  private readonly SCROLL_KEY_PREFIX = 'heatmap:scroll:';
  private readonly MOVEMENT_KEY_PREFIX = 'heatmap:movement:';
  private readonly SESSION_KEY_PREFIX = 'heatmap:session:';
  private readonly PAGE_KEY_PREFIX = 'heatmap:page:';

  private readonly CLICK_TTL = 60 * 60 * 24 * 7; // 7 days
  private readonly AGGREGATION_INTERVAL = 60 * 5; // 5 minutes

  /**
   * Record a click event
   */
  async recordClick(event: ClickEvent): Promise<void> {
    try {
      // Store in MongoDB for long-term storage
      const clickDoc = new ClickEventModel(event);
      await clickDoc.save();

      // Store in Redis for real-time aggregation
      const key = `${this.CLICK_KEY_PREFIX}${event.websiteId}:${event.pageId}`;
      const cellKey = this.getClickCellKey(event.x, event.y);

      await redis.zincrby(key, 1, cellKey);
      await redis.expire(key, this.CLICK_TTL);

      // Update session click count
      await redis.hincrby(`${this.SESSION_KEY_PREFIX}${event.sessionId}`, 'clicks', 1);

      logger.debug('Click recorded', { sessionId: event.sessionId, x: event.x, y: event.y });
    } catch (error) {
      logger.error('Failed to record click', { error, event });
      throw error;
    }
  }

  /**
   * Record a scroll event
   */
  async recordScroll(event: ScrollEvent): Promise<void> {
    try {
      // Store in MongoDB
      const scrollDoc = new ScrollEventModel(event);
      await scrollDoc.save();

      // Track max scroll depth per session
      const sessionKey = `${this.SESSION_KEY_PREFIX}${event.sessionId}`;
      const currentMax = await redis.hget(sessionKey, 'maxScrollDepth');
      const maxDepth = currentMax ? parseFloat(currentMax) : 0;

      if (event.maxScrollDepth > maxDepth) {
        await redis.hset(sessionKey, 'maxScrollDepth', event.maxScrollDepth.toString());
      }

      // Aggregate scroll depth distribution
      const depthBucket = Math.floor(event.scrollDepth / 10) * 10;
      const distKey = `${this.SCROLL_KEY_PREFIX}${event.websiteId}:${event.pageId}:distribution`;
      await redis.hincrby(distKey, depthBucket.toString(), 1);
      await redis.expire(distKey, this.CLICK_TTL);

      logger.debug('Scroll recorded', { sessionId: event.sessionId, depth: event.scrollDepth });
    } catch (error) {
      logger.error('Failed to record scroll', { error, event });
      throw error;
    }
  }

  /**
   * Record mouse movement (throttled)
   */
  async recordMovement(event: MovementEvent): Promise<void> {
    try {
      // Only store every Nth movement to reduce data volume
      if (event.throttleIndex % 5 !== 0) {
        return;
      }

      // Store in MongoDB (sampled)
      const movementDoc = new MovementEventModel(event);
      await movementDoc.save();

      // Track movement intensity in Redis
      const key = `${this.MOVEMENT_KEY_PREFIX}${event.websiteId}:${event.pageId}`;
      const cellKey = this.getClickCellKey(event.x, event.y);

      await redis.zincrby(key, 1, cellKey);
      await redis.expire(key, this.CLICK_TTL);

      logger.debug('Movement recorded', { sessionId: event.sessionId, x: event.x, y: event.y });
    } catch (error) {
      logger.error('Failed to record movement', { error });
      throw error;
    }
  }

  /**
   * Record a page view
   */
  async recordPageView(event: PageView): Promise<void> {
    try {
      // Store in MongoDB
      const pageViewDoc = new PageViewModel(event);
      await pageViewDoc.save();

      // Initialize or update session
      await this.initializeSession(event);

      // Increment page views counter
      const pageKey = `${this.PAGE_KEY_PREFIX}${event.websiteId}:${event.pageId}`;
      await redis.hincrby(pageKey, 'views', 1);
      await redis.hset(pageKey, 'url', event.url);

      // Update website total views
      await redis.hincrby(`heatmap:website:${event.websiteId}`, 'totalViews', 1);

      logger.debug('Page view recorded', { sessionId: event.sessionId, url: event.url });
    } catch (error) {
      logger.error('Failed to record page view', { error, event });
      throw error;
    }
  }

  /**
   * Initialize or update a session
   */
  async initializeSession(event: PageView): Promise<void> {
    const sessionKey = `${this.SESSION_KEY_PREFIX}${event.sessionId}`;

    const exists = await redis.exists(sessionKey);
    if (!exists) {
      await redis.hset(sessionKey, {
        websiteId: event.websiteId,
        startTime: event.timestamp.toString(),
        pageViews: '1',
        clicks: '0',
        maxScrollDepth: '0',
      });
      await redis.expire(sessionKey, 3600); // 1 hour TTL
    } else {
      await redis.hincrby(sessionKey, 'pageViews', 1);
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}${sessionId}`;
      const sessionData = await redis.hgetall(sessionKey);

      if (!sessionData || !sessionData.websiteId) {
        return;
      }

      const now = Date.now();
      const session: Session = {
        sessionId,
        websiteId: sessionData.websiteId,
        startTime: parseInt(sessionData.startTime, 10),
        endTime: now,
        duration: now - parseInt(sessionData.startTime, 10),
        pageViews: parseInt(sessionData.pageViews, 10) || 1,
        clicks: parseInt(sessionData.clicks, 10) || 0,
        avgScrollDepth: parseFloat(sessionData.maxScrollDepth || '0'),
        bounce: parseInt(sessionData.pageViews, 10) <= 1,
      };

      const sessionDoc = new SessionModel(session);
      await sessionDoc.save();

      await redis.del(sessionKey);

      logger.info('Session ended', { sessionId, duration: session.duration });
    } catch (error) {
      logger.error('Failed to end session', { error, sessionId });
      throw error;
    }
  }

  /**
   * Generate click heatmap data
   */
  async getClickHeatmap(websiteId: string, pageId: string, resolution: number = 50): Promise<ClickHeatmapData> {
    const key = `${this.CLICK_KEY_PREFIX}${websiteId}:${pageId}`;

    // Get aggregated data from Redis
    const clickData = await redis.zrangebyscore(key, '-inf', '+inf', 'WITHSCORES');

    // Get total from MongoDB for accurate count
    const totalClicks = await ClickEventModel.countDocuments({
      websiteId,
      pageId,
      timestamp: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
    });

    // Build heatmap cells
    const cells: HeatmapCell[] = [];
    let maxCount = 0;

    for (let i = 0; i < clickData.length; i += 2) {
      const [x, y] = clickData[i].split(':').map(Number);
      const count = parseInt(clickData[i + 1], 10);

      const cellX = Math.floor(x / resolution) * resolution;
      const cellY = Math.floor(y / resolution) * resolution;
      const cellKey = `${cellX}:${cellY}`;

      const existingCell = cells.find(c => c.x === cellX && c.y === cellY);
      if (existingCell) {
        existingCell.count += count;
        existingCell.intensity = existingCell.count / totalClicks;
      } else {
        cells.push({
          x: cellX,
          y: cellY,
          count,
          intensity: count / totalClicks,
        });
      }

      maxCount = Math.max(maxCount, count);
    }

    // Normalize intensity
    cells.forEach(cell => {
      cell.intensity = maxCount > 0 ? cell.count / maxCount : 0;
    });

    return {
      cells,
      resolution,
      totalClicks,
    };
  }

  /**
   * Generate scroll depth heatmap data
   */
  async getScrollHeatmap(websiteId: string, pageId: string): Promise<ScrollHeatmapData[]> {
    const distribution = await ScrollEventModel.aggregate([
      {
        $match: {
          websiteId,
          pageId,
          timestamp: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
        },
      },
      {
        $bucket: {
          groupBy: '$scrollDepth',
          boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110],
          default: '100+',
          output: { count: { $sum: 1 } },
        },
      },
    ]);

    const depthRanges = [
      { depth: 0, label: '0-10%' },
      { depth: 10, label: '10-20%' },
      { depth: 20, label: '20-30%' },
      { depth: 30, label: '30-40%' },
      { depth: 40, label: '40-50%' },
      { depth: 50, label: '50-60%' },
      { depth: 60, label: '60-70%' },
      { depth: 70, label: '70-80%' },
      { depth: 80, label: '80-90%' },
      { depth: 90, label: '90-100%' },
    ];

    return depthRanges.map(range => {
      const bucket = distribution.find(
        d => parseInt(d._id as unknown as string, 10) >= range.depth &&
             parseInt(d._id as unknown as string, 10) < range.depth + 10
      );

      return {
        depth: range.depth,
        percentage: range.depth + 10,
        viewCount: bucket ? bucket.count : 0,
      };
    });
  }

  /**
   * Generate movement heatmap data
   */
  async getMovementHeatmap(websiteId: string, pageId: string): Promise<MovementHeatmapData> {
    const movements = await MovementEventModel.find({
      websiteId,
      pageId,
      timestamp: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
    })
      .select('x y timestamp')
      .sort({ timestamp: 1 })
      .limit(10000);

    const path: Array<{ x: number; y: number; weight: number }> = [];
    const gridSize = 20;
    const grid: Map<string, number> = new Map();

    movements.forEach(m => {
      const gridX = Math.floor(m.x / gridSize) * gridSize;
      const gridY = Math.floor(m.y / gridSize) * gridSize;
      const key = `${gridX}:${gridY}`;

      const weight = grid.get(key) || 0;
      grid.set(key, weight + 1);

      path.push({ x: m.x, y: m.y, weight: 1 });
    });

    // Find hotspots
    const hotspots = Array.from(grid.entries())
      .map(([key, count]) => {
        const [x, y] = key.split(':').map(Number);
        return { x, y, intensity: count };
      })
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 20);

    const maxIntensity = Math.max(...hotspots.map(h => h.intensity), 1);
    hotspots.forEach(h => {
      h.intensity = h.intensity / maxIntensity;
    });

    return { path, hotspots };
  }

  /**
   * Get page analytics
   */
  async getPageAnalytics(websiteId: string, pageId?: string): Promise<PageAnalytics[]> {
    const matchStage: Record<string, unknown> = { websiteId };
    if (pageId) {
      matchStage.pageId = pageId;
    }

    const pageStats = await PageViewModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$pageId',
          url: { $first: '$url' },
          title: { $first: '$title' },
          views: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
        },
      },
      {
        $project: {
          pageId: '$_id',
          url: 1,
          title: 1,
          views: 1,
          uniqueSessions: { $size: '$uniqueSessions' },
        },
      },
    ]);

    const sessions = await SessionModel.aggregate([
      { $match: { websiteId } },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$duration' },
          avgScrollDepth: { $avg: '$avgScrollDepth' },
          bounceRate: {
            $avg: { $cond: ['$bounce', 1, 0] },
          },
        },
      },
    ]);

    const clickCounts = await ClickEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$pageId',
          clickCount: { $sum: 1 },
        },
      },
    ]);

    return pageStats.map(page => {
      const sessionData = sessions[0] || {};
      const clickData = clickCounts.find(c => c._id === page.pageId) || { clickCount: 0 };

      return {
        pageId: page.pageId,
        url: page.url || '',
        title: page.title || '',
        views: page.views,
        uniqueSessions: page.uniqueSessions,
        avgDuration: sessionData.avgDuration || 0,
        avgScrollDepth: sessionData.avgScrollDepth || 0,
        clickCount: clickData.clickCount,
        bounceRate: sessionData.bounceRate || 0,
      };
    });
  }

  /**
   * Get dashboard data
   */
  async getDashboard(websiteId: string): Promise<DashboardData> {
    const websiteKey = `heatmap:website:${websiteId}`;
    const websiteStats = await redis.hgetall(websiteKey);

    const sessions = await SessionModel.find({ websiteId })
      .sort({ startTime: -1 })
      .limit(100)
      .lean();

    const uniqueSessionIds = new Set(sessions.map(s => s.sessionId));
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgBounceRate = sessions.length > 0
      ? sessions.filter(s => s.bounce).length / sessions.length
      : 0;

    const pageAnalytics = await this.getPageAnalytics(websiteId);
    const topPages = pageAnalytics.sort((a, b) => b.views - a.views).slice(0, 10);

    // Get scroll depth distribution
    const scrollDistribution = await ScrollEventModel.aggregate([
      {
        $match: {
          websiteId,
          timestamp: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 },
        },
      },
      {
        $group: {
          _id: { $floor: { $divide: ['$scrollDepth', 10] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const scrollDepthDistribution = new Array(10).fill(0);
    scrollDistribution.forEach(d => {
      if (d._id >= 0 && d._id < 10) {
        scrollDepthDistribution[d._id] = d.count;
      }
    });

    // Generate placeholder heatmaps (would need specific pageId for real data)
    const clickHeatmap = await this.getClickHeatmap(websiteId, 'overall', 50);
    const movementHeatmap = await this.getMovementHeatmap(websiteId, 'overall');

    return {
      websiteId,
      totalViews: parseInt(websiteStats.totalViews || '0', 10),
      uniqueVisitors: uniqueSessionIds.size,
      avgSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      avgBounceRate,
      topPages,
      scrollDepthDistribution,
      clickHeatmap,
      movementHeatmap,
    };
  }

  /**
   * Create or update website configuration
   */
  async configureWebsite(config: {
    websiteId: string;
    name: string;
    domain: string;
    sampleRate?: number;
  }): Promise<void> {
    const key = `heatmap:config:${config.websiteId}`;
    await redis.hset(key, {
      name: config.name,
      domain: config.domain,
      sampleRate: (config.sampleRate || 1).toString(),
      enabled: 'true',
      createdAt: Date.now().toString(),
    });
  }

  /**
   * Get website configuration
   */
  async getWebsiteConfig(websiteId: string): Promise<{
    websiteId: string;
    name: string;
    domain: string;
    sampleRate: number;
    enabled: boolean;
  } | null> {
    const key = `heatmap:config:${websiteId}`;
    const config = await redis.hgetall(key);

    if (!config || !config.name) {
      return null;
    }

    return {
      websiteId,
      name: config.name,
      domain: config.domain,
      sampleRate: parseFloat(config.sampleRate || '1'),
      enabled: config.enabled === 'true',
    };
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return uuidv4();
  }

  /**
   * Generate unique page ID
   */
  generatePageId(): string {
    return uuidv4();
  }

  /**
   * Get click cell key for aggregation
   */
  private getClickCellKey(x: number, y: number, resolution: number = 50): string {
    const cellX = Math.floor(x / resolution) * resolution;
    const cellY = Math.floor(y / resolution) * resolution;
    return `${cellX}:${cellY}`;
  }

  /**
   * Connect to databases
   */
  async connect(mongodbUri: string): Promise<void> {
    await mongoose.connect(mongodbUri);
    logger.info('Connected to MongoDB');

    redis.on('error', (err) => {
      logger.error('Redis error', { error: err });
    });

    logger.info('Connected to Redis');
  }

  /**
   * Disconnect from databases
   */
  async disconnect(): Promise<void> {
    await mongoose.disconnect();
    redis.disconnect();
    logger.info('Disconnected from databases');
  }
}

export const heatmapService = new HeatmapService();
export { HeatmapService };
