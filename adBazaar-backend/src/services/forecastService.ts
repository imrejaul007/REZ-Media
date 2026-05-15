/**
 * AdBazaar - Forecast Service
 * Predict campaign performance
 */

interface HistoricalData {
  impressions: number[];
  ctr: number[];
  cvr: number[];
}

interface ForecastResult {
  predicted: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
  confidence: number;
  range: {
    low: number;
    high: number;
  };
}

export class ForecastService {
  /**
   * Predict campaign performance
   */
  forecast(
    historical: HistoricalData,
    days: number
  ): ForecastResult {
    const avgImpressions = this.average(historical.impressions);
    const avgCTR = this.average(historical.ctr);
    const avgCVR = this.average(historical.cvr);

    const dailyImpressions = avgImpressions;
    const predictedImpressions = dailyImpressions * days;
    const predictedClicks = predictedImpressions * (avgCTR / 100);
    const predictedConversions = predictedClicks * (avgCVR / 100);
    const predictedSpend = predictedImpressions * 0.01; // Assume 10 CPM

    const confidence = this.calculateConfidence(historical);

    return {
      predicted: {
        impressions: Math.round(predictedImpressions),
        clicks: Math.round(predictedClicks),
        conversions: Math.round(predictedConversions),
        spend: Math.round(predictedSpend),
      },
      confidence,
      range: {
        low: Math.round(predictedImpressions * 0.8),
        high: Math.round(predictedImpressions * 1.2),
      },
    };
  }

  /**
   * Calculate moving average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate forecast confidence
   */
  private calculateConfidence(historical: HistoricalData): number {
    const dataPoints = Math.min(
      historical.impressions.length,
      historical.ctr.length,
      historical.cvr.length
    );

    if (dataPoints < 7) return 0.5;
    if (dataPoints < 14) return 0.7;
    if (dataPoints < 30) return 0.85;
    return 0.95;
  }
}

export const forecastService = new ForecastService();
