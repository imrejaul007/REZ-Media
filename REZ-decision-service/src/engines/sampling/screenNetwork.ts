/**
 * SCREEN NETWORK MANAGER
 * Phase 5: DOOH Screen Inventory Management
 * Handles screen registration, status tracking, and network analytics
 */

import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================
// CONSTANTS
// ============================================

const REDIS_PREFIX = 'screen:';
const SCREEN_INDEX_PREFIX = 'screen:index:';
const HEARTBEAT_TTL = 300; // 5 minutes in seconds
const HEALTH_SCORE_WINDOW = 24 * 60 * 60; // 24 hours in seconds

// Default CPM rates by screen type (in cents)
export const DEFAULT_CPM_RATES: Record<ScreenType, number> = {
  cab_tablet: 450,      // $4.50
  restaurant_tv: 650,   // $6.50
  mall_kiosk: 550,      // $5.50
  airport_gate: 850,    // $8.50
  hotel_lobby: 500      // $5.00
};

// ============================================
// TYPES
// ============================================

export type ScreenType = 'cab_tablet' | 'restaurant_tv' | 'mall_kiosk' | 'airport_gate' | 'hotel_lobby';
export type ScreenStatus = 'active' | 'inactive' | 'maintenance';
export type ScreenHealthLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface ScreenLocation {
  lat: number;
  lng: number;
  city: string;
  address: string;
  country?: string;
  region?: string;
  postalCode?: string;
}

export interface AudienceDemographics {
  ageRanges: string[];
  gender: string[];
  income?: string;
}

export interface AudienceInterests {
  primary: string[];
  secondary: string[];
}

export interface AudienceProfile {
  demographics: AudienceDemographics;
  interests: AudienceInterests;
}

export interface ScreenHardware {
  model?: string;
  manufacturer?: string;
  resolution?: string;
  displaySize?: string;
  orientation?: 'landscape' | 'portrait' | 'both';
  brightness?: number; // nits
  uptime?: number; // total hours
}

export interface Screen {
  id: string;
  type: ScreenType;
  location: ScreenLocation;
  ownerId: string;
  status: ScreenStatus;
  cpm: number;
  audienceProfile: AudienceProfile;
  hardware?: ScreenHardware;
  registeredAt: Date;
  lastHeartbeat?: Date;
  healthScore?: number;
  impressionsToday?: number;
  impressionsTotal?: number;
  revenueToday?: number;
  revenueTotal?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ScreenRegistrationInput {
  type: ScreenType;
  location: ScreenLocation;
  ownerId: string;
  cpm?: number;
  audienceProfile?: AudienceProfile;
  hardware?: ScreenHardware;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ScreenUpdateInput {
  status?: ScreenStatus;
  cpm?: number;
  audienceProfile?: AudienceProfile;
  hardware?: ScreenHardware;
  location?: ScreenLocation;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ScreenNetworkStats {
  totalScreens: number;
  activeScreens: number;
  inactiveScreens: number;
  maintenanceScreens: number;
  activeRate: number;
  byType: Record<ScreenType, number>;
  byCity: Record<string, number>;
  byHealthLevel: Record<ScreenHealthLevel, number>;
  totalImpressionsToday: number;
  totalImpressionsAllTime: number;
  totalRevenueToday: number;
  totalRevenueAllTime: number;
  estimatedDailyRevenuePotential: number;
  averageHealthScore: number;
}

export interface ScreenQueryFilters {
  type?: ScreenType;
  status?: ScreenStatus;
  city?: string;
  ownerId?: string;
  minHealthScore?: number;
  minCpm?: number;
  maxCpm?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ScreenHealthMetrics {
  uptimePercentage: number;
  averageHeartbeatInterval: number;
  lastHeartbeatAgo: number;
  daysSinceRegistration: number;
  totalImpressions: number;
  dailyAverageImpressions: number;
  revenuePerImpression: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate Redis key for screen data
 */
function screenKey(screenId: string): string {
  return `${REDIS_PREFIX}${screenId}`;
}

/**
 * Generate Redis key for screen type index
 */
function typeIndexKey(type: ScreenType): string {
  return `${SCREEN_INDEX_PREFIX}type:${type}`;
}

/**
 * Generate Redis key for screen city index
 */
function cityIndexKey(city: string): string {
  return `${SCREEN_INDEX_PREFIX}city:${city.toLowerCase()}`;
}

/**
 * Generate Redis key for screen owner index
 */
function ownerIndexKey(ownerId: string): string {
  return `${SCREEN_INDEX_PREFIX}owner:${ownerId}`;
}

/**
 * Generate Redis key for screen status index
 */
function statusIndexKey(status: ScreenStatus): string {
  return `${SCREEN_INDEX_PREFIX}status:${status}`;
}

/**
 * Generate Redis key for screen heartbeat
 */
function heartbeatKey(screenId: string): string {
  return `${REDIS_PREFIX}heartbeat:${screenId}`;
}

/**
 * Generate Redis key for screen health history
 */
function healthHistoryKey(screenId: string): string {
  return `${REDIS_PREFIX}health:${screenId}:history`;
}

/**
 * Calculate health score based on heartbeat patterns
 */
function calculateHealthScore(
  lastHeartbeat: Date | null,
  uptimePercentage: number,
  recentHeartbeats: number
): number {
  if (!lastHeartbeat) return 0;

  const now = Date.now();
  const timeSinceHeartbeat = (now - lastHeartbeat.getTime()) / 1000; // seconds

  // Heartbeat score (max 40 points)
  let heartbeatScore = 40;
  if (timeSinceHeartbeat > 60) heartbeatScore -= 10;
  if (timeSinceHeartbeat > 180) heartbeatScore -= 10;
  if (timeSinceHeartbeat > 300) heartbeatScore -= 20;
  heartbeatScore = Math.max(0, heartbeatScore);

  // Uptime score (max 30 points)
  const uptimeScore = (uptimePercentage / 100) * 30;

  // Recent activity score (max 30 points)
  const activityScore = Math.min(30, recentHeartbeats * 3);

  return Math.round(heartbeatScore + uptimeScore + activityScore);
}

/**
 * Determine health level from score
 */
function getHealthLevel(score: number): ScreenHealthLevel {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 25) return 'poor';
  return 'critical';
}

/**
 * Normalize city name for consistent indexing
 */
function normalizeCity(city: string): string {
  return city.toLowerCase().trim();
}

// ============================================
// SCREEN NETWORK MANAGER CLASS
// ============================================

export class ScreenNetworkManager {

  // ============================================
  // SCREEN REGISTRATION
  // ============================================

  /**
   * Register a new screen in the network
   */
  async registerScreen(input: ScreenRegistrationInput): Promise<{
    success: boolean;
    screen?: Screen;
    error?: string;
  }> {
    try {
      const screenId = uuidv4();
      const now = new Date();
      const cpm = input.cpm ?? DEFAULT_CPM_RATES[input.type];

      const screen: Screen = {
        id: screenId,
        type: input.type,
        location: input.location,
        ownerId: input.ownerId,
        status: 'active',
        cpm,
        audienceProfile: input.audienceProfile ?? {
          demographics: { ageRanges: [], gender: [] },
          interests: { primary: [], secondary: [] }
        },
        hardware: input.hardware,
        registeredAt: now,
        lastHeartbeat: now,
        healthScore: 100,
        impressionsToday: 0,
        impressionsTotal: 0,
        revenueToday: 0,
        revenueTotal: 0,
        tags: input.tags ?? [],
        metadata: input.metadata
      };

      // Store screen data
      await redis.set(screenKey(screenId), JSON.stringify(screen));

      // Update indexes
      await Promise.all([
        redis.sadd(typeIndexKey(input.type), screenId),
        redis.sadd(cityIndexKey(input.location.city), screenId),
        redis.sadd(ownerIndexKey(input.ownerId), screenId),
        redis.sadd(statusIndexKey('active'), screenId),
        redis.sadd(`${SCREEN_INDEX_PREFIX}all`, screenId)
      ]);

      // Set initial heartbeat
      await this.updateHeartbeat(screenId);

      return { success: true, screen };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register screen'
      };
    }
  }

  /**
   * Unregister (remove) a screen from the network
   */
  async unregisterScreen(screenId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get current screen data
      const screenData = await redis.get(screenKey(screenId));
      if (!screenData) {
        return { success: false, error: 'Screen not found' };
      }

      const screen: Screen = JSON.parse(screenData);

      // Remove from all indexes
      await Promise.all([
        redis.del(screenKey(screenId)),
        redis.del(heartbeatKey(screenId)),
        redis.del(healthHistoryKey(screenId)),
        redis.srem(typeIndexKey(screen.type), screenId),
        redis.srem(cityIndexKey(screen.location.city), screenId),
        redis.srem(ownerIndexKey(screen.ownerId), screenId),
        redis.srem(statusIndexKey(screen.status), screenId),
        redis.srem(`${SCREEN_INDEX_PREFIX}all`, screenId)
      ]);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unregister screen'
      };
    }
  }

  /**
   * Update screen information
   */
  async updateScreen(screenId: string, input: ScreenUpdateInput): Promise<{
    success: boolean;
    screen?: Screen;
    error?: string;
  }> {
    try {
      const screenData = await redis.get(screenKey(screenId));
      if (!screenData) {
        return { success: false, error: 'Screen not found' };
      }

      const screen: Screen = JSON.parse(screenData);
      const oldCity = screen.location.city;
      const oldStatus = screen.status;

      // Update fields
      if (input.status !== undefined) screen.status = input.status;
      if (input.cpm !== undefined) screen.cpm = input.cpm;
      if (input.audienceProfile !== undefined) screen.audienceProfile = input.audienceProfile;
      if (input.hardware !== undefined) screen.hardware = { ...screen.hardware, ...input.hardware };
      if (input.location !== undefined) screen.location = { ...screen.location, ...input.location };
      if (input.tags !== undefined) screen.tags = input.tags;
      if (input.metadata !== undefined) screen.metadata = { ...screen.metadata, ...input.metadata };

      // Save updated screen
      await redis.set(screenKey(screenId), JSON.stringify(screen));

      // Update indexes if status changed
      if (input.status !== undefined && input.status !== oldStatus) {
        await redis.srem(statusIndexKey(oldStatus), screenId);
        await redis.sadd(statusIndexKey(input.status), screenId);
      }

      // Update city index if location changed
      if (input.location !== undefined && input.location.city !== oldCity) {
        await redis.srem(cityIndexKey(oldCity), screenId);
        await redis.sadd(cityIndexKey(input.location.city), screenId);
      }

      return { success: true, screen };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update screen'
      };
    }
  }

  /**
   * Get screen by ID
   */
  async getScreen(screenId: string): Promise<Screen | null> {
    const data = await redis.get(screenKey(screenId));
    if (!data) return null;

    const screen: Screen = JSON.parse(data);

    // Enrich with heartbeat info
    const heartbeat = await this.getLastHeartbeat(screenId);
    if (heartbeat) {
      screen.lastHeartbeat = heartbeat;
      screen.healthScore = await this.calculateCurrentHealthScore(screenId);
    }

    return screen;
  }

  // ============================================
  // SCREEN STATUS
  // ============================================

  /**
   * Update screen heartbeat
   */
  async updateHeartbeat(screenId: string): Promise<{
    success: boolean;
    healthScore?: number;
    error?: string;
  }> {
    try {
      const now = Date.now();
      const key = heartbeatKey(screenId);

      // Get previous heartbeat for interval calculation
      const prevHeartbeat = await redis.get(key);
      let interval = 60; // Default 60 seconds

      if (prevHeartbeat) {
        const prevTime = parseInt(prevHeartbeat);
        interval = Math.round((now - prevTime) / 1000);
      }

      // Store current heartbeat timestamp
      await redis.setex(key, HEARTBEAT_TTL, now.toString());

      // Push to heartbeat history for health calculation
      const historyKey = healthHistoryKey(screenId);
      await redis.zadd(historyKey, now, now.toString());
      await redis.expire(historyKey, HEALTH_SCORE_WINDOW);

      // Keep only last 24 hours of heartbeats
      const cutoff = now - (HEALTH_SCORE_WINDOW * 1000);
      await redis.zremrangebyscore(historyKey, '-inf', cutoff);

      // Update health score in screen data
      const healthScore = await this.calculateCurrentHealthScore(screenId);
      const screenData = await redis.get(screenKey(screenId));
      if (screenData) {
        const screen: Screen = JSON.parse(screenData);
        screen.lastHeartbeat = new Date(now);
        screen.healthScore = healthScore;
        await redis.set(screenKey(screenId), JSON.stringify(screen));
      }

      return { success: true, healthScore };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update heartbeat'
      };
    }
  }

  /**
   * Get last heartbeat timestamp for a screen
   */
  async getLastHeartbeat(screenId: string): Promise<Date | null> {
    const timestamp = await redis.get(heartbeatKey(screenId));
    if (!timestamp) return null;
    return new Date(parseInt(timestamp));
  }

  /**
   * Calculate current health score for a screen
   */
  async calculateCurrentHealthScore(screenId: string): Promise<number> {
    const screenData = await redis.get(screenKey(screenId));
    if (!screenData) return 0;

    const screen: Screen = JSON.parse(screenData);
    const historyKey = healthHistoryKey(screenId);
    const now = Date.now();

    // Get recent heartbeats
    const cutoff = now - (HEALTH_SCORE_WINDOW * 1000);
    const heartbeats = await redis.zrangebyscore(historyKey, cutoff, now);
    const recentHeartbeats = heartbeats.length;

    // Calculate uptime percentage (based on expected heartbeats)
    const expectedHeartbeats = Math.floor(HEALTH_SCORE_WINDOW / 60); // Every minute
    const uptimePercentage = Math.min(100, (recentHeartbeats / expectedHeartbeats) * 100);

    // Get last heartbeat
    const lastHeartbeat = await this.getLastHeartbeat(screenId);

    return calculateHealthScore(lastHeartbeat, uptimePercentage, recentHeartbeats);
  }

  /**
   * Get health metrics for a screen
   */
  async getScreenHealthMetrics(screenId: string): Promise<ScreenHealthMetrics | null> {
    const screen = await this.getScreen(screenId);
    if (!screen) return null;

    const historyKey = healthHistoryKey(screenId);
    const now = Date.now();
    const cutoff = now - (HEALTH_SCORE_WINDOW * 1000);

    // Get recent heartbeats
    const heartbeats = await redis.zrangebyscore(historyKey, cutoff, now);
    const recentHeartbeats = heartbeats.length;

    // Calculate average heartbeat interval
    let avgInterval = 60;
    if (heartbeats.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < heartbeats.length; i++) {
        intervals.push(parseInt(heartbeats[i]) - parseInt(heartbeats[i - 1]));
      }
      avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length / 1000; // Convert to seconds
    }

    // Calculate uptime percentage
    const expectedHeartbeats = Math.floor(HEALTH_SCORE_WINDOW / 60);
    const uptimePercentage = Math.min(100, (recentHeartbeats / expectedHeartbeats) * 100);

    // Days since registration
    const daysSinceRegistration = Math.floor(
      (now - new Date(screen.registeredAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Daily average impressions
    const dailyAverageImpressions = daysSinceRegistration > 0
      ? Math.round((screen.impressionsTotal ?? 0) / daysSinceRegistration)
      : (screen.impressionsToday ?? 0);

    // Revenue per impression
    const totalImpressions = screen.impressionsTotal ?? 0;
    const revenuePerImpression = totalImpressions > 0
      ? (screen.revenueTotal ?? 0) / totalImpressions
      : screen.cpm / 1000; // Fallback to CPM calculation

    const lastHeartbeatAgo = screen.lastHeartbeat
      ? Math.round((now - new Date(screen.lastHeartbeat).getTime()) / 1000)
      : -1;

    return {
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      averageHeartbeatInterval: Math.round(avgInterval),
      lastHeartbeatAgo,
      daysSinceRegistration,
      totalImpressions: screen.impressionsTotal ?? 0,
      dailyAverageImpressions,
      revenuePerImpression: Math.round(revenuePerImpression * 100) / 100
    };
  }

  /**
   * Set screen status
   */
  async setScreenStatus(screenId: string, status: ScreenStatus): Promise<{
    success: boolean;
    error?: string;
  }> {
    return this.updateScreen(screenId, { status });
  }

  // ============================================
  // SCREEN QUERIES
  // ============================================

  /**
   * Query screens with filters
   */
  async queryScreens(filters: ScreenQueryFilters = {}): Promise<{
    screens: Screen[];
    total: number;
    hasMore: boolean;
  }> {
    let screenIds: string[];

    // Start with most specific index
    if (filters.type) {
      screenIds = await redis.smembers(typeIndexKey(filters.type));
    } else if (filters.status) {
      screenIds = await redis.smembers(statusIndexKey(filters.status));
    } else if (filters.ownerId) {
      screenIds = await redis.smembers(ownerIndexKey(filters.ownerId));
    } else if (filters.city) {
      screenIds = await redis.smembers(cityIndexKey(filters.city));
    } else {
      screenIds = await redis.smembers(`${SCREEN_INDEX_PREFIX}all`);
    }

    // Fetch and filter screens
    const allScreens: Screen[] = [];
    for (const screenId of screenIds) {
      const screen = await this.getScreen(screenId);
      if (screen) allScreens.push(screen);
    }

    // Apply filters
    let filtered = allScreens.filter(screen => {
      if (filters.status && screen.status !== filters.status) return false;
      if (filters.type && screen.type !== filters.type) return false;
      if (filters.city && screen.location.city.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.ownerId && screen.ownerId !== filters.ownerId) return false;
      if (filters.minHealthScore !== undefined && (screen.healthScore ?? 0) < filters.minHealthScore) return false;
      if (filters.minCpm !== undefined && screen.cpm < filters.minCpm) return false;
      if (filters.maxCpm !== undefined && screen.cpm > filters.maxCpm) return false;
      if (filters.tags && filters.tags.length > 0) {
        const screenTags = screen.tags ?? [];
        if (!filters.tags.some(tag => screenTags.includes(tag))) return false;
      }
      return true;
    });

    // Sort by health score descending
    filtered.sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0));

    const total = filtered.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;

    const paginated = filtered.slice(offset, offset + limit);

    return {
      screens: paginated,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get screens by type
   */
  async getScreensByType(type: ScreenType): Promise<Screen[]> {
    const result = await this.queryScreens({ type, limit: 1000 });
    return result.screens;
  }

  /**
   * Get screens by city
   */
  async getScreensByCity(city: string): Promise<Screen[]> {
    const result = await this.queryScreens({ city, limit: 1000 });
    return result.screens;
  }

  /**
   * Get screens by owner
   */
  async getScreensByOwner(ownerId: string): Promise<Screen[]> {
    const result = await this.queryScreens({ ownerId, limit: 1000 });
    return result.screens;
  }

  // ============================================
  // NETWORK STATISTICS
  // ============================================

  /**
   * Get comprehensive network statistics
   */
  async getNetworkStats(): Promise<ScreenNetworkStats> {
    // Get all screen IDs
    const allScreenIds = await redis.smembers(`${SCREEN_INDEX_PREFIX}all`);

    // Initialize counters
    const byType: Record<ScreenType, number> = {
      cab_tablet: 0,
      restaurant_tv: 0,
      mall_kiosk: 0,
      airport_gate: 0,
      hotel_lobby: 0
    };

    const byCity: Record<string, number> = {};
    const byHealthLevel: Record<ScreenHealthLevel, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0
    };

    let activeScreens = 0;
    let inactiveScreens = 0;
    let maintenanceScreens = 0;
    let totalImpressionsToday = 0;
    let totalImpressionsAllTime = 0;
    let totalRevenueToday = 0;
    let totalRevenueAllTime = 0;
    let totalHealthScore = 0;
    let screensWithHealth = 0;

    // Aggregate data from all screens
    for (const screenId of allScreenIds) {
      const screen = await this.getScreen(screenId);
      if (!screen) continue;

      // Count by type
      byType[screen.type]++;

      // Count by city
      const city = screen.location.city;
      byCity[city] = (byCity[city] || 0) + 1;

      // Count by status
      if (screen.status === 'active') activeScreens++;
      else if (screen.status === 'inactive') inactiveScreens++;
      else if (screen.status === 'maintenance') maintenanceScreens++;

      // Count by health level
      if (screen.healthScore !== undefined) {
        const level = getHealthLevel(screen.healthScore);
        byHealthLevel[level]++;
        totalHealthScore += screen.healthScore;
        screensWithHealth++;
      }

      // Aggregate impressions and revenue
      totalImpressionsToday += screen.impressionsToday ?? 0;
      totalImpressionsAllTime += screen.impressionsTotal ?? 0;
      totalRevenueToday += screen.revenueToday ?? 0;
      totalRevenueAllTime += screen.revenueTotal ?? 0;
    }

    const totalScreens = allScreenIds.length;
    const activeRate = totalScreens > 0 ? (activeScreens / totalScreens) * 100 : 0;
    const averageHealthScore = screensWithHealth > 0 ? Math.round(totalHealthScore / screensWithHealth) : 0;

    // Calculate estimated daily revenue potential (based on active screens and their CPM)
    let estimatedDailyRevenuePotential = 0;
    for (const screenId of allScreenIds) {
      const screen = await this.getScreen(screenId);
      if (screen && screen.status === 'active') {
        // Assuming 1000 impressions per hour, 12 active hours per day
        const dailyImpressions = 1000 * 12;
        estimatedDailyRevenuePotential += (screen.cpm / 1000) * dailyImpressions;
      }
    }

    return {
      totalScreens,
      activeScreens,
      inactiveScreens,
      maintenanceScreens,
      activeRate: Math.round(activeRate * 100) / 100,
      byType,
      byCity,
      byHealthLevel,
      totalImpressionsToday,
      totalImpressionsAllTime,
      totalRevenueToday: Math.round(totalRevenueToday * 100) / 100,
      totalRevenueAllTime: Math.round(totalRevenueAllTime * 100) / 100,
      estimatedDailyRevenuePotential: Math.round(estimatedDailyRevenuePotential * 100) / 100,
      averageHealthScore
    };
  }

  /**
   * Get statistics by screen type
   */
  async getStatsByType(): Promise<Record<ScreenType, {
    count: number;
    activeCount: number;
    avgCpm: number;
    avgHealthScore: number;
    totalImpressions: number;
  }>> {
    const stats: Record<ScreenType, any> = {} as any;

    for (const type of Object.keys(DEFAULT_CPM_RATES) as ScreenType[]) {
      const screens = await this.getScreensByType(type);

      let activeCount = 0;
      let totalCpm = 0;
      let totalHealthScore = 0;
      let screensWithHealth = 0;
      let totalImpressions = 0;

      for (const screen of screens) {
        if (screen.status === 'active') activeCount++;
        totalCpm += screen.cpm;
        if (screen.healthScore !== undefined) {
          totalHealthScore += screen.healthScore;
          screensWithHealth++;
        }
        totalImpressions += screen.impressionsTotal ?? 0;
      }

      stats[type] = {
        count: screens.length,
        activeCount,
        avgCpm: screens.length > 0 ? Math.round(totalCpm / screens.length) : DEFAULT_CPM_RATES[type],
        avgHealthScore: screensWithHealth > 0 ? Math.round(totalHealthScore / screensWithHealth) : 0,
        totalImpressions
      };
    }

    return stats;
  }

  /**
   * Get statistics by city
   */
  async getStatsByCity(): Promise<Record<string, {
    count: number;
    activeCount: number;
    avgCpm: number;
    totalImpressions: number;
    revenuePotential: number;
  }>> {
    const allStats = await this.getNetworkStats();
    const stats: Record<string, any> = {};

    for (const city of Object.keys(allStats.byCity)) {
      const screens = await this.getScreensByCity(city);

      let activeCount = 0;
      let totalCpm = 0;
      let totalImpressions = 0;
      let revenuePotential = 0;

      for (const screen of screens) {
        if (screen.status === 'active') activeCount++;
        totalCpm += screen.cpm;
        totalImpressions += screen.impressionsTotal ?? 0;
        // Daily revenue potential: 1000 impressions/hour * 12 hours * CPM
        revenuePotential += (screen.cpm / 1000) * 1000 * 12;
      }

      stats[city] = {
        count: screens.length,
        activeCount,
        avgCpm: screens.length > 0 ? Math.round(totalCpm / screens.length) : 0,
        totalImpressions,
        revenuePotential: Math.round(revenuePotential * 100) / 100
      };
    }

    return stats;
  }

  // ============================================
  // IMPRESSION & REVENUE TRACKING
  // ============================================

  /**
   * Record an impression for a screen
   */
  async recordImpression(screenId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const screenData = await redis.get(screenKey(screenId));
      if (!screenData) {
        return { success: false, error: 'Screen not found' };
      }

      const screen: Screen = JSON.parse(screenData);
      const today = new Date().toISOString().split('T')[0];

      // Update impressions
      screen.impressionsToday = (screen.impressionsToday ?? 0) + 1;
      screen.impressionsTotal = (screen.impressionsTotal ?? 0) + 1;

      // Calculate revenue for this impression
      const impressionRevenue = screen.cpm / 1000;
      screen.revenueToday = (screen.revenueToday ?? 0) + impressionRevenue;
      screen.revenueTotal = (screen.revenueTotal ?? 0) + impressionRevenue;

      await redis.set(screenKey(screenId), JSON.stringify(screen));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record impression'
      };
    }
  }

  /**
   * Record multiple impressions (batch)
   */
  async recordImpressions(screenIds: string[], count: number = 1): Promise<{
    success: boolean;
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    for (const screenId of screenIds) {
      const result = await this.recordImpression(screenId);
      if (result.success) {
        processed++;
      } else {
        errors.push(`${screenId}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      processed,
      errors
    };
  }

  /**
   * Reset daily counters for all screens (called by scheduler)
   */
  async resetDailyCounters(): Promise<{
    success: boolean;
    processed: number;
  }> {
    const allScreenIds = await redis.smembers(`${SCREEN_INDEX_PREFIX}all`);
    let processed = 0;

    for (const screenId of allScreenIds) {
      const screenData = await redis.get(screenKey(screenId));
      if (screenData) {
        const screen: Screen = JSON.parse(screenData);
        screen.impressionsToday = 0;
        screen.revenueToday = 0;
        await redis.set(screenKey(screenId), JSON.stringify(screen));
        processed++;
      }
    }

    return { success: true, processed };
  }

  // ============================================
  // MAINTENANCE & CLEANUP
  // ============================================

  /**
   * Get screens that haven't sent heartbeat recently (potential offline)
   */
  async getOfflineScreens(thresholdSeconds: number = 300): Promise<Screen[]> {
    const now = Date.now();
    const threshold = now - (thresholdSeconds * 1000);
    const allScreenIds = await redis.smembers(`${SCREEN_INDEX_PREFIX}all`);

    const offlineScreens: Screen[] = [];

    for (const screenId of allScreenIds) {
      const heartbeat = await this.getLastHeartbeat(screenId);
      if (heartbeat && heartbeat.getTime() < threshold) {
        const screen = await this.getScreen(screenId);
        if (screen) {
          offlineScreens.push(screen);
        }
      }
    }

    return offlineScreens;
  }

  /**
   * Auto-mark screens as inactive if no heartbeat
   */
  async autoMarkInactive(thresholdSeconds: number = 600): Promise<{
    marked: number;
    screens: string[];
  }> {
    const offlineScreens = await this.getOfflineScreens(thresholdSeconds);
    const marked: string[] = [];

    for (const screen of offlineScreens) {
      if (screen.status === 'active') {
        await this.setScreenStatus(screen.id, 'inactive');
        marked.push(screen.id);
      }
    }

    return { marked: marked.length, screens: marked };
  }

  /**
   * Get screens in maintenance that are ready to be reactivated
   */
  async getMaintenanceReadyScreens(): Promise<Screen[]> {
    const result = await this.queryScreens({ status: 'maintenance', limit: 1000 });
    return result.screens;
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const screenNetwork = new ScreenNetworkManager();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick screen registration
 */
export async function registerScreen(input: ScreenRegistrationInput): Promise<{
  success: boolean;
  screen?: Screen;
  error?: string;
}> {
  return screenNetwork.registerScreen(input);
}

/**
 * Quick get screen by ID
 */
export async function getScreen(screenId: string): Promise<Screen | null> {
  return screenNetwork.getScreen(screenId);
}

/**
 * Quick screen heartbeat update
 */
export async function updateScreenHeartbeat(screenId: string): Promise<{
  success: boolean;
  healthScore?: number;
  error?: string;
}> {
  return screenNetwork.updateHeartbeat(screenId);
}

/**
 * Get network statistics
 */
export async function getNetworkStats(): Promise<ScreenNetworkStats> {
  return screenNetwork.getNetworkStats();
}

/**
 * Record impression for a screen
 */
export async function recordScreenImpression(screenId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return screenNetwork.recordImpression(screenId);
}

/**
 * Query screens with filters
 */
export async function queryScreens(filters: ScreenQueryFilters = {}): Promise<{
  screens: Screen[];
  total: number;
  hasMore: boolean;
}> {
  return screenNetwork.queryScreens(filters);
}

/**
 * Get screens by type
 */
export async function getScreensByType(type: ScreenType): Promise<Screen[]> {
  return screenNetwork.getScreensByType(type);
}

/**
 * Get screens by city
 */
export async function getScreensByCity(city: string): Promise<Screen[]> {
  return screenNetwork.getScreensByCity(city);
}

/**
 * Get screen health metrics
 */
export async function getScreenHealth(screenId: string): Promise<ScreenHealthMetrics | null> {
  return screenNetwork.getScreenHealthMetrics(screenId);
}

/**
 * Set screen status
 */
export async function setScreenStatus(screenId: string, status: ScreenStatus): Promise<{
  success: boolean;
  error?: string;
}> {
  return screenNetwork.setScreenStatus(screenId, status);
}
