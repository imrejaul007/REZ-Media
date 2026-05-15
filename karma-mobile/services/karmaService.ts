/**
 * Karma Service API
 * Handles all Karma feature API calls.
 * Points to https://rez-karma-service.onrender.com/v1/karma/*
 */
import apiClient, { ApiResponse } from './apiClient';

// =============================================================================
// TYPES
// =============================================================================

export interface KarmaProfile {
  userId: string;
  lifetimeKarma: number;
  activeKarma: number;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  conversionRate: number;
  eventsCompleted: number;
  totalHours: number;
  trustScore: number;
  badges: KarmaBadge[];
  nextLevelAt: number;
  decayWarning: string | null;
}

export interface KarmaBadge {
  id: string;
  name: string;
  icon?: string;
  earnedAt: string;
}

export interface KarmaMission {
  id: string;
  type: string;
  name: string;
  description: string;
  requirement: number;
  progress: number;
  isComplete: boolean;
  reward?: { karmaBonus: number; badgeId?: string };
}

export interface LevelInfo {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  activeKarma: number;
  threshold: number;
  nextLevelAt: number;
  conversionRate: number;
  progressPercent: number;
}

export interface KarmaEvent {
  _id: string;
  name: string;
  description: string;
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  image?: string;
  date: string;
  time?: { start: string; end: string };
  location: {
    address: string;
    city?: string;
    coordinates?: { lat: number; lng: number };
  };
  organizer: {
    name: string;
    logo?: string;
    ngoId?: string;
  };
  baseKarmaPerHour: number;
  maxKarmaPerEvent: number;
  expectedDurationHours: number;
  impactUnit?: string;
  impactMultiplier?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  capacity?: { goal: number; enrolled: number };
  maxVolunteers: number;
  confirmedVolunteers: number;
  verificationMode: 'qr' | 'gps' | 'manual';
  gpsRadius?: number;
  isJoined?: boolean;
  qrCodes?: { checkIn: string; checkOut: string };
  totalHours?: number;
}

export interface EventFilters {
  category?: string;
  city?: string;
  status?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface Booking {
  _id: string;
  eventId: string;
  bookingReference: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
  qrCheckedIn: boolean;
  qrCheckedInAt?: string;
  qrCheckedOut: boolean;
  qrCheckedOutAt?: string;
  gpsCheckIn?: GPSCoords;
  gpsCheckOut?: GPSCoords;
  ngoApproved: boolean;
  confidenceScore: number;
  verificationStatus: 'pending' | 'partial' | 'verified' | 'rejected';
  karmaEarned: number;
  earnedAt?: string;
  createdAt: string;
}

export interface GPSCoords {
  lat: number;
  lng: number;
}

export interface CheckInResult {
  success: boolean;
  booking: Booking;
  confidenceScore: number;
  message: string;
  karmaEarned?: number;
}

export interface CheckOutResult {
  success: boolean;
  booking: Booking;
  confidenceScore: number;
  message: string;
  karmaEarned?: number;
  pendingApproval?: boolean;
}

export interface EarnRecord {
  _id: string;
  eventId: string;
  eventName?: string;
  karmaEarned: number;
  activeLevelAtApproval: 'L1' | 'L2' | 'L3' | 'L4';
  conversionRateSnapshot: number;
  status: 'APPROVED_PENDING_CONVERSION' | 'CONVERTED' | 'REJECTED' | 'ROLLED_BACK';
  verificationSignals: {
    qr_in: boolean;
    qr_out: boolean;
    gps_match: boolean;
    ngo_approved: boolean;
    photo_proof: boolean;
  };
  confidenceScore: number;
  createdAt: string;
  approvedAt?: string;
  convertedAt?: string;
  rezCoinsEarned?: number;
}

export interface HistoryResult {
  records: EarnRecord[];
  total: number;
  page: number;
  pages: number;
}

export interface WalletBalance {
  karmaPoints: number;
  rezCoins: number;
  brandedCoins?: Record<string, number>;
}

export interface Transaction {
  _id: string;
  type: 'earned' | 'converted' | 'spent' | 'bonus';
  coinType: 'karma_points' | 'rez_coins' | 'branded_coin';
  amount: number;
  description: string;
  eventId?: string;
  batchId?: string;
  createdAt: string;
}

export interface TransactionResult {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
}

// =============================================================================
// COMMUNITIES TYPES
// =============================================================================

export interface Community {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: 'environment' | 'food' | 'health' | 'education' | 'community';
  coverImage: string;
  icon: string;
  followerCount: number;
  isFollowing: boolean;
  stats: { eventsHosted: number; totalVolunteers: number; totalHours: number };
  recentPosts: CommunityPost[];
}

export interface CommunityPost {
  _id: string;
  communityId: string;
  authorId: string;
  authorType: 'ngo' | 'volunteer';
  content: string;
  mediaUrls: string[];
  karmaEarned: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// API SERVICE
// =============================================================================

class KarmaService {
  async getKarmaProfile(userId: string): Promise<ApiResponse<KarmaProfile>> {
    return apiClient.get<KarmaProfile>(`/user/${userId}`);
  }

  async getKarmaLevel(userId: string): Promise<ApiResponse<LevelInfo>> {
    return apiClient.get<LevelInfo>(`/user/${userId}/level`);
  }

  async getEventDetail(eventId: string): Promise<ApiResponse<KarmaEvent>> {
    return apiClient.get<KarmaEvent>(`/event/${eventId}`);
  }

  async joinEvent(eventId: string): Promise<ApiResponse<Booking>> {
    return apiClient.post<Booking>('/event/join', { eventId });
  }

  async leaveEvent(eventId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/event/${eventId}/leave`);
  }

  async checkIn(
    userId: string,
    eventId: string,
    mode: 'qr' | 'gps',
    qrCode?: string,
    gpsCoords?: GPSCoords,
  ): Promise<ApiResponse<CheckInResult>> {
    const payload: Record<string, unknown> = { userId, eventId, mode };
    if (mode === 'qr' && qrCode) payload.qrCode = qrCode;
    if (mode === 'gps' && gpsCoords) payload.gpsCoords = gpsCoords;
    return apiClient.post<CheckInResult>('/verify/checkin', payload);
  }

  async checkOut(
    userId: string,
    eventId: string,
    mode: 'qr' | 'gps',
    qrCode?: string,
    gpsCoords?: GPSCoords,
  ): Promise<ApiResponse<CheckOutResult>> {
    const payload: Record<string, unknown> = { userId, eventId, mode };
    if (mode === 'qr' && qrCode) payload.qrCode = qrCode;
    if (mode === 'gps' && gpsCoords) payload.gpsCoords = gpsCoords;
    return apiClient.post<CheckOutResult>('/verify/checkout', payload);
  }

  async getKarmaHistory(userId: string, page = 1): Promise<ApiResponse<HistoryResult>> {
    return apiClient.get<HistoryResult>(`/user/${userId}/history`, { page: String(page) });
  }

  async getWalletBalance(coinType: 'karma_points' | 'rez_coins' | 'all' = 'all'): Promise<ApiResponse<WalletBalance>> {
    return apiClient.get<WalletBalance>('/wallet/balance', { coinType });
  }

  async getTransactions(
    coinType: 'karma_points' | 'rez_coins' | 'branded_coin' | 'all' = 'all',
    page = 1,
  ): Promise<ApiResponse<TransactionResult>> {
    return apiClient.get<TransactionResult>('/wallet/transactions', { coinType, page: String(page) });
  }

  async getMyEvents(status?: 'upcoming' | 'ongoing' | 'past'): Promise<ApiResponse<BookingWithEvent[]>> {
    return apiClient.get<BookingWithEvent[]>('/my-bookings', status ? { status } : undefined);
  }

  async getMyBooking(eventId: string): Promise<ApiResponse<Booking | null>> {
    return apiClient.get<Booking | null>(`/booking/${eventId}`);
  }

  async getNearbyEvents(filters?: EventFilters): Promise<ApiResponse<EventListResponse>> {
    return apiClient.get<EventListResponse>('/events', filters as Record<string, string>);
  }

  async getMissions(): Promise<ApiResponse<{ success: boolean; missions: KarmaMission[] }>> {
    return apiClient.get<{ success: boolean; missions: KarmaMission[] }>('/missions');
  }

  async getBadges(): Promise<ApiResponse<{ success: boolean; badges: KarmaBadge[] }>> {
    return apiClient.get<{ success: boolean; badges: KarmaBadge[] }>('/badges');
  }

  async getMicroActions(): Promise<ApiResponse<MicroActionsResult>> {
    return apiClient.get<MicroActionsResult>('/micro-actions');
  }

  async claimMicroAction(actionKey: string): Promise<ApiResponse<ClaimActionResult>> {
    return apiClient.post<ClaimActionResult>('/micro-actions/claim', { actionKey });
  }

  async getLeaderboard(
    scope: 'global' | 'city' | 'cause',
    period: 'all-time' | 'monthly' | 'weekly',
    limit = 50,
    offset = 0,
  ): Promise<ApiResponse<LeaderboardResult>> {
    return apiClient.get<LeaderboardResult>('/leaderboard', { scope, period, limit: String(limit), offset: String(offset) });
  }

  async getMyRank(scope: 'global' | 'city' | 'cause', period: 'all-time' | 'monthly' | 'weekly'): Promise<ApiResponse<UserRankResult>> {
    return apiClient.get<UserRankResult>('/leaderboard/my-rank', { scope, period });
  }

  async getCommunities(): Promise<ApiResponse<Community[]>> {
    return apiClient.get<Community[]>('/communities');
  }

  async getCommunity(slug: string): Promise<ApiResponse<Community>> {
    return apiClient.get<Community>(`/communities/${slug}`);
  }

  async getCommunityFeed(
    slug: string,
    page = 1,
    limit = 20,
  ): Promise<ApiResponse<{ posts: CommunityPost[]; page: number; limit: number }>> {
    return apiClient.get<{ posts: CommunityPost[]; page: number; limit: number }>(
      `/communities/${slug}/feed`,
      { page: String(page), limit: String(limit) },
    );
  }

  async followCommunity(slug: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post<{ success: boolean }>(`/communities/${slug}/follow`, {});
  }

  async unfollowCommunity(slug: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.delete<{ success: boolean }>(`/communities/${slug}/follow`);
  }

  async getRecommendedCommunities(): Promise<ApiResponse<Community[]>> {
    return apiClient.get<Community[]>('/communities/recommended');
  }

  async getMyCommunities(): Promise<ApiResponse<Community[]>> {
    return apiClient.get<Community[]>('/communities/my');
  }
}

export interface BookingWithEvent extends Booking {
  event: {
    _id: string;
    name: string;
    description: string;
    image?: string;
    date: string;
    time?: { start: string; end: string };
    location?: { address: string; city?: string; coordinates?: { lat: number; lng: number } };
    organizer?: { name: string; logo?: string; ngoId?: string };
    category?: string;
    difficulty?: string;
    expectedDurationHours?: number;
    baseKarmaPerHour?: number;
    maxKarmaPerEvent?: number;
    impactUnit?: string;
    impactMultiplier?: number;
    maxVolunteers?: number;
    confirmedVolunteers?: number;
    status?: string;
  };
}

export interface EventListResponse {
  success: boolean;
  events: KarmaEvent[];
  total: number;
}

// =============================================================================
// MICRO-ACTIONS TYPES
// =============================================================================

export interface MicroAction {
  id: string;
  key: string;
  name: string;
  description: string;
  karmaBonus: number;
  icon: string;
  category: 'daily' | 'social' | 'profile' | 'streak' | 'special';
  isAvailable: boolean;
  isLocked: boolean;
  lockReason?: string;
}

export interface CompletedAction {
  id: string;
  actionKey: string;
  completedAt: string;
  karmaEarned: number;
}

export interface MicroActionsResult {
  available: MicroAction[];
  completed: CompletedAction[];
  earnedToday: number;
  totalAvailable: number;
  totalCompleted: number;
}

export interface ClaimActionResult {
  success: boolean;
  karmaEarned: number;
  totalEarnedToday: number;
  newBadge?: KarmaBadge;
}

// =============================================================================
// LEADERBOARD TYPES
// =============================================================================

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatar?: string;
  karmaScore: number;
  level: 'L1' | 'L2' | 'L3' | 'L4';
  activeKarma: number;
  eventsCompleted: number;
  percentile: number;
}

export interface LeaderboardResult {
  scope: 'global' | 'city' | 'cause';
  period: 'all-time' | 'monthly' | 'weekly';
  entries: LeaderboardEntry[];
  userRank: number | null;
  totalParticipants: number;
  updatedAt: string;
}

export interface UserRankResult {
  rank: number;
  totalParticipants: number;
  percentile: number;
}

const karmaService = new KarmaService();
export default karmaService;
