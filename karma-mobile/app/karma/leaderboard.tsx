/**
 * Leaderboard Screen
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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import karmaService, { LeaderboardEntry } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

type Scope = 'global' | 'city' | 'cause';
type Period = 'all-time' | 'monthly' | 'weekly';

const SCOPE_LABELS: Record<Scope, string> = { global: 'Global', city: 'City', cause: 'Cause' };
const PERIOD_LABELS: Record<Period, string> = { 'all-time': 'All Time', monthly: 'Monthly', weekly: 'Weekly' };

function RankBadge({ rank }: { rank: number }) {
  const color = rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : rank === 3 ? '#CD7F32' : Colors.gray400;
  return (
    <View style={[styles.rankBadge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.rankText, { color }]}>#{rank}</Text>
    </View>
  );
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  return (
    <View style={[styles.leaderRow, isCurrentUser && styles.leaderRowCurrent]}>
      <RankBadge rank={entry.rank} />
      <View style={styles.leaderAvatar}>
        <Ionicons name="person" size={20} color={Colors.gray500} />
      </View>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>{entry.displayName}</Text>
        <Text style={styles.leaderLevel}>{entry.level}</Text>
      </View>
      <View style={styles.leaderScore}>
        <Text style={styles.leaderKarma}>{entry.activeKarma.toLocaleString()}</Text>
        <Text style={styles.leaderKarmaLabel}>KP</Text>
      </View>
    </View>
  );
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>('global');
  const [period, setPeriod] = useState<Period>('all-time');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await karmaService.getLeaderboard(scope, period);
      if (res.success && res.data) {
        setEntries(res.data.entries);
        setUserRank(res.data.userRank);
      }
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [scope, period]);

  useFocusEffect(useCallback(() => { loadLeaderboard(); }, [loadLeaderboard]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }, [loadLeaderboard]);

  return (
    <View style={styles.container}>
      <KarmaHeader title="Leaderboard" subtitle="Top performers" showBack />

      {/* Scope filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
        {(Object.keys(SCOPE_LABELS) as Scope[]).map((s) => (
          <Pressable
            key={s}
            style={[styles.filterChip, scope === s && styles.filterChipActive]}
            onPress={() => setScope(s)}
          >
            <Text style={[styles.filterChipText, scope === s && styles.filterChipTextActive]}>{SCOPE_LABELS[s]}</Text>
          </Pressable>
        ))}
        <View style={{ width: 8 }} />
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[styles.filterChip, period === p && styles.filterChipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.filterChipText, period === p && styles.filterChipTextActive]}>{PERIOD_LABELS[p]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* User rank card */}
      {userRank !== null && (
        <View style={[styles.userRankCard, shadows.md]}>
          <Ionicons name="medal" size={20} color={Colors.warning} />
          <Text style={styles.userRankLabel}>Your Rank</Text>
          <Text style={styles.userRankValue}>#{userRank}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="trophy-outline" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
        </View>
      ) : (
        <FlashList
          data={entries}
          
          renderItem={({ item }) => <LeaderboardRow entry={item} isCurrentUser={false} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterScroll: { maxHeight: 50 },
  filterContent: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.white, ...shadows.sm },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  userRankCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.base, marginTop: Spacing.sm, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md },
  userRankLabel: { fontSize: 14, color: Colors.gray600, flex: 1 },
  userRankValue: { ...Typography.h4, color: Colors.warning },
  listContent: { padding: Spacing.base },
  leaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...shadows.sm },
  leaderRowCurrent: { borderWidth: 2, borderColor: Colors.primary },
  rankBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '800' },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  leaderInfo: { flex: 1, marginLeft: 10 },
  leaderName: { ...Typography.bodyBold, color: Colors.gray800 },
  leaderLevel: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  leaderScore: { alignItems: 'flex-end' },
  leaderKarma: { ...Typography.bodyBold, color: Colors.gray800 },
  leaderKarmaLabel: { fontSize: 11, color: Colors.gray500 },
  emptyTitle: { ...Typography.h4, color: Colors.gray500, marginTop: 16 },
});
