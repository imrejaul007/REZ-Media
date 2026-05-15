/**
 * AdBazaar - Audience Builder
 * Build audiences for targeting
 */

import { rezIntelligence } from './rezIntelligenceClient';

interface AudienceCriteria {
  rfmSegments?: string[];
  interests?: string[];
  ageGroups?: string[];
  incomeLevels?: string[];
  locations?: string[];
}

interface AudienceProfile {
  criteria: AudienceCriteria;
  estimatedSize: number;
  topInterests: string[];
  avgEngagement: number;
}

export class AudienceBuilder {
  /**
   * Build audience from criteria
   */
  async buildAudience(criteria: AudienceCriteria): Promise<AudienceProfile> {
    // Estimate audience size based on criteria
    const estimatedSize = this.estimateSize(criteria);

    // Get top interests
    const topInterests = criteria.interests || this.getDefaultInterests(criteria);

    // Calculate average engagement
    const avgEngagement = this.estimateEngagement(criteria);

    return {
      criteria,
      estimatedSize,
      topInterests,
      avgEngagement,
    };
  }

  /**
   * Expand audience with lookalikes
   */
  async expandAudience(
    baseCriteria: AudienceCriteria,
    expansionFactor = 1.5
  ): Promise<AudienceCriteria> {
    return {
      ...baseCriteria,
      interests: [
        ...(baseCriteria.interests || []),
        ...this.getRelatedInterests(baseCriteria),
      ],
    };
  }

  /**
   * Estimate audience size
   */
  private estimateSize(criteria: AudienceCriteria): number {
    let base = 100000;

    if (criteria.rfmSegments?.length) {
      base *= criteria.rfmSegments.length * 0.3;
    }
    if (criteria.interests?.length) {
      base *= criteria.interests.length * 0.2;
    }
    if (criteria.locations?.length) {
      base *= Math.min(criteria.locations.length * 0.3, 2);
    }

    return Math.round(base);
  }

  /**
   * Estimate engagement rate
   */
  private estimateEngagement(criteria: AudienceCriteria): number {
    let engagement = 2.5; // Base 2.5%

    if (criteria.rfmSegments?.includes('champions')) {
      engagement += 1.5;
    }
    if (criteria.interests?.length) {
      engagement += criteria.interests.length * 0.3;
    }

    return Math.min(engagement, 5);
  }

  /**
   * Get default interests for RFM segments
   */
  private getDefaultInterests(criteria: AudienceCriteria): string[] {
    if (criteria.rfmSegments?.includes('champions')) {
      return ['luxury', 'premium', 'exclusive'];
    }
    if (criteria.rfmSegments?.includes('loyal')) {
      return ['deals', 'loyalty', 'rewards'];
    }
    return ['general', 'lifestyle'];
  }

  /**
   * Get related interests for expansion
   */
  private getRelatedInterests(baseInterests: string[]): string[] {
    const relationMap: Record<string, string[]> = {
      food: ['dining', 'restaurants', 'delivery'],
      travel: ['hotels', 'flights', 'vacations'],
      shopping: ['fashion', 'electronics', 'home'],
    };

    const related: string[] = [];
    for (const interest of baseInterests) {
      related.push(...(relationMap[interest.toLowerCase()] || []));
    }
    return [...new Set(related)];
  }
}

export const audienceBuilder = new AudienceBuilder();
