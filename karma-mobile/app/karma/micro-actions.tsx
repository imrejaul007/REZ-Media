/**
 * Micro Actions Screen
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
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import karmaService, { MicroAction, ClaimActionResult } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

const CATEGORY_COLORS: Record<string, string> = {
  daily: Colors.success,
  social: Colors.info,
  profile: Colors.warning,
  streak: '#EF4444',
  special: Colors.primary,
};

const CATEGORY_ICONS: Record<string, string> = {
  daily: 'sunny',
  social: 'share-social',
  profile: 'person',
  streak: 'flame',
  special: 'star',
};

function ActionCard({
  action,
  onClaim,
}: {
  action: MicroAction;
  onClaim: (key: string) => void;
}) {
  const color = CATEGORY_COLORS[action.category] ?? Colors.primary;
  const icon = CATEGORY_ICONS[action.category] ?? 'flag';

  return (
    <View style={[styles.actionCard, shadows.sm]}>
      <View style={[styles.actionIconWrap, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionName}>{action.name}</Text>
        <Text style={styles.actionDesc}>{action.description}</Text>
        <View style={styles.actionMeta}>
          <View style={[styles.karmaChip, { backgroundColor: color + '20' }]}>
            <Ionicons name="leaf" size={12} color={color} />
            <Text style={[styles.karmaChipText, { color }]}>+{action.karmaBonus} KP</Text>
          </View>
          {action.isLocked && (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={12} color={Colors.gray400} />
              <Text style={styles.lockedText}>Locked</Text>
            </View>
          )}
        </View>
      </View>
      {!action.isLocked && action.isAvailable && (
        <Pressable style={[styles.claimButton, { backgroundColor: color }]} onPress={() => onClaim(action.key)}>
          <Text style={styles.claimButtonText}>Claim</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MicroActions() {
  const [result, setResult] = useState<{ available: MicroAction[]; completed: any[]; earnedToday: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActions = useCallback(async () => {
    try {
      const res = await karmaService.getMicroActions();
      if (res.success && res.data) {
        setResult(res.data);
      }
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadActions(); }, [loadActions]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActions();
    setRefreshing(false);
  }, [loadActions]);

  const handleClaim = useCallback(async (key: string) => {
    try {
      const res = await karmaService.claimMicroAction(key);
      if (res.success && res.data) {
        const data = res.data as ClaimActionResult;
        Alert.alert('Karma Earned!', `+${data.karmaEarned} KP earned today!`, [{ text: 'OK' }]);
        loadActions();
      } else {
        Alert.alert('Error', res.message || 'Failed to claim action');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to claim action');
    }
  }, [loadActions]);

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Micro Actions" subtitle="Quick wins" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  const available = result?.available ?? [];
  const earnedToday = result?.earnedToday ?? 0;

  return (
    <View style={styles.container}>
      <KarmaHeader title="Micro Actions" subtitle="Quick wins" showBack />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary */}
        <View style={[styles.summaryCard, shadows.md]}>
          <Ionicons name="leaf" size={24} color={Colors.success} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.summaryValue}>{earnedToday}</Text>
            <Text style={styles.summaryLabel}>KP earned today</Text>
          </View>
        </View>

        {/* Available actions */}
        {available.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available ({available.length})</Text>
            {available.map((action) => (
              <ActionCard key={action.id} action={action} onClaim={handleClaim} />
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
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  summaryValue: { ...Typography.h2, color: Colors.gray800 },
  summaryLabel: { fontSize: 13, color: Colors.gray500, marginTop: 2 },
  section: { marginTop: Spacing.sm },
  sectionTitle: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: Spacing.sm },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  actionIconWrap: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  actionContent: { flex: 1, marginLeft: 12 },
  actionName: { ...Typography.bodyBold, color: Colors.gray800 },
  actionDesc: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  actionMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  karmaChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, gap: 4 },
  karmaChipText: { fontSize: 12, fontWeight: '700' },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockedText: { fontSize: 12, color: Colors.gray400 },
  claimButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.md },
  claimButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
