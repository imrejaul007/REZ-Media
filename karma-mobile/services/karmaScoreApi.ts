/**
 * KarmaScore API Client
 * Fetches KarmaScore data from the karma service.
 * Points to https://rez-karma-service.onrender.com/v1/karma/*
 */
import apiClient from './apiClient';

export interface KarmaScoreComponents {
  base: number;
  impact: number;
  relativeRank: number;
  trust: number;
  momentum: number;
}

export interface KarmaScoreResponse {
  userId: string;
  total: number;
  display: number;
  raw: number;
  components: KarmaScoreComponents;
  band: KarmaScoreBand;
  bandMeta: BandMetadata;
  percentile: number;
  trustGrade: TrustGrade;
  momentumLabel: MomentumLabel;
  stability: {
    raw: number;
    display: number;
    lastRawAt: number;
  } | null;
}

export interface ScoreHistoryEntry {
  date: string;
  rawScore: number;
  displayScore: number;
  band: string;
  percentile: number;
  components: KarmaScoreComponents;
  activeKarma: number;
  lifetimeKarma: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  activeKarma: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface MyRankResponse {
  rank: number | null;
  total: number;
  score: number;
  percentile: number;
}

export type KarmaScoreBand = 'starter' | 'active' | 'performer' | 'leader' | 'elite' | 'pinnacle';
export type TrustGrade = 'D' | 'C' | 'B' | 'A' | 'S';
export type MomentumLabel = 'cold' | 'slow' | 'steady' | 'hot' | 'blazing';

export interface BandMetadata {
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
  maxScore: number;
  perks: string[];
}

class KarmaScoreApi {
  async getMyScore(): Promise<KarmaScoreResponse | null> {
    const res = await apiClient.get<KarmaScoreResponse>('/score');
    return res.data ?? null;
  }

  async getScoreHistory(days = 30): Promise<ScoreHistoryEntry[]> {
    const res = await apiClient.get<{ data: { entries: ScoreHistoryEntry[] } }>('/score/history', { days: String(days) });
    return res.data?.data?.entries ?? [];
  }

  async getLeaderboard(limit = 20, offset = 0): Promise<LeaderboardResponse> {
    const res = await apiClient.get<{ data: LeaderboardResponse }>('/score/leaderboard', { limit: String(limit), offset: String(offset) });
    return res.data?.data ?? { entries: [], total: 0, limit, offset, hasMore: false };
  }

  async getMyRank(): Promise<MyRankResponse> {
    const res = await apiClient.get<{ data: MyRankResponse }>('/score/leaderboard/my-rank');
    return res.data?.data ?? { rank: null, total: 0, score: 0, percentile: 0 };
  }
}

export const karmaScoreApi = new KarmaScoreApi();
export default karmaScoreApi;
