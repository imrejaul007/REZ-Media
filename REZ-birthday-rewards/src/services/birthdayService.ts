/**
 * Birthday Service
 */

export class BirthdayService {
  async getConfig(merchantId: string) {
    return {
      merchantId,
      enabled: true,
      offer: {
        discount: 20,
        type: 'percentage',
        minOrder: 500,
        maxDiscount: 500,
      },
      channels: ['email', 'whatsapp', 'sms'],
      timing: 'birthday_day',
    };
  }

  async updateConfig(merchantId: string, config: any) {
    return { merchantId, ...config };
  }

  async getAnalytics(merchantId: string) {
    return {
      totalSent: 150,
      totalRedeemed: 89,
      redemptionRate: 59.3,
      revenue: 45000,
      topChannels: [
        { channel: 'whatsapp', sent: 80 },
        { channel: 'email', sent: 45 },
        { channel: 'sms', sent: 25 },
      ],
    };
  }

  async triggerBirthdays() {
    console.log('Birthday check triggered');
    return { triggered: true };
  }
}

export const birthdayService = new BirthdayService();
