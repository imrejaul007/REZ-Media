/**
 * AdBazaar - Intelligence Integration
 * Connects to REZ-Intelligence services for:
 * - User targeting
 * - Audience segments
 * - RFM analysis
 */

import axios from 'axios';

// Configuration
const INTELLIGENCE_URL = process.env.INTELLIGENCE_URL || 'http://localhost:3001';

// ============================================================================
// TYPES
// ============================================================================

interface UserSegment {
  segmentId: string;
  name: string;
  size: number;
  description?: string;
}

interface RFMData {
  rfmSegment: string;
  score: number;
  recency: number;
  frequency: number;
  monetary: number;
}

interface AudienceProfile {
  userId: string;
  segments: string[];
  rfm: RFMData;
  interests: string[];
  demographics: {
    age?: string;
    gender?: string;
    location?: string;
  };
}

// ============================================================================
// INTELLIGENCE CLIENT
// ============================================================================

class IntelligenceClient {
  private baseURL: string;

  constructor() {
    this.baseURL = INTELLIGENCE_URL;
  }

  /**
   * Get user segments
   */
  async getUserSegments(): Promise<UserSegment[] | null> {
    try {
      const response = await axios.get(`${this.baseURL}/api/segments`, {
        timeout: 3000,
      });
      return response.data.segments;
    } catch (error) {
      console.error('Failed to get segments:', error);
      return null;
    }
  }

  /**
   * Get user RFM data
   */
  async getUserRFM(userId: string): Promise<RFMData | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/rfm/${userId}`,
        { timeout: 3000 }
      );
      return response.data.rfm;
    } catch (error) {
      console.error('Failed to get RFM:', error);
      return null;
    }
  }

  /**
   * Get user audience profile
   */
  async getUserProfile(userId: string): Promise<AudienceProfile | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/profile/${userId}`,
        { timeout: 3000 }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get profile:', error);
      return null;
    }
  }

  /**
   * Get users by segment
   */
  async getUsersBySegment(
    segment: string,
    limit = 100
  ): Promise<string[] | null> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/segments/users`,
        { segment, limit },
        { timeout: 5000 }
      );
      return response.data.users;
    } catch (error) {
      console.error('Failed to get users by segment:', error);
      return null;
    }
  }

  /**
   * Match screen audience to user segments
   */
  async matchScreenAudience(screenType: string): Promise<{
    segments: string[];
    demographics: string[];
    interests: string[];
  } | null> {
    // Map screen types to likely segments
    const screenSegmentMap: Record<string, {
      segments: string[];
      demographics: string[];
      interests: string[];
    }> = {
      hotel_tv: {
        segments: ['travel', 'business', 'luxury'],
        demographics: ['25-54', 'high_income'],
        interests: ['travel', 'dining', 'entertainment'],
      },
      cab_screen: {
        segments: ['commuter', 'urban'],
        demographics: ['22-45', 'middle_income'],
        interests: ['food', 'entertainment', 'local'],
      },
      mall_kiosk: {
        segments: ['shopper', 'deal_seeker'],
        demographics: ['22-44', 'middle_income'],
        interests: ['shopping', 'fashion', 'food'],
      },
      gym_screen: {
        segments: ['fitness', 'health'],
        demographics: ['22-45', 'health_conscious'],
        interests: ['fitness', 'nutrition', 'wellness'],
      },
      office_lobby: {
        segments: ['professional', 'corporate'],
        demographics: ['25-44', 'high_income'],
        interests: ['productivity', 'food_delivery', 'wellness'],
      },
      billboard_led: {
        segments: ['general', 'awareness'],
        demographics: ['18-65', 'all'],
        interests: ['general'],
      },
    };

    return screenSegmentMap[screenType] || {
      segments: ['general'],
      demographics: ['all'],
      interests: ['general'],
    };
  }
}

export const intelligenceClient = new IntelligenceClient();
export default intelligenceClient;
