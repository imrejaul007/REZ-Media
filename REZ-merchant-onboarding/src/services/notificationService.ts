import { IMerchant } from '../models/Merchant';

const logger = {
  info: (message: string, meta?: object) => {
    console.log(`[NOTIFICATION] ${message}`, meta || '');
  },
  error: (message: string, meta?: object) => {
    console.error(`[NOTIFICATION ERROR] ${message}`, meta || '');
  }
};

interface AdminNotificationData {
  type: 'new_merchant' | 'kyc_submitted' | 'business_submitted' | 'kyc_rejected' | 'business_rejected' | 'merchant_approved' | 'merchant_rejected';
  merchant: IMerchant;
  message: string;
  additionalData?: Record<string, unknown>;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export class NotificationService {
  private static adminEmails: string[];

  static {
    const adminEmailConfig = process.env.ADMIN_EMAILS || '';
    this.adminEmails = adminEmailConfig.split(',').map((email) => email.trim()).filter(Boolean);
  }

  /**
   * Refresh admin emails from environment
   */
  static refreshAdminEmails(): void {
    const adminEmailConfig = process.env.ADMIN_EMAILS || '';
    this.adminEmails = adminEmailConfig.split(',').map((email) => email.trim()).filter(Boolean);
  }

  /**
   * Send notification to internal admin webhook/service
   */
  static async notifyInternalService(endpoint: string, payload: WebhookPayload): Promise<boolean> {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalToken || ''
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      logger.info('Internal service notified', { endpoint, event: payload.event });
      return true;
    } catch (error) {
      logger.error('Failed to notify internal service', {
        endpoint,
        event: payload.event,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Notify admins about merchant events
   */
  static async notifyAdmins(data: AdminNotificationData): Promise<void> {
    const { type, merchant, message, additionalData } = data;

    logger.info('Admin notification triggered', {
      type,
      merchantId: merchant._id,
      merchantEmail: merchant.email
    });

    // Log the notification for now
    // In production, this would send emails, push notifications, Slack messages, etc.
    const adminNotification = {
      type,
      merchantId: merchant._id.toString(),
      merchantEmail: merchant.email,
      merchantName: merchant.fullName,
      businessName: merchant.businessName,
      status: merchant.status,
      message,
      timestamp: new Date().toISOString(),
      additionalData
    };

    // Log to console (in production, use a proper logging/alerting system)
    console.log('\n========== ADMIN NOTIFICATION ==========');
    console.log(JSON.stringify(adminNotification, null, 2));
    console.log('========================================\n');

    // Notify via internal service (e.g., admin dashboard service)
    const adminServiceUrl = process.env.ADMIN_SERVICE_URL;
    if (adminServiceUrl) {
      await this.notifyInternalService(`${adminServiceUrl}/api/notifications`, {
        event: `merchant.${type}`,
        timestamp: new Date().toISOString(),
        data: adminNotification
      });
    }

    // Send email to admins
    if (this.adminEmails.length > 0) {
      await this.sendAdminEmail(adminNotification);
    }
  }

  /**
   * Send email notification to admin users
   */
  private static async sendAdminEmail(notification: Record<string, unknown>): Promise<void> {
    const { default: EmailService } = await import('./emailService');

    const statusColors: Record<string, string> = {
      pending: '#F59E0B',
      kyc_submitted: '#3B82F6',
      kyc_verified: '#10B981',
      business_submitted: '#8B5CF6',
      under_review: '#F59E0B',
      approved: '#10B981',
      rejected: '#EF4444'
    };

    const statusColor = statusColors[notification.status as string] || '#6B7280';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Merchant Notification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1F2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .info-item { background: white; padding: 15px; border-radius: 6px; }
          .info-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
          .info-value { font-size: 16px; font-weight: 600; margin-top: 4px; }
          .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; color: white; font-size: 12px; font-weight: 600; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Merchant Notification</h1>
          </div>
          <div class="content">
            <p><strong>${notification.message}</strong></p>

            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Merchant ID</div>
                <div class="info-value">${notification.merchantId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="status-badge" style="background: ${statusColor};">
                    ${notification.status}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${notification.merchantEmail}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Business Name</div>
                <div class="info-value">${notification.businessName || 'N/A'}</div>
              </div>
            </div>

            <p style="margin-top: 20px;">
              Please review this merchant in the admin dashboard.
            </p>
          </div>
          <div class="footer">
            <p>ReZ Platform Admin System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to all admin emails
    for (const adminEmail of this.adminEmails) {
      await EmailService.sendEmail({
        to: adminEmail,
        subject: `[ReZ Admin] Merchant ${notification.type}: ${notification.merchantEmail}`,
        html
      });
    }
  }

  /**
   * Notify when a new merchant registers
   */
  static async notifyNewMerchantRegistration(merchant: IMerchant): Promise<void> {
    await this.notifyAdmins({
      type: 'new_merchant',
      merchant,
      message: 'A new merchant has registered and requires email verification.',
      additionalData: {
        registrationDate: merchant.createdAt
      }
    });
  }

  /**
   * Notify when KYC documents are submitted
   */
  static async notifyKYCDocumentsSubmitted(merchant: IMerchant): Promise<void> {
    await this.notifyAdmins({
      type: 'kyc_submitted',
      merchant,
      message: 'KYC documents have been submitted and require verification.',
      additionalData: {
        submissionDate: new Date().toISOString()
      }
    });
  }

  /**
   * Notify when business details are submitted
   */
  static async notifyBusinessDetailsSubmitted(merchant: IMerchant): Promise<void> {
    await this.notifyAdmins({
      type: 'business_submitted',
      merchant,
      message: 'Business details have been submitted and require verification.',
      additionalData: {
        businessName: merchant.businessName,
        gstin: merchant.gstin,
        businessType: merchant.businessType
      }
    });
  }

  /**
   * Notify when a merchant is approved
   */
  static async notifyMerchantApproved(merchant: IMerchant): Promise<void> {
    await this.notifyAdmins({
      type: 'merchant_approved',
      merchant,
      message: 'A merchant has been approved and is now active.',
      additionalData: {
        approvalDate: merchant.reviewedAt
      }
    });
  }

  /**
   * Notify when a merchant is rejected
   */
  static async notifyMerchantRejected(merchant: IMerchant, reason: string): Promise<void> {
    await this.notifyAdmins({
      type: 'merchant_rejected',
      merchant,
      message: 'A merchant application has been rejected.',
      additionalData: {
        rejectionReason: reason,
        rejectionDate: merchant.reviewedAt
      }
    });
  }
}

export default NotificationService;
