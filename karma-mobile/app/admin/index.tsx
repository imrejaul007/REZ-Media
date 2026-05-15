/**
 * Admin Dashboard — Karma management with tabs: Events, Bookings, Leaderboard, Badges, CSR, Communities
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
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { BAND_COLORS } from '@/constants/theme';

// Mock data — in production, replace with API calls
const MOCK_EVENTS = [
  { _id: '1', title: 'Beach Cleanup Drive', category: 'environment', difficulty: 'easy', baseKarma: 50, maxVolunteers: 20, confirmedCount: 12, status: 'published', startDate: '2026-05-01' },
  { _id: '2', title: 'Food Distribution Camp', category: 'food', difficulty: 'medium', baseKarma: 75, maxVolunteers: 15, confirmedCount: 8, status: 'ongoing', startDate: '2026-04-28' },
  { _id: '3', title: 'Health Camp - Rural', category: 'health', difficulty: 'hard', baseKarma: 100, maxVolunteers: 10, confirmedCount: 10, status: 'published', startDate: '2026-05-10' },
  { _id: '4', title: 'School Tutoring', category: 'education', difficulty: 'easy', baseKarma: 40, maxVolunteers: 25, confirmedCount: 5, status: 'draft', startDate: '2026-05-15' },
];

const MOCK_BOOKINGS = [
  { _id: '1', bookingRef: 'KB-001', eventTitle: 'Beach Cleanup', userName: 'Priya S.', status: 'pending', confidenceScore: 0.85, karmaEarned: 0, appliedAt: '2026-04-20' },
  { _id: '2', bookingRef: 'KB-002', eventTitle: 'Food Distribution', userName: 'Rahul K.', status: 'approved', confidenceScore: 0.95, karmaEarned: 75, appliedAt: '2026-04-18' },
  { _id: '3', bookingRef: 'KB-003', eventTitle: 'Health Camp', userName: 'Anita M.', status: 'rejected', confidenceScore: 0.4, karmaEarned: 0, appliedAt: '2026-04-15' },
  { _id: '4', bookingRef: 'KB-004', eventTitle: 'Beach Cleanup', userName: 'Vikram R.', status: 'completed', confidenceScore: 1.0, karmaEarned: 50, appliedAt: '2026-04-10' },
];

const MOCK_LEADERBOARD = [
  { rank: 1, displayName: 'Priya S.', karma: 15420, band: 'pinnacle', level: 'L4' },
  { rank: 2, displayName: 'Rahul K.', karma: 12300, band: 'elite', level: 'L4' },
  { rank: 3, displayName: 'Anita M.', karma: 9800, band: 'elite', level: 'L3' },
  { rank: 4, displayName: 'Vikram R.', karma: 8200, band: 'leader', level: 'L3' },
  { rank: 5, displayName: 'Sunita L.', karma: 7600, band: 'leader', level: 'L3' },
];

const MOCK_BADGES = [
  { _id: '1', name: 'First Event', description: 'Attend your first event', icon: 'ribbon', level: 'bronze', earnedCount: 234, karmaRequired: 0 },
  { _id: '2', name: 'Week Warrior', description: 'Complete events for 7 days', icon: 'flame', level: 'silver', earnedCount: 89, karmaRequired: 500 },
  { _id: '3', name: 'Impact Maker', description: 'Earn 5000 karma points', icon: 'trophy', level: 'gold', earnedCount: 23, karmaRequired: 5000 },
  { _id: '4', name: 'Legend', description: 'Reach level 4', icon: 'star', level: 'platinum', earnedCount: 5, karmaRequired: 5000 },
];

const MOCK_CSR = [
  { _id: '1', companyName: 'TechCorp India', tier: 'gold', budget: 500000, creditsUsed: 320000, totalEventsSponsored: 12, totalVolunteersEngaged: 340 },
  { _id: '2', companyName: 'Green Solutions', tier: 'silver', budget: 200000, creditsUsed: 150000, totalEventsSponsored: 8, totalVolunteersEngaged: 180 },
  { _id: '3', companyName: 'HealthFirst', tier: 'bronze', budget: 100000, creditsUsed: 45000, totalEventsSponsored: 3, totalVolunteersEngaged: 75 },
];

const MOCK_COMMUNITIES = [
  { _id: '1', name: 'Eco Warriors', description: 'Environmental activists', memberCount: 1234, eventCount: 45, cause: 'environment' },
  { _id: '2', name: 'Food for All', description: 'Fight food waste', memberCount: 876, eventCount: 32, cause: 'food' },
  { _id: '3', name: 'Health Heroes', description: 'Healthcare volunteers', memberCount: 654, eventCount: 28, cause: 'health' },
];

type Tab = 'events' | 'bookings' | 'leaderboard' | 'badges' | 'csr' | 'communities';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'bookings', label: 'Bookings', icon: 'ticket' },
  { key: 'leaderboard', label: 'Rankings', icon: 'trophy' },
  { key: 'badges', label: 'Badges', icon: 'ribbon' },
  { key: 'csr', label: 'CSR', icon: 'business' },
  { key: 'communities', label: 'Communities', icon: 'people' },
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
            <Text style={styles.headerTitle}>Karma Admin</Text>
            <Text style={styles.headerSubtitle}>Management Dashboard</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatsBar() {
  const stats = [
    { label: 'Events', value: 156, icon: 'calendar' },
    { label: 'Volunteers', value: '2.4K', icon: 'people' },
    { label: 'Karma Dist.', value: '48K', icon: 'leaf' },
    { label: 'Badges', value: 892, icon: 'ribbon' },
  ];
  return (
    <View style={styles.statsBar}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.statItem}>
          <Ionicons name={stat.icon as any} size={18} color={Colors.primary} />
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function TabBar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => onTabChange(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={activeTab === tab.key ? Colors.primary : Colors.gray500}
          />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EventsTab() {
  return (
    <FlashList
      data={MOCK_EVENTS}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm]}>
          <View style={styles.listItemLeft}>
            <Text style={styles.listItemTitle}>{item.title}</Text>
            <View style={styles.listItemMeta}>
              <View style={[styles.statusBadge, { backgroundColor: item.status === 'published' ? Colors.success + '20' : Colors.gray200 }]}>
                <Text style={[styles.statusBadgeText, { color: item.status === 'published' ? Colors.success : Colors.gray600 }]}>{item.status}</Text>
              </View>
              <Text style={styles.listItemMetaText}>{item.category} · {item.difficulty}</Text>
            </View>
          </View>
          <View style={styles.listItemRight}>
            <Text style={styles.listItemValue}>{item.baseKarma} KP</Text>
            <Text style={styles.listItemMetaText}>{item.confirmedCount}/{item.maxVolunteers}</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function BookingsTab() {
  const statusColors: Record<string, string> = {
    pending: Colors.warning,
    approved: Colors.success,
    rejected: Colors.error,
    completed: Colors.info,
  };
  return (
    <FlashList
      data={MOCK_BOOKINGS}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm]}>
          <View style={styles.listItemLeft}>
            <Text style={styles.listItemTitle}>{item.userName}</Text>
            <Text style={styles.listItemSub}>{item.eventTitle} · {item.bookingRef}</Text>
            <View style={styles.listItemMeta}>
              <View style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] ?? Colors.gray500) + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColors[item.status] ?? Colors.gray500 }]}>{item.status}</Text>
              </View>
              <Text style={styles.listItemMetaText}>Score: {(item.confidenceScore * 100).toFixed(0)}%</Text>
            </View>
          </View>
          <View style={styles.listItemRight}>
            <Text style={styles.listItemValue}>{item.karmaEarned > 0 ? `+${item.karmaEarned}` : '-'} KP</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function LeaderboardTab() {
  return (
    <FlashList
      data={MOCK_LEADERBOARD}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm]}>
          <Text style={styles.rankNum}>#{item.rank}</Text>
          <View style={styles.listItemLeft}>
            <Text style={styles.listItemTitle}>{item.displayName}</Text>
            <Text style={styles.listItemSub}>Level {item.level}</Text>
          </View>
          <View style={styles.listItemRight}>
            <Text style={styles.listItemValue}>{item.karma.toLocaleString()}</Text>
            <Text style={styles.listItemMetaText}>KP</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function BadgesTab() {
  const levelColors: Record<string, string> = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#8B5CF6',
    diamond: '#E5E4E2',
  };
  return (
    <FlashList
      data={MOCK_BADGES}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm]}>
          <View style={[styles.badgeIcon, { backgroundColor: (levelColors[item.level] ?? Colors.gray500) + '20' }]}>
            <Ionicons name="ribbon" size={22} color={levelColors[item.level] ?? Colors.gray500} />
          </View>
          <View style={styles.listItemLeft}>
            <Text style={styles.listItemTitle}>{item.name}</Text>
            <Text style={styles.listItemSub}>{item.description}</Text>
          </View>
          <View style={styles.listItemRight}>
            <Text style={[styles.listItemValue, { color: levelColors[item.level] }]}>{item.earnedCount}</Text>
            <Text style={styles.listItemMetaText}>earned</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function CSRTab() {
  const tierColors: Record<string, string> = {
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  };
  return (
    <FlashList
      data={MOCK_CSR}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm, { flexDirection: 'column' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={[styles.badgeIcon, { backgroundColor: (tierColors[item.tier] ?? Colors.gray500) + '20' }]}>
              <Ionicons name="business" size={22} color={tierColors[item.tier] ?? Colors.gray500} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.listItemTitle}>{item.companyName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: (tierColors[item.tier] ?? Colors.gray500) + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: tierColors[item.tier] ?? Colors.gray500 }]}>{item.tier.toUpperCase()}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View>
              <Text style={styles.listItemValue}>{(item.creditsUsed / 1000).toFixed(0)}K</Text>
              <Text style={styles.listItemMetaText}>/{(item.budget / 1000).toFixed(0)}K used</Text>
            </View>
            <View>
              <Text style={styles.listItemValue}>{item.totalEventsSponsored}</Text>
              <Text style={styles.listItemMetaText}>events</Text>
            </View>
            <View>
              <Text style={styles.listItemValue}>{item.totalVolunteersEngaged}</Text>
              <Text style={styles.listItemMetaText}>volunteers</Text>
            </View>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

function CommunitiesTab() {
  return (
    <FlashList
      data={MOCK_COMMUNITIES}
      
      renderItem={({ item }) => (
        <View style={[styles.listItem, shadows.sm]}>
          <View style={styles.listItemLeft}>
            <Text style={styles.listItemTitle}>{item.name}</Text>
            <Text style={styles.listItemSub}>{item.description}</Text>
          </View>
          <View style={styles.listItemRight}>
            <Text style={styles.listItemValue}>{item.memberCount.toLocaleString()}</Text>
            <Text style={styles.listItemMetaText}>members · {item.eventCount} events</Text>
          </View>
        </View>
      )}
      contentContainerStyle={styles.listContent}
    />
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'events': return <EventsTab />;
      case 'bookings': return <BookingsTab />;
      case 'leaderboard': return <LeaderboardTab />;
      case 'badges': return <BadgesTab />;
      case 'csr': return <CSRTab />;
      case 'communities': return <CommunitiesTab />;
      default: return <EventsTab />;
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader />
      <StatsBar />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 56 },
  headerLeft: { width: 44, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  adminBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Typography.h4, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.white, paddingVertical: Spacing.md, paddingHorizontal: Spacing.base, ...shadows.sm },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { ...Typography.bodyBold, color: Colors.gray800, marginTop: 4 },
  statLabel: { fontSize: 11, color: Colors.gray500, marginTop: 2 },
  tabScroll: { maxHeight: 50 },
  tabContent: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: Spacing.sm },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, gap: 6, backgroundColor: Colors.white, ...shadows.sm },
  tabActive: { backgroundColor: Colors.primary + '15' },
  tabText: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },
  listContent: { padding: Spacing.base },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  listItemLeft: { flex: 1 },
  listItemRight: { alignItems: 'flex-end' },
  listItemTitle: { ...Typography.bodyBold, color: Colors.gray800 },
  listItemSub: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  listItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  listItemMetaText: { fontSize: 12, color: Colors.gray500 },
  listItemValue: { ...Typography.bodyBold, color: Colors.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  rankNum: { fontSize: 16, fontWeight: '800', color: Colors.gray500, width: 40, textAlign: 'center' },
  badgeIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
});
