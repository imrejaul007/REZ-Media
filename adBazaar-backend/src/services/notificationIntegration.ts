/**
 * AdBazaar - Notification Integration
 * Integrates with RABTUL notifications service
 */

import axios from 'axios';

// Configuration
const NOTIFICATION_URL = process.env.NOTIFICATION_URL || 'http://localhost:4004';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'dev-token';

interface NotificationPayload {
  userId: string;
  channel: 'push' | 'sms' | 'email' | 'whatsapp';
  template: string;
  data: Record<string, unknown>;
}

class NotificationClient {
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = NOTIFICATION_URL;
    this.token = INTERNAL_TOKEN;
  }

  /**
   * Send notification
   */
  async send(payload: NotificationPayload): Promise<{ success: boolean; messageId: string }> {
    try {
      const response = await axios.post(`${this.baseURL}/api/notifications/send`, payload, {
        headers: {
          'X-Internal-Token': this.token,
        'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to send notification:', error);
      return { success: false, messageId: '' };
    }
  }

  /**
   * Notify owner of booking
   */
  async notifyOwnerBooking(ownerId: string, data: {
    screenName: string;
    campaignName: string;
    startDate: string;
    endDate: string;
  }): Promise<void> {
    await this.send({
      userId: ownerId,
      channel: 'push',
      template: 'owner_booking_confirmed',
      data,
    });
  }

  /**
   * Notify advertiser of campaign start
   */
  async notifyCampaignStart(advertiserId: string, data: {
    campaignName: string;
    screenCount: number;
  }): Promise<void> {
    await this.send({
      userId: advertiserId,
      channel: 'push',
      template: 'campaign_started',
      data,
    });
  }

  /**
   * Notify owner of payout
   */
  async notifyOwnerPayout(ownerId: string, data: {
    amount: number;
    period: string;
    screens: number;
  }): Promise<void> {
    await this.send({
      userId: ownerId,
      channel: 'push',
      template: 'payout_processed',
      data,
    });
  }
}

export const notificationClient = new NotificationClient();
export default notificationClient;
