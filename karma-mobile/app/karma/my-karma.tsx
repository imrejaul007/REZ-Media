/**
 * My Karma Screen — passport card, stats, level progress, trust score, badges, earn history, PDF download
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/services/authContext';
import karmaService, { KarmaProfile, EarnRecord, KarmaBadge } from '@/services/karmaService';
import { karmaScoreApi, KarmaScoreResponse } from '@/services/karmaScoreApi';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { LEVEL_INFO, BAND_GRADIENTS, TRUST_GRADE_COLORS } from '@/types/karma';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function PassportCard({ profile }: { profile: KarmaProfile | null }) {
  const level = profile?.level ?? 'L1';
  const info = LEVEL_INFO[level] ?? LEVEL_INFO.L1;

  return (
    <LinearGradient colors={['#7C3AED', '#8B5CF6']} style={styles.passportCard}>
      <View style={styles.passportHeader}>
        <View>
          <Text style={styles.passportTitle}>Karma Passport</Text>
          <Text style={styles.passportSubtitle}>Level {level} — {info.label}</Text>
        </View>
        <View style={styles.passportLevelBadge}>
          <Text style={styles.passportLevelText}>{level}</Text>
        </View>
      </View>
      <View style={styles.passportStats}>
        <View style={styles.passportStat}>
          <Text style={styles.passportStatValue}>{profile?.activeKarma?.toLocaleString() ?? 0}</Text>
          <Text style={styles.passportStatLabel}>Active KP</Text>
        </View>
        <View style={styles.passportStatDivider} />
        <View style={styles.passportStat}>
          <Text style={styles.passportStatValue}>{profile?.lifetimeKarma?.toLocaleString() ?? 0}</Text>
          <Text style={styles.passportStatLabel}>Lifetime KP</Text>
        </View>
        <View style={styles.passportStatDivider} />
        <View style={styles.passportStat}>
          <Text style={styles.passportStatValue}>{((profile?.conversionRate ?? 0) * 100).toFixed(0)}%</Text>
          <Text style={styles.passportStatLabel}>Rate</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function TrustScoreCard({ score }: { score: KarmaScoreResponse | null }) {
  const trustColor = score ? TRUST_GRADE_COLORS[score.trustGrade] ?? Colors.gray500 : Colors.gray500;
  return (
    <View style={[styles.trustCard, shadows.sm]}>
      <View style={styles.trustHeader}>
        <Ionicons name="shield-checkmark" size={20} color={trustColor} />
        <Text style={styles.trustTitle}>Trust Score</Text>
        <Text style={[styles.trustGrade, { color: trustColor }]}>{score?.trustGrade ?? '-'}</Text>
      </View>
      <View style={styles.trustBar}>
        <View style={[styles.trustBarFill, { width: `${score?.percentile ?? 0}%`, backgroundColor: trustColor }]} />
      </View>
      <Text style={styles.trustPercent}>{score?.trustGrade ?? '-'}</Text>
    </View>
  );
}

function StatsRow({ profile }: { profile: KarmaProfile | null }) {
  const stats = [
    { icon: 'checkmark-circle', label: 'Events', value: profile?.eventsCompleted ?? 0, color: Colors.success },
    { icon: 'time', label: 'Hours', value: profile?.totalHours ?? 0, color: Colors.info },
    { icon: 'heart', label: 'Trust', value: `${((profile?.trustScore ?? 0) / 10).toFixed(1)}`, color: Colors.error },
    { icon: 'star', label: 'Badges', value: profile?.badges?.length ?? 0, color: Colors.warning },
  ];
  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statItem}>
          <View style={[styles.statIconWrap, { backgroundColor: stat.color + '15' }]}>
            <Ionicons name={stat.icon as any} size={18} color={stat.color} />
          </View>
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function LevelProgress({ profile }: { profile: KarmaProfile | null }) {
  const levels = ['L1', 'L2', 'L3', 'L4'] as const;
  const currentLevel = profile?.level ?? 'L1';
  const activeKarma = profile?.activeKarma ?? 0;

  return (
    <View style={styles.levelProgressCard}>
      <Text style={styles.cardTitle}>Level Progress</Text>
      <View style={styles.levelBar}>
        {levels.map((lvl, i) => {
          const isActive = lvl === currentLevel;
          const isPast = levels.indexOf(currentLevel) > i;
          return (
            <View key={lvl} style={styles.levelSegment}>
              <View style={[styles.levelDot, { backgroundColor: isActive ? Colors.primary : isPast ? Colors.success : Colors.gray200 }]} />
              <Text style={[styles.levelSegLabel, { color: isActive ? Colors.primary : Colors.gray500 }]}>{lvl}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.levelProgressText}>{activeKarma.toLocaleString()} KP earned</Text>
    </View>
  );
}

function BadgeCard({ badge }: { badge: KarmaBadge }) {
  return (
    <View style={styles.badgeItem}>
      <View style={styles.badgeIcon}>
        <Ionicons name="ribbon" size={24} color={Colors.primary} />
      </View>
      <Text style={styles.badgeName}>{badge.name}</Text>
      <Text style={styles.badgeDate}>{new Date(badge.earnedAt).toLocaleDateString()}</Text>
    </View>
  );
}

function EarnHistoryItem({ record }: { record: EarnRecord }) {
  const statusColors: Record<string, string> = {
    CONVERTED: Colors.success,
    APPROVED_PENDING_CONVERSION: Colors.warning,
    REJECTED: Colors.error,
    ROLLED_BACK: Colors.gray500,
  };
  return (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <Ionicons name="leaf" size={20} color={Colors.primary} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.historyEvent}>{record.eventName ?? 'Event'}</Text>
          <Text style={styles.historyDate}>{new Date(record.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.historyRight}>
        <Text style={[styles.historyKarma, { color: statusColors[record.status] ?? Colors.primary }]}>+{record.karmaEarned} KP</Text>
        <Text style={[styles.historyStatus, { color: statusColors[record.status] ?? Colors.gray500 }]}>{record.status}</Text>
      </View>
    </View>
  );
}

export default function MyKarma() {
  const { user } = useAuth();
  const [karmaProfile, setKarmaProfile] = useState<KarmaProfile | null>(null);
  const [score, setScore] = useState<KarmaScoreResponse | null>(null);
  const [badges, setBadges] = useState<KarmaBadge[]>([]);
  const [history, setHistory] = useState<EarnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const [profileRes, scoreRes, badgesRes, historyRes] = await Promise.all([
        karmaService.getKarmaProfile(user.userId),
        karmaScoreApi.getMyScore(),
        karmaService.getBadges(),
        karmaService.getKarmaHistory(user.userId),
      ]);
      if (profileRes.success && profileRes.data) setKarmaProfile(profileRes.data);
      if (scoreRes) setScore(scoreRes);
      if (badgesRes.success && badgesRes.data) setBadges(badgesRes.data.badges);
      if (historyRes.success && historyRes.data) setHistory(historyRes.data.records);
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      Alert.alert('Download', 'PDF report generation coming soon!');
    } catch (err) {
      Alert.alert('Error', 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="My Karma" subtitle="Your passport" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KarmaHeader
        title="My Karma"
        subtitle="Your passport"
        showBack
        rightAction={
          <Pressable onPress={handleDownload} disabled={downloading}>
            <Ionicons name="download-outline" size={22} color="#fff" />
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <PassportCard profile={karmaProfile} />
        <StatsRow profile={karmaProfile} />
        <LevelProgress profile={karmaProfile} />

        {/* Badges */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.cardTitle}>Badges ({badges.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {badges.map((badge) => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Earn History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.cardTitle}>Earn History</Text>
            {history.slice(0, 10).map((record) => (
              <EarnHistoryItem key={record._id} record={record} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  passportCard: { margin: Spacing.base, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  passportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passportTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  passportSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  passportLevelBadge: { backgroundColor: 'rgba(255,255,255,0.3)', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  passportLevelText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  passportStats: { flexDirection: 'row', marginTop: Spacing.lg },
  passportStat: { flex: 1, alignItems: 'center' },
  passportStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  passportStatValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  passportStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  trustCard: { marginHorizontal: Spacing.base, marginTop: Spacing.base, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base },
  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustTitle: { ...Typography.bodyBold, flex: 1 },
  trustGrade: { fontSize: 20, fontWeight: '800' },
  trustBar: { height: 6, backgroundColor: Colors.gray200, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  trustBarFill: { height: 6, borderRadius: 3 },
  trustPercent: { fontSize: 12, color: Colors.gray500, marginTop: 4, textAlign: 'right' },
  statsRow: { flexDirection: 'row', marginHorizontal: Spacing.base, marginTop: Spacing.base, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, ...shadows.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  statValue: { ...Typography.bodyBold, color: Colors.gray800 },
  statLabel: { fontSize: 11, color: Colors.gray500 },
  levelProgressCard: { marginHorizontal: Spacing.base, marginTop: Spacing.base, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, ...shadows.sm },
  cardTitle: { ...Typography.bodyBold, color: Colors.gray800 },
  levelBar: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  levelSegment: { alignItems: 'center' },
  levelDot: { width: 16, height: 16, borderRadius: 8 },
  levelSegLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  levelProgressText: { fontSize: 12, color: Colors.gray500, marginTop: 8, textAlign: 'center' },
  section: { marginHorizontal: Spacing.base, marginTop: Spacing.xl },
  badgeItem: { alignItems: 'center', marginRight: 16, width: 80 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  badgeName: { fontSize: 12, fontWeight: '600', color: Colors.gray800, textAlign: 'center' },
  badgeDate: { fontSize: 10, color: Colors.gray500, marginTop: 2 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: 8, ...shadows.sm },
  historyLeft: { flexDirection: 'row', alignItems: 'center' },
  historyEvent: { fontSize: 14, fontWeight: '600', color: Colors.gray800 },
  historyDate: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyKarma: { fontSize: 16, fontWeight: '800' },
  historyStatus: { fontSize: 11, marginTop: 2 },
});
