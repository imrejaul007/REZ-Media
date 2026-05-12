/**
 * AnalyticsService - Provides usage analytics and reporting
 * Generates insights from call data
 */

import { CallSession } from '../models/CallSession';
import { CallRecord } from '../models/CallRecord';
import { IUsageStats, IAnalyticsSummary, IPaginatedResponse, CallStatus } from '../types';
import { logger } from '../utils/logger';

export class AnalyticsService {
  /**
   * Get usage statistics for a user
   */
  async getUsageStats(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<IUsageStats> {
    const stats = await CallRecord.getAggregateStats(userId, startDate, endDate);
    const sessions = await CallSession.find({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
      status: CallStatus.ENDED,
    }).exec();

    // Calculate peak usage hour
    const hourCounts: Record<number, number> = {};
    sessions.forEach((session) => {
      const hour = session.startTime?.getHours() || 0;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let peakHour = 0;
    let maxCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour, 10);
      }
    });

    // Find most called number
    const destinationCounts: Record<string, { count: number; duration: number }> = {};
    sessions
      .filter((s) => s.callType === 'outbound' && s.calleePhone)
      .forEach((session) => {
        const dest = session.calleePhone!;
        if (!destinationCounts[dest]) {
          destinationCounts[dest] = { count: 0, duration: 0 };
        }
        destinationCounts[dest].count++;
        destinationCounts[dest].duration += session.actualDuration;
      });

    let mostCalledNumber: string | undefined;
    let maxCalls = 0;
    Object.entries(destinationCounts).forEach(([dest, data]) => {
      if (data.count > maxCalls) {
        maxCalls = data.count;
        mostCalledNumber = dest;
      }
    });

    // Calculate success rate
    const totalSessions = await CallSession.countDocuments({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    const callSuccessRate = totalSessions > 0 ? (sessions.length / totalSessions) * 100 : 0;

    return {
      userId,
      period,
      startDate,
      endDate,
      totalSessions: sessions.length,
      totalDuration: stats.totalDuration,
      totalCost: stats.totalCost,
      averageCallDuration: stats.averageDuration,
      peakUsageHour: peakHour,
      mostCalledNumber,
      callSuccessRate: Math.round(callSuccessRate * 100) / 100,
    };
  }

  /**
   * Get analytics summary for a user
   */
  async getAnalyticsSummary(
    userId: string,
    days = 30
  ): Promise<IAnalyticsSummary> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await CallRecord.getAggregateStats(userId, startDate, endDate);
    const sessions = await CallSession.find({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    // Calculate most active day
    const dayCounts: Record<string, number> = {};
    sessions.forEach((session) => {
      const day = session.createdAt.toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    let mostActiveDay = 'Monday';
    let maxDayCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        mostActiveDay = day;
      }
    });

    // Calculate most active hour
    const hourCounts: Record<number, number> = {};
    sessions.forEach((session) => {
      const hour = session.startTime?.getHours() || 0;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let mostActiveHour = 0;
    let maxHourCount = 0;
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxHourCount) {
        maxHourCount = count;
        mostActiveHour = parseInt(hour, 10);
      }
    });

    // Calculate success rate
    const totalAttempts = await CallSession.countDocuments({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    const successfulCalls = sessions.length;
    const callSuccessRate = totalAttempts > 0 ? (successfulCalls / totalAttempts) * 100 : 0;

    // Get top destinations
    const topDestinations = await CallRecord.getTopDestinations(userId, startDate, endDate, 5);

    return {
      userId,
      totalCalls: stats.totalCalls,
      totalDuration: stats.totalDuration,
      totalCost: stats.totalCost,
      averageCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
      averageDurationPerCall: stats.averageDuration,
      mostActiveDay,
      mostActiveHour,
      callSuccessRate: Math.round(callSuccessRate * 100) / 100,
      topDestinations,
    };
  }

  /**
   * Get daily usage trend
   */
  async getDailyTrend(
    userId: string,
    days = 30
  ): Promise<Array<{ date: string; calls: number; duration: number; cost: number }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return CallRecord.getDailyTrend(userId, startDate, endDate);
  }

  /**
   * Get call distribution by type
   */
  async getCallTypeDistribution(
    userId: string,
    days = 30
  ): Promise<{
    outbound: { count: number; totalDuration: number; totalCost: number };
    inbound: { count: number; totalDuration: number; totalCost: number };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sessions = await CallSession.find({
      callerId: userId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: CallStatus.ENDED,
    }).exec();

    const outbound = sessions.filter((s) => s.callType === 'outbound');
    const inbound = sessions.filter((s) => s.callType === 'inbound');

    return {
      outbound: {
        count: outbound.length,
        totalDuration: outbound.reduce((sum, s) => sum + s.actualDuration, 0),
        totalCost: outbound.reduce((sum, s) => sum + s.totalCost, 0),
      },
      inbound: {
        count: inbound.length,
        totalDuration: inbound.reduce((sum, s) => sum + s.actualDuration, 0),
        totalCost: inbound.reduce((sum, s) => sum + s.totalCost, 0),
      },
    };
  }

  /**
   * Get call quality metrics
   */
  async getCallQualityMetrics(
    userId: string,
    days = 30
  ): Promise<{
    totalCalls: number;
    missedCalls: number;
    failedCalls: number;
    successRate: number;
    averageDuration: number;
    averageCost: number;
    longestCall: number;
    shortestCall: number;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const allSessions = await CallSession.find({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
    }).exec();

    const completedSessions = allSessions.filter((s) => s.status === CallStatus.ENDED);
    const missedCalls = allSessions.filter((s) => s.status === CallStatus.MISSED).length;
    const failedCalls = allSessions.filter((s) => s.status === CallStatus.FAILED).length;

    const durations = completedSessions.map((s) => s.actualDuration);
    const costs = completedSessions.map((s) => s.totalCost);

    return {
      totalCalls: allSessions.length,
      missedCalls,
      failedCalls,
      successRate: allSessions.length > 0 ? (completedSessions.length / allSessions.length) * 100 : 0,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      averageCost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
      longestCall: durations.length > 0 ? Math.max(...durations) : 0,
      shortestCall: durations.length > 0 ? Math.min(...durations) : 0,
    };
  }

  /**
   * Get peak usage hours
   */
  async getPeakUsageHours(
    userId: string,
    days = 30
  ): Promise<Array<{ hour: number; count: number; averageDuration: number }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sessions = await CallSession.find({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
      status: CallStatus.ENDED,
    }).exec();

    const hourStats: Record<number, { count: number; totalDuration: number }> = {};

    sessions.forEach((session) => {
      const hour = session.startTime?.getHours() || 0;
      if (!hourStats[hour]) {
        hourStats[hour] = { count: 0, totalDuration: 0 };
      }
      hourStats[hour].count++;
      hourStats[hour].totalDuration += session.actualDuration;
    });

    return Object.entries(hourStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour, 10),
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get cost breakdown
   */
  async getCostBreakdown(
    userId: string,
    days = 30
  ): Promise<{
    totalCost: number;
    averageCostPerCall: number;
    averageCostPerMinute: number;
    mostExpensiveCall: number;
    leastExpensiveCall: number;
    costByDestination: Array<{ destination: string; totalCost: number; count: number }>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sessions = await CallSession.find({
      callerId: userId,
      createdAt: { $gte: startDate, $lte: endDate },
      status: CallStatus.ENDED,
    }).exec();

    const costs = sessions.map((s) => s.totalCost);
    const totalCost = costs.reduce((a, b) => a + b, 0);

    // Cost by destination
    const destinationCosts: Record<string, { cost: number; count: number }> = {};
    sessions.forEach((session) => {
      if (session.calleePhone) {
        if (!destinationCosts[session.calleePhone]) {
          destinationCosts[session.calleePhone] = { cost: 0, count: 0 };
        }
        destinationCosts[session.calleePhone].cost += session.totalCost;
        destinationCosts[session.calleePhone].count++;
      }
    });

    const totalDuration = sessions.reduce((sum, s) => sum + s.actualDuration, 0);
    const totalMinutes = totalDuration / 60;

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      averageCostPerCall: costs.length > 0 ? totalCost / costs.length : 0,
      averageCostPerMinute: totalMinutes > 0 ? totalCost / totalMinutes : 0,
      mostExpensiveCall: costs.length > 0 ? Math.max(...costs) : 0,
      leastExpensiveCall: costs.length > 0 ? Math.min(...costs) : 0,
      costByDestination: Object.entries(destinationCosts)
        .map(([destination, stats]) => ({
          destination,
          totalCost: Math.round(stats.cost * 10000) / 10000,
          count: stats.count,
        }))
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 10),
    };
  }

  /**
   * Get real-time call statistics
   */
  async getRealtimeStats(): Promise<{
    activeCalls: number;
    totalSessionsToday: number;
    totalCostToday: number;
    averageWaitTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeCalls = await CallSession.countDocuments({
      status: { $in: [CallStatus.ACTIVE, CallStatus.CONNECTING, CallStatus.ON_HOLD] },
    }).exec();

    const todaySessions = await CallSession.find({
      createdAt: { $gte: today },
    }).exec();

    const todayCompletedSessions = todaySessions.filter((s) => s.status === CallStatus.ENDED);

    return {
      activeCalls,
      totalSessionsToday: todaySessions.length,
      totalCostToday: todayCompletedSessions.reduce((sum, s) => sum + s.totalCost, 0),
      averageWaitTime: 0, // Would need call start/end times to calculate
    };
  }

  /**
   * Export data for user
   */
  async exportUserData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    sessions: Array<{
      sessionId: string;
      callerId: string;
      calleeId: string;
      callType: string;
      status: string;
      startTime: Date;
      endTime: Date;
      duration: number;
      billableDuration: number;
      totalCost: number;
      billingStatus: string;
    }>;
    summary: IAnalyticsSummary;
  }> {
    const sessions = await CallSession.find({
      $or: [{ callerId: userId }, { calleeId: userId }],
      createdAt: { $gte: startDate, $lte: endDate },
    }).sort({ createdAt: -1 }).exec();

    const summary = await this.getAnalyticsSummary(userId, 365);

    return {
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        callerId: s.callerId,
        calleeId: s.calleeId,
        callType: s.callType,
        status: s.status,
        startTime: s.startTime || s.createdAt,
        endTime: s.endTime || new Date(),
        duration: s.duration,
        billableDuration: s.billableDuration,
        totalCost: s.totalCost,
        billingStatus: s.billingStatus,
      })),
      summary,
    };
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
