/**
 * DOOH Service - Screen Management
 *
 * Handles all screen CRUD operations, health monitoring,
 * and screen network management.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Screen,
  ScreenRegistration,
  ScreenHeartbeat,
  ScreenHealth,
  ScreenFilter,
  ScreenStatus,
  ScreenOSConfig,
  ContentUpdate,
  Playlist,
  Creative,
  DEFAULT_CPM_RATES,
  ScreenType,
} from '../types';

// ============================================================================
// Screen Store
// ============================================================================

class ScreenStore {
  private screens: Map<string, Screen> = new Map();
  private healthMap: Map<string, ScreenHealth> = new Map();
  private heartbeatMap: Map<string, Date> = new Map();

  /**
   * Register a new screen
   */
  register(data: ScreenRegistration): Screen {
    const screen: Screen = {
      id: `screen_${uuidv4()}`,
      name: data.name,
      type: data.type,
      network_type: data.network_type,
      location_type: data.location_type,
      location: data.location,
      hardware: data.hardware,
      owner_id: data.owner_id,
      owner_email: data.owner_email,
      owner_phone: data.owner_phone,
      owner_type: 'partner',
      status: 'active',
      operating_hours: data.operating_hours,
      audience_profile: data.audience_profile,
      cpm: data.cpm || DEFAULT_CPM_RATES[data.type] || 10,
      total_impressions: 0,
      total_scans: 0,
      earnings_balance: 0,
      earnings_paid: 0,
      playlist_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.screens.set(screen.id, screen);
    this.initializeHealth(screen.id);

    return screen;
  }

  /**
   * Get screen by ID
   */
  get(screenId: string): Screen | undefined {
    return this.screens.get(screenId);
  }

  /**
   * Get all screens
   */
  getAll(): Screen[] {
    return Array.from(this.screens.values());
  }

  /**
   * Query screens by filter
   */
  query(filter: ScreenFilter): Screen[] {
    return Array.from(this.screens.values()).filter(screen => {
      if (filter.type && screen.type !== filter.type) return false;
      if (filter.network_type && screen.network_type !== filter.network_type) return false;
      if (filter.city && screen.location.city.toLowerCase() !== filter.city.toLowerCase()) return false;
      if (filter.area && screen.location.area.toLowerCase() !== filter.area.toLowerCase()) return false;
      if (filter.status && screen.status !== filter.status) return false;
      if (filter.owner_type && screen.owner_type !== filter.owner_type) return false;
      if (filter.owner_id && screen.owner_id !== filter.owner_id) return false;
      if (filter.min_cpm && screen.cpm < filter.min_cpm) return false;
      if (filter.max_cpm && screen.cpm > filter.max_cpm) return false;
      if (filter.min_footfall && (screen.audience_profile?.daily_footfall || 0) < filter.min_footfall) return false;
      return true;
    });
  }

  /**
   * Get screens by area
   */
  getByArea(areaId: string): Screen[] {
    return Array.from(this.screens.values()).filter(
      s => s.location.area.toLowerCase() === areaId.toLowerCase()
    );
  }

  /**
   * Get screens by city
   */
  getByCity(city: string): Screen[] {
    return Array.from(this.screens.values()).filter(
      s => s.location.city.toLowerCase() === city.toLowerCase()
    );
  }

  /**
   * Get screens by owner
   */
  getByOwner(ownerId: string): Screen[] {
    return Array.from(this.screens.values()).filter(
      s => s.owner_id === ownerId
    );
  }

  /**
   * Get screens by type
   */
  getByType(type: ScreenType): Screen[] {
    return Array.from(this.screens.values()).filter(s => s.type === type);
  }

  /**
   * Get active screens for playlist update
   */
  getActiveForUpdate(): Screen[] {
    return Array.from(this.screens.values()).filter(s => s.status === 'active');
  }

  /**
   * Update screen
   */
  update(screenId: string, updates: Partial<Screen>): Screen | null {
    const screen = this.screens.get(screenId);
    if (!screen) return null;

    const updated: Screen = {
      ...screen,
      ...updates,
      id: screen.id, // Prevent ID change
      updated_at: new Date(),
    };

    this.screens.set(screenId, updated);
    return updated;
  }

  /**
   * Update screen status
   */
  updateStatus(screenId: string, status: ScreenStatus): boolean {
    const screen = this.screens.get(screenId);
    if (!screen) return false;

    screen.status = status;
    screen.last_seen = new Date();
    screen.updated_at = new Date();
    this.screens.set(screenId, screen);

    // Update health status
    const health = this.healthMap.get(screenId);
    if (health) {
      health.status = status === 'active' ? 'healthy' : status === 'offline' ? 'offline' : 'degraded';
      this.healthMap.set(screenId, health);
    }

    return true;
  }

  /**
   * Process screen heartbeat
   */
  processHeartbeat(heartbeat: ScreenHeartbeat): ContentUpdate | null {
    const screen = this.screens.get(heartbeat.screen_id);
    if (!screen) return null;

    // Update screen state
    screen.status = heartbeat.status;
    screen.last_seen = heartbeat.timestamp;
    screen.updated_at = new Date();
    this.screens.set(heartbeat.screen_id, screen);

    // Update heartbeat tracking
    this.heartbeatMap.set(heartbeat.screen_id, heartbeat.timestamp);

    // Update health
    const health = this.healthMap.get(heartbeat.screen_id);
    if (health) {
      health.lastHeartbeat = heartbeat.timestamp;
      health.status = 'healthy';
      health.errorCount = 0;
      this.healthMap.set(heartbeat.screen_id, health);
    }

    // Check if playlist needs update
    if (this.needsPlaylistUpdate(screen, heartbeat)) {
      return this.generateContentUpdate(screen);
    }

    return null;
  }

  /**
   * Check if screen needs playlist update
   */
  private needsPlaylistUpdate(screen: Screen, heartbeat: ScreenHeartbeat): boolean {
    if (screen.playlist_version === undefined || screen.playlist_version === 0) return true;
    if (heartbeat.playlist_version !== screen.playlist_version) return true;
    if (!screen.last_sync) return true;

    const syncAge = Date.now() - new Date(screen.last_sync).getTime();
    const maxAge = 60 * 60 * 1000; // 1 hour
    return syncAge > maxAge;
  }

  /**
   * Generate content update for screen
   */
  private generateContentUpdate(screen: Screen): ContentUpdate {
    return {
      screen_id: screen.id,
      playlist: {} as Playlist, // Will be populated by playlist service
      creatives: [] as Creative[], // Will be populated by playlist service
      config: this.getScreenConfig(),
      version: (screen.playlist_version || 0) + 1,
      timestamp: new Date(),
    };
  }

  /**
   * Get screen OS configuration
   */
  private getScreenConfig(): ScreenOSConfig {
    return {
      server_url: process.env.DOOH_SERVER_URL || 'https://dooh.rezapp.com',
      api_key: process.env.DOOH_API_KEY || '',
      sync_interval: 300, // 5 minutes
      playlist_refresh: 300,
      heartbeat_interval: 60,
      offline_buffer_hours: 24,
    };
  }

  /**
   * Delete screen
   */
  delete(screenId: string): boolean {
    this.healthMap.delete(screenId);
    this.heartbeatMap.delete(screenId);
    return this.screens.delete(screenId);
  }

  /**
   * Get screen health
   */
  getHealth(screenId: string): ScreenHealth | null {
    return this.healthMap.get(screenId) || null;
  }

  /**
   * Initialize health tracking for a screen
   */
  private initializeHealth(screenId: string): void {
    this.healthMap.set(screenId, {
      screenId,
      status: 'healthy',
      lastHeartbeat: new Date(),
      uptime: 100,
      errorCount: 0,
      connectionQuality: 'excellent',
      bandwidth: 100,
      storageAvailable: 500,
    });
  }

  /**
   * Get network statistics
   */
  getStats(): NetworkStats {
    const screens = Array.from(this.screens.values());

    return {
      total: screens.length,
      active: screens.filter(s => s.status === 'active').length,
      offline: screens.filter(s => s.status === 'offline').length,
      inactive: screens.filter(s => s.status === 'inactive').length,
      maintenance: screens.filter(s => s.status === 'maintenance').length,
      by_type: this.groupByType(screens),
      by_city: this.groupByCity(screens),
      by_network_type: this.groupByNetworkType(screens),
      total_impressions: screens.reduce((sum, s) => sum + (s.total_impressions || 0), 0),
      total_scans: screens.reduce((sum, s) => sum + (s.total_scans || 0), 0),
      total_earnings: screens.reduce((sum, s) => sum + (s.earnings_balance || 0), 0),
    };
  }

  private groupByType(screens: Screen[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const screen of screens) {
      groups[screen.type] = (groups[screen.type] || 0) + 1;
    }
    return groups;
  }

  private groupByCity(screens: Screen[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const screen of screens) {
      groups[screen.location.city] = (groups[screen.location.city] || 0) + 1;
    }
    return groups;
  }

  private groupByNetworkType(screens: Screen[]): Record<string, number> {
    return {
      '1:1': screens.filter(s => s.network_type === '1:1').length,
      'mass': screens.filter(s => s.network_type === 'mass').length,
    };
  }
}

interface NetworkStats {
  total: number;
  active: number;
  offline: number;
  inactive: number;
  maintenance: number;
  by_type: Record<string, number>;
  by_city: Record<string, number>;
  by_network_type: Record<string, number>;
  total_impressions: number;
  total_scans: number;
  total_earnings: number;
}

// ============================================================================
// Screen Management Service
// ============================================================================

export class ScreenManagementService {
  private store: ScreenStore;

  constructor() {
    this.store = new ScreenStore();
  }

  // -------------------------------------------------------------------------
  // Screen CRUD Operations
  // -------------------------------------------------------------------------

  /**
   * Register a new screen in the network
   */
  registerScreen(data: ScreenRegistration): Screen {
    return this.store.register(data);
  }

  /**
   * Get screen by ID
   */
  getScreen(screenId: string): Screen | undefined {
    return this.store.get(screenId);
  }

  /**
   * Get all screens
   */
  getAllScreens(): Screen[] {
    return this.store.getAll();
  }

  /**
   * Query screens with filters
   */
  queryScreens(filter: ScreenFilter): Screen[] {
    return this.store.query(filter);
  }

  /**
   * Get screens by area
   */
  getScreensByArea(areaId: string): Screen[] {
    return this.store.getByArea(areaId);
  }

  /**
   * Get screens by city
   */
  getScreensByCity(city: string): Screen[] {
    return this.store.getByCity(city);
  }

  /**
   * Get screens by owner
   */
  getScreensByOwner(ownerId: string): Screen[] {
    return this.store.getByOwner(ownerId);
  }

  /**
   * Update screen
   */
  updateScreen(screenId: string, updates: Partial<Screen>): Screen | null {
    return this.store.update(screenId, updates);
  }

  /**
   * Update screen status
   */
  updateScreenStatus(screenId: string, status: ScreenStatus): boolean {
    return this.store.updateStatus(screenId, status);
  }

  /**
   * Remove screen from network
   */
  removeScreen(screenId: string): boolean {
    return this.store.delete(screenId);
  }

  // -------------------------------------------------------------------------
  // Screen Health
  // -------------------------------------------------------------------------

  /**
   * Get screen health status
   */
  getScreenHealth(screenId: string): ScreenHealth | null {
    const screen = this.store.get(screenId);
    if (!screen) return null;

    const health = this.store.getHealth(screenId);
    if (!health) return null;

    // Update health based on last heartbeat
    const lastHeartbeat = health.lastHeartbeat;
    const now = new Date();
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();

    // Determine status based on heartbeat
    if (timeSinceHeartbeat > 5 * 60 * 1000) { // 5 minutes
      health.status = 'offline';
    } else if (timeSinceHeartbeat > 60 * 1000) { // 1 minute
      health.status = 'degraded';
    } else {
      health.status = 'healthy';
    }

    // Update connection quality
    if (timeSinceHeartbeat < 10000) {
      health.connectionQuality = 'excellent';
    } else if (timeSinceHeartbeat < 60000) {
      health.connectionQuality = 'good';
    } else {
      health.connectionQuality = 'poor';
    }

    return health;
  }

  /**
   * Get health for all active screens
   */
  getAllScreenHealth(): ScreenHealth[] {
    const screens = this.store.getAll();
    const healthList: ScreenHealth[] = [];

    for (const screen of screens) {
      const health = this.getScreenHealth(screen.id);
      if (health) {
        healthList.push(health);
      }
    }

    return healthList;
  }

  // -------------------------------------------------------------------------
  // Heartbeat & Sync
  // -------------------------------------------------------------------------

  /**
   * Process screen heartbeat
   */
  processHeartbeat(heartbeat: ScreenHeartbeat): ContentUpdate | null {
    return this.store.processHeartbeat(heartbeat);
  }

  /**
   * Get active screens that need playlist updates
   */
  getScreensForPlaylistUpdate(): Screen[] {
    return this.store.getActiveForUpdate();
  }

  /**
   * Update screen metrics (impressions, scans)
   */
  updateScreenMetrics(
    screenId: string,
    options: { impressions?: number; scans?: number }
  ): boolean {
    const screen = this.store.get(screenId);
    if (!screen) return false;

    if (options.impressions) {
      screen.total_impressions = (screen.total_impressions || 0) + options.impressions;
    }

    if (options.scans) {
      screen.total_scans = (screen.total_scans || 0) + options.scans;
    }

    screen.updated_at = new Date();
    return true;
  }

  // -------------------------------------------------------------------------
  // Network Statistics
  // -------------------------------------------------------------------------

  /**
   * Get network-wide statistics
   */
  getNetworkStats(): NetworkStats {
    return this.store.getStats();
  }

  /**
   * Get screen types summary
   */
  getScreenTypesSummary(): { type: string; count: number }[] {
    const stats = this.store.getStats();
    return Object.entries(stats.by_type).map(([type, count]) => ({ type, count }));
  }

  /**
   * Get cities with screen counts
   */
  getCitiesSummary(): { city: string; count: number }[] {
    const stats = this.store.getStats();
    return Object.entries(stats.by_city).map(([city, count]) => ({ city, count }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let serviceInstance: ScreenManagementService | null = null;

export function createScreenManagementService(): ScreenManagementService {
  if (!serviceInstance) {
    serviceInstance = new ScreenManagementService();
  }
  return serviceInstance;
}

// Re-export types for convenience
export type { NetworkStats };
