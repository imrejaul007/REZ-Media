/**
 * Karma Mobile App Types
 * Inlined from @rez/shared-types (not published to npm)
 */

// Re-export all types as any to bypass the import issue
// In production, these should come from @rez/shared-types

export type KarmaLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type KarmaConversionRate = number;
export type EarnRecordStatus = 'pending' | 'approved' | 'rejected';
export type KarmaVerificationStatus = 'pending' | 'verified' | 'rejected';
export type EventDifficulty = 'easy' | 'medium' | 'hard';
export type EventCategory = 'environment' | 'food' | 'health' | 'education' | 'community';
export type KarmaEventStatus = 'active' | 'completed' | 'cancelled';
export type KarmaScoreBand = 'starter' | 'active' | 'performer' | 'leader' | 'elite' | 'pinnacle';
export type TrustGrade = 'S' | 'A' | 'B' | 'C' | 'D';
export type MomentumLabel = 'cold' | 'slow' | 'steady' | 'hot' | 'blazing';

export interface IBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: Date;
}

export interface IKarmaProfile {
  id: string;
  userId: string;
  karmaScore: number;
  level: KarmaLevel;
  totalEarned: number;
  totalSpent: number;
  streak: number;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEarnRecord {
  id: string;
  profileId: string;
  eventId: string;
  amount: number;
  status: EarnRecordStatus;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface IKarmaEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  difficulty: EventDifficulty;
  karmaPoints: number;
  status: KarmaEventStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface ILevelInfo {
  label: string;
  perks: string[];
  color: string;
  minScore: number;
  maxScore: number;
}

export interface IKarmaStats {
  totalEvents: number;
  completedEvents: number;
  averageScore: number;
  rank: number;
  totalParticipants: number;
}

export interface BandMetadata {
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
  maxScore: number;
  perks: string[];
}

export interface KarmaScoreComponents {
  base: number;
  recency: number;
  consistency: number;
  difficulty: number;
  total: number;
}

// =============================================================================
// LEVEL THRESHOLDS
// =============================================================================

export const LEVEL_THRESHOLDS: Record<KarmaLevel, { min: number; conversionRate: KarmaConversionRate }> = {
  L1: { min: 0, conversionRate: 0.25 },
  L2: { min: 500, conversionRate: 0.5 },
  L3: { min: 2000, conversionRate: 0.75 },
  L4: { min: 5000, conversionRate: 1.0 },
};

export const LEVEL_INFO: Record<KarmaLevel, { label: string; perks: string[]; color: string }> = {
  L1: {
    label: 'Apprentice',
    perks: ['Access to easy events', '25% conversion rate', 'Basic badges'],
    color: '#9CA3AF',
  },
  L2: {
    label: 'Contributor',
    perks: ['Access to medium events', '50% conversion rate', 'Featured badges', 'Community posts'],
    color: '#10B981',
  },
  L3: {
    label: 'Champion',
    perks: ['Access to hard events', '75% conversion rate', 'Premium badges', 'Priority booking'],
    color: '#3B82F6',
  },
  L4: {
    label: 'Legend',
    perks: ['All events', '100% conversion rate', 'Exclusive perks', 'Early access', 'CSR recognition'],
    color: '#8B5CF6',
  },
};

// =============================================================================
// BAND GRADIENTS
// =============================================================================

export const BAND_GRADIENTS: Record<KarmaScoreBand, readonly [string, string, string]> = {
  starter: ['#9CA3AF', '#6B7280', '#4B5563'],
  active: ['#10B981', '#059669', '#047857'],
  performer: ['#3B82F6', '#2563EB', '#1D4ED8'],
  leader: ['#8B5CF6', '#7C3AED', '#6D28D9'],
  elite: ['#F59E0B', '#D97706', '#B45309'],
  pinnacle: ['#EF4444', '#DC2626', '#B91C1C'],
};

export const BAND_METADATA: Record<KarmaScoreBand, BandMetadata> = {
  starter: { label: 'Starter', color: '#6B7280', bgColor: '#F3F4F6', minScore: 300, maxScore: 450, perks: ['Basic access'] },
  active: { label: 'Active', color: '#059669', bgColor: '#D1FAE5', minScore: 450, maxScore: 550, perks: ['Events access', 'Basic rewards'] },
  performer: { label: 'Performer', color: '#2563EB', bgColor: '#DBEAFE', minScore: 550, maxScore: 650, perks: ['Better rewards', 'Monthly challenges'] },
  leader: { label: 'Leader', color: '#7C3AED', bgColor: '#EDE9FE', minScore: 650, maxScore: 750, perks: ['Premium perks', 'Leaderboard', 'Badges'] },
  elite: { label: 'Elite', color: '#D97706', bgColor: '#FEF3C7', minScore: 750, maxScore: 850, perks: ['VIP events', 'Max conversion', 'Elite badge'] },
  pinnacle: { label: 'Pinnacle', color: '#DC2626', bgColor: '#FEE2E2', minScore: 850, maxScore: 900, perks: ['Legend status', 'All perks', 'CSR recognition'] },
};

export const TRUST_GRADE_COLORS: Record<TrustGrade, string> = {
  S: '#EF4444',
  A: '#F59E0B',
  B: '#3B82F6',
  C: '#6B7280',
  D: '#9CA3AF',
};

export const MOMENTUM_ICONS: Record<MomentumLabel, string> = {
  cold: 'snow-outline',
  slow: 'leaf-outline',
  steady: 'trending-up-outline',
  hot: 'flame-outline',
  blazing: 'bonfire-outline',
};

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

export const CATEGORY_CONFIG: Record<EventCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  environment: { label: 'Environment', icon: 'leaf', color: '#10B981', bgColor: '#D1FAE5' },
  food: { label: 'Food', icon: 'restaurant', color: '#F59E0B', bgColor: '#FEF3C7' },
  health: { label: 'Health', icon: 'medkit', color: '#EF4444', bgColor: '#FEE2E2' },
  education: { label: 'Education', icon: 'school', color: '#3B82F6', bgColor: '#DBEAFE' },
  community: { label: 'Community', icon: 'people', color: '#8B5CF6', bgColor: '#EDE9FE' },
};

// =============================================================================
// DIFFICULTY CONFIG
// =============================================================================

export const DIFFICULTY_CONFIG: Record<EventDifficulty, { label: string; color: string; karmaMultiplier: number }> = {
  easy: { label: 'Easy', color: '#10B981', karmaMultiplier: 1.0 },
  medium: { label: 'Medium', color: '#F59E0B', karmaMultiplier: 1.5 },
  hard: { label: 'Hard', color: '#EF4444', karmaMultiplier: 2.0 },
};
