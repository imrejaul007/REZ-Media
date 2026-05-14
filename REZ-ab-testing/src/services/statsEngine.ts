import { IVariantStats, PrimaryMetric } from '../types';

// Statistical significance result
export interface SignificanceResult {
  pValue: number;
  zScore: number;
  confidenceLevel: number;
  isSignificant: boolean;
  testType: string;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

// Sample size calculation result
export interface SampleSizeResult {
  requiredSampleSize: number;
  perVariant: number;
  detectableEffect: number;
  power: number;
  alpha: number;
}

// Revenue impact calculation
export interface RevenueImpact {
  totalRevenue: number;
  estimatedLift: number;
  projectedAnnualRevenue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

// Beta distribution parameters for Bayesian analysis
interface BetaParams {
  alpha: number;
  beta: number;
}

// Normal distribution approximation for Bayesian
interface NormalParams {
  mean: number;
  variance: number;
}

/**
 * Statistics Engine for A/B Testing
 * Implements frequentist and Bayesian statistical methods
 */
export class StatsEngine {
  private static readonly DEFAULT_CONFIDENCE = 0.95;
  private static readonly DEFAULT_POWER = 0.8;
  private static readonly Z_SCORES: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  /**
   * Calculate chi-square statistic for independence test
   */
  static chiSquareTest(
    controlConversions: number,
    controlImpressions: number,
    variantConversions: number,
    variantImpressions: number
  ): { chiSquare: number; pValue: number; degreesOfFreedom: number } {
    // Create contingency table
    const observed = [
      [controlConversions, controlImpressions - controlConversions],
      [variantConversions, variantImpressions - variantConversions],
    ];

    // Calculate expected values
    const totalConversions = controlConversions + variantConversions;
    const totalNonConversions =
      controlImpressions - controlConversions + variantImpressions - variantConversions;
    const total = controlImpressions + variantImpressions;

    const expected = [
      [
        (totalConversions * controlImpressions) / total,
        (totalNonConversions * controlImpressions) / total,
      ],
      [
        (totalConversions * variantImpressions) / total,
        (totalNonConversions * variantImpressions) / total,
      ],
    ];

    // Calculate chi-square statistic with Yates' correction
    let chiSquare = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const correction = 0.5; // Yates' correction for continuity
        const diff = Math.abs(observed[i][j] - expected[i][j]) - correction;
        chiSquare += (diff * diff) / expected[i][j];
      }
    }

    // Degrees of freedom = (rows - 1) * (cols - 1) = 1
    const degreesOfFreedom = 1;

    // Calculate p-value from chi-square distribution
    const pValue = 1 - this.chiSquareCDF(chiSquare, degreesOfFreedom);

    return { chiSquare, pValue, degreesOfFreedom };
  }

  /**
   * Approximation of chi-square CDF using incomplete gamma function
   */
  private static chiSquareCDF(x: number, k: number): number {
    if (x <= 0) return 0;
    return this.gammaCDF(x / 2, k / 2);
  }

  /**
   * Lower incomplete gamma function approximation
   */
  private static gammaCDF(x: number, a: number): number {
    // Using series expansion for small x, continued fraction for large x
    if (x < 0) return 0;
    if (x === 0) return 0;
    if (a <= 0) return 1;

    if (x < a + 1) {
      // Series expansion (Gammser)
      let sum = 1 / a;
      let term = 1 / a;
      for (let n = 1; n < 100; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < 1e-10) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - this.logGamma(a));
    } else {
      // Continued fraction (Gammcc)
      return 1 - this.gammacf(x, a);
    }
  }

  /**
   * Continued fraction for gamma function
   */
  private static gammacf(x: number, a: number): number {
    const maxIterations = 200;
    const epsilon = 1e-10;

    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let i = 1; i <= maxIterations; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < epsilon) break;
    }

    return Math.exp(-x + a * Math.log(x) - this.logGamma(a)) * h;
  }

  /**
   * Log gamma function using Stirling's approximation
   */
  private static logGamma(x: number): number {
    const coefficients = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
    ];

    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;

    for (let j = 0; j < 6; j++) {
      ser += coefficients[j] / ++y;
    }

    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  /**
   * Two-proportion Z-test for comparing conversion rates
   */
  static twoProportionZTest(
    controlConversions: number,
    controlImpressions: number,
    variantConversions: number,
    variantImpressions: number,
    confidenceLevel: number = StatsEngine.DEFAULT_CONFIDENCE
  ): SignificanceResult {
    const p1 = controlImpressions > 0 ? controlConversions / controlImpressions : 0;
    const p2 = variantImpressions > 0 ? variantConversions / variantImpressions : 0;

    // Pooled proportion
    const pooled = (controlConversions + variantConversions) / (controlImpressions + variantImpressions);

    // Standard error
    const se = Math.sqrt(
      pooled * (1 - pooled) * (1 / controlImpressions + 1 / variantImpressions)
    );

    // Z-score
    const zScore = se > 0 ? (p2 - p1) / se : 0;

    // Two-tailed p-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));

    // Critical value for confidence level
    const criticalValue = StatsEngine.Z_SCORES[confidenceLevel] || 1.96;

    // Confidence interval for the difference
    const diff = p2 - p1;
    const diffSe = Math.sqrt(
      (p1 * (1 - p1)) / controlImpressions +
      (p2 * (1 - p2)) / variantImpressions
    );
    const margin = criticalValue * diffSe;

    return {
      pValue,
      zScore,
      confidenceLevel,
      isSignificant: pValue < 1 - confidenceLevel,
      testType: 'two-proportion-z-test',
      confidenceInterval: {
        lower: diff - margin,
        upper: diff + margin,
      },
    };
  }

  /**
   * Standard normal CDF approximation
   */
  private static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Bayesian analysis using Beta distribution
   */
  static bayesianAnalysis(
    controlConversions: number,
    controlImpressions: number,
    variantConversions: number,
    variantImpressions: number,
    confidenceLevel: number = StatsEngine.DEFAULT_CONFIDENCE
  ): {
    control: BetaParams & { mean: number; variance: number };
    variant: BetaParams & { mean: number; variance: number };
    probabilityOfBeingBetter: number;
    expectedLift: number;
    confidenceInterval: { lower: number; upper: number };
    isSignificant: boolean;
  } {
    // Beta prior parameters (uniform)
    const alphaPrior = 1;
    const betaPrior = 1;

    // Posterior parameters
    const controlAlpha = alphaPrior + controlConversions;
    const controlBeta = betaPrior + (controlImpressions - controlConversions);

    const variantAlpha = alphaPrior + variantConversions;
    const variantBeta = betaPrior + (variantImpressions - variantConversions);

    // Calculate posterior means
    const controlMean = controlAlpha / (controlAlpha + controlBeta);
    const variantMean = variantAlpha / (variantAlpha + variantBeta);

    // Calculate posterior variances (Beta distribution)
    const controlVariance = (controlAlpha * controlBeta) /
      ((controlAlpha + controlBeta) ** 2 * (controlAlpha + controlBeta + 1));
    const variantVariance = (variantAlpha * variantBeta) /
      ((variantAlpha + variantBeta) ** 2 * (variantAlpha + variantBeta + 1));

    // Monte Carlo simulation for probability of being better
    const simulations = 100000;
    let wins = 0;
    for (let i = 0; i < simulations; i++) {
      // Sample from Gamma approximations to Beta distributions
      const controlSample = this.sampleBeta(controlAlpha, controlBeta);
      const variantSample = this.sampleBeta(variantAlpha, variantBeta);
      if (variantSample > controlSample) wins++;
    }
    const probabilityOfBeingBetter = wins / simulations;

    // Calculate expected lift
    const expectedLift = controlMean > 0 ? ((variantMean - controlMean) / controlMean) * 100 : 0;

    // Calculate confidence interval using normal approximation
    const diff = variantMean - controlMean;
    const diffVariance = controlVariance + variantVariance;
    const diffStd = Math.sqrt(diffVariance);

    const z = StatsEngine.Z_SCORES[confidenceLevel] || 1.96;
    const confidenceInterval = {
      lower: diff - z * diffStd,
      upper: diff + z * diffStd,
    };

    return {
      control: {
        alpha: controlAlpha,
        beta: controlBeta,
        mean: controlMean,
        variance: controlVariance,
      },
      variant: {
        alpha: variantAlpha,
        beta: variantBeta,
        mean: variantMean,
        variance: variantVariance,
      },
      probabilityOfBeingBetter,
      expectedLift,
      confidenceInterval,
      isSignificant: probabilityOfBeingBetter > confidenceLevel,
    };
  }

  /**
   * Sample from Beta distribution using Gamma approximation
   */
  private static sampleBeta(alpha: number, beta: number): number {
    // Using Marsaglia and Tsang's method
    const gamma1 = this.sampleGamma(alpha);
    const gamma2 = this.sampleGamma(beta);
    return gamma1 / (gamma1 + gamma2);
  }

  /**
   * Sample from Gamma distribution using Marsaglia and Tsang's method
   */
  private static sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x: number;
      let v: number;

      do {
        x = this.normalRandom();
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * (x * x) * (x * x)) {
        return d * v;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v;
      }
    }
  }

  /**
   * Generate normal random number using Box-Muller transform
   */
  private static normalRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Calculate minimum required sample size per variant
   */
  static calculateSampleSize(
    baselineConversionRate: number,
    minimumDetectableEffect: number, // Relative change (e.g., 0.05 for 5%)
    alpha: number = 0.05,
    power: number = StatsEngine.DEFAULT_POWER
  ): SampleSizeResult {
    const effect = baselineConversionRate * (1 + minimumDetectableEffect) - baselineConversionRate;
    const p1 = baselineConversionRate;
    const p2 = baselineConversionRate + effect;

    const zAlpha = StatsEngine.Z_SCORES[1 - alpha / 2] || 1.96;
    const zBeta = StatsEngine.Z_SCORES[power] || 0.84;

    const pooled = (p1 + p2) / 2;
    const diff = Math.abs(p2 - p1);

    const n = Math.ceil(
      2 *
        Math.pow(zAlpha * Math.sqrt(2 * pooled * (1 - pooled)) +
          zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) /
        Math.pow(diff, 2)
    );

    return {
      requiredSampleSize: n * 2, // Total for both variants
      perVariant: n,
      detectableEffect: minimumDetectableEffect,
      power,
      alpha,
    };
  }

  /**
   * Calculate revenue impact of experiment
   */
  static calculateRevenueImpact(
    controlRevenue: number,
    controlImpressions: number,
    variantRevenue: number,
    variantImpressions: number,
    trafficPercentage: number = 100,
    confidenceLevel: number = StatsEngine.DEFAULT_CONFIDENCE
  ): RevenueImpact {
    const controlAOV = controlImpressions > 0 ? controlRevenue / controlImpressions : 0;
    const variantAOV = variantImpressions > 0 ? variantRevenue / variantImpressions : 0;

    const totalRevenue = controlRevenue + variantRevenue;

    // Calculate uplift
    const uplift = controlRevenue > 0
      ? ((variantRevenue - controlRevenue) / controlRevenue) * 100
      : 0;

    // Project to annual revenue (assuming 365 days)
    const dailyRevenue = totalRevenue;
    const projectedAnnualRevenue = dailyRevenue * 365 * (100 / trafficPercentage);

    // Calculate confidence interval for uplift
    const n1 = controlImpressions;
    const n2 = variantImpressions;
    const p1 = controlRevenue / n1;
    const p2 = variantRevenue / n2;

    const pooled = (controlRevenue + variantRevenue) / (n1 + n2);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));

    const z = StatsEngine.Z_SCORES[confidenceLevel] || 1.96;
    const liftSe = se / p1;

    return {
      totalRevenue,
      estimatedLift: uplift,
      projectedAnnualRevenue,
      confidenceInterval: {
        lower: uplift - z * Math.abs(liftSe) * 100,
        upper: uplift + z * Math.abs(liftSe) * 100,
      },
    };
  }

  /**
   * Calculate variant statistics
   */
  static calculateVariantStats(
    variantId: string,
    variantName: string,
    impressions: number,
    conversions: number,
    revenue: number,
    controlConversionRate: number
  ): IVariantStats {
    const conversionRate = impressions > 0 ? conversions / impressions : 0;
    const averageOrderValue = conversions > 0 ? revenue / conversions : 0;
    const uplift = controlConversionRate > 0
      ? ((conversionRate - controlConversionRate) / controlConversionRate) * 100
      : 0;

    return {
      variantId,
      variantName,
      impressions,
      conversions,
      conversionRate,
      revenue,
      averageOrderValue,
      confidence: 0, // Will be calculated by caller
      isWinner: false,
      uplift,
    };
  }

  /**
   * Determine if experiment has reached minimum sample size
   */
  static hasReachedMinimumSample(
    impressions: number,
    conversions: number,
    minimumSampleSize: number,
    minimumConversions: number = 100
  ): { reached: boolean; reason?: string } {
    if (impressions < minimumSampleSize) {
      return {
        reached: false,
        reason: `Need ${minimumSampleSize - impressions} more impressions (${Math.round((impressions / minimumSampleSize) * 100)}% complete)`,
      };
    }

    if (conversions < minimumConversions) {
      return {
        reached: false,
        reason: `Need ${minimumConversions - conversions} more conversions`,
      };
    }

    return { reached: true };
  }

  /**
   * Calculate sequential testing boundary (O'Brien-Fleming)
   */
  static sequentialTestingBoundary(
    currentImpressions: number,
    totalExpectedImpressions: number,
    alpha: number = 0.05,
    numberOfLooks: number = 10
  ): { boundary: number; isExceeded: boolean } {
    // O'Brien-Fleming spending function
    const spendingFunction = (t: number): number => {
      return 2 - 2 * this.normalCDF(this.normalCDF(1 - alpha / 2) / Math.sqrt(t));
    };

    const informationFraction = Math.min(currentImpressions / totalExpectedImpressions, 1);
    const boundary = spendingFunction(informationFraction) / numberOfLooks;

    return {
      boundary,
      isExceeded: alpha < boundary,
    };
  }
}
