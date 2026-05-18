/**
 * REZ Care - REZ Media Integration
 *
 * Connects to REZ Media services:
 * - Campaign Hub
 * - Loyalty/Karma
 * - Attribution
 * - DOOH
 * - Engagement
 */

import axios from 'axios';
import { logger } from '../utils/logger';

// REZ Media URLs
const MEDIA_URLS = {
  campaignHub: process.env.REZ_CAMPAIGN_HUB_URL || 'http://localhost:4500',
  loyalty: process.env.REZ_LOYALTY_URL || 'http://localhost:4600',
  karma: process.env.REZ_KARMA_URL || 'http://localhost:4610',
  attribution: process.env.REZ_ATTRIBUTION_URL || 'http://localhost:4700',
  engagement: process.env.REZ_ENGAGEMENT_URL || 'http://localhost:4800',
  dooh: process.env.REZ_DOOH_URL || 'http://localhost:4900',
  ads: process.env.REZ_ADS_URL || 'http://localhost:4200',
};

const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'rez-internal-token';

const headers = {
  'Content-Type': 'application/json',
  'X-Internal-Token': INTERNAL_TOKEN,
};

export interface MediaContext {
  customerId: string;
  campaign?: string;
  touchpoints?: string[];
  conversions?: number;
}

/**
 * REZ Media Integration Service
 */
class REZMediaIntegration {
  // ============================================
  // LOYALTY & KARMA
  // ============================================

  /**
   * Grant loyalty points from support resolution
   */
  async grantLoyaltyPoints(customerId: string, points: number, reason: string): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.loyalty}/grant`, {
        customerId,
        points,
        reason: `Support: ${reason}`,
        source: 'support_ticket',
      }, { headers });
      logger.info(`[Media] Granted ${points} loyalty points to ${customerId}`);
      return true;
    } catch (error) {
      logger.error('[Media] Loyalty grant failed', error);
      return false;
    }
  }

  /**
   * Grant Karma points (social impact)
   */
  async grantKarma(customerId: string, points: number, action: string): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.karma}/grant`, {
        customerId,
        points,
        action: `support_${action}`,
      }, { headers });
      return true;
    } catch (error) {
      logger.error('[Media] Karma grant failed', error);
      return false;
    }
  }

  // ============================================
  // CAMPAIGNS
  // ============================================

  /**
   * Trigger retention campaign
   */
  async triggerRetentionCampaign(customerId: string, reason: string): Promise<{ campaignId: string } | null> {
    try {
      const res = await axios.post(`${MEDIA_URLS.campaignHub}/trigger`, {
        campaignType: 'retention',
        customerId,
        trigger: `support_${reason}`,
        priority: 'high',
      }, { headers });
      return res.data?.campaignId ? { campaignId: res.data.campaignId } : null;
    } catch (error) {
      logger.error('[Media] Campaign trigger failed', error);
      return null;
    }
  }

  /**
   * Get active campaigns for customer
   */
  async getActiveCampaigns(customerId: string): Promise<string[]> {
    try {
      const res = await axios.get(`${MEDIA_URLS.campaignHub}/customer/${customerId}/campaigns`, { headers });
      return res.data?.campaigns || [];
    } catch {
      return [];
    }
  }

  // ============================================
  // ATTRIBUTION
  // ============================================

  /**
   * Track support touchpoint in attribution
   */
  async trackSupportTouchpoint(data: {
    customerId: string;
    ticketId: string;
    category: string;
    outcome: string;
    conversion?: number;
  }): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.attribution}/touchpoint`, {
        source: 'support',
        ticketId: data.ticketId,
        customerId: data.customerId,
        channel: 'support',
        touchpoint: `support_${data.category}`,
        outcome: data.outcome,
        value: data.conversion || 0,
      }, { headers });
      return true;
    } catch (error) {
      logger.error('[Media] Attribution track failed', error);
      return false;
    }
  }

  /**
   * Get customer lifetime value from attribution
   */
  async getLTV(customerId: string): Promise<number> {
    try {
      const res = await axios.get(`${MEDIA_URLS.attribution}/customer/${customerId}/ltv`, { headers });
      return res.data?.ltv || 0;
    } catch {
      return 0;
    }
  }

  // ============================================
  // ENGAGEMENT
  // ============================================

  /**
   * Send push notification
   */
  async sendPush(customerId: string, title: string, body: string, data?: any): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.engagement}/push`, {
        customerId,
        notification: { title, body, data },
      }, { headers });
      return true;
    } catch (error) {
      logger.error('[Media] Push failed', error);
      return false;
    }
  }

  /**
   * Send email
   */
  async sendEmail(customerId: string, template: string, vars?: Record<string, string>): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.engagement}/email`, {
        customerId,
        template,
        variables: vars,
      }, { headers });
      return true;
    } catch (error) {
      logger.error('[Media] Email failed', error);
      return false;
    }
  }

  // ============================================
  // DOOH (Digital Out of Home)
  // ============================================

  /**
   * Push emergency announcement to DOOH screens
   */
  async pushDOOHAnnouncement(location: string, message: string): Promise<boolean> {
    try {
      await axios.post(`${MEDIA_URLS.dooh}/emergency`, {
        location,
        message,
        priority: 'high',
      }, { headers });
      return true;
    } catch (error) {
      logger.error('[Media] DOOH push failed', error);
      return false;
    }
  }

  // ============================================
  // AUTONOMOUS LOOP HELPERS
  // ============================================

  /**
   * Full enrichment from media services
   */
  async enrichTicket(ticketId: string, customerId: string): Promise<{
    ltv?: number;
    activeCampaigns?: string[];
    karma?: number;
  }> {
    const [ltv, campaigns, karma] = await Promise.all([
      this.getLTV(customerId),
      this.getActiveCampaigns(customerId),
      this.getKarma(customerId),
    ]);
    return { ltv, activeCampaigns: campaigns, karma };
  }

  private async getKarma(customerId: string): Promise<number> {
    try {
      const res = await axios.get(`${MEDIA_URLS.karma}/${customerId}/balance`, { headers });
      return res.data?.balance || 0;
    } catch {
      return 0;
    }
  }
}

export const mediaIntegration = new REZMediaIntegration();
