/**
 * DOOH ANALYTICS DASHBOARD API
 * Phase 5: Digital Out of Home screen performance analytics
 *
 * Endpoints:
 * - GET /api/dooh/analytics/screens          - Screen performance overview
 * - GET /api/dooh/analytics/screens/:id     - Individual screen analytics
 * - GET /api/dooh/analytics/campaigns       - Campaign analytics by screen type
 * - GET /api/dooh/analytics/network          - Network-wide metrics
 */

import { Router, Request, Response } from 'express';
import Redis from 'ioredis';

const router = Router();

// ============================================
// TYPES & INTERFACES
// ============================================

interface DateRange {
  start: Date;
  end: Date;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface ScreenMetrics {
  screenId: string;
  screenName: string;
  location: string;
  screenType: 'billboard' | 'transit' | 'kiosk' | 'wallboard' | 'poster';
  totalImpressions: number;
  qrScans: number;
  scanRate: number;
  costPerScan: number;
  status: 'active' | 'inactive' | 'maintenance';
}

interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  screenType: string;
  impressions: number;
  qrScans: number;
  conversionRate: number;
  spend: number;
  status: 'active' | 'paused' | 'completed' | 'draft';
}

interface TimeOfDayPattern {
  hour: number;
  impressions: number;
  scans: number;
  scanRate: number;
}

interface NetworkMetrics {
  totalScreens: number;
  activeScreens: number;
  inactiveScreens: number;
  maintenanceScreens: number;
  totalImpressions: number;
  totalScans: number;
  avgScanRate: number;
  networkCPM: number;
  totalRevenue: number;
  totalSpend: number;
  roi: number;
}

// ============================================
// HELPERS
// ============================================

/**
 * Parse date range from query params or return defaults
 */
function parseDateRange(req: Request): DateRange {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const start = req.query.start
    ? new Date(req.query.start as string)
    : defaultStart;
  const end = req.query.end
    ? new Date(req.query.end as string)
    : now;

  return { start, end };
}

/**
 * Generate date array between two dates
 */
function getDateArray(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Create Redis client with error handling
 */
async function getRedisClient(): Promise<Redis> {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  return redis;
}

/**
 * Calculate percentage with safe division
 */
function safePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100 * 100) / 100;
}

/**
 * Calculate CPM (Cost Per Mille)
 */
function calculateCPM(spend: number, impressions: number): number {
  if (impressions === 0) return 0;
  return Math.round((spend / impressions) * 1000 * 100) / 100;
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Generate DOOH Redis key prefix
 */
function doohKey(suffix: string): string {
  return `dooh:${suffix}`;
}

/**
 * Parse hour from timestamp for time-of-day analysis
 */
function getHourFromDate(dateStr: string): number {
  return new Date(dateStr).getHours();
}

// ============================================
// 1. SCREEN ANALYTICS OVERVIEW
// GET /api/dooh/analytics/screens
// ============================================

router.get('/screens', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const REDIS_KEYS = {
      screenList: doohKey('screens:list'),
      screenImpressions: (screenId: string, date: string) => doohKey(`screen:${screenId}:impressions:${date}`),
      screenScans: (screenId: string, date: string) => doohKey(`screen:${screenId}:scans:${date}`),
      screenSpend: (screenId: string) => doohKey(`screen:${screenId}:spend`),
      screenName: (screenId: string) => doohKey(`screen:${screenId}:name`),
      screenLocation: (screenId: string) => doohKey(`screen:${screenId}:location`),
      screenType: (screenId: string) => doohKey(`screen:${screenId}:type`),
      screenStatus: (screenId: string) => doohKey(`screen:${screenId}:status`),
      screenRevenue: (screenId: string, date: string) => doohKey(`screen:${screenId}:revenue:${date}`),
    };

    // Get all screen IDs
    const screenIds = await redis.smembers(REDIS_KEYS.screenList);

    if (screenIds.length === 0) {
      // Return sample data for demonstration
      const sampleScreens = generateSampleScreens();
      return res.json({
        success: true,
        data: {
          screens: sampleScreens.screens,
          summary: sampleScreens.summary,
          topPerforming: sampleScreens.topPerforming,
          lowestPerforming: sampleScreens.lowestPerforming,
          byScreenType: sampleScreens.byScreenType,
          period: { start: start.toISOString(), end: end.toISOString() },
          meta: {
            totalScreens: sampleScreens.screens.length,
            daysAnalyzed: dates.length,
            generatedAt: new Date().toISOString()
          }
        }
      });
    }

    // Aggregate metrics for each screen
    const screenMetrics: ScreenMetrics[] = [];
    let totalImpressions = 0;
    let totalScans = 0;
    let totalSpend = 0;
    let totalRevenue = 0;
    const screensByType: Record<string, { impressions: number; scans: number; count: number }> = {};

    for (const screenId of screenIds) {
      const [name, location, screenType, status, spend] = await Promise.all([
        redis.get(REDIS_KEYS.screenName(screenId)),
        redis.get(REDIS_KEYS.screenLocation(screenId)),
        redis.get(REDIS_KEYS.screenType(screenId)),
        redis.get(REDIS_KEYS.screenStatus(screenId)),
        redis.get(REDIS_KEYS.screenSpend(screenId))
      ]);

      let screenImpressions = 0;
      let screenScans = 0;
      let screenRevenue = 0;

      // Aggregate daily data
      for (const date of dates) {
        const [impressions, scans, revenue] = await Promise.all([
          redis.get(REDIS_KEYS.screenImpressions(screenId, date)),
          redis.get(REDIS_KEYS.screenScans(screenId, date)),
          redis.get(REDIS_KEYS.screenRevenue(screenId, date))
        ]);

        screenImpressions += parseInt(impressions || '0');
        screenScans += parseInt(scans || '0');
        screenRevenue += parseFloat(revenue || '0');
      }

      totalImpressions += screenImpressions;
      totalScans += screenScans;
      totalSpend += parseFloat(spend || '0');
      totalRevenue += screenRevenue;

      // Track by screen type
      const type = screenType || 'poster';
      if (!screensByType[type]) {
        screensByType[type] = { impressions: 0, scans: 0, count: 0 };
      }
      screensByType[type].impressions += screenImpressions;
      screensByType[type].scans += screenScans;
      screensByType[type].count++;

      const scanRate = safePercentage(screenScans, screenImpressions);
      const costPerScan = screenScans > 0 ? parseFloat(spend || '0') / screenScans : 0;

      screenMetrics.push({
        screenId,
        screenName: name || `Screen ${screenId.slice(0, 8)}`,
        location: location || 'Unknown',
        screenType: type as ScreenMetrics['screenType'],
        totalImpressions: screenImpressions,
        qrScans: screenScans,
        scanRate,
        costPerScan: Math.round(costPerScan * 100) / 100,
        status: (status as ScreenMetrics['status']) || 'active'
      });
    }

    // Sort screens by scan rate (best performing first)
    const sortedScreens = [...screenMetrics].sort((a, b) => b.scanRate - a.scanRate);
    const topPerforming = sortedScreens.slice(0, 5);
    const lowestPerforming = sortedScreens.slice(-5).reverse();

    // Calculate network-wide summary
    const avgScanRate = safePercentage(totalScans, totalImpressions);
    const networkCPM = calculateCPM(totalSpend, totalImpressions);
    const roi = totalSpend > 0 ? safePercentage(totalRevenue - totalSpend, totalSpend) : 0;

    // Screen type breakdown
    const byScreenType = Object.entries(screensByType).map(([type, data]) => ({
      screenType: type,
      screenCount: data.count,
      totalImpressions: data.impressions,
      totalScans: data.scans,
      avgScanRate: safePercentage(data.scans, data.impressions)
    }));

    const analytics = {
      screens: sortedScreens.slice(0, limit),
      summary: {
        totalScreens: screenIds.length,
        activeScreens: screenMetrics.filter(s => s.status === 'active').length,
        totalImpressions,
        totalScans,
        avgScanRate: `${avgScanRate}%`,
        avgCostPerScan: formatCurrency(totalScans > 0 ? totalSpend / totalScans : 0),
        networkCPM: formatCurrency(networkCPM),
        totalRevenue: formatCurrency(totalRevenue),
        totalSpend: formatCurrency(totalSpend),
        roi: `${roi}%`
      },
      topPerforming,
      lowestPerforming,
      byScreenType,
      period: { start: start.toISOString(), end: end.toISOString() },
      meta: {
        daysAnalyzed: dates.length,
        limit,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[DOOH ANALYTICS] Screen analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch screen analytics'
    });
  }
});

// ============================================
// 2. INDIVIDUAL SCREEN ANALYTICS
// GET /api/dooh/analytics/screens/:id
// ============================================

router.get('/screens/:id', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { id: screenId } = req.params;
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);

    const REDIS_KEYS = {
      screenName: doohKey(`screen:${screenId}:name`),
      screenLocation: doohKey(`screen:${screenId}:location`),
      screenType: doohKey(`screen:${screenId}:type`),
      screenStatus: doohKey(`screen:${screenId}:status`),
      screenSpend: doohKey(`screen:${screenId}:spend`),
      screenBudget: doohKey(`screen:${screenId}:budget`),
      screenImpressions: (date: string) => doohKey(`screen:${screenId}:impressions:${date}`),
      screenScans: (date: string) => doohKey(`screen:${screenId}:scans:${date}`),
      screenRevenue: (date: string) => doohKey(`screen:${screenId}:revenue:${date}`),
      screenHourly: (date: string) => doohKey(`screen:${screenId}:hourly:${date}`),
      screenCampaigns: doohKey(`screen:${screenId}:campaigns`),
    };

    // Get screen metadata
    const [name, location, screenType, status, spend, budget] = await Promise.all([
      redis.get(REDIS_KEYS.screenName),
      redis.get(REDIS_KEYS.screenLocation),
      redis.get(REDIS_KEYS.screenType),
      redis.get(REDIS_KEYS.screenStatus),
      redis.get(REDIS_KEYS.screenSpend),
      redis.get(REDIS_KEYS.screenBudget)
    ]);

    // Aggregate daily metrics
    let totalImpressions = 0;
    let totalScans = 0;
    let totalRevenue = 0;
    const dailyMetrics: { date: string; impressions: number; scans: number; revenue: number; scanRate: number }[] = [];

    // Aggregate hourly patterns (24-hour)
    const hourlyData: { hour: number; impressions: number; scans: number }[] = Array.from(
      { length: 24 },
      (_, i) => ({ hour: i, impressions: 0, scans: 0 })
    );

    for (const date of dates) {
      const [impressions, scans, revenue] = await Promise.all([
        redis.get(REDIS_KEYS.screenImpressions(date)),
        redis.get(REDIS_KEYS.screenScans(date)),
        redis.get(REDIS_KEYS.screenRevenue(date))
      ]);

      const imp = parseInt(impressions || '0');
      const sca = parseInt(scans || '0');
      const rev = parseFloat(revenue || '0');

      totalImpressions += imp;
      totalScans += sca;
      totalRevenue += rev;

      dailyMetrics.push({
        date,
        impressions: imp,
        scans: sca,
        revenue: rev,
        scanRate: safePercentage(sca, imp)
      });

      // Get hourly breakdown for this date
      const hourlyJson = await redis.get(REDIS_KEYS.screenHourly(date));
      if (hourlyJson) {
        try {
          const hourly = JSON.parse(hourlyJson);
          for (const [hour, data] of Object.entries(hourly)) {
            const h = parseInt(hour);
            if (h >= 0 && h < 24 && data) {
              hourlyData[h].impressions += (data as { impressions?: number }).impressions || 0;
              hourlyData[h].scans += (data as { scans?: number }).scans || 0;
            }
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Calculate key metrics
    const scanRate = safePercentage(totalScans, totalImpressions);
    const costPerScan = totalScans > 0 ? parseFloat(spend || '0') / totalScans : 0;
    const avgDailyImpressions = Math.round(totalImpressions / dates.length);
    const avgDailyScans = Math.round(totalScans / dates.length);

    // Budget utilization
    const totalBudget = parseFloat(budget || '0');
    const budgetUtilization = totalBudget > 0 ? safePercentage(parseFloat(spend || '0'), totalBudget) : 0;

    // Calculate ROI
    const totalSpend = parseFloat(spend || '0');
    const roi = totalSpend > 0 ? safePercentage(totalRevenue - totalSpend, totalSpend) : 0;

    // Time-of-day patterns
    const timeOfDayPatterns: TimeOfDayPattern[] = hourlyData.map(h => ({
      hour: h.hour,
      impressions: h.impressions,
      scans: h.scans,
      scanRate: safePercentage(h.scans, h.impressions)
    }));

    // Find peak hours
    const peakHours = [...hourlyData]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
      .map(h => h.hour);

    const bestScanRateHours = [...hourlyData]
      .filter(h => h.impressions > 0)
      .sort((a, b) => b.scanRate - a.scanRate)
      .slice(0, 3)
      .map(h => h.hour);

    // Get campaigns on this screen
    const campaignIds = await redis.smembers(REDIS_KEYS.screenCampaigns);
    const campaigns: { campaignId: string; impressions: number; scans: number; scanRate: number }[] = [];

    for (const campaignId of campaignIds) {
      const campaignImpressions = await redis.get(doohKey(`screen:${screenId}:campaign:${campaignId}:impressions`));
      const campaignScans = await redis.get(doohKey(`screen:${screenId}:campaign:${campaignId}:scans`));

      const imp = parseInt(campaignImpressions || '0');
      const sca = parseInt(campaignScans || '0');

      campaigns.push({
        campaignId,
        impressions: imp,
        scans: sca,
        scanRate: safePercentage(sca, imp)
      });
    }

    // Performance benchmarks
    const industryAvgScanRate = 3.5; // Industry average QR scan rate for DOOH
    const performanceVsBenchmark = safePercentage(scanRate, industryAvgScanRate);

    // Find best and worst performing days
    const bestDay = dailyMetrics.reduce((max, d) => d.scanRate > (max?.scanRate || 0) ? d : max, dailyMetrics[0]);
    const worstDay = dailyMetrics.reduce((min, d) => d.scanRate < (min?.scanRate || Infinity) ? d : min, dailyMetrics[0]);

    const analytics = {
      screenId,
      metadata: {
        name: name || `Screen ${screenId.slice(0, 8)}`,
        location: location || 'Unknown',
        screenType: screenType || 'poster',
        status: status || 'active'
      },
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: {
        totalImpressions,
        totalScans,
        totalRevenue: formatCurrency(totalRevenue),
        totalSpend: formatCurrency(totalSpend),
        scanRate: `${scanRate}%`,
        costPerScan: formatCurrency(costPerScan),
        roi: `${roi}%`,
        avgDailyImpressions,
        avgDailyScans
      },
      budget: {
        total: formatCurrency(totalBudget),
        spent: formatCurrency(totalSpend),
        utilization: `${budgetUtilization}%`,
        remaining: formatCurrency(Math.max(0, totalBudget - parseFloat(spend || '0')))
      },
      performance: {
        scanRate: `${scanRate}%`,
        benchmarkRate: `${industryAvgScanRate}%`,
        vsBenchmark: `${performanceVsBenchmark > 100 ? '+' : ''}${(performanceVsBenchmark - 100).toFixed(1)}%`,
        status: scanRate >= industryAvgScanRate ? 'ABOVE_AVERAGE' : 'BELOW_AVERAGE'
      },
      dailyMetrics,
      timeOfDay: {
        patterns: timeOfDayPatterns,
        peakHours,
        bestScanRateHours,
        avgImpressionsByHour: hourlyData.map(h => h.impressions / dates.length)
      },
      campaigns: campaigns.sort((a, b) => b.scanRate - a.scanRate),
      bestDay: bestDay ? { date: bestDay.date, scanRate: `${bestDay.scanRate}%` } : null,
      worstDay: worstDay ? { date: worstDay.date, scanRate: `${worstDay.scanRate}%` } : null,
      meta: {
        daysAnalyzed: dates.length,
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[DOOH ANALYTICS] Individual screen error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch screen analytics'
    });
  }
});

// ============================================
// 3. CAMPAIGN ANALYTICS
// GET /api/dooh/analytics/campaigns
// ============================================

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);
    const screenTypeFilter = req.query.screenType as string | undefined;

    const REDIS_KEYS = {
      campaignList: doohKey('campaigns:list'),
      campaignName: (campaignId: string) => doohKey(`campaign:${campaignId}:name`),
      campaignStatus: (campaignId: string) => doohKey(`campaign:${campaignId}:status`),
      campaignScreens: (campaignId: string) => doohKey(`campaign:${campaignId}:screens`),
      campaignScreenType: (screenId: string) => doohKey(`screen:${screenId}:type`),
      campaignImpressions: (campaignId: string, date: string) => doohKey(`campaign:${campaignId}:impressions:${date}`),
      campaignScans: (campaignId: string, date: string) => doohKey(`campaign:${campaignId}:scans:${date}`),
      campaignSpend: (campaignId: string) => doohKey(`campaign:${campaignId}:spend`),
      campaignRevenue: (campaignId: string, date: string) => doohKey(`campaign:${campaignId}:revenue:${date}`),
      campaignHourly: (campaignId: string, date: string) => doohKey(`campaign:${campaignId}:hourly:${date}`),
    };

    // Get all campaign IDs
    const campaignIds = await redis.smembers(REDIS_KEYS.campaignList);

    if (campaignIds.length === 0) {
      // Return sample campaign data
      const sampleCampaigns = generateSampleCampaigns();
      return res.json({
        success: true,
        data: {
          campaigns: sampleCampaigns.campaigns,
          summary: sampleCampaigns.summary,
          byScreenType: sampleCampaigns.byScreenType,
          timeOfDayPatterns: sampleCampaigns.timeOfDayPatterns,
          topPerforming: sampleCampaigns.topPerforming,
          lowestPerforming: sampleCampaigns.lowestPerforming,
          period: { start: start.toISOString(), end: end.toISOString() },
          meta: {
            totalCampaigns: sampleCampaigns.campaigns.length,
            daysAnalyzed: dates.length,
            generatedAt: new Date().ISOString()
          }
        }
      });
    }

    // Aggregate metrics for each campaign
    const campaignMetrics: CampaignMetrics[] = [];
    let totalImpressions = 0;
    let totalScans = 0;
    let totalSpend = 0;
    let totalRevenue = 0;

    // Aggregate by screen type
    const byScreenType: Record<string, { impressions: number; scans: number; campaigns: number; spend: number }> = {};

    // Aggregate hourly patterns
    const hourlyAggregates: { hour: number; impressions: number; scans: number }[] = Array.from(
      { length: 24 },
      (_, i) => ({ hour: i, impressions: 0, scans: 0 })
    );

    for (const campaignId of campaignIds) {
      const [name, status, screenIds] = await Promise.all([
        redis.get(REDIS_KEYS.campaignName(campaignId)),
        redis.get(REDIS_KEYS.campaignStatus(campaignId)),
        redis.smembers(REDIS_KEYS.campaignScreens(campaignId))
      ]);

      let campaignImpressions = 0;
      let campaignScans = 0;
      let campaignRevenue = 0;
      const campaignScreenTypes = new Set<string>();

      // Aggregate daily data
      for (const date of dates) {
        const [impressions, scans, revenue] = await Promise.all([
          redis.get(REDIS_KEYS.campaignImpressions(campaignId, date)),
          redis.get(REDIS_KEYS.campaignScans(campaignId, date)),
          redis.get(REDIS_KEYS.campaignRevenue(campaignId, date))
        ]);

        campaignImpressions += parseInt(impressions || '0');
        campaignScans += parseInt(scans || '0');
        campaignRevenue += parseFloat(revenue || '0');

        // Aggregate hourly patterns
        const hourlyJson = await redis.get(REDIS_KEYS.campaignHourly(campaignId, date));
        if (hourlyJson) {
          try {
            const hourly = JSON.parse(hourlyJson);
            for (const [hour, data] of Object.entries(hourly)) {
              const h = parseInt(hour);
              if (h >= 0 && h < 24 && data) {
                hourlyAggregates[h].impressions += (data as { impressions?: number }).impressions || 0;
                hourlyAggregates[h].scans += (data as { scans?: number }).scans || 0;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Get screen types for this campaign
      for (const screenId of screenIds) {
        if (screenTypeFilter && screenTypeFilter !== 'all') {
          const screenType = await redis.get(REDIS_KEYS.campaignScreenType(screenId));
          if (screenType === screenTypeFilter) {
            campaignScreenTypes.add(screenType);
          }
        } else {
          const screenType = await redis.get(REDIS_KEYS.campaignScreenType(screenId));
          if (screenType) campaignScreenTypes.add(screenType);
        }
      }

      const spend = parseFloat(await redis.get(REDIS_KEYS.campaignSpend(campaignId)) || '0');
      const screenType = campaignScreenTypes.size > 0 ? Array.from(campaignScreenTypes)[0] : 'mixed';

      // Track by screen type
      if (!byScreenType[screenType]) {
        byScreenType[screenType] = { impressions: 0, scans: 0, campaigns: 0, spend: 0 };
      }
      byScreenType[screenType].impressions += campaignImpressions;
      byScreenType[screenType].scans += campaignScans;
      byScreenType[screenType].campaigns++;
      byScreenType[screenType].spend += spend;

      totalImpressions += campaignImpressions;
      totalScans += campaignScans;
      totalSpend += spend;
      totalRevenue += campaignRevenue;

      const conversionRate = safePercentage(campaignScans, campaignImpressions);

      campaignMetrics.push({
        campaignId,
        campaignName: name || `Campaign ${campaignId.slice(0, 8)}`,
        screenType,
        impressions: campaignImpressions,
        qrScans: campaignScans,
        conversionRate,
        spend,
        status: (status as CampaignMetrics['status']) || 'active'
      });
    }

    // Sort by conversion rate
    const sortedCampaigns = [...campaignMetrics].sort((a, b) => b.conversionRate - a.conversionRate);
    const topPerforming = sortedCampaigns.slice(0, 5);
    const lowestPerforming = sortedCampaigns.slice(-5).reverse();

    // Screen type breakdown
    const screenTypeBreakdown = Object.entries(byScreenType).map(([type, data]) => ({
      screenType: type,
      campaignCount: data.campaigns,
      totalImpressions: data.impressions,
      totalScans: data.scans,
      avgConversionRate: safePercentage(data.scans, data.impressions),
      totalSpend: formatCurrency(data.spend),
      cpm: formatCurrency(calculateCPM(data.spend, data.impressions))
    }));

    // Time-of-day patterns
    const timeOfDayPatterns: TimeOfDayPattern[] = hourlyAggregates.map(h => ({
      hour: h.hour,
      impressions: h.impressions,
      scans: h.scans,
      scanRate: safePercentage(h.scans, h.impressions)
    }));

    // Find best performing time windows
    const morningPeak = hourlyAggregates.slice(6, 12).reduce((sum, h) => sum + h.impressions, 0);
    const afternoonPeak = hourlyAggregates.slice(12, 18).reduce((sum, h) => sum + h.impressions, 0);
    const eveningPeak = hourlyAggregates.slice(18, 24).reduce((sum, h) => sum + h.impressions, 0);
    const nightPeak = hourlyAggregates.slice(0, 6).reduce((sum, h) => sum + h.impressions, 0);

    const peakTimeWindows = [
      { window: 'morning', label: '6AM-12PM', impressions: morningPeak },
      { window: 'afternoon', label: '12PM-6PM', impressions: afternoonPeak },
      { window: 'evening', label: '6PM-12AM', impressions: eveningPeak },
      { window: 'night', label: '12AM-6AM', impressions: nightPeak }
    ].sort((a, b) => b.impressions - a.impressions);

    // Calculate network-wide metrics
    const avgConversionRate = safePercentage(totalScans, totalImpressions);
    const networkCPM = calculateCPM(totalSpend, totalImpressions);
    const roi = totalSpend > 0 ? safePercentage(totalRevenue - totalSpend, totalSpend) : 0;

    const analytics = {
      campaigns: sortedCampaigns,
      summary: {
        totalCampaigns: campaignIds.length,
        activeCampaigns: campaignMetrics.filter(c => c.status === 'active').length,
        totalImpressions,
        totalScans,
        avgConversionRate: `${avgConversionRate}%`,
        totalSpend: formatCurrency(totalSpend),
        totalRevenue: formatCurrency(totalRevenue),
        networkCPM: formatCurrency(networkCPM),
        roi: `${roi}%`
      },
      byScreenType: screenTypeBreakdown,
      timeOfDayPatterns,
      peakTimeWindows,
      topPerforming,
      lowestPerforming,
      period: { start: start.toISOString(), end: end.toISOString() },
      meta: {
        daysAnalyzed: dates.length,
        screenTypeFilter: screenTypeFilter || 'all',
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[DOOH ANALYTICS] Campaign analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign analytics'
    });
  }
});

// ============================================
// 4. NETWORK ANALYTICS
// GET /api/dooh/analytics/network
// ============================================

router.get('/network', async (req: Request, res: Response) => {
  try {
    const redis = await getRedisClient();
    const { start, end } = parseDateRange(req);
    const dates = getDateArray(start, end);

    const REDIS_KEYS = {
      screenList: doohKey('screens:list'),
      screenStatus: (screenId: string) => doohKey(`screen:${screenId}:status`),
      screenType: (screenId: string) => doohKey(`screen:${screenId}:type`),
      screenImpressions: (screenId: string, date: string) => doohKey(`screen:${screenId}:impressions:${date}`),
      screenScans: (screenId: string, date: string) => doohKey(`screen:${screenId}:scans:${date}`),
      screenSpend: (screenId: string) => doohKey(`screen:${screenId}:spend`),
      screenRevenue: (screenId: string, date: string) => doohKey(`screen:${screenId}:revenue:${date}`),
      networkBudget: doohKey('network:budget'),
      networkSpend: doohKey('network:spend'),
    };

    // Get all screen IDs
    const screenIds = await redis.smembers(REDIS_KEYS.screenList);

    if (screenIds.length === 0) {
      // Return sample network data
      const sampleNetwork = generateSampleNetwork();
      return res.json({
        success: true,
        data: {
          ...sampleNetwork,
          period: { start: start.toISOString(), end: end.toISOString() },
          meta: {
            daysAnalyzed: dates.length,
            generatedAt: new Date().toISOString()
          }
        }
      });
    }

    // Aggregate network metrics
    let totalImpressions = 0;
    let totalScans = 0;
    let totalSpend = 0;
    let totalRevenue = 0;
    let activeScreens = 0;
    let inactiveScreens = 0;
    let maintenanceScreens = 0;

    const statusBreakdown: Record<string, number> = {};
    const screenTypeBreakdown: Record<string, { count: number; impressions: number; scans: number }> = {};
    const dailyTotals: { date: string; impressions: number; scans: number; scanRate: number; revenue: number }[] = [];

    for (const screenId of screenIds) {
      const [status, screenType] = await Promise.all([
        redis.get(REDIS_KEYS.screenStatus(screenId)),
        redis.get(REDIS_KEYS.screenType(screenId))
      ]);

      // Count status
      const s = status || 'active';
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;

      if (s === 'active') activeScreens++;
      else if (s === 'inactive') inactiveScreens++;
      else if (s === 'maintenance') maintenanceScreens++;

      // Track by screen type
      const type = screenType || 'poster';
      if (!screenTypeBreakdown[type]) {
        screenTypeBreakdown[type] = { count: 0, impressions: 0, scans: 0 };
      }
      screenTypeBreakdown[type].count++;

      // Aggregate daily data
      let screenImpressions = 0;
      let screenScans = 0;
      let screenRevenue = 0;

      for (const date of dates) {
        const [impressions, scans, revenue] = await Promise.all([
          redis.get(REDIS_KEYS.screenImpressions(screenId, date)),
          redis.get(REDIS_KEYS.screenScans(screenId, date)),
          redis.get(REDIS_KEYS.screenRevenue(screenId, date))
        ]);

        screenImpressions += parseInt(impressions || '0');
        screenScans += parseInt(scans || '0');
        screenRevenue += parseFloat(revenue || '0');
      }

      const spend = parseFloat(await redis.get(REDIS_KEYS.screenSpend(screenId)) || '0');

      totalImpressions += screenImpressions;
      totalScans += screenScans;
      totalSpend += spend;
      totalRevenue += screenRevenue;

      screenTypeBreakdown[type].impressions += screenImpressions;
      screenTypeBreakdown[type].scans += screenScans;
    }

    // Calculate daily totals
    for (const date of dates) {
      let dayImpressions = 0;
      let dayScans = 0;
      let dayRevenue = 0;

      for (const screenId of screenIds) {
        const [impressions, scans, revenue] = await Promise.all([
          redis.get(REDIS_KEYS.screenImpressions(screenId, date)),
          redis.get(REDIS_KEYS.screenScans(screenId, date)),
          redis.get(REDIS_KEYS.screenRevenue(screenId, date))
        ]);

        dayImpressions += parseInt(impressions || '0');
        dayScans += parseInt(scans || '0');
        dayRevenue += parseFloat(revenue || '0');
      }

      dailyTotals.push({
        date,
        impressions: dayImpressions,
        scans: dayScans,
        scanRate: safePercentage(dayScans, dayImpressions),
        revenue: dayRevenue
      });
    }

    // Get network budget info
    const networkBudget = parseFloat(await redis.get(REDIS_KEYS.networkBudget) || '0');
    const networkSpend = parseFloat(await redis.get(REDIS_KEYS.networkSpend) || '0');

    // Calculate network metrics
    const networkMetrics: NetworkMetrics = {
      totalScreens: screenIds.length,
      activeScreens,
      inactiveScreens,
      maintenanceScreens,
      totalImpressions,
      totalScans,
      avgScanRate: safePercentage(totalScans, totalImpressions),
      networkCPM: calculateCPM(totalSpend, totalImpressions),
      totalRevenue,
      totalSpend,
      roi: totalSpend > 0 ? safePercentage(totalRevenue - totalSpend, totalSpend) : 0
    };

    // Screen type performance
    const screenTypePerformance = Object.entries(screenTypeBreakdown).map(([type, data]) => ({
      screenType: type,
      screenCount: data.count,
      totalImpressions: data.impressions,
      totalScans: data.scans,
      avgScanRate: safePercentage(data.scans, data.impressions),
      cpm: calculateCPM(
        data.impressions > 0 ? (totalSpend / totalImpressions) * data.impressions : 0,
        data.impressions
      ),
      contribution: safePercentage(data.impressions, totalImpressions)
    })).sort((a, b) => b.avgScanRate - a.avgScanRate);

    // Find peak and low days
    const peakDay = dailyTotals.reduce((max, d) => d.impressions > (max?.impressions || 0) ? d : max, dailyTotals[0]);
    const lowDay = dailyTotals.reduce((min, d) => d.impressions < (min?.impressions || Infinity) ? d : min, dailyTotals[0]);

    // Calculate trends
    const midPoint = Math.floor(dailyTotals.length / 2);
    const firstHalf = dailyTotals.slice(0, midPoint);
    const secondHalf = dailyTotals.slice(midPoint);

    const firstHalfImpressions = firstHalf.reduce((sum, d) => sum + d.impressions, 0);
    const secondHalfImpressions = secondHalf.reduce((sum, d) => sum + d.impressions, 0);
    const impressionTrend = firstHalfImpressions > 0
      ? safePercentage(secondHalfImpressions - firstHalfImpressions, firstHalfImpressions)
      : 0;

    const firstHalfScans = firstHalf.reduce((sum, d) => sum + d.scans, 0);
    const secondHalfScans = secondHalf.reduce((sum, d) => sum + d.scans, 0);
    const scanTrend = firstHalfScans > 0
      ? safePercentage(secondHalfScans - firstHalfScans, firstHalfScans)
      : 0;

    // Budget analysis
    const budgetUtilization = networkBudget > 0 ? safePercentage(networkSpend, networkBudget) : 0;
    const budgetRemaining = networkBudget - networkSpend;

    // Calculate efficiency metrics
    const costPerImpression = totalImpressions > 0 ? totalSpend / totalImpressions : 0;
    const costPerScan = totalScans > 0 ? totalSpend / totalScans : 0;
    const revenuePerImpression = totalImpressions > 0 ? totalRevenue / totalImpressions : 0;
    const revenuePerScan = totalScans > 0 ? totalRevenue / totalScans : 0;

    // Screen health metrics
    const screenHealth = {
      activePercentage: safePercentage(activeScreens, screenIds.length),
      inactivityRate: safePercentage(inactiveScreens, screenIds.length),
      maintenanceRate: safePercentage(maintenanceScreens, screenIds.length),
      healthScore: Math.max(0, 100 - (inactiveScreens * 5) - (maintenanceScreens * 3))
    };

    const analytics = {
      period: { start: start.toISOString(), end: end.toISOString() },
      networkMetrics,
      statusBreakdown,
      screenTypePerformance,
      dailyTotals,
      trends: {
        impressionTrend: `${impressionTrend > 0 ? '+' : ''}${impressionTrend}%`,
        scanTrend: `${scanTrend > 0 ? '+' : ''}${scanTrend}%`,
        direction: impressionTrend > 5 ? 'GROWING' : impressionTrend < -5 ? 'DECLINING' : 'STABLE'
      },
      budget: {
        total: formatCurrency(networkBudget),
        spent: formatCurrency(networkSpend),
        remaining: formatCurrency(budgetRemaining),
        utilization: `${budgetUtilization}%`
      },
      efficiency: {
        costPerImpression: formatCurrency(costPerImpression),
        costPerScan: formatCurrency(costPerScan),
        revenuePerImpression: formatCurrency(revenuePerImpression),
        revenuePerScan: formatCurrency(revenuePerScan)
      },
      screenHealth,
      peakDay: peakDay ? { date: peakDay.date, impressions: peakDay.impressions } : null,
      lowDay: lowDay ? { date: lowDay.date, impressions: lowDay.impressions } : null,
      meta: {
        daysAnalyzed: dates.length,
        avgDailyImpressions: Math.round(totalImpressions / dates.length),
        avgDailyScans: Math.round(totalScans / dates.length),
        generatedAt: new Date().toISOString()
      }
    };

    await redis.quit();

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[DOOH ANALYTICS] Network analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch network analytics'
    });
  }
});

// ============================================
// SAMPLE DATA GENERATORS (for demo/development)
// ============================================

function generateSampleScreens() {
  const screens: ScreenMetrics[] = [
    { screenId: 'scr_001', screenName: 'Times Square Billboard A', location: 'New York, NY', screenType: 'billboard', totalImpressions: 125000, qrScans: 5625, scanRate: 4.5, costPerScan: 0.45, status: 'active' },
    { screenId: 'scr_002', screenName: 'LAX Terminal 1 Kiosk', location: 'Los Angeles, CA', screenType: 'kiosk', totalImpressions: 45000, qrScans: 2700, scanRate: 6.0, costPerScan: 0.35, status: 'active' },
    { screenId: 'scr_003', screenName: 'Chicago Transit Wallboard', location: 'Chicago, IL', screenType: 'wallboard', totalImpressions: 89000, qrScans: 3560, scanRate: 4.0, costPerScan: 0.55, status: 'active' },
    { screenId: 'scr_004', screenName: 'Miami Beach Poster', location: 'Miami, FL', screenType: 'poster', totalImpressions: 32000, qrScans: 960, scanRate: 3.0, costPerScan: 0.62, status: 'active' },
    { screenId: 'scr_005', screenName: 'SF Transit Billboard', location: 'San Francisco, CA', screenType: 'billboard', totalImpressions: 78000, qrScans: 3900, scanRate: 5.0, costPerScan: 0.40, status: 'maintenance' },
    { screenId: 'scr_006', screenName: 'Seattle Mall Kiosk', location: 'Seattle, WA', screenType: 'kiosk', totalImpressions: 28000, qrScans: 1400, scanRate: 5.0, costPerScan: 0.50, status: 'active' },
    { screenId: 'scr_007', screenName: 'Denver Transit Poster', location: 'Denver, CO', screenType: 'poster', totalImpressions: 22000, qrScans: 660, scanRate: 3.0, costPerScan: 0.70, status: 'inactive' },
    { screenId: 'scr_008', screenName: 'Boston Hub Wallboard', location: 'Boston, MA', screenType: 'wallboard', totalImpressions: 65000, qrScans: 2925, scanRate: 4.5, costPerScan: 0.48, status: 'active' }
  ];

  const totalImpressions = screens.reduce((sum, s) => sum + s.totalImpressions, 0);
  const totalScans = screens.reduce((sum, s) => sum + s.qrScans, 0);
  const avgScanRate = safePercentage(totalScans, totalImpressions);
  const totalSpend = totalScans * 0.45;
  const totalRevenue = totalSpend * 2.5;

  return {
    screens: screens.sort((a, b) => b.scanRate - a.scanRate),
    summary: {
      totalScreens: screens.length,
      activeScreens: screens.filter(s => s.status === 'active').length,
      totalImpressions,
      totalScans,
      avgScanRate: `${avgScanRate}%`,
      avgCostPerScan: '$0.48',
      networkCPM: '$3.84',
      totalRevenue: `$${totalRevenue.toFixed(2)}`,
      totalSpend: `$${totalSpend.toFixed(2)}`,
      roi: `${safePercentage(totalRevenue - totalSpend, totalSpend)}%`
    },
    topPerforming: screens.slice(0, 3),
    lowestPerforming: screens.slice(-3).reverse(),
    byScreenType: [
      { screenType: 'billboard', screenCount: 2, totalImpressions: 203000, totalScans: 9525, avgScanRate: 4.69 },
      { screenType: 'kiosk', screenCount: 2, totalImpressions: 73000, totalScans: 4100, avgScanRate: 5.62 },
      { screenType: 'wallboard', screenCount: 2, totalImpressions: 154000, totalScans: 6485, avgScanRate: 4.21 },
      { screenType: 'poster', screenCount: 2, totalImpressions: 54000, totalScans: 1620, avgScanRate: 3.0 }
    ]
  };
}

function generateSampleCampaigns() {
  const campaigns: CampaignMetrics[] = [
    { campaignId: 'cmp_001', campaignName: 'Summer Sale 2026', screenType: 'billboard', impressions: 250000, qrScans: 11250, conversionRate: 4.5, spend: 5000, status: 'active' },
    { campaignId: 'cmp_002', campaignName: 'New Product Launch', screenType: 'kiosk', impressions: 85000, qrScans: 5100, conversionRate: 6.0, spend: 3000, status: 'active' },
    { campaignId: 'cmp_003', campaignName: 'Brand Awareness Q2', screenType: 'wallboard', impressions: 180000, qrScans: 8100, conversionRate: 4.5, spend: 4500, status: 'active' },
    { campaignId: 'cmp_004', campaignName: 'Flash Sale Weekend', screenType: 'poster', impressions: 65000, qrScans: 1950, conversionRate: 3.0, spend: 1500, status: 'completed' },
    { campaignId: 'cmp_005', campaignName: 'Holiday Special', screenType: 'billboard', impressions: 120000, qrScans: 6000, conversionRate: 5.0, spend: 3500, status: 'paused' },
    { campaignId: 'cmp_006', campaignName: 'Spring Collection', screenType: 'kiosk', impressions: 45000, qrScans: 2700, conversionRate: 6.0, spend: 1800, status: 'active' }
  ];

  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalScans = campaigns.reduce((sum, c) => sum + c.qrScans, 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalRevenue = totalSpend * 2.5;

  return {
    campaigns: campaigns.sort((a, b) => b.conversionRate - a.conversionRate),
    summary: {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      totalImpressions,
      totalScans,
      avgConversionRate: `${safePercentage(totalScans, totalImpressions)}%`,
      totalSpend: formatCurrency(totalSpend),
      totalRevenue: formatCurrency(totalRevenue),
      networkCPM: formatCurrency(calculateCPM(totalSpend, totalImpressions)),
      roi: `${safePercentage(totalRevenue - totalSpend, totalSpend)}%`
    },
    byScreenType: [
      { screenType: 'billboard', campaignCount: 2, totalImpressions: 370000, totalScans: 17250, avgConversionRate: 4.66, totalSpend: '$8,500', cpm: '$22.97' },
      { screenType: 'kiosk', campaignCount: 2, totalImpressions: 130000, totalScans: 7800, avgConversionRate: 6.0, totalSpend: '$4,800', cpm: '$36.92' },
      { screenType: 'wallboard', campaignCount: 1, totalImpressions: 180000, totalScans: 8100, avgConversionRate: 4.5, totalSpend: '$4,500', cpm: '$25.00' },
      { screenType: 'poster', campaignCount: 1, totalImpressions: 65000, totalScans: 1950, avgConversionRate: 3.0, totalSpend: '$1,500', cpm: '$23.08' }
    ],
    timeOfDayPatterns: [
      { hour: 6, impressions: 15000, scans: 750, scanRate: 5.0 },
      { hour: 9, impressions: 45000, scans: 2250, scanRate: 5.0 },
      { hour: 12, impressions: 65000, scans: 3575, scanRate: 5.5 },
      { hour: 15, impressions: 55000, scans: 3025, scanRate: 5.5 },
      { hour: 18, impressions: 75000, scans: 4125, scanRate: 5.5 },
      { hour: 21, impressions: 40000, scans: 2000, scanRate: 5.0 }
    ],
    topPerforming: campaigns.slice(0, 3),
    lowestPerforming: campaigns.slice(-3).reverse()
  };
}

function generateSampleNetwork() {
  const totalScreens = 150;
  const activeScreens = 128;
  const inactiveScreens = 15;
  const maintenanceScreens = 7;
  const totalImpressions = 2450000;
  const totalScans = 117600;
  const totalSpend = 45000;
  const totalRevenue = 112500;

  return {
    networkMetrics: {
      totalScreens,
      activeScreens,
      inactiveScreens,
      maintenanceScreens,
      totalImpressions,
      totalScans,
      avgScanRate: safePercentage(totalScans, totalImpressions),
      networkCPM: calculateCPM(totalSpend, totalImpressions),
      totalRevenue,
      totalSpend,
      roi: safePercentage(totalRevenue - totalSpend, totalSpend)
    },
    statusBreakdown: {
      active: activeScreens,
      inactive: inactiveScreens,
      maintenance: maintenanceScreens
    },
    screenTypePerformance: [
      { screenType: 'kiosk', screenCount: 35, totalImpressions: 520000, totalScans: 31200, avgScanRate: 6.0, cpm: 32.31, contribution: 21.22 },
      { screenType: 'billboard', screenCount: 45, totalImpressions: 980000, totalScans: 46040, avgScanRate: 4.7, cpm: 18.37, contribution: 40.0 },
      { screenType: 'wallboard', screenCount: 40, totalImpressions: 650000, totalScans: 27300, avgScanRate: 4.2, cpm: 27.69, contribution: 26.53 },
      { screenType: 'transit', screenCount: 20, totalImpressions: 180000, totalScans: 8100, avgScanRate: 4.5, cpm: 20.0, contribution: 7.35 },
      { screenType: 'poster', screenCount: 10, totalImpressions: 120000, totalScans: 3960, avgScanRate: 3.3, cpm: 15.0, contribution: 4.9 }
    ],
    trends: {
      impressionTrend: '+8.5%',
      scanTrend: '+12.3%',
      direction: 'GROWING'
    },
    budget: {
      total: '$75,000',
      spent: '$45,000',
      remaining: '$30,000',
      utilization: '60%'
    },
    efficiency: {
      costPerImpression: '$0.018',
      costPerScan: '$0.38',
      revenuePerImpression: '$0.046',
      revenuePerScan: '$0.96'
    },
    screenHealth: {
      activePercentage: 85.33,
      inactivityRate: 10.0,
      maintenanceRate: 4.67,
      healthScore: 88
    },
    peakDay: { date: '2026-05-01', impressions: 385000 },
    lowDay: { date: '2026-04-30', impressions: 285000 }
  };
}

export default router;
