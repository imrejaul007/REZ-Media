/**
 * AdBazaar - REZ Intelligence Client
 * Connects to REZ Intelligence for AI-powered targeting
 */

import axios from 'axios';

const REZ_INTEL_URL = process.env.REZ_INTEL_URL || 'http://localhost:3001';

interface IntentSignal {
  intent: string;
  confidence: number;
}

export class REZIntelligenceClient {
  private baseURL: string;

  constructor() {
    this.baseURL = REZ_INTEL_URL;
  }

  async getUserIntents(userId: string): Promise<IntentSignal[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/intent/active/${userId}`,
        { timeout: 3000 }
      );
      return response.data.intents || [];
    } catch {
      return [];
    }
  }

  async getTargetingSuggestions(screenType: string): Promise<{
    segments: string[];
    interests: string[];
    score: number;
  }> {
    const suggestions: Record<string, { segments: string[]; interests: string[]; score: number }> = {
      hotel_tv: { segments: ['travel', 'business'], interests: ['dining', 'entertainment'], score: 85 },
      cab_screen: { segments: ['commuter', 'urban'], interests: ['food', 'local'], score: 75 },
      mall_kiosk: { segments: ['shopper'], interests: ['fashion', 'beauty'], score: 80 },
    };
    return suggestions[screenType] || { segments: ['general'], interests: ['general'], score: 50 };
  }
}

export const rezIntelligence = new REZIntelligenceClient();
