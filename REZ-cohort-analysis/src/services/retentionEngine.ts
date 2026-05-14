import Decimal from 'decimal.js';
import {
  CohortPeriod,
  CohortType,
  RetentionCurvePoint,
  TimeToConvertResult,
  SegmentComparisonResult,
} from '../models/Cohort';

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Retention Engine - Core mathematical operations for cohort analysis
 * All calculations use Decimal.js for financial precision
 */

// ============= Period Calculations =============

export function getPeriodStart(date: Date, period: CohortPeriod): Date {
  const d = new Date(date);

  switch (period) {
    case 'daily':
      d.setHours(0, 0, 0, 0);
      break;
    case 'weekly':
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }

  return d;
}

export function getPeriodEnd(date: Date, period: CohortPeriod): Date {
  const d = new Date(date);

  switch (period) {
    case 'daily':
      d.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      const day = d.getDay();
      const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
      d.setDate(diff);
      d.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      d.setTime(lastDay.getTime());
      break;
  }

  return d;
}

export function getPeriodsBetween(start: Date, end: Date, period: CohortPeriod): number {
  const startPeriod = getPeriodStart(start, period);
  const endPeriod = getPeriodStart(end, period);

  switch (period) {
    case 'daily':
      return Math.floor((endPeriod.getTime() - startPeriod.getTime()) / (1000 * 60 * 60 * 24));
    case 'weekly':
      return Math.floor((endPeriod.getTime() - startPeriod.getTime()) / (1000 * 60 * 60 * 24 * 7));
    case 'monthly':
      return (
        (endPeriod.getFullYear() - startPeriod.getFullYear()) * 12 +
        (endPeriod.getMonth() - startPeriod.getMonth())
      );
  }
}

export function formatPeriodLabel(date: Date, period: CohortPeriod): string {
  const year = date.getFullYear();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const week = Math.ceil((day + new Date(year, date.getMonth(), 1).getDay()) / 7);

  switch (period) {
    case 'daily':
      return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'weekly':
      return `${year}-W${String(week).padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month}`;
  }
}

// ============= Retention Calculations =============

/**
 * Calculate retention rate as a percentage
 * Formula: (Retained Users / Initial Cohort Size) * 100
 */
export function calculateRetentionRate(retainedUsers: number, initialUsers: number): number {
  if (initialUsers === 0) return 0;

  const rate = new Decimal(retainedUsers)
    .dividedBy(initialUsers)
    .times(100)
    .toDecimalPlaces(2)
    .toNumber();

  return Math.min(100, Math.max(0, rate));
}

/**
 * Calculate weighted average retention rate across cohorts
 */
export function calculateWeightedRetention(rates: number[], weights: number[]): number {
  if (rates.length !== weights.length || rates.length === 0) {
    return 0;
  }

  let weightedSum = new Decimal(0);
  let totalWeight = new Decimal(0);

  for (let i = 0; i < rates.length; i++) {
    const weight = new Decimal(weights[i]);
    weightedSum = weightedSum.plus(new Decimal(rates[i]).times(weight));
    totalWeight = totalWeight.plus(weight);
  }

  if (totalWeight.isZero()) return 0;

  return weightedSum.dividedBy(totalWeight).toDecimalPlaces(2).toNumber();
}

/**
 * Calculate retention with confidence interval using Wilson score
 * Provides statistical confidence bounds for retention rates
 */
export function calculateRetentionWithConfidence(
  retainedUsers: number,
  initialUsers: number,
  confidenceLevel: number = 0.95
): { rate: number; lower: number; upper: number } {
  if (initialUsers === 0) {
    return { rate: 0, lower: 0, upper: 0 };
  }

  const rate = calculateRetentionRate(retainedUsers, initialUsers);

  // Wilson score interval for proportion confidence
  const z = confidenceLevel === 0.99 ? 2.576 : confidenceLevel === 0.95 ? 1.96 : 1.645;
  const p = rate / 100;
  const n = initialUsers;

  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

  const lower = Math.max(0, ((center - spread) / denominator) * 100);
  const upper = Math.min(100, ((center + spread) / denominator) * 100);

  return {
    rate,
    lower: new Decimal(lower).toDecimalPlaces(2).toNumber(),
    upper: new Decimal(upper).toDecimalPlaces(2).toNumber(),
  };
}

// ============= Revenue Calculations =============

/**
 * Calculate Average Revenue Per User (ARPU)
 * Formula: Total Revenue / Active Users
 */
export function calculateARPU(totalRevenue: number, activeUsers: number): number {
  if (activeUsers === 0) return 0;

  const arpu = new Decimal(totalRevenue).dividedBy(activeUsers).toDecimalPlaces(2).toNumber();
  return Math.max(0, arpu);
}

/**
 * Calculate Cumulative ARPU over retention periods
 */
export function calculateCumulativeARPU(
  revenues: number[],
  cohortSizes: number[]
): { periodIndex: number; cumulativeARPU: number }[] {
  if (revenues.length !== cohortSizes.length) {
    throw new Error('Revenues and cohort sizes must have the same length');
  }

  const results: { periodIndex: number; cumulativeARPU: number }[] = [];
  let cumulativeRevenue = new Decimal(0);
  let totalUsers = 0;

  for (let i = 0; i < revenues.length; i++) {
    cumulativeRevenue = cumulativeRevenue.plus(revenues[i]);
    totalUsers += cohortSizes[i];

    const cumulativeARPU = totalUsers > 0
      ? cumulativeRevenue.dividedBy(totalUsers).toDecimalPlaces(2).toNumber()
      : 0;

    results.push({ periodIndex: i, cumulativeARPU });
  }

  return results;
}

/**
 * Calculate Lifetime Value based on retention and revenue
 * LTV = ARPU * Average Lifespan
 */
export function calculateLTV(
  arpu: number,
  monthlyChurnRate: number
): number {
  if (monthlyChurnRate >= 1 || monthlyChurnRate < 0) {
    return arpu * 12; // Default to annual if churn rate is invalid
  }

  // LTV = ARPU / Churn Rate (simplified model)
  const retentionRate = 1 - monthlyChurnRate;
  const averageLifespan = 1 / monthlyChurnRate;

  const ltv = new Decimal(arpu)
    .times(averageLifespan)
    .toDecimalPlaces(2)
    .toNumber();

  return Math.max(0, ltv);
}

// ============= Time-to-Convert Calculations =============

/**
 * Calculate time-to-convert statistics
 * Measures how long users take to convert from first activity
 */
export function calculateTimeToConvert(
  conversionDates: Map<string, Date>,
  acquisitionDates: Map<string, Date>
): TimeToConvertResult {
  const timeToConverts: number[] = [];
  const distribution: Record<number, number> = {};
  let totalDays = 0;

  for (const [userId, conversionDate] of conversionDates) {
    const acquisitionDate = acquisitionDates.get(userId);
    if (!acquisitionDate) continue;

    const days = Math.floor(
      (conversionDate.getTime() - acquisitionDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    timeToConverts.push(days);
    totalDays += days;

    // Group into weekly buckets
    const bucket = Math.floor(days / 7);
    distribution[bucket] = (distribution[bucket] || 0) + 1;
  }

  if (timeToConverts.length === 0) {
    return {
      medianDays: 0,
      meanDays: 0,
      percentile25: 0,
      percentile75: 0,
      percentile90: 0,
      distribution: {},
      totalUsers: acquisitionDates.size,
      convertedUsers: 0,
      conversionRate: 0,
    };
  }

  timeToConverts.sort((a, b) => a - b);

  const n = timeToConverts.length;
  const convertedUsers = timeToConverts.length;
  const totalUsers = acquisitionDates.size;

  return {
    medianDays: percentile(timeToConverts, 50),
    meanDays: new Decimal(totalDays).dividedBy(n).toDecimalPlaces(1).toNumber(),
    percentile25: percentile(timeToConverts, 25),
    percentile75: percentile(timeToConverts, 75),
    percentile90: percentile(timeToConverts, 90),
    distribution,
    totalUsers,
    convertedUsers,
    conversionRate: new Decimal(convertedUsers)
      .dividedBy(totalUsers)
      .times(100)
      .toDecimalPlaces(2)
      .toNumber(),
  };
}

function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;

  const index = (p / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;

  if (lower === upper) {
    return sortedArray[lower];
  }

  return new Decimal(sortedArray[lower])
    .times(1 - fraction)
    .plus(new Decimal(sortedArray[upper]).times(fraction))
    .toDecimalPlaces(1)
    .toNumber();
}

// ============= Segment Comparison =============

/**
 * Compare retention metrics across segments
 */
export function compareSegments(
  segmentData: Map<string, { cohortSize: number; retentionByPeriod: Map<number, number>; revenue: number; conversions: number }>
): SegmentComparisonResult[] {
  const results: SegmentComparisonResult[] = [];

  for (const [segmentId, data] of segmentData) {
    const retentionRates: number[] = [];
    const retentionByPeriod: Record<number, number> = {};

    for (const [periodIndex, rate] of data.retentionByPeriod) {
      retentionRates.push(rate);
      retentionByPeriod[periodIndex] = rate;
    }

    const avgRetention = retentionRates.length > 0
      ? retentionRates.reduce((a, b) => a + b, 0) / retentionRates.length
      : 0;

    results.push({
      segmentId,
      segmentName: segmentId, // Would be resolved from segment service in production
      averageRetentionRate: new Decimal(avgRetention).toDecimalPlaces(2).toNumber(),
      retentionRatesByPeriod: retentionByPeriod,
      cohortSize: data.cohortSize,
      revenuePerUser: data.cohortSize > 0
        ? new Decimal(data.revenue).dividedBy(data.cohortSize).toDecimalPlaces(2).toNumber()
        : 0,
      conversionRate: data.cohortSize > 0
        ? new Decimal(data.conversions).dividedBy(data.cohortSize).times(100).toDecimalPlaces(2).toNumber()
        : 0,
    });
  }

  // Sort by average retention rate descending
  return results.sort((a, b) => b.averageRetentionRate - a.averageRetentionRate);
}

// ============= Retention Curve Fitting =============

/**
 * Fit retention data to exponential decay model
 * Formula: R(t) = R0 * e^(-λt)
 */
export function fitExponentialDecay(
  retentionData: RetentionCurvePoint[]
): { r0: number; lambda: number; rSquared: number } {
  if (retentionData.length < 3) {
    return { r0: 100, lambda: 0.1, rSquared: 0 };
  }

  // Convert to natural log for linear regression
  const validData = retentionData.filter(d => d.retentionRate > 0);
  if (validData.length < 3) {
    return { r0: 100, lambda: 0.1, rSquared: 0 };
  }

  const n = validData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  let sumYReal = 0, sumYY = 0;

  for (const point of validData) {
    const x = point.periodIndex;
    const y = Math.log(point.retentionRate);

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;

    // For R-squared calculation
    sumYReal += point.retentionRate;
    sumYY += point.retentionRate * point.retentionRate;
  }

  // Linear regression: y = ln(R0) - λx
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const r0 = Math.exp(intercept);
  const lambda = -slope;

  // Calculate R-squared
  const yMean = sumYReal / n;
  let ssTot = 0, ssRes = 0;

  for (const point of validData) {
    const predicted = r0 * Math.exp(-lambda * point.periodIndex);
    ssTot += Math.pow(point.retentionRate - yMean, 2);
    ssRes += Math.pow(point.retentionRate - predicted, 2);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    r0: new Decimal(r0).toDecimalPlaces(2).toNumber(),
    lambda: new Decimal(lambda).toDecimalPlaces(4).toNumber(),
    rSquared: new Decimal(rSquared).toDecimalPlaces(4).toNumber(),
  };
}

/**
 * Predict retention at a future period using exponential model
 */
export function predictRetention(
  r0: number,
  lambda: number,
  periodIndex: number
): number {
  const predicted = r0 * Math.exp(-lambda * periodIndex);
  return new Decimal(Math.min(100, Math.max(0, predicted))).toDecimalPlaces(2).toNumber();
}

// ============= Export Utilities =============

/**
 * Generate retention curve summary statistics
 */
export function calculateRetentionStats(
  curvePoints: RetentionCurvePoint[]
): {
  averageRetention: number;
  medianRetention: number;
  maxDrop: number;
  stabilizationPeriod: number;
} {
  if (curvePoints.length === 0) {
    return {
      averageRetention: 0,
      medianRetention: 0,
      maxDrop: 0,
      stabilizationPeriod: 0,
    };
  }

  const rates = curvePoints.map(p => p.retentionRate);
  const averageRetention = rates.reduce((a, b) => a + b, 0) / rates.length;

  // Find median
  const sortedRates = [...rates].sort((a, b) => a - b);
  const mid = Math.floor(sortedRates.length / 2);
  const medianRetention = sortedRates.length % 2 !== 0
    ? sortedRates[mid]
    : (sortedRates[mid - 1] + sortedRates[mid]) / 2;

  // Calculate max drop between consecutive periods
  let maxDrop = 0;
  for (let i = 1; i < rates.length; i++) {
    const drop = rates[i - 1] - rates[i];
    if (drop > maxDrop) {
      maxDrop = drop;
    }
  }

  // Find stabilization period (when drop becomes < 1%)
  let stabilizationPeriod = rates.length;
  for (let i = 1; i < rates.length - 1; i++) {
    const drop = rates[i - 1] - rates[i];
    if (drop < 1) {
      stabilizationPeriod = i;
      break;
    }
  }

  return {
    averageRetention: new Decimal(averageRetention).toDecimalPlaces(2).toNumber(),
    medianRetention: new Decimal(medianRetention).toDecimalPlaces(2).toNumber(),
    maxDrop: new Decimal(maxDrop).toDecimalPlaces(2).toNumber(),
    stabilizationPeriod,
  };
}

/**
 * Interpolate missing retention data points
 */
export function interpolateRetention(
  knownPoints: RetentionCurvePoint[],
  targetPeriod: number
): number {
  if (knownPoints.length === 0) return 0;
  if (knownPoints.length === 1) return knownPoints[0].retentionRate;

  // Find surrounding points
  const sorted = [...knownPoints].sort((a, b) => a.periodIndex - b.periodIndex);

  if (targetPeriod <= sorted[0].periodIndex) {
    return sorted[0].retentionRate;
  }

  if (targetPeriod >= sorted[sorted.length - 1].periodIndex) {
    return sorted[sorted.length - 1].retentionRate;
  }

  // Linear interpolation
  let lower = sorted[0];
  let upper = sorted[1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].periodIndex <= targetPeriod && sorted[i + 1].periodIndex >= targetPeriod) {
      lower = sorted[i];
      upper = sorted[i + 1];
      break;
    }
  }

  const ratio = (targetPeriod - lower.periodIndex) / (upper.periodIndex - lower.periodIndex);
  const interpolated = lower.retentionRate + ratio * (upper.retentionRate - lower.retentionRate);

  return new Decimal(interpolated).toDecimalPlaces(2).toNumber();
}
