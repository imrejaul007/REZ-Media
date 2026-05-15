/**
 * Karma Score Admin Page
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

const BAND_COLORS: Record<string, string> = {
  starter: '#9CA3AF',
  active: '#10B981',
  performer: '#3B82F6',
  leader: '#8B5CF6',
  elite: '#F59E0B',
  pinnacle: '#EF4444',
};

const MOCK_BAND_DISTRIBUTION = [
  { band: 'starter', count: 2847, pct: 57.2 },
  { band: 'active', count: 1203, pct: 24.2 },
  { band: 'performer', count: 532, pct: 10.7 },
  { band: 'leader', count: 231, pct: 4.6 },
  { band: 'elite', count: 82, pct: 1.6 },
  { band: 'pinnacle', count: 28, pct: 0.6 },
];

const MOCK_TOP_PERFORMERS = [
  { userId: 'user_001', displayName: 'Priya S.', score: 887, band: 'pinnacle', karma: 15420 },
  { userId: 'user_002', displayName: 'Rahul K.', score: 872, band: 'elite', karma: 12300 },
  { userId: 'user_003', displayName: 'Anita M.', score: 854, band: 'elite', karma: 9800 },
  { userId: 'user_004', displayName: 'Vikram R.', score: 791, band: 'leader', karma: 8200 },
  { userId: 'user_005', displayName: 'Sunita L.', score: 745, band: 'leader', karma: 7600 },
];

function AdminHeader() {
  return (
    <LinearGradient colors={['#7C3AED', '#8B5CF6', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>KarmaScore Admin</Text>
            <Text style={styles.headerSubtitle}>Score Distribution</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export default function KarmaScoreAdmin() {
  const total = MOCK_BAND_DISTRIBUTION.reduce((s, b) => s + b.count, 0);

  return (
    <View style={styles.container}>
      <AdminHeader />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Overview */}
        <View style={styles.overviewGrid}>
          <View style={[styles.overviewCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.overviewValue}>{total.toLocaleString()}</Text>
            <Text style={styles.overviewLabel}>Total Users</Text>
          </View>
          <View style={[styles.overviewCard, { borderLeftColor: Colors.success }]}>
            <Text style={styles.overviewValue}>4,973</Text>
            <Text style={styles.overviewLabel}>Active Users</Text>
          </View>
          <View style={[styles.overviewCard, { borderLeftColor: Colors.warning }]}>
            <Text style={styles.overviewValue}>587</Text>
            <Text style={styles.overviewLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Band Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Band Distribution</Text>
          {MOCK_BAND_DISTRIBUTION.map((band) => (
            <View key={band.band} style={styles.bandRow}>
              <View style={styles.bandLeft}>
                <View style={[styles.bandDot, { backgroundColor: BAND_COLORS[band.band] }]} />
                <Text style={styles.bandLabel}>{band.band.charAt(0).toUpperCase() + band.band.slice(1)}</Text>
              </View>
              <View style={styles.bandMiddle}>
                <View style={[styles.bandBar, shadows.sm]}>
                  <View
                    style={[
                      styles.bandBarFill,
                      { width: `${band.pct}%`, backgroundColor: BAND_COLORS[band.band] },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.bandRight}>
                <Text style={styles.bandCount}>{band.count.toLocaleString()}</Text>
                <Text style={styles.bandPct}>{band.pct}%</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Top Performers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Performers</Text>
          {MOCK_TOP_PERFORMERS.map((user, i) => (
            <View key={user.userId} style={[styles.performerRow, shadows.sm]}>
              <Text style={styles.performerRank}>#{i + 1}</Text>
              <View style={styles.performerAvatar}>
                <Ionicons name="person" size={20} color={Colors.gray400} />
              </View>
              <View style={styles.performerInfo}>
                <Text style={styles.performerName}>{user.displayName}</Text>
                <View style={[styles.performerBadge, { backgroundColor: (BAND_COLORS[user.band] ?? Colors.gray500) + '20' }]}>
                  <Text style={[styles.performerBadgeText, { color: BAND_COLORS[user.band] ?? Colors.gray500 }]}>
                    {user.band}
                  </Text>
                </View>
              </View>
              <View style={styles.performerScore}>
                <Text style={styles.performerScoreValue}>{user.score}</Text>
                <Text style={styles.performerKarma}>{user.karma.toLocaleString()} KP</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 56 },
  headerLeft: { width: 44, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  adminBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Typography.h4, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  overviewGrid: { flexDirection: 'row', padding: Spacing.base, gap: Spacing.sm },
  overviewCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, borderLeftWidth: 4, ...shadows.sm },
  overviewValue: { ...Typography.h3, color: Colors.gray800 },
  overviewLabel: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.xl },
  sectionTitle: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: Spacing.md },
  bandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bandLeft: { flexDirection: 'row', alignItems: 'center', width: 90 },
  bandDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  bandLabel: { fontSize: 13, color: Colors.gray700 },
  bandMiddle: { flex: 1, marginHorizontal: 10 },
  bandBar: { height: 8, backgroundColor: Colors.gray100, borderRadius: 4, overflow: 'hidden' },
  bandBarFill: { height: 8, borderRadius: 4 },
  bandRight: { width: 70, alignItems: 'flex-end' },
  bandCount: { fontSize: 13, fontWeight: '700', color: Colors.gray800 },
  bandPct: { fontSize: 11, color: Colors.gray500 },
  performerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  performerRank: { fontSize: 16, fontWeight: '800', color: Colors.gray400, width: 30, textAlign: 'center' },
  performerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  performerInfo: { flex: 1, marginLeft: 10 },
  performerName: { ...Typography.bodyBold, color: Colors.gray800 },
  performerBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, marginTop: 4 },
  performerBadgeText: { fontSize: 11, fontWeight: '700' },
  performerScore: { alignItems: 'flex-end' },
  performerScoreValue: { ...Typography.h4, color: Colors.primary },
  performerKarma: { fontSize: 12, color: Colors.gray500 },
});
