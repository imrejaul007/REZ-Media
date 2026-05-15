/**
 * Karma Home Screen — main hub
 * Snapshot card, quick actions, nearby events, how it works, level guide
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
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/services/authContext';
import karmaService, { KarmaProfile, KarmaEvent } from '@/services/karmaService';
import { karmaScoreApi, KarmaScoreResponse } from '@/services/karmaScoreApi';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { CATEGORY_CONFIG, LEVEL_INFO } from '@/types/karma';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function KarmaSnapshotCard({ profile, score }: { profile: KarmaProfile | null; score: KarmaScoreResponse | null }) {
  const activeKarma = profile?.activeKarma ?? 0;
  const lifetimeKarma = profile?.lifetimeKarma ?? 0;
  const level = profile?.level ?? 'L1';
  const scoreDisplay = score?.display ?? 0;

  return (
    <LinearGradient colors={['#7C3AED', '#8B5CF6', '#A78BFA']} style={styles.snapshotCard}>
      <View style={styles.snapshotTop}>
        <View>
          <Text style={styles.snapshotLabel}>Active Karma</Text>
          <Text style={styles.snapshotValue}>{activeKarma.toLocaleString()}</Text>
          <Text style={styles.snapshotLifetime}>Lifetime: {lifetimeKarma.toLocaleString()}</Text>
        </View>
        <View style={styles.snapshotRight}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{level}</Text>
          </View>
          <Text style={styles.levelLabel}>{LEVEL_INFO[level]?.label}</Text>
        </View>
      </View>
      <View style={styles.snapshotBottom}>
        <View style={styles.snapshotStat}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.snapshotStatText}>Score: {scoreDisplay}</Text>
        </View>
        <View style={styles.snapshotStat}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.snapshotStatText}>{profile?.eventsCompleted ?? 0} Events</Text>
        </View>
        <View style={styles.snapshotStat}>
          <Ionicons name="time" size={16} color="#3B82F6" />
          <Text style={styles.snapshotStatText}>{profile?.totalHours ?? 0}h</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function QuickActionCard({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function EventCard({ event }: { event: KarmaEvent }) {
  const cat = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.community;
  return (
    <Pressable style={[styles.eventCard, shadows.md]}>
      <View style={[styles.eventCategoryBadge, { backgroundColor: cat.bgColor }]}>
        <Ionicons name={cat.icon as any} size={14} color={cat.color} />
        <Text style={[styles.eventCategoryText, { color: cat.color }]}>{cat.label}</Text>
      </View>
      <Text style={styles.eventName} numberOfLines={2}>{event.name}</Text>
      <View style={styles.eventMeta}>
        <Ionicons name="location" size={12} color={Colors.gray500} />
        <Text style={styles.eventMetaText}>{event.location.city ?? event.location.address}</Text>
      </View>
      <View style={styles.eventKarma}>
        <Ionicons name="leaf" size={14} color={Colors.primary} />
        <Text style={styles.eventKarmaText}>
          {event.baseKarmaPerHour} KP/hr · Up to {event.maxKarmaPerEvent}
        </Text>
      </View>
    </Pressable>
  );
}

function HowItWorks() {
  const steps = [
    { icon: 'search', title: 'Find Events', desc: 'Browse nearby volunteering events' },
    { icon: 'qr-code', title: 'Check In', desc: 'Scan QR at event start & end' },
    { icon: 'trophy', title: 'Earn Karma', desc: 'Get karma points for your impact' },
    { icon: 'swap-horizontal', title: 'Convert', desc: 'Turn karma into ReZ Coins' },
  ];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How It Works</Text>
      <View style={styles.howItWorksGrid}>
        {steps.map((step, i) => (
          <View key={i} style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <Text style={styles.howStepNumberText}>{i + 1}</Text>
            </View>
            <Ionicons name={step.icon as any} size={22} color={Colors.primary} style={{ marginBottom: 4 }} />
            <Text style={styles.howStepTitle}>{step.title}</Text>
            <Text style={styles.howStepDesc}>{step.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LevelGuide() {
  const levels: Array<{ level: string; label: string; min: string; rate: string; color: string }> = [
    { level: 'L1', label: 'Apprentice', min: '0', rate: '25%', color: '#9CA3AF' },
    { level: 'L2', label: 'Contributor', min: '500', rate: '50%', color: '#10B981' },
    { level: 'L3', label: 'Champion', min: '2,000', rate: '75%', color: '#3B82F6' },
    { level: 'L4', label: 'Legend', min: '5,000', rate: '100%', color: '#8B5CF6' },
  ];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Level Guide</Text>
      {levels.map((lvl) => (
        <View key={lvl.level} style={styles.levelRow}>
          <View style={[styles.levelDot, { backgroundColor: lvl.color }]} />
          <View style={styles.levelInfo}>
            <Text style={styles.levelName}>{lvl.level} — {lvl.label}</Text>
            <Text style={styles.levelMin}>{lvl.min}+ KP</Text>
          </View>
          <View style={[styles.levelRateBadge, { backgroundColor: lvl.color + '20' }]}>
            <Text style={[styles.levelRateText, { color: lvl.color }]}>{lvl.rate} rate</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function KarmaHome() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<KarmaProfile | null>(null);
  const [score, setScore] = useState<KarmaScoreResponse | null>(null);
  const [events, setEvents] = useState<KarmaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const [profileRes, scoreRes, eventsRes] = await Promise.all([
        karmaService.getKarmaProfile(user.userId),
        karmaScoreApi.getMyScore(),
        karmaService.getNearbyEvents(),
      ]);
      if (profileRes.success && profileRes.data) setProfile(profileRes.data);
      if (scoreRes) setScore(scoreRes);
      if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data.events.slice(0, 5));
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

  const quickActions = [
    { icon: 'scan', label: 'Scan QR', screen: '/karma/scan', color: Colors.primary },
    { icon: 'compass', label: 'Explore', screen: '/karma/explore', color: Colors.success },
    { icon: 'wallet', label: 'Wallet', screen: '/karma/wallet', color: Colors.warning },
    { icon: 'medal', label: 'Leaderboard', screen: '/karma/leaderboard', color: Colors.info },
    { icon: 'flag', label: 'Missions', screen: '/karma/missions', color: '#EF4444' },
    { icon: 'people', label: 'Community', screen: '/karma/communities', color: '#8B5CF6' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Karma" subtitle="Your Impact Journey" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KarmaHeader title="Karma" subtitle="Your Impact Journey" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <KarmaSnapshotCard profile={profile} score={score} />

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <QuickActionCard key={action.label} {...action} onPress={() => {}} />
            ))}
          </View>
        </View>

        {/* Nearby Events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nearby Events</Text>
              <Pressable onPress={() => {}}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventsScroll}>
              {events.map((event) => (
                <EventCard key={event._id} event={event} />
              ))}
            </ScrollView>
          </View>
        )}

        <HowItWorks />
        <LevelGuide />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  snapshotCard: { margin: Spacing.base, padding: Spacing.base, borderRadius: BorderRadius.xl },
  snapshotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  snapshotLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  snapshotValue: { fontSize: 40, fontWeight: '800', color: '#fff' },
  snapshotLifetime: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  snapshotRight: { alignItems: 'flex-end' },
  levelBadge: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  levelText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  levelLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  snapshotBottom: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.lg },
  snapshotStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  snapshotStatText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.h4, color: Colors.gray800, marginBottom: Spacing.sm },
  seeAll: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickAction: { width: (SCREEN_WIDTH - Spacing.base * 2 - Spacing.sm * 2) / 3, alignItems: 'center', paddingVertical: Spacing.base },
  quickActionIcon: { width: 48, height: 48, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionLabel: { fontSize: 12, color: Colors.gray700, fontWeight: '600', textAlign: 'center' },
  eventsScroll: { marginHorizontal: -Spacing.base },
  eventCard: { width: 200, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginLeft: Spacing.base },
  eventCategoryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginBottom: 8, gap: 4 },
  eventCategoryText: { fontSize: 11, fontWeight: '600' },
  eventName: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: 6 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  eventMetaText: { fontSize: 12, color: Colors.gray500 },
  eventKarma: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventKarmaText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  howItWorksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  howStep: { width: (SCREEN_WIDTH - Spacing.base * 2 - Spacing.md) / 2, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, alignItems: 'center' },
  howStepNumber: { position: 'absolute', top: -8, left: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  howStepNumberText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  howStepTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray800, marginBottom: 2 },
  howStepDesc: { fontSize: 12, color: Colors.gray500, textAlign: 'center' },
  levelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 8 },
  levelDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  levelInfo: { flex: 1 },
  levelName: { fontSize: 14, fontWeight: '600', color: Colors.gray800 },
  levelMin: { fontSize: 12, color: Colors.gray500 },
  levelRateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  levelRateText: { fontSize: 12, fontWeight: '700' },
});
