import { v4 as uuidv4 } from 'uuid';
import {
  CohortRequest,
  CohortPeriod,
  CohortType,
  CohortRow,
  CohortDataPoint,
  CohortGridSchema,
  UserActivity,
  CohortDefinition,
  RetentionCurve,
  ICohortDefinition,
  IUserActivity,
  IRetentionCurve,
  SegmentComparisonResult,
} from '../models/Cohort';
import {
  getPeriodStart,
  getPeriodEnd,
  getPeriodsBetween,
  formatPeriodLabel,
  calculateRetentionRate,
  calculateRetentionWithConfidence,
  calculateARPU,
  calculateTimeToConvert,
  compareSegments,
  calculateRetentionStats,
  fitExponentialDecay,
  predictRetention,
} from './retentionEngine';
import { startOfDay, endOfDay, differenceInDays, format } from 'date-fns';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

// ============= Cohort Grid Generation =============

export interface GenerateCohortGridOptions {
  request: CohortRequest;
  userActivities: IUserActivity[];
  maxPeriods?: number;
}

export async function generateCohortGrid(options: GenerateCohortGridOptions): Promise<{
  id: string;
  name: string;
  type: CohortType;
  period: CohortPeriod;
  cohorts: CohortRow[];
  maxPeriods: number;
  generatedAt: string;
  metadata?: {
    totalUsers: number;
    averageRetentionRate: number;
    averageRevenuePerUser?: number;
    topPerformingCohort?: string;
    worstPerformingCohort?: string;
  };
}> {
  const { request, userActivities, maxPeriods = 12 } = options;

  const gridId = uuidv4();
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);

  // Group activities by cohort
  const cohortGroups = new Map<string, IUserActivity[]>();
  const userFirstActivity = new Map<string, IUserActivity>();

  for (const activity of userActivities) {
    const cohortKey = getPeriodStart(activity.cohortDate, request.period).toISOString();

    if (!cohortGroups.has(cohortKey)) {
      cohortGroups.set(cohortKey, []);
    }
    cohortGroups.get(cohortKey)!.push(activity);

    // Track first activity per user for conversion tracking
    if (!userFirstActivity.has(activity.userId)) {
      userFirstActivity.set(activity.userId, activity);
    }
  }

  // Generate cohort rows
  const cohorts: CohortRow[] = [];
  const retentionRates: { cohortLabel: string; rate: number }[] = [];

  for (const [cohortKey, activities] of cohortGroups) {
    const cohortDate = new Date(cohortKey);
    const cohortLabel = formatPeriodLabel(cohortDate, request.period);

    // Count unique users in this cohort
    const uniqueUsers = new Set(activities.map(a => a.userId));
    const initialSize = uniqueUsers.size;

    if (initialSize === 0) continue;

    // Calculate metrics per period
    const dataPoints = calculateCohortDataPoints({
      activities,
      initialSize,
      cohortDate,
      period: request.period,
      maxPeriods,
      endDate,
      type: request.type,
    });

    // Calculate period 0 retention (always 100%)
    const period0Retention = calculateRetentionRate(dataPoints[0]?.retainedUsers || initialSize, initialSize);

    cohorts.push({
      cohortId: uuidv4(),
      cohortDate: cohortKey,
      cohortLabel,
      initialSize,
      dataPoints,
    });

    // Track for metadata
    const finalRetention = dataPoints[dataPoints.length - 1]?.retentionRate || 0;
    retentionRates.push({ cohortLabel, rate: finalRetention });
  }

  // Sort cohorts by date
  cohorts.sort((a, b) => new Date(a.cohortDate).getTime() - new Date(b.cohortDate).getTime());

  // Calculate metadata
  const totalUsers = cohorts.reduce((sum, c) => sum + c.initialSize, 0);
  const avgRetention = cohorts.length > 0
    ? cohorts.reduce((sum, c) => {
        const finalPoint = c.dataPoints[c.dataPoints.length - 1];
        return sum + (finalPoint?.retentionRate || 0);
      }, 0) / cohorts.length
    : 0;

  // Find top/worst performing cohorts
  retentionRates.sort((a, b) => b.rate - a.rate);
  const topPerforming = retentionRates[0]?.cohortLabel;
  const worstPerforming = retentionRates[retentionRates.length - 1]?.cohortLabel;

  const totalRevenue = userActivities.reduce((sum, a) => sum + a.revenue, 0);
  const avgRevenuePerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;

  return {
    id: gridId,
    name: request.name,
    type: request.type,
    period: request.period,
    cohorts,
    maxPeriods,
    generatedAt: new Date().toISOString(),
    metadata: {
      totalUsers,
      averageRetentionRate: Math.round(avgRetention * 100) / 100,
      averageRevenuePerUser: Math.round(avgRevenuePerUser * 100) / 100,
      topPerformingCohort: topPerforming,
      worstPerformingCohort: worstPerforming,
    },
  };
}

interface CalculateDataPointsOptions {
  activities: IUserActivity[];
  initialSize: number;
  cohortDate: Date;
  period: CohortPeriod;
  maxPeriods: number;
  endDate: Date;
  type: CohortType;
}

function calculateCohortDataPoints(options: CalculateDataPointsOptions): CohortDataPoint[] {
  const {
    activities,
    initialSize,
    cohortDate,
    period,
    maxPeriods,
    endDate,
    type,
  } = options;

  const dataPoints: CohortDataPoint[] = [];

  // Group activities by period
  const periodActivities = new Map<number, Set<string>>();
  const periodRevenue = new Map<number, number>();
  const periodConversions = new Map<number, number>();

  for (let i = 0; i <= maxPeriods; i++) {
    periodActivities.set(i, new Set());
    periodRevenue.set(i, 0);
    periodConversions.set(i, 0);
  }

  for (const activity of activities) {
    const activityPeriodStart = getPeriodStart(activity.cohortDate, period);
    const cohortPeriodStart = getPeriodStart(cohortDate, period);
    const periodIndex = getPeriodsBetween(cohortPeriodStart, activityPeriodStart, period);

    if (periodIndex >= 0 && periodIndex <= maxPeriods) {
      periodActivities.get(periodIndex)!.add(activity.userId);
      periodRevenue.set(
        periodIndex,
        (periodRevenue.get(periodIndex) || 0) + activity.revenue
      );
      periodConversions.set(
        periodIndex,
        (periodConversions.get(periodIndex) || 0) + activity.conversions
      );
    }
  }

  // Build data points
  let cumulativeActiveUsers = 0;

  for (let i = 0; i <= maxPeriods; i++) {
    const periodDate = new Date(cohortDate);
    switch (period) {
      case 'daily':
        periodDate.setDate(periodDate.getDate() + i);
        break;
      case 'weekly':
        periodDate.setDate(periodDate.getDate() + i * 7);
        break;
      case 'monthly':
        periodDate.setMonth(periodDate.getMonth() + i);
        break;
    }

    const activeUsers = periodActivities.get(i)?.size || 0;
    const retainedUsers = activeUsers;
    const revenue = periodRevenue.get(i) || 0;
    const conversions = periodConversions.get(i) || 0;

    // For period > 0, retention is based on users still active in this period
    // For period 0, it's always 100% (the acquisition period)
    const retentionRate = i === 0
      ? 100
      : calculateRetentionRate(activeUsers, initialSize);

    const arpu = activeUsers > 0 ? calculateARPU(revenue, activeUsers) : 0;

    dataPoints.push({
      periodIndex: i,
      periodLabel: formatPeriodLabel(periodDate, period),
      activeUsers,
      retainedUsers,
      retentionRate,
      revenue,
      averageRevenuePerUser: arpu,
      conversions,
      conversionRate: initialSize > 0
        ? (conversions / initialSize) * 100
        : 0,
    });
  }

  return dataPoints;
}

// ============= Retention Curve Generation =============

export async function generateRetentionCurve(
  cohortType: CohortType,
  period: CohortPeriod,
  segmentId?: string
): Promise<{
  curvePoints: Array<{
    periodIndex: number;
    retentionRate: number;
    lowerConfidence: number;
    upperConfidence: number;
    sampleSize: number;
  }>;
  model: {
    r0: number;
    lambda: number;
    rSquared: number;
  };
  stats: {
    averageRetention: number;
    medianRetention: number;
    maxDrop: number;
    stabilizationPeriod: number;
  };
}> {
  const query: Record<string, unknown> = { cohortType, period };
  if (segmentId) {
    query.segmentId = segmentId;
  }

  const curves = await RetentionCurve.find(query).sort({ periodIndex: 1 }).lean();

  if (curves.length === 0) {
    return {
      curvePoints: [],
      model: { r0: 100, lambda: 0.1, rSquared: 0 },
      stats: {
        averageRetention: 0,
        medianRetention: 0,
        maxDrop: 0,
        stabilizationPeriod: 0,
      },
    };
  }

  const curvePoints = curves.map(c => ({
    periodIndex: c.periodIndex,
    retentionRate: c.retentionRate,
    lowerConfidence: c.confidenceInterval.lower,
    upperConfidence: c.confidenceInterval.upper,
    sampleSize: c.sampleSize,
  }));

  const model = fitExponentialDecay(curvePoints);
  const stats = calculateRetentionStats(curvePoints);

  return { curvePoints, model, stats };
}

// ============= Revenue Cohorting =============

export interface RevenueCohortResult {
  cohortDate: string;
  cohortLabel: string;
  cohortSize: number;
  period0Revenue: number;
  period0ARPU: number;
  cumulativeRevenue: number;
  cumulativeARPU: number;
  revenueRetentionRate: number;
}

export async function calculateRevenueCohorts(
  startDate: Date,
  endDate: Date,
  period: CohortPeriod,
  maxPeriods: number = 6
): Promise<RevenueCohortResult[]> {
  const activities = await UserActivity.find({
    cohortDate: { $gte: startDate, $lte: endDate },
    period,
  }).lean();

  // Group by cohort
  const cohortGroups = new Map<string, IUserActivity[]>();
  for (const activity of activities) {
    const cohortKey = getPeriodStart(activity.cohortDate, period).toISOString();
    if (!cohortGroups.has(cohortKey)) {
      cohortGroups.set(cohortKey, []);
    }
    cohortGroups.get(cohortKey)!.push(activity);
  }

  const results: RevenueCohortResult[] = [];

  for (const [cohortKey, cohortActivities] of cohortGroups) {
    const cohortDate = new Date(cohortKey);
    const uniqueUsers = new Set(cohortActivities.map(a => a.userId));
    const cohortSize = uniqueUsers.size;

    if (cohortSize === 0) continue;

    // Calculate revenue per period
    const periodRevenue = new Map<number, number>();
    for (let i = 0; i <= maxPeriods; i++) {
      periodRevenue.set(i, 0);
    }

    for (const activity of cohortActivities) {
      const activityPeriodStart = getPeriodStart(activity.cohortDate, period);
      const cohortPeriodStart = getPeriodStart(cohortDate, period);
      const periodIndex = getPeriodsBetween(cohortPeriodStart, activityPeriodStart, period);

      if (periodIndex >= 0 && periodIndex <= maxPeriods) {
        periodRevenue.set(
          periodIndex,
          (periodRevenue.get(periodIndex) || 0) + activity.revenue
        );
      }
    }

    const period0Revenue = periodRevenue.get(0) || 0;
    const period0ARPU = cohortSize > 0 ? period0Revenue / cohortSize : 0;

    let cumulativeRevenue = 0;
    for (let i = 0; i <= maxPeriods; i++) {
      cumulativeRevenue += periodRevenue.get(i) || 0;
    }
    const cumulativeARPU = cohortSize > 0 ? cumulativeRevenue / cohortSize : 0;

    // Revenue retention: what percentage of period 0 revenue is maintained?
    const revenueRetentionRate = period0Revenue > 0
      ? (cumulativeRevenue / ((maxPeriods + 1) * period0Revenue)) * 100
      : 0;

    results.push({
      cohortDate: cohortKey,
      cohortLabel: formatPeriodLabel(cohortDate, period),
      cohortSize,
      period0Revenue: Math.round(period0Revenue * 100) / 100,
      period0ARPU: Math.round(period0ARPU * 100) / 100,
      cumulativeRevenue: Math.round(cumulativeRevenue * 100) / 100,
      cumulativeARPU: Math.round(cumulativeARPU * 100) / 100,
      revenueRetentionRate: Math.round(revenueRetentionRate * 100) / 100,
    });
  }

  return results.sort((a, b) => new Date(a.cohortDate).getTime() - new Date(b.cohortDate).getTime());
}

// ============= Time-to-Convert Analysis =============

export async function analyzeTimeToConvert(
  startDate: Date,
  endDate: Date
): Promise<{
  medianDays: number;
  meanDays: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  distribution: Record<number, number>;
  totalUsers: number;
  convertedUsers: number;
  conversionRate: number;
}> {
  const activities = await UserActivity.find({
    cohortDate: { $gte: startDate, $lte: endDate },
    conversions: { $gt: 0 },
  }).lean();

  const userFirstActivity = new Map<string, IUserActivity>();
  const userConversionDate = new Map<string, Date>();

  // Get all activities to find first activity and conversion
  const allActivities = await UserActivity.find({
    cohortDate: { $gte: startDate, $lte: endDate },
  }).lean();

  for (const activity of allActivities) {
    if (!userFirstActivity.has(activity.userId)) {
      userFirstActivity.set(activity.userId, activity);
    }
    if (activity.conversions > 0) {
      const existing = userConversionDate.get(activity.userId);
      if (!existing || activity.activityDate < existing) {
        userConversionDate.set(activity.userId, activity.activityDate);
      }
    }
  }

  return calculateTimeToConvert(userConversionDate, userFirstActivity);
}

// ============= Segment Comparison =============

export async function compareSegmentsByRetention(
  startDate: Date,
  endDate: Date,
  period: CohortPeriod,
  segmentIds: string[]
): Promise<SegmentComparisonResult[]> {
  const segmentData = new Map<string, {
    cohortSize: number;
    retentionByPeriod: Map<number, number>;
    revenue: number;
    conversions: number;
  }>();

  for (const segmentId of segmentIds) {
    segmentData.set(segmentId, {
      cohortSize: 0,
      retentionByPeriod: new Map(),
      revenue: 0,
      conversions: 0,
    });
  }

  const activities = await UserActivity.find({
    cohortDate: { $gte: startDate, $lte: endDate },
    segmentId: { $in: segmentIds },
    period,
  }).lean();

  // Group by segment
  const segmentActivities = new Map<string, IUserActivity[]>();
  for (const activity of activities) {
    if (!segmentActivities.has(activity.segmentId || '')) {
      segmentActivities.set(activity.segmentId || '', []);
    }
    segmentActivities.get(activity.segmentId || '')!.push(activity);
  }

  for (const [segmentId, segActivities] of segmentActivities) {
    if (!segmentData.has(segmentId)) continue;

    const data = segmentData.get(segmentId)!;

    // Group by cohort
    const cohortGroups = new Map<string, Set<string>>();
    for (const activity of segActivities) {
      const cohortKey = getPeriodStart(activity.cohortDate, period).toISOString();
      if (!cohortGroups.has(cohortKey)) {
        cohortGroups.set(cohortKey, new Set());
      }
      cohortGroups.get(cohortKey)!.add(activity.userId);
    }

    // Calculate retention per cohort period
    let totalRetentionRate = 0;
    let retentionCount = 0;

    for (const [, users] of cohortGroups) {
      data.cohortSize += users.size;
    }

    for (const [cohortKey, users] of cohortGroups) {
      const cohortDate = new Date(cohortKey);
      const retentionByPeriod = new Map<number, Set<string>>();

      // Find all users active in each period
      for (const activity of segActivities) {
        const activityCohort = getPeriodStart(activity.cohortDate, period).toISOString();
        if (activityCohort !== cohortKey) continue;

        const activityPeriodStart = getPeriodStart(activity.cohortDate, period);
        const cohortPeriodStart = getPeriodStart(cohortDate, period);
        const periodIndex = getPeriodsBetween(cohortPeriodStart, activityPeriodStart, period);

        if (periodIndex >= 0 && periodIndex <= 12) {
          if (!retentionByPeriod.has(periodIndex)) {
            retentionByPeriod.set(periodIndex, new Set());
          }
          retentionByPeriod.get(periodIndex)!.add(activity.userId);
        }
      }

      // Calculate retention rates
      for (const [periodIndex, periodUsers] of retentionByPeriod) {
        const retentionRate = calculateRetentionRate(periodUsers.size, users.size);
        data.retentionByPeriod.set(
          periodIndex,
          (data.retentionByPeriod.get(periodIndex) || 0) + retentionRate
        );
        if (periodIndex > 0) {
          totalRetentionRate += retentionRate;
          retentionCount++;
        }
      }
    }

    // Calculate averages
    for (const [periodIndex, totalRate] of data.retentionByPeriod) {
      const avgRate = totalRate / Math.max(1, retentionCount);
      data.retentionByPeriod.set(periodIndex, avgRate);
    }

    // Sum revenue and conversions
    for (const activity of segActivities) {
      data.revenue += activity.revenue;
      data.conversions += activity.conversions;
    }
  }

  return compareSegments(segmentData);
}

// ============= Export Functions =============

export async function exportCohortAsCSV(gridId: string): Promise<string> {
  const { CohortGrid } = await import('../models/Cohort');

  // Note: In production, this would fetch from cache/database
  // For now, return headers as placeholder
  return 'cohort_date,period_0,period_1,period_2,period_3,period_4,period_5\n';
}

export async function exportCohortAsJSON(gridId: string): Promise<string> {
  // Placeholder for JSON export
  return JSON.stringify({ gridId, exportedAt: new Date().toISOString() });
}

// ============= Cohort Definition CRUD =============

export async function createCohortDefinition(request: CohortRequest): Promise<ICohortDefinition> {
  const definition = new CohortDefinition({
    name: request.name,
    type: request.type,
    period: request.period,
    startDate: new Date(request.startDate),
    endDate: new Date(request.endDate),
    segmentIds: request.segmentIds || [],
    metrics: request.metrics || ['users'],
  });

  await definition.save();
  return definition;
}

export async function getCohortDefinition(id: string): Promise<ICohortDefinition | null> {
  return CohortDefinition.findById(id).lean();
}

export async function listCohortDefinitions(
  filters: {
    type?: CohortType;
    period?: CohortPeriod;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<ICohortDefinition[]> {
  const query: Record<string, unknown> = {};

  if (filters.type) query.type = filters.type;
  if (filters.period) query.period = filters.period;
  if (filters.startDate) query.startDate = { $gte: filters.startDate };
  if (filters.endDate) query.endDate = { $lte: filters.endDate };

  return CohortDefinition.find(query).sort({ createdAt: -1 }).lean();
}

export async function deleteCohortDefinition(id: string): Promise<boolean> {
  const result = await CohortDefinition.findByIdAndDelete(id);
  return result !== null;
}

// ============= Retention Curve Storage =============

export async function storeRetentionCurvePoint(
  cohortType: CohortType,
  period: CohortPeriod,
  cohortDate: Date,
  periodIndex: number,
  retainedUsers: number,
  initialUsers: number,
  segmentId?: string
): Promise<IRetentionCurve> {
  const { lower, upper } = calculateRetentionWithConfidence(retainedUsers, initialUsers);

  const curvePoint = new RetentionCurve({
    cohortType,
    period,
    cohortDate,
    periodIndex,
    retentionRate: calculateRetentionRate(retainedUsers, initialUsers),
    confidenceInterval: { lower, upper },
    sampleSize: initialUsers,
    segmentId,
  });

  await curvePoint.save();
  return curvePoint;
}
