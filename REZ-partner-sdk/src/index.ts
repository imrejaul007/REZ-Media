/**
 * REZ Partner SDK
 * Third-party apps join REZ ad network
 */

export interface REZPartnerConfig {
  apiKey: string;
  partnerId: string;
  environment: 'production' | 'staging';
}

export interface AdConfig {
  placement: string;
  type: 'banner' | 'video' | 'native' | 'qr';
  size?: string;
}

export interface UserContext {
  userId: string;
  deviceId: string;
  location?: { lat: number; lng: number };
  interests?: string[];
  demographics?: { ageRange?: string; gender?: string };
}

export interface REZAd {
  adId: string;
  title: string;
  imageUrl: string;
  clickUrl: string;
  reward?: { coins: number };
}

export class REZPartnerSDK {
  private config: REZPartnerConfig;
  private baseUrl: string;

  constructor(config: REZPartnerConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.rez.app'
      : 'https://api.staging.rez.app';
  }

  // Initialize partner app
  async initialize(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/partners/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-Key': this.config.apiKey
        },
        body: JSON.stringify({
          partner_id: this.config.partnerId
        })
      });
      return response.ok;
    } catch (error) {
      console.error('REZ SDK init failed:', error);
      return false;
    }
  }

  // Request ad for placement
  async requestAd(config: AdConfig, context: UserContext): Promise<REZAd | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/ads/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-Key': this.config.apiKey
        },
        body: JSON.stringify({
          placement: config.placement,
          type: config.type,
          size: config.size,
          user_id: context.userId,
          device_id: context.deviceId,
          location: context.location,
          interests: context.interests,
          demographics: context.demographics
        })
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.ad;
    } catch (error) {
      console.error('REZ SDK ad request failed:', error);
      return null;
    }
  }

  // Record ad impression
  async recordImpression(adId: string, userId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/ads/impression`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Key': this.config.apiKey
      },
      body: JSON.stringify({ ad_id: adId, user_id: userId })
    });
  }

  // Record ad click
  async recordClick(adId: string, userId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/ads/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Key': this.config.apiKey
      },
      body: JSON.stringify({ ad_id: adId, user_id: userId })
    });
  }

  // Track conversion
  async trackConversion(adId: string, userId: string, value: number): Promise<void> {
    await fetch(`${this.baseUrl}/api/ads/conversion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Key': this.config.apiKey
      },
      body: JSON.stringify({ ad_id: adId, user_id: userId, value })
    });
  }

  // Get earnings report
  async getEarnings(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/partners/earnings`, {
      headers: { 'X-Partner-Key': this.config.apiKey }
    });
    return response.json();
  }
}

// Usage Example:
// const sdk = new REZPartnerSDK({
//   apiKey: 'your-api-key',
//   partnerId: 'your-partner-id',
//   environment: 'production'
// });
//
// await sdk.initialize();
// const ad = await sdk.requestAd({ placement: 'home_screen', type: 'banner' }, { userId: '123', deviceId: '456' });

export default REZPartnerSDK;
