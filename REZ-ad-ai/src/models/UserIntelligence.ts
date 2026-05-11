/**
 * User Intelligence Model
 *
 * Stores user intent signals and segments for ad targeting.
 */

export interface UserIntelligenceDoc {
  user_id: string;
  intent: {
    current: string;
    history: Array<{
      intent: string;
      timestamp: Date;
    }>;
  };
  segments: string[];
  consent: {
    ads: boolean;
    tracking: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Mock implementation for TypeScript
export const UserIntelligence = {
  findOne: async (query: { user_id: string }): Promise<UserIntelligenceDoc | null> => {
    // Return null for now - implement actual DB call if needed
    console.log('UserIntelligence.findOne called with:', query);
    return null;
  }
};
