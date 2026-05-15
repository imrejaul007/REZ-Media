/**
 * Missions Screen — missions with progress
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import karmaService, { KarmaMission } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

const MISSION_ICONS: Record<string, string> = {
  event: 'calendar',
  streak: 'flame',
  social: 'share-social',
  profile: 'person',
  special: 'star',
};

function MissionCard({ mission }: { mission: KarmaMission }) {
  const progress = Math.min(100, (mission.progress / mission.requirement) * 100);
  const icon = MISSION_ICONS[mission.type] ?? 'flag';

  return (
    <View style={[styles.missionCard, shadows.sm]}>
      <View style={styles.missionHeader}>
        <View style={[styles.missionIconWrap, { backgroundColor: mission.isComplete ? Colors.success + '20' : Colors.primary + '20' }]}>
          <Ionicons
            name={icon as any}
            size={22}
            color={mission.isComplete ? Colors.success : Colors.primary}
          />
        </View>
        <View style={styles.missionInfo}>
          <Text style={styles.missionName}>{mission.name}</Text>
          <Text style={styles.missionDesc}>{mission.description}</Text>
        </View>
        {mission.isComplete && (
          <View style={styles.completeBadge}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          </View>
        )}
      </View>
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={mission.isComplete ? [Colors.success, Colors.success] : [Colors.primary, Colors.primaryLight]}
            style={[styles.progressFill, { width: `${progress}%` }]}
          />
        </View>
        <Text style={styles.progressText}>{mission.progress}/{mission.requirement}</Text>
      </View>
      {mission.reward && (
        <View style={styles.rewardRow}>
          <Ionicons name="gift" size={14} color={Colors.warning} />
          <Text style={styles.rewardText}>+{mission.reward.karmaBonus} KP</Text>
          {mission.reward.badgeId && (
            <Text style={styles.rewardBadge}>+ Badge</Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function Missions() {
  const [missions, setMissions] = useState<KarmaMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMissions = useCallback(async () => {
    try {
      const res = await karmaService.getMissions();
      if (res.success && res.data) {
        setMissions(res.data.missions);
      }
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadMissions(); }, [loadMissions]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMissions();
    setRefreshing(false);
  }, [loadMissions]);

  const completed = missions.filter((m) => m.isComplete).length;
  const total = missions.length;

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Missions" subtitle="Complete & earn" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KarmaHeader title="Missions" subtitle="Complete & earn" showBack />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary */}
        <View style={[styles.summaryCard, shadows.md]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryValue}>{completed}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRight}>
            <Text style={styles.summaryValue}>{total - completed}</Text>
            <Text style={styles.summaryLabel}>In Progress</Text>
          </View>
        </View>

        {/* Missions list */}
        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.base },
  summaryLeft: { flex: 1, alignItems: 'center' },
  summaryRight: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: Colors.gray200 },
  summaryValue: { ...Typography.h2, color: Colors.primary },
  summaryLabel: { fontSize: 13, color: Colors.gray500, marginTop: 4 },
  missionCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  missionHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  missionIconWrap: { width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  missionInfo: { flex: 1, marginLeft: 12 },
  missionName: { ...Typography.bodyBold, color: Colors.gray800 },
  missionDesc: { fontSize: 13, color: Colors.gray500, marginTop: 2 },
  completeBadge: { marginLeft: 8 },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  progressBar: { flex: 1, height: 8, backgroundColor: Colors.gray200, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressText: { fontSize: 12, color: Colors.gray500, fontWeight: '600', minWidth: 40, textAlign: 'right' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4 },
  rewardText: { fontSize: 13, color: Colors.warning, fontWeight: '700' },
  rewardBadge: { fontSize: 11, color: Colors.primary, fontWeight: '600', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
});
