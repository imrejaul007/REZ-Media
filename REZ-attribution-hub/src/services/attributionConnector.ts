/**
 * Attribution Hub Connector
 *
 * Connects all marketing touchpoints to conversion tracking
 * Powers multi-touch attribution across REZ ecosystem
 *
 * @package REZ-Attribution-Hub
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import Redis from 'ioredis';

// ============================================================================
// Configuration
// ============================================================================

const ATTRIBUTION_HUB = process.env.ATTRIBUTION_HUB_URL || 'https://rez-attribution-hub.onrender.com';
const LOYALTY_SERVICE = process.env.LOYALTY_SERVICE_URL || 'https://rez-loyalty-service.onrender.com';
const WALLET_SERVICE = process.env.WALLET_SERVICE_URL || 'https://rez-wallet-service.onrender.com';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Cache TTL in seconds
const CACHE_TTL = {
  ATTRIBUTION: 300,      // 5 minutes
  CAMPAIGN_PERF: 60,     // 1 minute
  TOUCHPOINT: 60,        // 1 minute
};

// ============================================================================
// Types
// ============================================================================

/**
 * Marketing channel types
 */
export type ChannelType =
  | 'dooh'
  | 'qr'
  | 'search'
  | 'social'
  | 'display'
  | 'email'
  | 'referral'
  | 'organic'
  | 'direct';

/**
 * Attribution model types
 */
export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'last_non_direct'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'data_driven';

/**
 * Touchpoint tracking data
 */
export interface TouchpointData {
  customerId: string;
  channel: ChannelType;
  campaignId?: string;
  adId?: string;
  storeId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conversion tracking data
 */
export interface ConversionData {
  customerId: string;
  orderId: string;
  amount: number;
  merchantId: string;
  storeId?: string;
}

/**
 * Attribution result for a single channel
 */
export interface AttributionResult {
  channel: ChannelType;
  weight: number;
  revenue: number;
  touchpoints: number;
  avgDwellTime?: number;
}

/**
 * DOOH interaction data
 */
export interface DOOHInteractionData {
  screenId: string;
  customerId?: string;
  adId: string;
  dwellTime: number;
  action: 'view' | 'scan' | 'click';
}

/**
 * Customer attribution summary
 */
export interface CustomerAttributionSummary {
  customerId: string;
  totalConversions: number;
  totalRevenue: number;
  totalTouchpoints: number;
  firstTouchChannel: ChannelType;
  lastTouchChannel: ChannelType;
  byChannel: Record<ChannelType, ChannelAttributionStats>;
  byCampaign: Record<string, CampaignAttributionStats>;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Channel-specific attribution stats
 */
export interface ChannelAttributionStats {
  conversions: number;
  revenue: number;
  touchpoints: number;
  avgOrderValue: number;
  conversionRate: number;
}

/**
 * Campaign-specific attribution stats
 */
export interface CampaignAttributionStats {
  campaignId: string;
  channel: ChannelType;
  conversions: number;
  revenue: number;
  roas: number;
  touchpoints: number;
}

/**
 * Campaign performance metrics
 */
export interface CampaignPerformance {
  campaignId: string;
  impressions: number;
  uniqueImpressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  attribution: Record<ChannelType, AttributionChannelMetrics>;
  trend: {
    daily: DailyPerformance[];
    comparison: {
      vsLastPeriod: PeriodComparison;
      vsLastWeek: PeriodComparison;
    };
  };
}

/**
 * Attribution channel metrics breakdown
 */
export interface AttributionChannelMetrics {
  conversions: number;
  revenue: number;
  percentage: number;
  avgOrderValue: number;
}

/**
 * Daily performance data point
 */
export interface DailyPerformance {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  roas: number;
}

/**
 * Period comparison data
 */
export interface PeriodComparison {
  impressionsChange: number;
  clicksChange: number;
  conversionsChange: number;
  revenueChange: number;
  roasChange: number;
}

/**
 * Touchpoint response
 */
export interface TouchpointResponse {
  touchpointId: string;
  customerId: string;
  channel: ChannelType;
  campaignId?: string;
  adId?: string;
  storeId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conversion response
 */
export interface ConversionResponse {
  conversionId: string;
  orderId: string;
  customerId: string;
  amount: number;
  attribution: AttributionResult[];
  cashbackAwarded: number;
  timestamp: string;
}

/**
 * API Error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Redis client singleton
 */
let redisClient: Redis | null = null;

/**
 * HTTP client singleton
 */
let httpClient: AxiosInstance | null = null;

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('error', (error: Error) => {
      console.error('[AttributionConnector] Redis connection error:', error.message);
    });

    redisClient.on('connect', () => {
      console.log('[AttributionConnector] Redis connected');
    });
  }
  return redisClient;
}

/**
 * Get or create HTTP client
 */
function getHttpClient(): AxiosInstance {
  if (!httpClient) {
    httpClient = axios.create({
      baseURL: ATTRIBUTION_HUB,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
    });

    httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        const message = error.response?.data?.message || error.message;
        console.error('[AttributionConnector] API Error:', message);
        return Promise.reject(error);
      }
    );
  }
  return httpClient;
}

// ============================================================================
// Core Tracking Functions
// ============================================================================

/**
 * Track a marketing touchpoint
 *
 * @param data - Touchpoint data
 * @returns Touchpoint ID
 * @throws {Error} When API call fails
 *
 * @example
 * ```typescript
 * const touchpointId = await trackTouchpoint({
 *   customerId: 'cust_123',
 *   channel: 'dooh',
 *   campaignId: 'camp_456',
 *   adId: 'ad_789',
 *   metadata: { screenId: 'screen_001', dwellTime: 30 }
 * });
 * ```
 */
export async function trackTouchpoint(data: TouchpointData): Promise<string> {
  const client = getHttpClient();

  try {
    const response = await client.post<TouchpointResponse>('/api/v1/touchpoints', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Cache touchpoint for attribution
    await cacheTouchpoint(response.data.touchpointId, data);

    return response.data.touchpointId;
  } catch (error) {
    console.error('[AttributionConnector] Failed to track touchpoint:', error);
    throw error;
  }
}

/**
 * Track a conversion event
 *
 * @param data - Conversion data
 * @returns Attribution results
 * @throws {Error} When API call fails or cashback fails
 *
 * @example
 * ```typescript
 * const attribution = await trackConversion({
 *   customerId: 'cust_123',
 *   orderId: 'order_456',
 *   amount: 500,
 *   merchantId: 'merchant_789'
 * });
 * ```
 */
export async function trackConversion(data: ConversionData): Promise<AttributionResult[]> {
  const client = getHttpClient();

  try {
    const response = await client.post<ConversionResponse>('/api/v1/conversions', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // Award cashback based on attribution
    await awardCashback(data.customerId, data.orderId, response.data.attribution);

    // Invalidate customer attribution cache
    await invalidateCustomerCache(data.customerId);

    return response.data.attribution;
  } catch (error) {
    console.error('[AttributionConnector] Failed to track conversion:', error);
    throw error;
  }
}

// ============================================================================
// Cashback Functions
// ============================================================================

/**
 * Award cashback based on attribution
 *
 * @param customerId - Customer ID
 * @param orderId - Order ID
 * @param attribution - Attribution results
 * @throws {Error} When wallet credit fails
 */
async function awardCashback(
  customerId: string,
  orderId: string,
  attribution: AttributionResult[]
): Promise<void> {
  if (!attribution || attribution.length === 0) {
    console.warn('[AttributionConnector] No attribution data for cashback');
    return;
  }

  const primaryChannel = attribution[0]?.channel || 'organic';
  const coins = calculateCashback(attribution);

  try {
    await creditWallet(customerId, coins, orderId, primaryChannel, attribution);
    console.log(`[AttributionConnector] Awarded ${coins} coins to ${customerId}`);
  } catch (error) {
    console.error('[AttributionConnector] Failed to award cashback:', error);
    // Don't throw - conversion tracking should succeed even if cashback fails
  }
}

/**
 * Calculate cashback coins based on attribution
 *
 * @param attribution - Attribution results
 * @returns Number of coins to award
 */
function calculateCashback(attribution: AttributionResult[]): number {
  // Coin rates per channel (per 100 INR)
  const coinRates: Record<ChannelType, number> = {
    dooh: 3,
    qr: 2,
    referral: 2.5,
    search: 1.5,
    social: 1.5,
    display: 1,
    email: 1,
    organic: 0.5,
    direct: 0,
  };

  const primaryChannel = attribution[0]?.channel || 'organic';
  const totalRevenue = attribution.reduce((sum, a) => sum + a.revenue, 0);

  // Base coins calculation
  const baseCoins = Math.floor(totalRevenue / 100) * (coinRates[primaryChannel] || 1);

  // DOOH bonus (50% extra for DOOH-attributed conversions)
  if (attribution.some((a) => a.channel === 'dooh')) {
    return Math.floor(baseCoins * 1.5);
  }

  // Referral bonus (25% extra)
  if (attribution.some((a) => a.channel === 'referral')) {
    return Math.floor(baseCoins * 1.25);
  }

  return baseCoins;
}

/**
 * Credit wallet with cashback
 *
 * @param customerId - Customer ID
 * @param coins - Number of coins
 * @param orderId - Order ID
 * @param channel - Attribution channel
 * @param attribution - Attribution breakdown
 */
async function creditWallet(
  customerId: string,
  coins: number,
  orderId: string,
  channel: ChannelType,
  attribution?: AttributionResult[]
): Promise<void> {
  const client = getHttpClient();

  await client.post(`${WALLET_SERVICE}/api/v1/transactions/credit`, {
    customerId,
    amount: coins,
    type: 'cashback',
    source: 'attribution',
    sourceService: 'attribution-hub',
    metadata: {
      orderId,
      channel,
      attribution: attribution?.map((a) => ({
        channel: a.channel,
        weight: a.weight,
        revenue: a.revenue,
      })),
    },
  });
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get customer attribution summary
 *
 * @param customerId - Customer ID
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @returns Customer attribution summary
 * @throws {Error} When API call fails
 *
 * @example
 * ```typescript
 * const summary = await getCustomerAttribution(
 *   'cust_123',
 *   '2024-01-01',
 *   '2024-01-31'
 * );
 * ```
 */
export async function getCustomerAttribution(
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<CustomerAttributionSummary> {
  const cacheKey = `attribution:customer:${customerId}:${startDate || 'all'}:${endDate || 'all'}`;

  // Try cache first
  const cached = await getFromCache<CustomerAttributionSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const client = getHttpClient();

  const response = await client.get<CustomerAttributionSummary>(
    `/api/v1/attribution/${customerId}`,
    {
      params: { startDate, endDate },
    }
  );

  // Cache result
  await setInCache(cacheKey, response.data, CACHE_TTL.ATTRIBUTION);

  return response.data;
}

/**
 * Get campaign performance metrics
 *
 * @param campaignId - Campaign ID
 * @returns Campaign performance data
 * @throws {Error} When API call fails
 *
 * @example
 * ```typescript
 * const perf = await getCampaignPerformance('camp_123');
 * console.log(`ROAS: ${perf.roas}, Revenue: ${perf.revenue}`);
 * ```
 */
export async function getCampaignPerformance(
  campaignId: string
): Promise<CampaignPerformance> {
  const cacheKey = `attribution:campaign:${campaignId}`;

  // Try cache first
  const cached = await getFromCache<CampaignPerformance>(cacheKey);
  if (cached) {
    return cached;
  }

  const client = getHttpClient();

  const response = await client.get<CampaignPerformance>(
    `/api/v1/campaigns/${campaignId}/performance`
  );

  // Cache result
  await setInCache(cacheKey, response.data, CACHE_TTL.CAMPAIGN_PERF);

  return response.data;
}

/**
 * Get channel attribution breakdown
 *
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @returns Channel attribution summary
 */
export async function getChannelAttribution(
  startDate?: string,
  endDate?: string
): Promise<Record<ChannelType, ChannelAttributionStats>> {
  const client = getHttpClient();

  const response = await client.get<Record<ChannelType, ChannelAttributionStats>>(
    '/api/v1/attribution/channels',
    {
      params: { startDate, endDate },
    }
  );

  return response.data;
}

// ============================================================================
// DOOH-Specific Functions
// ============================================================================

/**
 * Track DOOH screen interaction
 *
 * @param data - DOOH interaction data
 * @throws {Error} When API call fails
 *
 * @example
 * ```typescript
 * await trackDOOHInteraction({
 *   screenId: 'screen_001',
 *   customerId: 'cust_123',
 *   adId: 'ad_456',
 *   dwellTime: 45,
 *   action: 'scan'
 * });
 * ```
 */
export async function trackDOOHInteraction(data: DOOHInteractionData): Promise<void> {
  const client = getHttpClient();

  try {
    await client.post('/api/v1/dooh/interaction', {
      ...data,
      timestamp: new Date().toISOString(),
    });

    // If QR scanned, track as touchpoint
    if (data.action === 'scan' && data.customerId) {
      await trackTouchpoint({
        customerId: data.customerId,
        channel: 'dooh',
        adId: data.adId,
        metadata: {
          screenId: data.screenId,
          dwellTime: data.dwellTime,
          action: data.action,
        },
      });
    }

    // Update DOOH metrics cache
    await updateDOOHMetricsCache(data);
  } catch (error) {
    console.error('[AttributionConnector] Failed to track DOOH interaction:', error);
    throw error;
  }
}

/**
 * Get DOOH campaign attribution
 *
 * @param campaignId - Campaign ID
 * @returns DOOH-specific attribution data
 */
export async function getDOOHCampaignAttribution(
  campaignId: string
): Promise<{
  totalScans: number;
  totalConversions: number;
  revenue: number;
  avgDwellTime: number;
  byScreenType: Record<string, { scans: number; conversions: number }>;
}> {
  const client = getHttpClient();

  const response = await client.get(`/api/v1/dooh/campaigns/${campaignId}/attribution`);

  return response.data;
}

// ============================================================================
// QR-Specific Functions
// ============================================================================

/**
 * Track QR code scan
 *
 * @param data - QR scan data
 * @returns Touchpoint ID
 */
export async function trackQRScan(data: {
  customerId: string;
  qrId: string;
  merchantId: string;
  storeId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  return trackTouchpoint({
    customerId: data.customerId,
    channel: 'qr',
    storeId: data.storeId,
    metadata: {
      qrId: data.qrId,
      merchantId: data.merchantId,
      ...data.metadata,
    },
  });
}

/**
 * Get QR campaign attribution
 *
 * @param campaignId - Campaign ID
 * @returns QR campaign attribution data
 */
export async function getQRCampaignAttribution(
  campaignId: string
): Promise<{
  totalScans: number;
  uniqueScans: number;
  conversions: number;
  revenue: number;
  scanToConversionRate: number;
}> {
  const client = getHttpClient();

  const response = await client.get(`/api/v1/qr/campaigns/${campaignId}/attribution`);

  return response.data;
}

// ============================================================================
// Multi-Touch Attribution Functions
// ============================================================================

/**
 * Get journey touchpoints for customer
 *
 * @param customerId - Customer ID
 * @param limit - Max touchpoints to return
 * @returns Customer journey
 */
export async function getCustomerJourney(
  customerId: string,
  limit: number = 20
): Promise<{
  touchpoints: Array<{
    id: string;
    channel: ChannelType;
    campaignId?: string;
    adId?: string;
    storeId?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  conversions: Array<{
    orderId: string;
    timestamp: string;
    amount: number;
    attribution: AttributionResult[];
  }>;
}> {
  const client = getHttpClient();

  const response = await client.get(`/api/v1/journey/${customerId}`, {
    params: { limit },
  });

  return response.data;
}

/**
 * Simulate attribution with different models
 *
 * @param customerId - Customer ID
 * @param models - Attribution models to simulate
 * @returns Attribution comparison
 */
export async function simulateAttribution(
  customerId: string,
  models: AttributionModel[]
): Promise<Record<AttributionModel, AttributionResult[]>> {
  const client = getHttpClient();

  const response = await client.post(`/api/v1/attribution/${customerId}/simulate`, {
    models,
  });

  return response.data;
}

// ============================================================================
// Cache Functions
// ============================================================================

/**
 * Get value from cache
 */
async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(key);
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    console.warn('[AttributionConnector] Cache read error:', error);
    return null;
  }
}

/**
 * Set value in cache
 */
async function setInCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.warn('[AttributionConnector] Cache write error:', error);
  }
}

/**
 * Cache touchpoint for attribution
 */
async function cacheTouchpoint(touchpointId: string, data: TouchpointData): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `touchpoint:${touchpointId}`;
    await redis.setex(key, CACHE_TTL.TOUCHPOINT, JSON.stringify(data));
  } catch (error) {
    console.warn('[AttributionConnector] Touchpoint cache error:', error);
  }
}

/**
 * Invalidate customer attribution cache
 */
async function invalidateCustomerCache(customerId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const pattern = `attribution:customer:${customerId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.warn('[AttributionConnector] Cache invalidation error:', error);
  }
}

/**
 * Update DOOH metrics cache
 */
async function updateDOOHMetricsCache(data: DOOHInteractionData): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = `dooh:metrics:${data.screenId}`;

    const existing = await redis.get(key);
    const metrics = existing ? JSON.parse(existing) : {
      views: 0,
      scans: 0,
      clicks: 0,
    };

    if (data.action === 'view') metrics.views++;
    if (data.action === 'scan') metrics.scans++;
    if (data.action === 'click') metrics.clicks++;

    await redis.setex(key, 60, JSON.stringify(metrics));
  } catch (error) {
    console.warn('[AttributionConnector] DOOH metrics cache error:', error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get channel display name
 */
export function getChannelDisplayName(channel: ChannelType): string {
  const names: Record<ChannelType, string> = {
    dooh: 'Digital Out of Home',
    qr: 'QR Code',
    search: 'Search',
    social: 'Social Media',
    display: 'Display Ads',
    email: 'Email',
    referral: 'Referral',
    organic: 'Organic',
    direct: 'Direct',
  };
  return names[channel] || channel;
}

/**
 * Calculate ROAS (Return on Ad Spend)
 */
export function calculateROAS(revenue: number, spend: number): number {
  if (spend === 0) return 0;
  return revenue / spend;
}

/**
 * Calculate CPA (Cost per Acquisition)
 */
export function calculateCPA(spend: number, acquisitions: number): number {
  if (acquisitions === 0) return 0;
  return spend / acquisitions;
}

/**
 * Validate channel type
 */
export function isValidChannel(channel: string): channel is ChannelType {
  const validChannels: ChannelType[] = [
    'dooh',
    'qr',
    'search',
    'social',
    'display',
    'email',
    'referral',
    'organic',
    'direct',
  ];
  return validChannels.includes(channel as ChannelType);
}

/**
 * Validate attribution model
 */
export function isValidAttributionModel(model: string): model is AttributionModel {
  const validModels: AttributionModel[] = [
    'first_touch',
    'last_touch',
    'last_non_direct',
    'linear',
    'time_decay',
    'position_based',
    'data_driven',
  ];
  return validModels.includes(model as AttributionModel);
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for attribution connector
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    attributionHub: boolean;
    redis: boolean;
    wallet: boolean;
  };
  latency: {
    attributionHub: number;
    redis: number;
  };
}> {
  const result = {
    status: 'healthy' as const,
    services: {
      attributionHub: false,
      redis: false,
      wallet: false,
    },
    latency: {
      attributionHub: 0,
      redis: 0,
    },
  };

  // Check Redis
  const redisStart = Date.now();
  try {
    const redis = getRedisClient();
    await redis.ping();
    result.services.redis = true;
    result.latency.redis = Date.now() - redisStart;
  } catch {
    result.status = 'degraded';
  }

  // Check Attribution Hub
  const hubStart = Date.now();
  try {
    const client = getHttpClient();
    await client.get('/health');
    result.services.attributionHub = true;
    result.latency.attributionHub = Date.now() - hubStart;
  } catch {
    result.status = 'unhealthy';
  }

  // Check Wallet Service
  try {
    const client = getHttpClient();
    await axios.get(`${WALLET_SERVICE}/health`, { timeout: 2000 });
    result.services.wallet = true;
  } catch {
    // Wallet is optional
  }

  return result;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Close connections
 */
export async function closeConnections(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  httpClient = null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Core tracking
  trackTouchpoint,
  trackConversion,

  // Queries
  getCustomerAttribution,
  getCampaignPerformance,
  getChannelAttribution,

  // DOOH
  trackDOOHInteraction,
  getDOOHCampaignAttribution,

  // QR
  trackQRScan,
  getQRCampaignAttribution,

  // Journey
  getCustomerJourney,
  simulateAttribution,

  // Utilities
  getChannelDisplayName,
  calculateROAS,
  calculateCPA,
  isValidChannel,
  isValidAttributionModel,

  // Health
  healthCheck,
  closeConnections,
};
